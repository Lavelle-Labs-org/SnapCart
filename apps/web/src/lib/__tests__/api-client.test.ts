import { describe, it, expect, vi } from "vitest";
import {
  OrderBySmsApiClient,
  ApiClientError,
  createApiClient,
  api,
} from "../api-client";
import type {
  CheckoutInput,
  CreateProductInput,
  LoginInput,
  SignupInput,
  VerifyCheckoutInput,
  VerifyPhoneInput,
} from "@order-by-sms/contracts";

describe("OrderBySmsApiClient (apps/web - MIG-008)", () => {
  it("provides a default singleton and factory function", () => {
    expect(api).toBeInstanceOf(OrderBySmsApiClient);
    const customClient = createApiClient({ baseUrl: "http://localhost:4000" });
    expect(customClient).toBeInstanceOf(OrderBySmsApiClient);
  });

  describe("Core Request Handling & Envelope Unboxing", () => {
    it("successfully unboxes standard success envelope", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { status: "ok", uptime: 123, timestamp: "2026-10-18T17:00:00Z" },
        }),
      });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });
      const result = await client.health();

      expect(mockFetch).toHaveBeenCalledWith("/api/health", expect.objectContaining({
        credentials: "include",
        headers: expect.any(Headers),
      }));
      expect(result).toEqual({ status: "ok", uptime: 123, timestamp: "2026-10-18T17:00:00Z" });
    });

    it("throws typed ApiClientError when response has error envelope", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Phone number is invalid",
            details: { field: "phone" },
          },
        }),
      });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });

      await expect(client.login({ phone: "invalid", password: "secret" }))
        .rejects.toThrow(ApiClientError);

      try {
        await client.login({ phone: "invalid", password: "secret" });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiClientError);
        const apiErr = err as ApiClientError;
        expect(apiErr.code).toBe("VALIDATION_ERROR");
        expect(apiErr.status).toBe(400);
        expect(apiErr.message).toBe("Phone number is invalid");
        expect(apiErr.details).toEqual({ field: "phone" });
      }
    });

    it("throws ApiClientError on non-JSON HTTP errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => "<html>502 Bad Gateway</html>",
      });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });

      try {
        await client.health();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiClientError);
        const apiErr = err as ApiClientError;
        expect(apiErr.code).toBe("HTTP_ERROR");
        expect(apiErr.status).toBe(502);
      }
    });

    it("respects custom baseUrl and default headers", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { status: "ok", uptime: 10, timestamp: "2026-10-18T17:00:00Z" },
        }),
      });

      const client = new OrderBySmsApiClient({
        baseUrl: "https://api.example.com",
        defaultHeaders: { "X-Client-Version": "1.0.0" },
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await client.health();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/health",
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );
      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get("X-Client-Version")).toBe("1.0.0");
      expect(headers.get("Accept")).toBe("application/json");
    });
  });

  describe("Authentication Endpoints", () => {
    it("handles seller signup", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: {
            sellerId: "seller_1",
            phone: "0911223344",
            verificationId: "ver_1",
          },
        }),
      });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });
      const input: SignupInput = {
        business_name: "Habesha Coffee",
        sms_name: "Habesha",
        phone: "0911223344",
        password: "securepassword123",
      };

      const res = await client.signup(input);
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(input),
        headers: expect.any(Headers),
        credentials: "include",
      });
      expect(res.sellerId).toBe("seller_1");
    });

    it("handles seller phone verification", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: {
            seller: {
              id: "seller_1",
              businessName: "Habesha Coffee",
              smsName: "Habesha",
              phone: "0911223344",
              slug: "habesha-coffee",
              createdAt: "2026-10-18T12:00:00Z",
            },
          },
        }),
      });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });
      const input: VerifyPhoneInput = {
        phone: "0911223344",
        code: "123456",
      };

      const res = await client.verifyPhone(input);
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/verify-phone", expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }));
      expect(res.seller.id).toBe("seller_1");
    });

    it("handles seller login and logout", async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            success: true,
            data: {
              seller: {
                id: "seller_1",
                businessName: "Habesha Coffee",
                smsName: "Habesha",
                phone: "0911223344",
                slug: "habesha-coffee",
                createdAt: "2026-10-18T12:00:00Z",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            success: true,
            data: { loggedOut: true },
          }),
        });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });
      const loginInput: LoginInput = { phone: "0911223344", password: "password123" };

      const loginRes = await client.login(loginInput);
      expect(loginRes.seller.id).toBe("seller_1");

      const logoutRes = await client.logout();
      expect(logoutRes.loggedOut).toBe(true);
    });
  });

  describe("Public Storefront & Buyer Checkout Endpoints", () => {
    it("fetches storefront catalog", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: {
            seller: {
              id: "seller_1",
              businessName: "Habesha Cafe",
              smsName: "Habesha",
              phone: "0911223344",
              slug: "habesha-cafe",
              createdAt: "2026-10-18T12:00:00Z",
            },
            products: [
              {
                id: "prod_1",
                sellerId: "seller_1",
                name: "Macchiato",
                priceSantim: 5000,
                available: true,
                createdAt: "2026-10-18T12:00:00Z",
              },
            ],
          },
        }),
      });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });
      const storefront = await client.getStorefront("habesha-cafe");

      expect(mockFetch).toHaveBeenCalledWith("/api/s/habesha-cafe", expect.any(Object));
      expect(storefront.seller.slug).toBe("habesha-cafe");
      expect(storefront.products).toHaveLength(1);
    });

    it("submits checkout, verifies OTP, and resends OTP", async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            success: true,
            data: { draftId: "draft_123", phone: "0922334455", expiresAt: "2026-10-18T17:10:00Z" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            success: true,
            data: {
              order: {
                id: "ord_1",
                sellerId: "seller_1",
                number: 1001,
                buyerName: "Abebe",
                buyerPhone: "0922334455",
                smsConsent: true,
                consentWording: "Consent text",
                state: "new",
                totalSantim: 5000,
                createdAt: "2026-10-18T17:05:00Z",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            success: true,
            data: { sent: true, retryAfter: 60 },
          }),
        });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });
      const checkoutInput: CheckoutInput = {
        slug: "habesha-cafe",
        buyerName: "Abebe",
        buyerPhone: "0922334455",
        smsConsent: true,
        consentWording: "Consent text",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const checkoutRes = await client.checkout(checkoutInput);
      expect(checkoutRes.draftId).toBe("draft_123");

      const verifyInput: VerifyCheckoutInput = { draftId: "draft_123", code: "654321" };
      const verifyRes = await client.verifyCheckout(verifyInput);
      expect(verifyRes.order.number).toBe(1001);

      const resendRes = await client.resendCheckoutOtp("draft_123");
      expect(resendRes.sent).toBe(true);
    });
  });

  describe("Seller Orders & Lifecycle Endpoints", () => {
    it("handles order state transitions and pickup code reissue", async () => {
      const mockFetch = vi.fn().mockImplementation((path: string) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => {
            if (path.includes("/accept")) {
              return { success: true, data: { id: "ord_1", state: "accepted" } };
            }
            if (path.includes("/reject")) {
              return { success: true, data: { id: "ord_1", state: "rejected" } };
            }
            if (path.includes("/ready")) {
              return { success: true, data: { id: "ord_1", state: "ready" } };
            }
            if (path.includes("/complete")) {
              return { success: true, data: { id: "ord_1", state: "completed" } };
            }
            if (path.includes("/reissue")) {
              return { success: true, data: { reissued: true } };
            }
            return { success: true, data: [{ id: "ord_1" }] };
          },
        });
      });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });

      const orders = await client.getOrders();
      expect(orders).toHaveLength(1);

      const accepted = await client.acceptOrder("ord_1");
      expect(accepted.state).toBe("accepted");

      const ready = await client.readyOrder("ord_1");
      expect(ready.state).toBe("ready");

      const reissued = await client.reissuePickupCode("ord_1");
      expect(reissued.reissued).toBe(true);

      const completed = await client.completeOrder("ord_1", "4321");
      expect(completed.state).toBe("completed");

      const rejected = await client.rejectOrder("ord_1");
      expect(rejected.state).toBe("rejected");
    });
  });

  describe("Product Management Endpoints", () => {
    it("handles CRUD operations on products", async () => {
      const mockFetch = vi.fn().mockImplementation((path: string, options?: RequestInit) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => {
            if (options?.method === "POST") {
              return { success: true, data: { id: "prod_new", name: "Tea", priceSantim: 2000 } };
            }
            if (options?.method === "PATCH") {
              return { success: true, data: { id: "prod_new", name: "Spiced Tea", priceSantim: 2500 } };
            }
            if (options?.method === "DELETE") {
              return { success: true, data: { deleted: true } };
            }
            return { success: true, data: [{ id: "prod_1", name: "Coffee" }] };
          },
        });
      });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });

      const list = await client.getProducts();
      expect(list).toHaveLength(1);

      const createInput: CreateProductInput = { name: "Tea", priceSantim: 2000 };
      const created = await client.createProduct(createInput);
      expect(created.id).toBe("prod_new");

      const updated = await client.updateProduct("prod_new", { priceSantim: 2500 });
      expect(updated.priceSantim).toBe(2500);

      const deleted = await client.deleteProduct("prod_new");
      expect(deleted.deleted).toBe(true);
    });
  });

  describe("Action Links & Buyer Opt-Out", () => {
    it("fetches action link order and executes action state transitions", async () => {
      const mockFetch = vi.fn().mockImplementation((path: string) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => {
            if (path.startsWith("/api/stop/")) {
              return { success: true, data: { suppressed: true } };
            }
            if (path.includes("/accept")) {
              return { success: true, data: { id: "ord_1", state: "accepted" } };
            }
            return { success: true, data: { order: { id: "ord_1" }, actionToken: "token_123" } };
          },
        });
      });

      const client = new OrderBySmsApiClient({ fetchFn: mockFetch as unknown as typeof fetch });

      const actionData = await client.getActionOrder("token_123");
      expect(actionData.actionToken).toBe("token_123");

      const accepted = await client.acceptAction("token_123");
      expect(accepted.state).toBe("accepted");

      const optOutRes = await client.optOut("stop_token_456");
      expect(optOutRes.suppressed).toBe(true);
    });
  });
});
