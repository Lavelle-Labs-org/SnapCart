import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      message: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock("../../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

import { SignJWT } from "jose";

process.env.SESSION_SECRET = "test_session_secret_32_characters_long_minimum";

const cookieStoreMock = {
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(cookieStoreMock),
}));

async function createTestToken(sellerId: string): Promise<string> {
  const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET!);
  return await new SignJWT({ sellerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: redirectMock,
}));

import MessagesLogPage from "../page";
import MessagesClient from "../messages-client";

describe("MessagesLogPage (FE-012, Issue #35 - /dashboard/messages)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreMock.get.mockReturnValue(undefined);
    delete process.env.SMS_SENDING_PAUSED;
    delete process.env.SMS_BALANCE_LOW;
  });

  describe("Messages Database Query & Mapping", () => {
    it("queries database and passes mapped messages to MessagesClient", async () => {
      const now = new Date("2026-10-20T10:00:00Z");
      const mockMessages = [
        {
          id: "msg_1",
          seller_id: "seller-123",
          order_id: "ord-1",
          recipient_phone: "0911223344",
          event: "seller_new_order",
          text: "Order #1001",
          status: "sent",
          skip_reason: null,
          smshub_message_id: "smshub-1",
          network: "ethio_telecom",
          credits_used: 1,
          attempts: 1,
          created_at: now,
          updated_at: now,
        },
        {
          id: "msg_2",
          seller_id: "seller-123",
          order_id: null,
          recipient_phone: "0799887766",
          event: "buyer_order_ready",
          text: "Order #1002 ready",
          status: "failed",
          skip_reason: null,
          smshub_message_id: null,
          network: "safaricom",
          credits_used: 0,
          attempts: 1,
          created_at: now,
          updated_at: now,
        },
      ];

      prismaMock.message.findMany.mockResolvedValue(mockMessages);
      const token = await createTestToken("seller-123");
      cookieStoreMock.get.mockReturnValue({ value: token });

      const element = await MessagesLogPage({});

      expect(element).toBeDefined();
      expect(element.type).toBe(MessagesClient);

      expect(prismaMock.message.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { seller_id: "seller-123" },
            { order: { seller_id: "seller-123" } },
          ],
        },
        orderBy: { created_at: "desc" },
      });

      const props = element.props;
      expect(props.initialMessages).toHaveLength(2);
      expect(props.initialMessages[0].id).toBe("msg_1");
      expect(props.initialMessages[0].status).toBe("sent");
      expect(props.initialMessages[1].id).toBe("msg_2");
      expect(props.initialMessages[1].status).toBe("failed");
      expect(props.isSendingPaused).toBe(false);
      expect(props.isLowBalance).toBe(false);
    });

    it("ignores spoofed searchParams.sellerId and scopes query to cookie sellerId", async () => {
      prismaMock.message.findMany.mockResolvedValue([]);
      const token = await createTestToken("seller-authenticated");
      cookieStoreMock.get.mockReturnValue({ value: token });

      await MessagesLogPage({
        searchParams: Promise.resolve({ sellerId: "seller-victim-idor" }),
      });

      expect(prismaMock.message.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { seller_id: "seller-authenticated" },
            { order: { seller_id: "seller-authenticated" } },
          ],
        },
        orderBy: { created_at: "desc" },
      });
    });

    it("passes isSendingPaused=true when SMS_SENDING_PAUSED is configured (Acceptance Criterion 4)", async () => {
      process.env.SMS_SENDING_PAUSED = "true";
      prismaMock.message.findMany.mockResolvedValue([]);
      const token = await createTestToken("seller-123");
      cookieStoreMock.get.mockReturnValue({ value: token });

      const element = await MessagesLogPage({});
      expect(element.props.isSendingPaused).toBe(true);
    });

    it("passes isLowBalance=true when SMS_BALANCE_LOW is configured (Acceptance Criterion 4)", async () => {
      process.env.SMS_BALANCE_LOW = "true";
      prismaMock.message.findMany.mockResolvedValue([]);
      const token = await createTestToken("seller-123");
      cookieStoreMock.get.mockReturnValue({ value: token });

      const element = await MessagesLogPage({});
      expect(element.props.isLowBalance).toBe(true);
    });
  });

  describe("Authentication Enforcement", () => {
    it("redirects unauthenticated users to /login", async () => {
      await MessagesLogPage({});
      expect(redirectMock).toHaveBeenCalledWith("/login");
    });
  });
});
