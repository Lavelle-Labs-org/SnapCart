import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException, ForbiddenException, HttpException, HttpStatus } from "@nestjs/common";
import { MessagesService } from "../messages.service";
import { SMSHubError } from "../../smshub/smshub.service";

describe("MessagesService (BE-016)", () => {
  let service: MessagesService;
  let prismaMock: any;
  let smshubServiceMock: any;

  const seller1 = { id: "seller-111" };
  const seller2 = { id: "seller-222" };

  beforeEach(() => {
    prismaMock = {
      message: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
      },
      suppressionList: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    smshubServiceMock = {
      sendSMS: vi.fn(),
    };

    service = new MessagesService(prismaMock, smshubServiceMock);
  });

  describe("getMessages", () => {
    it("returns formatted messages for the seller ordered by created_at desc", async () => {
      const now = new Date();
      prismaMock.message.findMany.mockResolvedValue([
        {
          id: "msg-1",
          seller_id: "seller-111",
          order_id: "ord-1",
          recipient_phone: "0911223344",
          event: "seller_new_order",
          text: "Order #1001 confirmed",
          status: "sent",
          skip_reason: null,
          smshub_message_id: "smshub-123",
          request_id: "req-1",
          network: "ethio_telecom",
          credits_used: 1,
          error_type: null,
          attempts: 1,
          created_at: now,
          updated_at: now,
        },
      ]);

      const result = await service.getMessages("seller-111");

      expect(prismaMock.message.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { seller_id: "seller-111" },
            { order: { seller_id: "seller-111" } },
          ],
        },
        orderBy: { created_at: "desc" },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "msg-1",
        sellerId: "seller-111",
        orderId: "ord-1",
        recipientPhone: "0911223344",
        event: "seller_new_order",
        text: "Order #1001 confirmed",
        status: "sent",
        skipReason: null,
        smshubMessageId: "smshub-123",
        requestId: "req-1",
        network: "ethio_telecom",
        creditsUsed: 1,
        errorType: null,
        attempts: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });
  });

  describe("resendMessage", () => {
    it("throws NotFoundException if message does not exist", async () => {
      prismaMock.message.findUnique.mockResolvedValue(null);

      await expect(service.resendMessage("non-existent-id", seller1.id)).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws ForbiddenException if message belongs to another seller", async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        id: "msg-1",
        seller_id: seller2.id,
        order_id: null,
        status: "failed",
      });

      await expect(service.resendMessage("msg-1", seller1.id)).rejects.toThrow(
        ForbiddenException
      );
    });

    it("throws HttpException with INVALID_MESSAGE_STATUS if message status is sent", async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        id: "msg-1",
        seller_id: seller1.id,
        status: "sent",
        attempts: 1,
      });

      await expect(service.resendMessage("msg-1", seller1.id)).rejects.toThrow(
        HttpException
      );

      try {
        await service.resendMessage("msg-1", seller1.id);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = err.getResponse();
        expect(response.code).toBe("INVALID_MESSAGE_STATUS");
      }
    });

    it("throws HttpException with INVALID_MESSAGE_STATUS if message status is skipped", async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        id: "msg-1",
        seller_id: seller1.id,
        status: "skipped",
        attempts: 0,
      });

      await expect(service.resendMessage("msg-1", seller1.id)).rejects.toThrow(
        HttpException
      );
    });

    it("throws HttpException with INVALID_MESSAGE_STATUS if message status is test_passed", async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        id: "msg-1",
        seller_id: seller1.id,
        status: "test_passed",
        attempts: 1,
      });

      await expect(service.resendMessage("msg-1", seller1.id)).rejects.toThrow(
        HttpException
      );
    });

    it("dispatches via SMSHubService and updates message row when status is failed", async () => {
      const now = new Date();
      prismaMock.message.findUnique.mockResolvedValue({
        id: "msg-failed",
        seller_id: seller1.id,
        recipient_phone: "0911223344",
        text: "Order #1001 ready for pickup",
        status: "failed",
        attempts: 1,
        smshub_message_id: null,
        created_at: now,
        updated_at: now,
      });

      smshubServiceMock.sendSMS.mockResolvedValue({
        status: "success",
        data: {
          message_id: "smshub-new-999",
          network: "ethio_telecom",
          credits_used: 1,
          request_id: "req-new-1",
        },
      });

      prismaMock.message.update.mockResolvedValue({
        id: "msg-failed",
        seller_id: seller1.id,
        order_id: null,
        recipient_phone: "0911223344",
        event: "ready",
        text: "Order #1001 ready for pickup",
        status: "sent",
        skip_reason: null,
        smshub_message_id: "smshub-new-999",
        request_id: "req-new-1",
        network: "ethio_telecom",
        credits_used: 1,
        error_type: null,
        attempts: 2,
        created_at: now,
        updated_at: now,
      });

      const result = await service.resendMessage("msg-failed", seller1.id);

      expect(smshubServiceMock.sendSMS).toHaveBeenCalledWith({
        msisdn: "0911223344",
        text: "Order #1001 ready for pickup",
        trackLinks: false,
      });

      expect(prismaMock.message.update).toHaveBeenCalledWith({
        where: { id: "msg-failed" },
        data: {
          status: "sent",
          smshub_message_id: "smshub-new-999",
          request_id: "req-new-1",
          network: "ethio_telecom",
          credits_used: 1,
          error_type: null,
          attempts: 2,
        },
      });

      expect(result.resent).toBe(true);
      expect(result.message.status).toBe("sent");
      expect(result.message.attempts).toBe(2);
      expect(result.message.smshubMessageId).toBe("smshub-new-999");
    });

    it("dispatches successfully when status is unknown", async () => {
      const now = new Date();
      prismaMock.message.findUnique.mockResolvedValue({
        id: "msg-unknown",
        seller_id: seller1.id,
        recipient_phone: "0799887766",
        text: "Order #1002 accepted",
        status: "unknown",
        attempts: 1,
        created_at: now,
        updated_at: now,
      });

      smshubServiceMock.sendSMS.mockResolvedValue({
        status: "success",
        data: {
          message_id: "smshub-unknown-fixed",
          network: "safaricom",
          credits_used: 2,
          request_id: "req-unknown-fixed",
        },
      });

      prismaMock.message.update.mockResolvedValue({
        id: "msg-unknown",
        seller_id: seller1.id,
        order_id: null,
        recipient_phone: "0799887766",
        event: "accepted",
        text: "Order #1002 accepted",
        status: "sent",
        skip_reason: null,
        smshub_message_id: "smshub-unknown-fixed",
        request_id: "req-unknown-fixed",
        network: "safaricom",
        credits_used: 2,
        error_type: null,
        attempts: 2,
        created_at: now,
        updated_at: now,
      });

      const result = await service.resendMessage("msg-unknown", seller1.id);

      expect(result.resent).toBe(true);
      expect(prismaMock.message.update).toHaveBeenCalledWith({
        where: { id: "msg-unknown" },
        data: {
          status: "sent",
          smshub_message_id: "smshub-unknown-fixed",
          request_id: "req-unknown-fixed",
          network: "safaricom",
          credits_used: 2,
          error_type: null,
          attempts: 2,
        },
      });
    });

    it("handles test mode where would_send is true and sets status to test_passed", async () => {
      const now = new Date();
      prismaMock.message.findUnique.mockResolvedValue({
        id: "msg-test",
        seller_id: seller1.id,
        recipient_phone: "0911223344",
        text: "Test SMS",
        status: "failed",
        attempts: 1,
        created_at: now,
        updated_at: now,
      });

      smshubServiceMock.sendSMS.mockResolvedValue({
        status: "success",
        data: {
          would_send: true,
          message_id: "smshub-test-id",
          credits_used: 1,
        },
      });

      prismaMock.message.update.mockResolvedValue({
        id: "msg-test",
        seller_id: seller1.id,
        order_id: null,
        recipient_phone: "0911223344",
        event: "test",
        text: "Test SMS",
        status: "test_passed",
        skip_reason: null,
        smshub_message_id: "smshub-test-id",
        request_id: null,
        network: null,
        credits_used: 1,
        error_type: null,
        attempts: 2,
        created_at: now,
        updated_at: now,
      });

      const result = await service.resendMessage("msg-test", seller1.id);

      expect(result.resent).toBe(true);
      expect(prismaMock.message.update).toHaveBeenCalledWith({
        where: { id: "msg-test" },
        data: {
          status: "test_passed",
          smshub_message_id: "smshub-test-id",
          request_id: null,
          network: null,
          credits_used: 1,
          error_type: null,
          attempts: 2,
        },
      });
    });

    it("updates row to failed and increments attempts if SMSHub fails again during resend", async () => {
      const now = new Date();
      prismaMock.message.findUnique.mockResolvedValue({
        id: "msg-fail-again",
        seller_id: seller1.id,
        recipient_phone: "0911223344",
        text: "Order #1001",
        status: "failed",
        attempts: 1,
        created_at: now,
        updated_at: now,
      });

      smshubServiceMock.sendSMS.mockRejectedValue(
        new SMSHubError({
          message: "SMSHub 502 Bad Gateway",
          status: 502,
          errorType: "bad_gateway",
          requestId: "req-err-502",
        })
      );

      prismaMock.message.update.mockResolvedValue({
        id: "msg-fail-again",
        seller_id: seller1.id,
        order_id: null,
        recipient_phone: "0911223344",
        event: "test",
        text: "Order #1001",
        status: "failed",
        skip_reason: null,
        smshub_message_id: null,
        request_id: "req-err-502",
        network: null,
        credits_used: null,
        error_type: "bad_gateway",
        attempts: 2,
        created_at: now,
        updated_at: now,
      });

      const result = await service.resendMessage("msg-fail-again", seller1.id);

      expect(result.resent).toBe(false);
      expect(prismaMock.message.update).toHaveBeenCalledWith({
        where: { id: "msg-fail-again" },
        data: {
          status: "failed",
          error_type: "bad_gateway",
          request_id: "req-err-502",
          attempts: 2,
        },
      });
    });

    it("marks message as skipped if recipient phone is in suppression list", async () => {
      const now = new Date();
      prismaMock.message.findUnique.mockResolvedValue({
        id: "msg-suppressed",
        seller_id: seller1.id,
        recipient_phone: "0911223344",
        text: "Order #1001",
        status: "failed",
        attempts: 1,
        created_at: now,
        updated_at: now,
      });

      prismaMock.suppressionList.findUnique.mockResolvedValue({
        phone: "0911223344",
        reason: "opted_out",
      });

      prismaMock.message.update.mockResolvedValue({
        id: "msg-suppressed",
        seller_id: seller1.id,
        order_id: null,
        recipient_phone: "0911223344",
        event: "test",
        text: "Order #1001",
        status: "skipped",
        skip_reason: "opted_out",
        smshub_message_id: null,
        request_id: null,
        network: null,
        credits_used: null,
        error_type: null,
        attempts: 2,
        created_at: now,
        updated_at: now,
      });

      const result = await service.resendMessage("msg-suppressed", seller1.id);

      expect(smshubServiceMock.sendSMS).not.toHaveBeenCalled();
      expect(result.resent).toBe(false);
      expect(prismaMock.message.update).toHaveBeenCalledWith({
        where: { id: "msg-suppressed" },
        data: {
          status: "skipped",
          skip_reason: "opted_out",
          attempts: 2,
        },
      });
    });
  });
});
