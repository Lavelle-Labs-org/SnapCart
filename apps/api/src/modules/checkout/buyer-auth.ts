import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env";
import type { SessionCookieOptions } from "../auth/auth.types";

export const BUYER_SESSION_COOKIE = "buyer_session";
export const BUYER_SESSION_DURATION_SECONDS = 90 * 24 * 60 * 60; // 90 days

export interface BuyerSessionPayload {
  customerId: string;
  phone: string;
  name?: string;
  iat?: number;
  exp?: number;
}

function getSecretKey(secret?: string): Uint8Array {
  let secretStr = secret;
  if (!secretStr) {
    try {
      secretStr = env.SESSION_SECRET;
    } catch {
      secretStr =
        process.env.SESSION_SECRET ||
        "mock_session_secret_at_least_32_characters_long";
    }
  }
  return new TextEncoder().encode(secretStr);
}

export async function signBuyerToken(
  payload: { customerId: string; phone: string; name?: string },
  secret?: string
): Promise<string> {
  const secretKey = getSecretKey(secret);
  return await new SignJWT({
    customerId: payload.customerId,
    phone: payload.phone,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${BUYER_SESSION_DURATION_SECONDS}s`)
    .sign(secretKey);
}

export async function verifyBuyerToken(
  token: string,
  secret?: string
): Promise<BuyerSessionPayload | null> {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return null;
  }

  try {
    const secretKey = getSecretKey(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (
      !payload ||
      typeof payload.customerId !== "string" ||
      typeof payload.phone !== "string"
    ) {
      return null;
    }

    return {
      customerId: payload.customerId,
      phone: payload.phone,
      name: typeof payload.name === "string" ? payload.name : undefined,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function createBuyerSessionCookie(
  token: string,
  options?: { isProduction?: boolean; maxAge?: number }
): SessionCookieOptions {
  const isProd =
    options?.isProduction ?? process.env.NODE_ENV === "production";

  return {
    name: BUYER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: options?.maxAge ?? BUYER_SESSION_DURATION_SECONDS,
    secure: isProd,
  };
}

export function extractBuyerTokenFromRequest(req: any): string | null {
  if (!req) return null;

  // 1. Cookies parsed by cookie-parser
  if (req.cookies && req.cookies[BUYER_SESSION_COOKIE]) {
    return req.cookies[BUYER_SESSION_COOKIE];
  }

  // 2. Cookie header parsing
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader && typeof cookieHeader === "string") {
    const match = cookieHeader
      .split(";")
      .map((c: string) => c.trim())
      .find((c: string) => c.startsWith(`${BUYER_SESSION_COOKIE}=`));
    if (match) {
      return decodeURIComponent(
        match.substring(BUYER_SESSION_COOKIE.length + 1)
      );
    }
  }

  // 3. Authorization Bearer header fallback
  const authHeader = req.headers?.authorization;
  if (
    authHeader &&
    typeof authHeader === "string" &&
    authHeader.startsWith("Bearer ")
  ) {
    return authHeader.substring(7).trim();
  }

  return null;
}
