import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Supabase Row Level Security (RLS) Quality Gate (rls_disabled_in_public)", () => {
  const migrationsDir = path.resolve(__dirname, "../migrations");
  const rlsMigrationDir = path.join(
    migrationsDir,
    "20261028120000_enable_rls_on_public_tables"
  );
  const sqlPath = path.join(rlsMigrationDir, "migration.sql");

  it("contains the dedicated RLS migration directory and migration.sql file", () => {
    expect(fs.existsSync(rlsMigrationDir)).toBe(true);
    expect(fs.existsSync(sqlPath)).toBe(true);
  });

  it("enables Row Level Security on all 14 public application tables", () => {
    const sql = fs.readFileSync(sqlPath, "utf-8");

    const expectedTables = [
      "sellers",
      "products",
      "customers",
      "orders",
      "order_items",
      "order_events",
      "phone_verifications",
      "pickup_codes",
      "action_tokens",
      "messages",
      "message_events",
      "suppression_list",
      "rate_counters",
      "payment_transactions",
    ];

    for (const table of expectedTables) {
      expect(
        sql,
        `Expected table '${table}' to have ENABLE ROW LEVEL SECURITY in migration`
      ).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it("enforces default-deny posture and does not introduce permissive public policies (USING (true))", () => {
    const sql = fs.readFileSync(sqlPath, "utf-8");

    // Must never contain wildcard bypass policies that expose private data to anon
    expect(sql).not.toMatch(/CREATE\s+POLICY.*USING\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/CREATE\s+POLICY.*TO\s+public/i);
    expect(sql).not.toMatch(/CREATE\s+POLICY.*TO\s+anon/i);
  });
});
