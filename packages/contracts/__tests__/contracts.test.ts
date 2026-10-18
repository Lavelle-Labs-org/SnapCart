import { describe, it, expect } from "vitest";
import {
  CONTRACTS_VERSION,
  normalizeEthiopianPhone,
  maskPhoneNumber,
  validateStateTransition,
  isTerminalState,
  getNextAllowedStates,
  createSuccessResponse,
  createErrorResponse,
  ALLOWED_TRANSITIONS,
} from "@order-by-sms/contracts";
import type {
  OrderDto,
  ProductDto,
  SellerDto,
  ApiResponse,
  ApiErrorResponse,
  ApiErrorCode,
  SignupInput,
  LoginInput,
  StorefrontDto,
  CheckoutResponse,
} from "@order-by-sms/contracts";

describe("Shared Contracts Package (@order-by-sms/contracts)", () => {
  it("exports contracts version identifier", () => {
    expect(CONTRACTS_VERSION).toBe("0.1.0");
  });

  describe("Phone Utilities", () => {
    it("normalizes Ethio Telecom format", () => {
      const res = normalizeEthiopianPhone("0911223344");
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe("0911223344");
      expect(res.network).toBe("ethio_telecom");
    });

    it("normalizes Safaricom format", () => {
      const res = normalizeEthiopianPhone("0711223344");
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe("0711223344");
      expect(res.network).toBe("safaricom");
    });

    it("masks phone numbers correctly", () => {
      expect(maskPhoneNumber("0911223344")).toBe("09•• ••• 344");
    });
  });

  describe("Order State Machine", () => {
    it("validates forward transitions and terminal states", () => {
      expect(validateStateTransition("new", "accepted").allowed).toBe(true);
      expect(validateStateTransition("accepted", "ready").allowed).toBe(true);
      expect(validateStateTransition("ready", "completed").allowed).toBe(true);
      expect(validateStateTransition("new", "ready").allowed).toBe(false);
      expect(isTerminalState("completed")).toBe(true);
      expect(isTerminalState("rejected")).toBe(true);
      expect(isTerminalState("new")).toBe(false);
      expect(getNextAllowedStates("new")).toEqual(["accepted", "rejected"]);
    });

    it("maintains the full allowed transition structure", () => {
      expect(ALLOWED_TRANSITIONS.new).toEqual(["accepted", "rejected"]);
      expect(ALLOWED_TRANSITIONS.accepted).toEqual(["ready"]);
      expect(ALLOWED_TRANSITIONS.ready).toEqual(["completed"]);
      expect(ALLOWED_TRANSITIONS.rejected).toEqual([]);
      expect(ALLOWED_TRANSITIONS.completed).toEqual([]);
    });
  });

  describe("API Envelopes", () => {
    it("creates standard success envelope", () => {
      const envelope: ApiResponse<{ id: string }> = createSuccessResponse({
        id: "ord_123",
      });
      expect(envelope).toEqual({
        success: true,
        data: { id: "ord_123" },
      });
    });

    it("creates standard error envelope", () => {
      const code: ApiErrorCode = "ORDER_ALREADY_ACCEPTED";
      const errorEnvelope: ApiErrorResponse = createErrorResponse(
        code,
        "This order has already been accepted.",
        { orderId: "ord_123" }
      );
      expect(errorEnvelope).toEqual({
        success: false,
        error: {
          code: "ORDER_ALREADY_ACCEPTED",
          message: "This order has already been accepted.",
          details: { orderId: "ord_123" },
        },
      });
    });
  });

  describe("Domain Types & DTO Compatibility", () => {
    it("allows instantiating typed DTO structures cleanly", () => {
      const seller: SellerDto = {
        id: "sell_1",
        businessName: "Habesha Coffee",
        smsName: "Habesha",
        phone: "0911223344",
        slug: "habesha-coffee",
        createdAt: new Date().toISOString(),
      };
      expect(seller.businessName).toBe("Habesha Coffee");

      const product: ProductDto = {
        id: "prod_1",
        sellerId: seller.id,
        name: "Yirgacheffe Pour Over",
        priceSantim: 25000,
        available: true,
        createdAt: new Date().toISOString(),
      };
      expect(product.priceSantim).toBe(25000);

      const order: OrderDto = {
        id: "ord_1",
        sellerId: seller.id,
        number: 1001,
        buyerName: "Abebe Bikila",
        buyerPhone: "0922334455",
        smsConsent: true,
        consentWording: "I agree to receive order status updates via SMS.",
        consentAt: new Date().toISOString(),
        state: "new",
        totalSantim: 25000,
        createdAt: new Date().toISOString(),
        items: [
          {
            id: "item_1",
            orderId: "ord_1",
            productId: product.id,
            nameAtOrder: product.name,
            unitPriceSantim: product.priceSantim,
            quantity: 1,
          },
        ],
      };
      expect(order.number).toBe(1001);
      expect(order.items?.[0].quantity).toBe(1);

      const signupInput: SignupInput = {
        business_name: seller.businessName,
        sms_name: seller.smsName,
        phone: seller.phone,
        password: "securepassword123",
      };
      expect(signupInput.business_name).toBe("Habesha Coffee");

      const loginInput: LoginInput = {
        phone: seller.phone,
        password: "securepassword123",
      };
      expect(loginInput.phone).toBe("0911223344");

      const storefront: StorefrontDto = {
        seller,
        products: [product],
      };
      expect(storefront.products).toHaveLength(1);

      const checkoutRes: CheckoutResponse = {
        draftId: "draft_123",
        phone: order.buyerPhone,
        expiresAt: new Date().toISOString(),
      };
      expect(checkoutRes.draftId).toBe("draft_123");
    });
  });
});

