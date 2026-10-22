import { describe, it, expect, vi } from "vitest";
import {
  validateProductInput,
  createProductApi,
  toggleAvailabilityApi,
  updateProductApi,
  deleteProductApi,
} from "../product-manager";

describe("ProductManager Actions & API Calls (FE-011, Issue #34)", () => {
  describe("Input Validation: validateProductInput()", () => {
    it("accepts valid product names and positive Birr prices", () => {
      expect(validateProductInput("Special Doro Wat", "350")).toEqual({ isValid: true });
      expect(validateProductInput("Traditional Tea", "15.50")).toEqual({ isValid: true });
      expect(validateProductInput("Coffee Beans 1kg", "600")).toEqual({ isValid: true });
    });

    it("rejects empty or short product names (< 2 characters)", () => {
      expect(validateProductInput("", "100").isValid).toBe(false);
      expect(validateProductInput("A", "100").isValid).toBe(false);
      expect(validateProductInput("   ", "100").isValid).toBe(false);
    });

    it("rejects non-positive, zero, or non-numeric prices", () => {
      expect(validateProductInput("Valid Product", "0").isValid).toBe(false);
      expect(validateProductInput("Valid Product", "-50").isValid).toBe(false);
      expect(validateProductInput("Valid Product", "abc").isValid).toBe(false);
    });
  });

  describe("Create Product API: createProductApi() (Acceptance Criterion 1)", () => {
    it("submits compliant payload to POST /api/products", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "prod-101",
          name: "Fresh Injera",
          priceSantim: 5000,
          available: true,
        }),
      });

      const result = await createProductApi(
        { name: "Fresh Injera", priceBirr: 50, available: true },
        mockFetch as any
      );

      expect(mockFetch).toHaveBeenCalledWith("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Fresh Injera", priceBirr: 50, available: true }),
      });

      expect(result).toEqual({
        id: "prod-101",
        name: "Fresh Injera",
        priceSantim: 5000,
        available: true,
      });
    });

    it("correctly unwraps wrapped ApiResponse { success: true, data } envelopes", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "prod-wrapped",
            name: "Shiro Wat",
            price_santim: 8000,
            available: true,
          },
        }),
      });

      const result = await createProductApi(
        { name: "Shiro Wat", priceBirr: 80, available: true },
        mockFetch as any
      );

      expect(result).toEqual({
        id: "prod-wrapped",
        name: "Shiro Wat",
        priceSantim: 8000,
        available: true,
      });
    });

    it("throws server error message on failure", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Product name already exists" }),
      });

      await expect(
        createProductApi({ name: "Duplicate", priceBirr: 50 }, mockFetch as any)
      ).rejects.toThrow("Product name already exists");
    });
  });

  describe("Toggle Availability API: toggleAvailabilityApi() (Acceptance Criterion 2)", () => {
    it("submits inverted available boolean to PATCH /api/products/:id", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "prod-102",
          name: "Spiced Tea",
          priceSantim: 2500,
          available: false,
        }),
      });

      const result = await toggleAvailabilityApi("prod-102", true, mockFetch as any);

      expect(mockFetch).toHaveBeenCalledWith("/api/products/prod-102", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: false }),
      });

      expect(result.available).toBe(false);
    });
  });

  describe("Update Product API: updateProductApi()", () => {
    it("submits modified details to PATCH /api/products/:id", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "prod-103",
          name: "Updated Doro Wat",
          priceSantim: 40000,
          available: true,
        }),
      });

      const result = await updateProductApi(
        "prod-103",
        { name: "Updated Doro Wat", priceBirr: 400, available: true },
        mockFetch as any
      );

      expect(mockFetch).toHaveBeenCalledWith("/api/products/prod-103", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Doro Wat", priceBirr: 400, available: true }),
      });

      expect(result.name).toBe("Updated Doro Wat");
      expect(result.priceSantim).toBe(40000);
    });
  });

  describe("Delete Product API: deleteProductApi() (Acceptance Criterion 3)", () => {
    it("submits DELETE request to /api/products/:id for soft deletion", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ deleted: true, id: "prod-104" }),
      });

      const result = await deleteProductApi("prod-104", mockFetch as any);

      expect(mockFetch).toHaveBeenCalledWith("/api/products/prod-104", {
        method: "DELETE",
      });

      expect(result).toEqual({ deleted: true, id: "prod-104" });
    });
  });
});
