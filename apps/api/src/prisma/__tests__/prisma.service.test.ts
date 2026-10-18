import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaService } from "../prisma.service";
import { PrismaClient } from "@prisma/client";

describe("PrismaService Lifecycle & Client Tests (apps/api)", () => {
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = new PrismaService({
      databaseUrl: "postgresql://postgres:postgres@localhost:5432/order_by_sms_test?schema=public",
    });
  });

  it("extends PrismaClient with full entity delegate access", () => {
    expect(prismaService).toBeInstanceOf(PrismaClient);
    expect(typeof prismaService.seller).toBe("object");
    expect(typeof prismaService.order).toBe("object");
    expect(typeof prismaService.product).toBe("object");
    expect(typeof prismaService.message).toBe("object");
    expect(typeof prismaService.$connect).toBe("function");
    expect(typeof prismaService.$disconnect).toBe("function");
  });

  it("calls $connect on module initialization", async () => {
    const connectSpy = vi
      .spyOn(prismaService, "$connect")
      .mockResolvedValueOnce(undefined);

    await prismaService.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it("calls $disconnect on module destruction", async () => {
    const disconnectSpy = vi
      .spyOn(prismaService, "$disconnect")
      .mockResolvedValueOnce(undefined);

    await prismaService.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it("propagates connection errors in non-test environments", async () => {
    const prevEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      vi.spyOn(prismaService, "$connect").mockRejectedValueOnce(
        new Error("Database connection refused: 5432")
      );

      await expect(prismaService.onModuleInit()).rejects.toThrowError(
        "Database connection refused: 5432"
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
    }
  });

  it("logs warning and does not crash in test environment if database is unreachable", async () => {
    const prevEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    try {
      vi.spyOn(prismaService, "$connect").mockRejectedValueOnce(
        new Error("Database connection refused: 5432")
      );

      await expect(prismaService.onModuleInit()).resolves.toBeUndefined();
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
    }
  });
});
