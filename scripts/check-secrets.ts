/**
 * Pre-Commit Secret Scanning & Repository Hygiene Check (INFRA-004)
 *
 * Scans git staged files and diffs for accidental secret leakage:
 * - SMSHub Live API Keys: `sk_live_...`
 * - SMSHub Webhook Secrets: `whsec_...`
 * - Private RSA/EC/SSH Keys
 * - Unencrypted .env files (except .env.example)
 *
 * Usage:
 *   npm run check:secrets
 *   tsx scripts/check-secrets.ts [--staged | --all | <filepath>]
 *
 * References:
 *   docs/06-security-and-privacy.md (Section 3, Section 9.3)
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface SecretViolation {
  file: string;
  line?: number;
  rule: string;
  snippet?: string;
  reason: string;
}

export interface ScanResult {
  passed: boolean;
  violations: SecretViolation[];
  scannedFilesCount: number;
}

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  reason: string;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "SMSHub Live API Key",
    pattern: /sk_live_[a-zA-Z0-9_\-]{8,}/,
    reason: "SMSHub live API key detected. Never commit live production credentials to version control.",
  },
  {
    name: "SMSHub Webhook Secret",
    pattern: /whsec_[a-zA-Z0-9_\-]{8,}/,
    reason: "SMSHub webhook secret detected. Webhook secrets must remain exclusively in environment variables.",
  },
  {
    name: "Cryptographic Private Key",
    pattern: /-----BEGIN (RSA|EC|OPENSSH|DSA|PGP)?\s*PRIVATE KEY-----/,
    reason: "Unencrypted private cryptographic key block detected.",
  },
  {
    name: "AWS Access Key ID",
    pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
    reason: "AWS Access Key ID detected.",
  },
];

export const FORBIDDEN_FILE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /^\.env(?!\.example$)/i,
    reason: "Live or local .env file must never be committed. Use .env.example with mock values.",
  },
  {
    pattern: /(^|\/)\.env\.(local|production|staging|test\.local)($|\.)/i,
    reason: "Environment credential file must not be committed to git.",
  },
  {
    pattern: /\.(pem|key|pkcs12|pfx|p12)$/i,
    reason: "Cryptographic certificate/key file detected.",
  },
  {
    pattern: /(^|\/)(id_rsa|id_ed25519|id_ecdsa)$/i,
    reason: "SSH private key file detected.",
  },
];

function runGitCommand(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, {
      cwd: cwd || process.cwd(),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Scans a single string of text (e.g. file content or git diff chunk) for secrets.
 */
export function scanContent(content: string, filename = "buffer"): SecretViolation[] {
  const violations: SecretViolation[] = [];
  const lines = content.split(/\r?\n/);

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Skip git diff deletion lines
    if (line.startsWith("-") && !line.startsWith("---")) {
      continue;
    }

    // Strip leading '+' in git diff added lines for pattern matching
    const testLine = line.startsWith("+") && !line.startsWith("+++") ? line.substring(1) : line;

    for (const rule of SECRET_PATTERNS) {
      if (rule.pattern.test(testLine)) {
        // Redact match for security reporting
        const match = testLine.match(rule.pattern)?.[0] || "";
        const redacted =
          match.length > 8 ? `${match.slice(0, 7)}...[REDACTED]` : "[REDACTED_SECRET]";

        violations.push({
          file: filename,
          line: idx + 1,
          rule: rule.name,
          snippet: redacted,
          reason: rule.reason,
        });
        break;
      }
    }
  }

  return violations;
}

/**
 * Checks file paths against forbidden file naming rules.
 */
export function checkForbiddenFiles(filePaths: string[]): SecretViolation[] {
  const violations: SecretViolation[] = [];

  for (const rawPath of filePaths) {
    const normalized = rawPath.replace(/\\/g, "/").trim();
    if (!normalized) continue;

    for (const rule of FORBIDDEN_FILE_PATTERNS) {
      const basename = path.basename(normalized);
      if (rule.pattern.test(basename) || rule.pattern.test(normalized)) {
        violations.push({
          file: normalized,
          rule: "Forbidden Secret File",
          reason: rule.reason,
        });
        break;
      }
    }
  }

  return violations;
}

/**
 * Scans git staged files and staged diff.
 */
export function scanStagedFiles(cwd?: string): ScanResult {
  const stagedFilesRaw = runGitCommand("git diff --cached --name-only", cwd);
  const stagedFiles = stagedFilesRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  const violations: SecretViolation[] = [];

  // 1. Check staged filenames
  violations.push(...checkForbiddenFiles(stagedFiles));

  // 2. Check staged diff content per file
  for (const file of stagedFiles) {
    const fileDiff = runGitCommand(`git diff --cached -U0 -- "${file}"`, cwd);
    if (fileDiff) {
      violations.push(...scanContent(fileDiff, file));
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    scannedFilesCount: stagedFiles.length,
  };
}

/**
 * Scans specified disk files directly.
 */
export function scanFiles(filePaths: string[], baseDir = process.cwd()): ScanResult {
  const violations: SecretViolation[] = [];

  violations.push(...checkForbiddenFiles(filePaths));

  for (const filePath of filePaths) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);
    if (!fs.existsSync(fullPath)) continue;

    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) continue;

    try {
      const content = fs.readFileSync(fullPath, "utf8");
      violations.push(...scanContent(content, filePath));
    } catch {
      // Ignore binary or unreadable files
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    scannedFilesCount: filePaths.length,
  };
}

/**
 * CLI Runner
 */
export function runCli(): void {
  console.log("=== Order-by-SMS: Secret Scanning & Repository Hygiene (INFRA-004) ===");

  const args = process.argv.slice(2);
  let result: ScanResult;

  if (args.length > 0 && !args[0].startsWith("-")) {
    console.log(`Scanning explicit file(s): ${args.join(", ")}`);
    result = scanFiles(args);
  } else {
    console.log("Scanning git staged changes...");
    result = scanStagedFiles();
  }

  console.log(`Scanned ${result.scannedFilesCount} file(s).`);

  if (!result.passed) {
    console.error("\n❌ SECRET SCAN FAILED! Potential secret credentials detected:\n");
    for (const v of result.violations) {
      const loc = v.line ? `${v.file}:${v.line}` : v.file;
      console.error(`  ✖ [${v.rule}] at ${loc}`);
      console.error(`    Reason:  ${v.reason}`);
      if (v.snippet) {
        console.error(`    Snippet: ${v.snippet}`);
      }
      console.error();
    }
    console.error("⛔ Commit rejected. Revoke leaked keys and remove secrets before committing.\n");
    process.exit(1);
  }

  console.log("✔ PASS: No secrets or forbidden credential files detected.\n");
  process.exit(0);
}

// Auto-run if executed directly as script
if (
  process.argv[1] &&
  (process.argv[1].endsWith("check-secrets.ts") || process.argv[1].endsWith("check-secrets.js"))
) {
  runCli();
}
