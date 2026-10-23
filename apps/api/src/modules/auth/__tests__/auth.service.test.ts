import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "../auth.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { SMSHubService } from "../../smshub/smshub.service";
import { hashPassword, verifyPassword } from "../password";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "../auth.types";
import { HttpException, HttpStatus } from "@nestjs/common";

describe("AuthService (apps/api - MIG-006)", () => {
  let authService: AuthService;
  let prismaMock: any;
  let smshubMock: any;

  const TEST_SECRET = "super_secret_session_key_at_least_32_characters_long!";
  const TEST_SELLER_ID = "seller-uuid-1234-5678";

  beforeEach(async () => {
    prismaMock = {
      seller: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      phoneVerification: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    smshubMock = {
      verifySend: vi.fn(),
      verifyCheck: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SMSHubService, useValue: smshubMock },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Password Hashing & Verification (password.ts)", () => {
    it("hashes password and verifies match correctly", async () => {
      const hash = await hashPassword("mySecretPassword123");
      expect(hash).toBeDefined();
      expect(hash).not.toBe("mySecretPassword123");

      const matches = await verifyPassword("mySecretPassword123", hash);
      expect(matches).toBe(true);

      const wrong = await verifyPassword("wrongPassword", hash);
      expect(wrong).toBe(false);
    });

    it("rejects empty password hashing", async () => {
      await expect(hashPassword("")).rejects.toThrow("Password cannot be empty");
    });
  });

  describe("Session Token & Cookie Management", () => {
    it("creates cookie with HttpOnly, SameSite=Lax, and 7-day maxAge", () => {
      const cookie = authService.createSessionCookie("mock_jwt_token", {
        isProduction: false,
      });

      expect(cookie.name).toBe(SESSION_COOKIE_NAME);
      expect(cookie.value).toBe("mock_jwt_token");
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("lax");
      expect(cookie.path).toBe("/");
      expect(cookie.maxAge).toBe(SESSION_DURATION_SECONDS);
      expect(cookie.secure).toBe(false);
    });

    it("enforces Secure flag when in production mode", () => {
      const prodCookie = authService.createSessionCookie("mock_jwt_token", {
        isProduction: true,
      });
      expect(prodCookie.secure).toBe(true);
    });

    it("creates clear session cookie with maxAge=0", () => {
      const clearCookie = authService.createClearSessionCookie();
      expect(clearCookie.name).toBe(SESSION_COOKIE_NAME);
      expect(clearCookie.value).toBe("");
      expect(clearCookie.maxAge).toBe(0);
      expect(clearCookie.httpOnly).toBe(true);
    });

    it("signs and verifies valid session token", async () => {
      const token = await authService.createSessionToken(
        { sellerId: TEST_SELLER_ID },
        { secret: TEST_SECRET }
      );

      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);

      const decoded = await authService.verifySessionToken(token, {
        secret: TEST_SECRET,
      });
      expect(decoded.sellerId).toBe(TEST_SELLER_ID);
    });

    it("rejects session creation with empty sellerId", async () => {
      await expect(
        authService.createSessionToken({ sellerId: "" }, { secret: TEST_SECRET })
      ).rejects.toThrow(HttpException);
    });

    it("rejects tampered session tokens", async () => {
      const token = await authService.createSessionToken(
        { sellerId: TEST_SELLER_ID },
        { secret: TEST_SECRET }
      );
      const tampered = token.slice(0, -5) + "aaaaa";

      await expect(
        authService.verifySessionToken(tampered, { secret: TEST_SECRET })
      ).rejects.toThrow(HttpException);
    });
  });

  describe("Signup Flow", () => {
    const signupDto = {
      business_name: "Habesha Roasters",
      sms_name: "Habesha",
      phone: "+251911223344",
      password: "securepassword123",
    };

    it("dispatches OTP via SMSHub and registers unverified seller", async () => {
      prismaMock.seller.findUnique.mockResolvedValue(null);
      smshubMock.verifySend.mockResolvedValue({
        status: "success",
        data: { verification_id: "ver_test_123", expires_in: 300 },
      });
      prismaMock.seller.create.mockResolvedValue({
        id: "seller-123",
        phone: "0911223344",
        slug: "habesha-roasters",
      });
      prismaMock.phoneVerification.create.mockResolvedValue({});

      const result = await authService.signup(signupDto);

      expect(result.seller_id).toBe("seller-123");
      expect(result.phone).toBe("0911223344");
      expect(result.verification_id).toBe("ver_test_123");
      expect(smshubMock.verifySend).toHaveBeenCalledWith(
        "0911223344",
        "Habesha",
        6,
        300
      );
    });

    it("rejects duplicate phone with 409 Conflict", async () => {
      prismaMock.seller.findUnique.mockResolvedValue({
        id: "existing-seller",
        phone: "0911223344",
      });

      await expect(authService.signup(signupDto)).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.CONFLICT,
        })
      );
    });
  });

  describe("Verify Phone Flow", () => {
    it("verifies OTP, marks phone_verified_at, and issues session token and cookie", async () => {
      prismaMock.phoneVerification.findFirst.mockResolvedValue({
        id: "pv-1",
        verification_id: "ver_test_123",
        phone: "0911223344",
        status: "pending",
      });
      smshubMock.verifyCheck.mockResolvedValue({
        status: "success",
        data: { valid: true, verification_status: "approved" },
      });
      prismaMock.phoneVerification.update.mockResolvedValue({});
      prismaMock.seller.update.mockResolvedValue({
        id: "seller-123",
        business_name: "Habesha Roasters",
        phone: "0911223344",
        slug: "habesha-roasters",
        phone_verified_at: new Date(),
      });

      const result = await authService.verifyPhone({
        phone: "0911223344",
        code: "123456",
      });

      expect(result.seller.id).toBe("seller-123");
      expect(result.token).toBeDefined();
      expect(result.cookie.name).toBe(SESSION_COOKIE_NAME);
    });

    it("rejects invalid OTP with 400 Bad Request", async () => {
      prismaMock.phoneVerification.findFirst.mockResolvedValue({
        id: "pv-1",
        verification_id: "ver_test_123",
        phone: "0911223344",
        status: "pending",
      });
      smshubMock.verifyCheck.mockResolvedValue({
        status: "success",
        data: { valid: false, verification_status: "failed" },
      });

      await expect(
        authService.verifyPhone({ phone: "0911223344", code: "999999" })
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
        })
      );
    });
  });

  describe("Login Flow", () => {
    it("authenticates verified seller and creates session", async () => {
      const passwordHash = await hashPassword("correctpassword123");
      prismaMock.seller.findUnique.mockResolvedValue({
        id: "seller-123",
        business_name: "Habesha Roasters",
        phone: "0911223344",
        slug: "habesha-roasters",
        password_hash: passwordHash,
        phone_verified_at: new Date(),
      });

      const result = await authService.login({
        phone: "+251911223344",
        password: "correctpassword123",
      });

      expect(result.seller.id).toBe("seller-123");
      expect(result.token).toBeDefined();
      expect(result.cookie.name).toBe(SESSION_COOKIE_NAME);
    });

    it("rejects wrong password with 401 Unauthorized", async () => {
      const passwordHash = await hashPassword("correctpassword123");
      prismaMock.seller.findUnique.mockResolvedValue({
        id: "seller-123",
        phone: "0911223344",
        password_hash: passwordHash,
        phone_verified_at: new Date(),
      });

      await expect(
        authService.login({
          phone: "0911223344",
          password: "wrongPassword",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.UNAUTHORIZED,
        })
      );
    });

    it("rejects unverified phone with 403 Forbidden", async () => {
      const passwordHash = await hashPassword("correctpassword123");
      prismaMock.seller.findUnique.mockResolvedValue({
        id: "seller-123",
        phone: "0911223344",
        password_hash: passwordHash,
        phone_verified_at: null, // Not verified
      });

      await expect(
        authService.login({
          phone: "0911223344",
          password: "correctpassword123",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.FORBIDDEN,
        })
      );
    });
  });

  describe("updateSettings", () => {
    it("successfully updates business_name and sms_name", async () => {
      const mockUpdatedSeller = {
        id: "seller-123",
        business_name: "Updated Habesha Cafe",
        sms_name: "Updated Cafe",
        phone: "+251911223344",
        slug: "habesha-cafe",
        phone_verified_at: new Date(),
        created_at: new Date(),
      };
      prismaMock.seller.update.mockResolvedValue(mockUpdatedSeller);

      const result = await authService.updateSettings("seller-123", {
        business_name: "Updated Habesha Cafe",
        sms_name: "Updated Cafe",
      });

      expect(prismaMock.seller.update).toHaveBeenCalledWith({
        where: { id: "seller-123" },
        data: {
          business_name: "Updated Habesha Cafe",
          sms_name: "Updated Cafe",
        },
      });
      expect(result.seller.businessName).toBe("Updated Habesha Cafe");
      expect(result.seller.smsName).toBe("Updated Cafe");
    });

    it("successfully updates settings using camelCase businessName and smsName", async () => {
      const mockUpdatedSeller = {
        id: "seller-123",
        business_name: "Camel Cafe",
        sms_name: "Camel",
        phone: "+251911223344",
        slug: "camel-cafe",
        phone_verified_at: new Date(),
        created_at: new Date(),
      };
      prismaMock.seller.update.mockResolvedValue(mockUpdatedSeller);

      const result = await authService.updateSettings("seller-123", {
        businessName: "Camel Cafe",
        smsName: "Camel",
      });

      expect(prismaMock.seller.update).toHaveBeenCalledWith({
        where: { id: "seller-123" },
        data: {
          business_name: "Camel Cafe",
          sms_name: "Camel",
        },
      });
      expect(result.seller.businessName).toBe("Camel Cafe");
      expect(result.seller.smsName).toBe("Camel");
    });

    it("rejects sms_name longer than 20 characters", async () => {
      await expect(
        authService.updateSettings("seller-123", {
          sms_name: "ThisIsWayTooLongForAnSMSName",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
        })
      );
    });

    it("rejects when no updates are provided", async () => {
      await expect(
        authService.updateSettings("seller-123", {})
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
        })
      );
    });
  });
});
