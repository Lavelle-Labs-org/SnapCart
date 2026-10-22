import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Prisma Migrations Baseline (PR-006, Issue #125)", () => {
  const migrationsDir = path.resolve(__dirname, "../migrations");
  const lockFilePath = path.join(migrationsDir, "migration_lock.toml");

  it("contains prisma/migrations directory with migration_lock.toml configured for postgresql", () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.existsSync(lockFilePath)).toBe(true);

    const lockContent = fs.readFileSync(lockFilePath, "utf-8");
    expect(lockContent).toMatch(/provider\s*=\s*["']postgresql["']/);
  });

  it("contains an initial versioned migration directory containing migration.sql", () => {
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
    const migrationDirs = entries.filter((e) => e.isDirectory() && e.name.endsWith("_init"));
    expect(migrationDirs.length).toBeGreaterThanOrEqual(1);

    const initDir = path.join(migrationsDir, migrationDirs[0].name);
    const sqlPath = path.join(initDir, "migration.sql");
    expect(fs.existsSync(sqlPath)).toBe(true);
  });

  it("defines all required database tables and enums in the initial migration", () => {
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
    const initDirName = entries.find((e) => e.isDirectory() && e.name.endsWith("_init"))!.name;
    const sql = fs.readFileSync(path.join(migrationsDir, initDirName, "migration.sql"), "utf-8");

    // Enums
    expect(sql).toContain('CREATE TYPE "OrderState"');
    expect(sql).toContain('CREATE TYPE "MessageStatus"');

    // Tables
    const requiredTables = [
      "sellers",
      "products",
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
    ];

    for (const table of requiredTables) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }

    // Critical Foreign Keys & Cascades
    expect(sql).toContain('ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey"');
    expect(sql).toContain('ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey"');
    expect(sql).toContain('ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey"');
    expect(sql).toContain('ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey"');

    // Critical Unique Indexes
    expect(sql).toContain('CREATE UNIQUE INDEX "sellers_phone_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "sellers_slug_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "orders_seller_id_number_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "pickup_codes_order_id_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "action_tokens_token_hash_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "messages_smshub_message_id_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "message_events_delivery_id_key"');
  });
});
