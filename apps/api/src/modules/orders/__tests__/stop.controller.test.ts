import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { StopController } from "../stop.controller";
import { OrdersService } from "../orders.service";

describe("StopController (BE-015 - Buyer SMS Opt-Out & Suppression)", () => {
  let controller: StopController;
  let ordersServiceMock: any;
  const validToken = "valid_stop_token_1234567890";

  beforeEach(() => {
    vi.clearAllMocks();

    ordersServiceMock = {
      optOutBuyer: vi.fn(),
      getStopTokenDetails: vi.fn(),
    };

    controller = new StopController(ordersServiceMock as unknown as OrdersService);
  });

  describe("POST /api/stop/:token", () => {
    it("successfully delegates opt-out to OrdersService and returns suppression confirmation", async () => {
      ordersServiceMock.optOutBuyer.mockResolvedValue({
        suppressed: true,
        phone: "09•• ••• 344",
      });

      const result = await controller.optOut(validToken);

      expect(ordersServiceMock.optOutBuyer).toHaveBeenCalledWith(validToken);
      expect(result).toEqual({
        suppressed: true,
        phone: "09•• ••• 344",
      });
    });

    it("propagates NotFoundException when token is invalid or expired", async () => {
      ordersServiceMock.optOutBuyer.mockRejectedValue(
        new NotFoundException("Invalid or unknown stop token")
      );

      await expect(controller.optOut("bad_token")).rejects.toThrow(
        NotFoundException
      );
      expect(ordersServiceMock.optOutBuyer).toHaveBeenCalledWith("bad_token");
    });

    it("handles idempotent re-opt-out when already suppressed", async () => {
      ordersServiceMock.optOutBuyer.mockResolvedValue({
        suppressed: true,
        phone: "09•• ••• 344",
        alreadySuppressed: true,
      });

      const result = await controller.optOut(validToken);

      expect(result.suppressed).toBe(true);
      expect(result.alreadySuppressed).toBe(true);
    });
  });

  describe("GET /api/stop/:token (Read-Only Preview)", () => {
    it("delegates to getStopTokenDetails and returns preview metadata without side effects", async () => {
      ordersServiceMock.getStopTokenDetails.mockResolvedValue({
        valid: true,
        orderNumber: 1043,
        shopName: "Habesha Cafe",
        maskedPhone: "09•• ••• 344",
        alreadySuppressed: false,
      });

      const result = await controller.getStopDetails(validToken);

      expect(ordersServiceMock.getStopTokenDetails).toHaveBeenCalledWith(validToken);
      expect(result).toEqual({
        valid: true,
        orderNumber: 1043,
        shopName: "Habesha Cafe",
        maskedPhone: "09•• ••• 344",
        alreadySuppressed: false,
      });
    });

    it("propagates NotFoundException when token is invalid", async () => {
      ordersServiceMock.getStopTokenDetails.mockRejectedValue(
        new NotFoundException("Stop link has expired")
      );

      await expect(controller.getStopDetails("expired_token")).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
