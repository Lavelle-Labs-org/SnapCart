/**
 * Unit & Integration Tests for Pre-Commit Secret Scanner (INFRA-004)
 *
 * Verifies:
 * 1. Pattern detection for live SMSHub keys, webhook secrets, private keys, and forbidden files.
 * 2. Whitelisting of harmless text and test keys (`sk_test_...`, `.env.example`).
 * 3. Acceptance criteria: Staging a dummy file with `sk_live_...` fails the check with exit code 1.
 */

import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  scanContent,
  checkForbiddenFiles,
  scanStagedFiles,
} from "../check-secrets";

// Construct test tokens dynamically to prevent static scanners from flagging test fixtures
const MOCK_LIVE_API_KEY = ["sk", "live", "abcdef1234567890abcdef"].join("_");
const MOCK_WEBHOOK_SECRET = ["whsec", "supersecrettoken123456"].join("_");
const MOCK_PRIVATE_KEY_HEADER = ["-----BEGIN", "RSA", "PRIVATE", "KEY-----"].join(" ");
const MOCK_PRIVATE_KEY_FOOTER = ["-----END", "RSA", "PRIVATE", "KEY-----"].join(" ");
const MOCK_AWS_KEY = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
const MOCK_DUMMY_LIVE_SECRET = ["sk", "live", "dummy_secret_key_1234567890abcdef"].join("_");

describe("Pre-Commit Secret Scanner (INFRA-004)", () => {
  describe("scanContent() pattern detection", () => {
    it("passes for clean code and harmless documentation", () => {
      const cleanContent = `
        export const config = {
          apiUrl: "https://api.ord.et",
          timeoutMs: 5000,
        };
      `;
      const violations = scanContent(cleanContent, "clean.ts");
      expect(violations).toHaveLength(0);
    });

    it("allows test-mode mock keys (e.g. sk_test_...) without flagging as live leak", () => {
      const testKeyContent = `
        process.env.SMSHUB_API_KEY = "sk_test_dummy_mock_key_123456789";
      `;
      const violations = scanContent(testKeyContent, "test-setup.ts");
      expect(violations).toHaveLength(0);
    });

    it("detects live SMSHub API key (sk_live_...)", () => {
      const leakedLiveKey = `
        const apiKey = "${MOCK_LIVE_API_KEY}";
      `;
      const violations = scanContent(leakedLiveKey, "config.ts");
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0].rule).toBe("SMSHub Live API Key");
      expect(violations[0].snippet).toContain("sk_live");
      expect(violations[0].snippet).toContain("[REDACTED]");
    });

    it("detects SMSHub webhook secret (whsec_...)", () => {
      const leakedWebhookSecret = `
        const webhookSecret = "${MOCK_WEBHOOK_SECRET}";
      `;
      const violations = scanContent(leakedWebhookSecret, "webhooks.ts");
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0].rule).toBe("SMSHub Webhook Secret");
    });

    it("detects unencrypted private cryptographic keys", () => {
      const privateKey = `
        ${MOCK_PRIVATE_KEY_HEADER}
        MIIEowIBAAKCAQEA0Y...
        ${MOCK_PRIVATE_KEY_FOOTER}
      `;
      const violations = scanContent(privateKey, "server.key");
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0].rule).toBe("Cryptographic Private Key");
    });

    it("detects AWS Access Key ID pattern", () => {
      const awsKey = `
        AWS_ACCESS_KEY_ID = "${MOCK_AWS_KEY}";
      `;
      const violations = scanContent(awsKey, "aws.ts");
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0].rule).toBe("AWS Access Key ID");
    });
  });

  describe("checkForbiddenFiles() file hygiene", () => {
    it("flags forbidden unencrypted .env files", () => {
      const files = [".env", ".env.local", ".env.production", "apps/api/.env"];
      const violations = checkForbiddenFiles(files);
      expect(violations).toHaveLength(4);
      expect(violations.every((v) => v.rule === "Forbidden Secret File")).toBe(true);
    });

    it("allows .env.example and .env.*.example with placeholder templates", () => {
      const files = [
        ".env.example",
        ".env.development.example",
        ".env.production.example",
        "apps/api/.env.example",
        "apps/web/.env.production.example",
      ];
      const violations = checkForbiddenFiles(files);
      expect(violations).toHaveLength(0);
    });

    it("flags private key files and certificate files", () => {
      const files = ["server.key", "cert.pem", "id_rsa", "id_ed25519"];
      const violations = checkForbiddenFiles(files);
      expect(violations).toHaveLength(4);
    });
  });

  describe("Git Staged Integration & Acceptance Criterion", () => {
    const dummySecretFile = path.join(process.cwd(), "dummy-secret-test.tmp");
    const dummyCleanFile = path.join(process.cwd(), "dummy-clean-test.tmp");

    afterEach(() => {
      // Ensure cleanup of any staged dummy files
      for (const file of [dummySecretFile, dummyCleanFile]) {
        if (fs.existsSync(file)) {
          try {
            execSync(`git reset HEAD "${file}"`, { stdio: "ignore" });
          } catch {}
          try {
            fs.unlinkSync(file);
          } catch {}
        }
      }
    });

    it("acceptance criterion: staging a dummy file with sk_live_... fails the check script with code 1", () => {
      // 1. Create dummy file containing sk_live_...
      fs.writeFileSync(
        dummySecretFile,
        `SMSHUB_API_KEY="${MOCK_DUMMY_LIVE_SECRET}"\n`
      );

      // 2. Stage dummy file in git
      execSync(`git add "${dummySecretFile}"`);

      // 3. Verify scanStagedFiles() detects failure
      const scanResult = scanStagedFiles();
      expect(scanResult.passed).toBe(false);
      expect(scanResult.violations.some((v) => v.rule === "SMSHub Live API Key")).toBe(true);

      // 4. Verify running the CLI script directly exits with code 1
      let processFailed = false;
      let exitCode: number | null = null;
      try {
        execSync("npx tsx scripts/check-secrets.ts", {
          encoding: "utf8",
          stdio: "pipe",
        });
      } catch (err: any) {
        processFailed = true;
        exitCode = err.status;
      }

      expect(processFailed).toBe(true);
      expect(exitCode).toBe(1);
    }, 25000);

    it("staging a clean dummy file passes the check script with code 0", () => {
      // 1. Create clean dummy file
      fs.writeFileSync(dummyCleanFile, "// Clean harmless comment\nexport const x = 42;\n");

      // 2. Stage clean dummy file
      execSync(`git add "${dummyCleanFile}"`);

      // 3. Verify scanStagedFiles() passes
      const scanResult = scanStagedFiles();
      expect(scanResult.passed).toBe(true);
      expect(scanResult.violations).toHaveLength(0);

      // 4. Verify running the CLI script directly exits with code 0
      const output = execSync("npx tsx scripts/check-secrets.ts", {
        encoding: "utf8",
        stdio: "pipe",
      });
      expect(output).toContain("PASS");
    }, 25000);
  });
});
