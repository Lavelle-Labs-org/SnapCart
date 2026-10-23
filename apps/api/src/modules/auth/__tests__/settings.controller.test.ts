import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsController } from "../settings.controller";
import { AuthController } from "../auth.controller";

describe("Settings Routes (PR-012, Issue #131)", () => {
  let authServiceMock: any;
  let settingsController: SettingsController;
  let authController: AuthController;

  const expectedSellerShape = {
    id: "seller-123",
    businessName: "Original Cafe",
    smsName: "Original",
    phone: "+251911223344",
    slug: "original-cafe",
    phoneVerifiedAt: "2026-10-20T10:00:00.000Z",
    createdAt: "2026-10-15T10:00:00.000Z",
  };

  const mockSeller = {
    id: "seller-123",
    business_name: "Original Cafe",
    sms_name: "Original",
    phone: "+251911223344",
    slug: "original-cafe",
    phone_verified_at: new Date("2026-10-20T10:00:00.000Z"),
    created_at: new Date("2026-10-15T10:00:00.000Z"),
  } as any;

  beforeEach(() => {
    authServiceMock = {
      updateSettings: vi.fn(),
      signup: vi.fn(),
      verifyPhone: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
    };

    settingsController = new SettingsController(authServiceMock);
    authController = new AuthController(authServiceMock);
  });

  describe("SettingsController (/api/settings alias)", () => {
    it("returns camelCase-only seller profile on GET /api/settings", async () => {
      const result = await settingsController.getSettings(mockSeller);

      expect(result.seller).toEqual(expectedSellerShape);
      // Ensure no snake_case leakage
      expect(result.seller).not.toHaveProperty("business_name");
      expect(result.seller).not.toHaveProperty("sms_name");
      expect(result.seller).not.toHaveProperty("created_at");
      expect(result.seller).not.toHaveProperty("phone_verified_at");
    });

    it("delegates to authService.updateSettings on PATCH /api/settings", async () => {
      authServiceMock.updateSettings.mockResolvedValue({
        seller: {
          id: "seller-123",
          businessName: "Updated Cafe",
          smsName: "Updated",
          phone: "+251911223344",
          slug: "original-cafe",
          phoneVerifiedAt: "2026-10-20T10:00:00.000Z",
          createdAt: "2026-10-15T10:00:00.000Z",
        },
      });

      const dto = { business_name: "Updated Cafe", sms_name: "Updated" };
      const result = await settingsController.updateSettings(mockSeller, dto);

      expect(authServiceMock.updateSettings).toHaveBeenCalledWith("seller-123", dto);
      expect(result.seller.businessName).toBe("Updated Cafe");
      expect(result.seller.smsName).toBe("Updated");
    });
  });

  describe("AuthController (/api/auth/settings)", () => {
    it("returns camelCase-only seller profile on GET /api/auth/settings", async () => {
      const result = await authController.getSettings(mockSeller);

      expect(result.seller).toEqual(expectedSellerShape);
      // Ensure no snake_case leakage
      expect(result.seller).not.toHaveProperty("business_name");
      expect(result.seller).not.toHaveProperty("sms_name");
      expect(result.seller).not.toHaveProperty("created_at");
    });

    it("delegates to authService.updateSettings on PATCH /api/auth/settings", async () => {
      authServiceMock.updateSettings.mockResolvedValue({
        seller: {
          id: "seller-123",
          businessName: "Patched Cafe",
          smsName: "Patched",
          phone: "+251911223344",
          slug: "original-cafe",
          phoneVerifiedAt: "2026-10-20T10:00:00.000Z",
          createdAt: "2026-10-15T10:00:00.000Z",
        },
      });

      const dto = { businessName: "Patched Cafe", smsName: "Patched" };
      const result = await authController.updateSettings(mockSeller, dto);

      expect(authServiceMock.updateSettings).toHaveBeenCalledWith("seller-123", dto);
      expect(result.seller.businessName).toBe("Patched Cafe");
    });
  });
});
