import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsController } from "../settings.controller";
import { AuthController } from "../auth.controller";
import { HttpStatus } from "@nestjs/common";

describe("Settings Routes (PR-012, Issue #131)", () => {
  let authServiceMock: any;
  let settingsController: SettingsController;
  let authController: AuthController;

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
    it("returns formatted seller profile on GET /api/settings", async () => {
      const result = await settingsController.getSettings(mockSeller);

      expect(result.seller).toEqual({
        id: "seller-123",
        business_name: "Original Cafe",
        businessName: "Original Cafe",
        sms_name: "Original",
        smsName: "Original",
        phone: "+251911223344",
        slug: "original-cafe",
        phone_verified_at: mockSeller.phone_verified_at,
        phoneVerifiedAt: "2026-10-20T10:00:00.000Z",
        created_at: mockSeller.created_at,
        createdAt: "2026-10-15T10:00:00.000Z",
      });
    });

    it("delegates to authService.updateSettings on PATCH /api/settings", async () => {
      authServiceMock.updateSettings.mockResolvedValue({
        seller: {
          id: "seller-123",
          business_name: "Updated Cafe",
          businessName: "Updated Cafe",
          sms_name: "Updated",
          smsName: "Updated",
          phone: "+251911223344",
          slug: "original-cafe",
          phone_verified_at: mockSeller.phone_verified_at,
          phoneVerifiedAt: "2026-10-20T10:00:00.000Z",
          created_at: mockSeller.created_at,
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
    it("returns formatted seller profile on GET /api/auth/settings", async () => {
      const result = await authController.getSettings(mockSeller);

      expect(result.seller).toEqual({
        id: "seller-123",
        business_name: "Original Cafe",
        businessName: "Original Cafe",
        sms_name: "Original",
        smsName: "Original",
        phone: "+251911223344",
        slug: "original-cafe",
        phone_verified_at: mockSeller.phone_verified_at,
        phoneVerifiedAt: "2026-10-20T10:00:00.000Z",
        created_at: mockSeller.created_at,
        createdAt: "2026-10-15T10:00:00.000Z",
      });
    });

    it("delegates to authService.updateSettings on PATCH /api/auth/settings", async () => {
      authServiceMock.updateSettings.mockResolvedValue({
        seller: {
          id: "seller-123",
          business_name: "Patched Cafe",
          businessName: "Patched Cafe",
          sms_name: "Patched",
          smsName: "Patched",
          phone: "+251911223344",
          slug: "original-cafe",
          phone_verified_at: mockSeller.phone_verified_at,
          phoneVerifiedAt: "2026-10-20T10:00:00.000Z",
          created_at: mockSeller.created_at,
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
