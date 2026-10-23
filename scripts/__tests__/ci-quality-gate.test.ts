import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * PR-018 Acceptance Test: CI Quality Gate Workflow Expansion (Issue #137)
 *
 * Verifies that .github/workflows/ci.yml includes:
 * 1. Code quality and linting via `npm run lint`
 * 2. High & critical dependency vulnerability check via `npm audit --audit-level=high`
 * 3. Repository hygiene / secret scanning via `npm run check:secrets`
 * 4. TypeScript type checking via `npx tsc --noEmit`
 * 5. Vitest test suite execution
 * 6. Production build verification
 */
describe("CI Quality Gate Workflow Configuration (PR-018, Issue #137)", () => {
  const ciWorkflowPath = path.resolve(__dirname, "../../.github/workflows/ci.yml");

  it("ci.yml workflow file exists in .github/workflows", () => {
    expect(fs.existsSync(ciWorkflowPath)).toBe(true);
  });

  it("ci.yml contains linting step `npm run lint`", () => {
    const content = fs.readFileSync(ciWorkflowPath, "utf-8");
    expect(content).toMatch(/run:\s*npm run lint/);
  });

  it("ci.yml contains high/critical dependency audit step `npm audit --audit-level=high`", () => {
    const content = fs.readFileSync(ciWorkflowPath, "utf-8");
    expect(content).toMatch(/run:\s*npm audit --audit-level=high/);
  });

  it("ci.yml retains secret scanning, typechecking, test execution, and production build", () => {
    const content = fs.readFileSync(ciWorkflowPath, "utf-8");
    expect(content).toMatch(/run:\s*npm run check:secrets/);
    expect(content).toMatch(/run:\s*npx tsc --noEmit/);
    expect(content).toMatch(/run:\s*npx vitest run/);
    expect(content).toMatch(/run:\s*npm run build/);
  });
});
