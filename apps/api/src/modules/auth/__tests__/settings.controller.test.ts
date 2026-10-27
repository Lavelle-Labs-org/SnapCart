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
    logoUrl: null,
    logo_url: null,
    createdAt: "2026-10-15T10:00:00.000Z",
  };

  const mockSeller = {
    id: "seller-123",
    business_name: "Original Cafe",
    sms_name: "Original",
    phone: "+251911223344",
    slug: "original-cafe",
    logo_url: null,
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
      uploadProfileImage: vi.fn(),
      deleteProfileImage: vi.fn(),
    };

    settingsController = new SettingsController(authServiceMock);
    authController = new AuthController(authServiceMock);
  });

  describe("SettingsController (/api/settings alias)", () => {
    it("returns camelCase seller profile with logoUrl on GET /api/settings", async () => {
      const result = await settingsController.getSettings(mockSeller);

      expect(result.seller).toEqual(expectedSellerShape);
      // Ensure no internal timestamp leak
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

    it("delegates to authService.uploadProfileImage on POST /api/settings/profile-image", async () => {
      authServiceMock.uploadProfileImage.mockResolvedValue({
        seller: {
          ...expectedSellerShape,
          logoUrl: "https://r2.orderbysms.et/profiles/seller-123/avatar.png",
        },
      });

      const mockFile = { buffer: Buffer.from("fake-image"), originalname: "shop.png" };
      const result = await settingsController.uploadProfileImage(mockSeller, mockFile);

      expect(authServiceMock.uploadProfileImage).toHaveBeenCalledWith(
        "seller-123",
        mockFile.buffer,
        "shop.png"
      );
      expect(result.seller.logoUrl).toBe("https://r2.orderbysms.et/profiles/seller-123/avatar.png");
    });

    it("delegates to authService.deleteProfileImage on DELETE /api/settings/profile-image", async () => {
      authServiceMock.deleteProfileImage.mockResolvedValue({
        seller: { ...expectedSellerShape, logoUrl: null },
      });

      const result = await settingsController.deleteProfileImage(mockSeller);

      expect(authServiceMock.deleteProfileImage).toHaveBeenCalledWith("seller-123");
      expect(result.seller.logoUrl).toBeNull();
    });
  });

  describe("AuthController (/api/auth/settings)", () => {
    it("returns camelCase seller profile with logoUrl on GET /api/auth/settings", async () => {
      const result = await authController.getSettings(mockSeller);

      expect(result.seller).toEqual(expectedSellerShape);
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

    it("delegates to authService.uploadProfileImage on POST /api/auth/profile-image", async () => {
      authServiceMock.uploadProfileImage.mockResolvedValue({
        seller: {
          ...expectedSellerShape,
          logoUrl: "https://r2.orderbysms.et/profiles/seller-123/avatar.png",
        },
      });

      const mockFile = { buffer: Buffer.from("fake-image"), originalname: "shop.png" };
      const result = await authController.uploadProfileImage(mockSeller, mockFile);

      expect(authServiceMock.uploadProfileImage).toHaveBeenCalledWith(
        "seller-123",
        mockFile.buffer,
        "shop.png"
      );
      expect(result.seller.logoUrl).toBe("https://r2.orderbysms.et/profiles/seller-123/avatar.png");
    });

    it("delegates to authService.deleteProfileImage on DELETE /api/auth/profile-image", async () => {
      authServiceMock.deleteProfileImage.mockResolvedValue({
        seller: { ...expectedSellerShape, logoUrl: null },
      });

      const result = await authController.deleteProfileImage(mockSeller);

      expect(authServiceMock.deleteProfileImage).toHaveBeenCalledWith("seller-123");
      expect(result.seller.logoUrl).toBeNull();
    });
  });
});
