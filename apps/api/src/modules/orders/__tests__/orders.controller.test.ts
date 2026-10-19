import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { OrdersController } from "../orders.controller";

describe("OrdersController (BE-013 - Dashboard Order Actions & Reissue)", () => {
  let controller: OrdersController;
  let ordersServiceMock: any;
  let prismaMock: any;

  const authenticatedSeller = {
    id: "seller-123",
    business_name: "Habesha Cafe",
    slug: "habesha-cafe",
  };

  const otherSeller = {
    id: "seller-999",
    business_name: "Other Cafe",
  };

  const mockOrder = {
    id: "order-1",
    seller_id: authenticatedSeller.id,
    number: 1001,
    buyer_name: "Abebe Bikila",
    buyer_phone: "0911223344",
    sms_consent: true,
    consent_wording: "Send SMS updates",
    consent_at: new Date(),
    state: "new",
    total_santim: 85000,
    created_at: new Date(),
    order_items: [],
    order_events: [],
  };

  beforeEach(() => {
    ordersServiceMock = {
      transitionOrderState: vi.fn(),
      completeWithPickupCode: vi.fn(),
      reissuePickupCode: vi.fn(),
    };

    prismaMock = {
      order: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };

    controller = new OrdersController(ordersServiceMock, prismaMock);
  });

  describe("Ownership Enforcement", () => {
    it("throws NotFoundException when order does not exist", async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        controller.acceptOrder(authenticatedSeller, "non-existent-id")
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when order belongs to another seller", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: "order-other",
        seller_id: otherSeller.id,
        number: 1002,
      });

      await expect(
        controller.acceptOrder(authenticatedSeller, "order-other")
      ).rejects.toThrow(ForbiddenException);

      expect(ordersServiceMock.transitionOrderState).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/orders and GET /api/orders/:id", () => {
    it("lists orders belonging to the authenticated seller", async () => {
      prismaMock.order.findMany.mockResolvedValue([mockOrder]);

      const result = await controller.getOrders(authenticatedSeller);

      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
        where: { seller_id: authenticatedSeller.id },
        include: { order_items: true },
        orderBy: { created_at: "desc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockOrder.id);
    });

    it("retrieves single order if owned by seller", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        ...mockOrder,
        seller: authenticatedSeller,
      });

      const result = await controller.getOrder(authenticatedSeller, mockOrder.id);

      expect(result.id).toBe(mockOrder.id);
      expect(result.number).toBe(1001);
    });

    it("throws ForbiddenException when retrieving single order of another seller", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        ...mockOrder,
        seller_id: otherSeller.id,
      });

      await expect(
        controller.getOrder(authenticatedSeller, mockOrder.id)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("POST /api/orders/:id/accept", () => {
    it("enforces seller ownership and calls transitionOrderState with 'accepted' and 'seller_dash'", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: mockOrder.id,
        seller_id: authenticatedSeller.id,
      });
      ordersServiceMock.transitionOrderState.mockResolvedValue({
        success: true,
        orderId: mockOrder.id,
        currentState: "accepted",
      });

      const res = await controller.acceptOrder(authenticatedSeller, mockOrder.id);

      expect(ordersServiceMock.transitionOrderState).toHaveBeenCalledWith(
        mockOrder.id,
        "accepted",
        "seller_dash"
      );
      expect(res.currentState).toBe("accepted");
    });
  });

  describe("POST /api/orders/:id/reject", () => {
    it("enforces seller ownership and calls transitionOrderState with 'rejected' and 'seller_dash'", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: mockOrder.id,
        seller_id: authenticatedSeller.id,
      });
      ordersServiceMock.transitionOrderState.mockResolvedValue({
        success: true,
        orderId: mockOrder.id,
        currentState: "rejected",
      });

      const res = await controller.rejectOrder(authenticatedSeller, mockOrder.id);

      expect(ordersServiceMock.transitionOrderState).toHaveBeenCalledWith(
        mockOrder.id,
        "rejected",
        "seller_dash"
      );
      expect(res.currentState).toBe("rejected");
    });
  });

  describe("POST /api/orders/:id/ready", () => {
    it("enforces seller ownership and calls transitionOrderState with 'ready' and 'seller_dash'", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: mockOrder.id,
        seller_id: authenticatedSeller.id,
      });
      ordersServiceMock.transitionOrderState.mockResolvedValue({
        success: true,
        orderId: mockOrder.id,
        currentState: "ready",
        pickupCode: "4321",
      });

      const res = await controller.readyOrder(authenticatedSeller, mockOrder.id);

      expect(ordersServiceMock.transitionOrderState).toHaveBeenCalledWith(
        mockOrder.id,
        "ready",
        "seller_dash"
      );
      expect(res.currentState).toBe("ready");
      expect(res.pickupCode).toBe("4321");
    });
  });

  describe("POST /api/orders/:id/complete", () => {
    it("enforces seller ownership and calls completeWithPickupCode with 'seller_dash'", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: mockOrder.id,
        seller_id: authenticatedSeller.id,
      });
      ordersServiceMock.completeWithPickupCode.mockResolvedValue({
        success: true,
        orderId: mockOrder.id,
        currentState: "completed",
      });

      const res = await controller.completeOrder(
        authenticatedSeller,
        mockOrder.id,
        { code: "4321" }
      );

      expect(ordersServiceMock.completeWithPickupCode).toHaveBeenCalledWith(
        mockOrder.id,
        "4321",
        "seller_dash"
      );
      expect(res.currentState).toBe("completed");
    });
  });

  describe("POST /api/orders/:id/pickup-code/reissue", () => {
    it("enforces seller ownership and calls reissuePickupCode with 'seller_dash'", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: mockOrder.id,
        seller_id: authenticatedSeller.id,
      });
      ordersServiceMock.reissuePickupCode.mockResolvedValue({
        success: true,
        orderId: mockOrder.id,
        pickupCode: "8765",
      });

      const res = await controller.reissuePickupCode(
        authenticatedSeller,
        mockOrder.id
      );

      expect(ordersServiceMock.reissuePickupCode).toHaveBeenCalledWith(
        mockOrder.id,
        "seller_dash"
      );
      expect(res.pickupCode).toBe("8765");
    });
  });
});
