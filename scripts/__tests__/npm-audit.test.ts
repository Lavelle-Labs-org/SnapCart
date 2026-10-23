import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

/**
 * PR-016 Acceptance Test: Dependency Vulnerability Remediation (Issue #135)
 *
 * Acceptance Criterion:
 * - Zero critical or high severity vulnerabilities reported in npm audit.
 */
describe("Dependency Vulnerability Audit (PR-016, Issue #135)", () => {
  it("npm audit reports zero critical severity vulnerabilities", () => {
    let output = "";
    try {
      output = execSync("npm audit --json", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err: any) {
      output = err.stdout?.toString() || "";
    }

    expect(output.length).toBeGreaterThan(0);
    const data = JSON.parse(output);
    const criticalCount = data.metadata?.vulnerabilities?.critical ?? 0;
    expect(criticalCount).toBe(0);
  }, 25000);

  it("npm audit reports zero high severity vulnerabilities", () => {
    let output = "";
    try {
      output = execSync("npm audit --json", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err: any) {
      output = err.stdout?.toString() || "";
    }

    expect(output.length).toBeGreaterThan(0);
    const data = JSON.parse(output);
    const highCount = data.metadata?.vulnerabilities?.high ?? 0;
    expect(highCount).toBe(0);
  }, 25000);

  it("npm audit --audit-level=high exits with exit code 0", () => {
    let exitCode = 0;
    try {
      execSync("npm audit --audit-level=high", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err: any) {
      exitCode = err.status ?? 1;
    }

    expect(exitCode).toBe(0);
  }, 25000);
});
