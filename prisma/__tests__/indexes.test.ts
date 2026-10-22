import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Database Indexes Audit (PR-007, Issue #126)", () => {
  const schemaPath = path.resolve(__dirname, "../schema.prisma");
  const migrationsDir = path.resolve(__dirname, "../migrations");

  it("declares required composite indexes on Order, Message, and Product in schema.prisma", () => {
    const schema = fs.readFileSync(schemaPath, "utf-8");

    // Order model indexes
    expect(schema).toMatch(/model Order\s*\{[\s\S]*?@@index\(\[seller_id,\s*created_at\]\)[\s\S]*?\}/);
    expect(schema).toMatch(/model Order\s*\{[\s\S]*?@@index\(\[seller_id,\s*state\]\)[\s\S]*?\}/);

    // Message model indexes
    expect(schema).toMatch(/model Message\s*\{[\s\S]*?@@index\(\[seller_id,\s*created_at\]\)[\s\S]*?\}/);
    expect(schema).toMatch(/model Message\s*\{[\s\S]*?@@index\(\[order_id\]\)[\s\S]*?\}/);
    expect(schema).toMatch(/model Message\s*\{[\s\S]*?@@index\(\[recipient_phone\]\)[\s\S]*?\}/);

    // Product model indexes
    expect(schema).toMatch(/model Product\s*\{[\s\S]*?@@index\(\[seller_id,\s*available,\s*deleted_at\]\)[\s\S]*?\}/);
  });

  it("contains a dedicated migration file applying the performance indexes", () => {
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
    const indexMigrationDir = entries.find((e) => e.isDirectory() && e.name.includes("indexes"));
    expect(indexMigrationDir).toBeDefined();

    const sqlPath = path.join(migrationsDir, indexMigrationDir!.name, "migration.sql");
    expect(fs.existsSync(sqlPath)).toBe(true);

    const sql = fs.readFileSync(sqlPath, "utf-8");
    expect(sql).toContain('CREATE INDEX "orders_seller_id_created_at_idx" ON "orders"("seller_id", "created_at");');
    expect(sql).toContain('CREATE INDEX "orders_seller_id_state_idx" ON "orders"("seller_id", "state");');
    expect(sql).toContain('CREATE INDEX "messages_seller_id_created_at_idx" ON "messages"("seller_id", "created_at");');
    expect(sql).toContain('CREATE INDEX "messages_order_id_idx" ON "messages"("order_id");');
    expect(sql).toContain('CREATE INDEX "messages_recipient_phone_idx" ON "messages"("recipient_phone");');
    expect(sql).toContain('CREATE INDEX "products_seller_id_available_deleted_at_idx" ON "products"("seller_id", "available", "deleted_at");');
  });
});
