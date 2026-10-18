/**
 * Seller Authentication & Session Management Service (BE-004)
 * Handles encrypted JWT session tokens, HTTP cookie generation,
 * session verification, and route authorization guards.
 * References: docs/03 (FR-1), docs/06 (Sec 3.3, 4.3), docs/09 (Sec 3).
 */

import { SignJWT, jwtVerify } from "jose";
import { env } from "@/env";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { Seller } from "@prisma/client";

export const SESSION_COOKIE_NAME = "seller_session";
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionPayload {
  sellerId: string;
  iat?: number;
  exp?: number;
}

export interface SessionCookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  path: string;
  maxAge: number;
}

export class AuthError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string = "Unauthorized", status: number = 401, code: string = "UNAUTHORIZED") {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Returns Uint8Array signing key for HMAC-SHA256 JWTs using SESSION_SECRET.
 */
function getSessionSecretKey(secret?: string): Uint8Array {
  const secretStr = secret ?? env.SESSION_SECRET;
  return new TextEncoder().encode(secretStr);
}

/**
 * Signs and creates a cryptographically secure session JWT for a seller.
 * Claims are minimal (sellerId only); mutable fields like phone or slug are resolved
 * authoritatively from the database as needed.
 */
export async function createSessionToken(
  payload: { sellerId: string },
  options?: {
    expiresIn?: string | number;
    secret?: string;
  }
): Promise<string> {
  const rawId = payload?.sellerId;
  const sellerId = typeof rawId === "string" ? rawId.trim() : "";
  if (!sellerId) {
    throw new AuthError("Cannot create session token: sellerId must be a non-empty string", 400, "INVALID_SELLER_ID");
  }

  const secretKey = getSessionSecretKey(options?.secret);
  const expiration = options?.expiresIn ?? "7d";

  return await new SignJWT({
    sellerId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(secretKey);
}

/**
 * Verifies a session JWT, confirms signature and expiration, and returns the payload.
 * Validates that sellerId is a non-empty string before accepting the session.
 * Throws 401 AuthError if the token is invalid, tampered with, expired, or malformed.
 */
export async function verifySessionToken(
  token: string,
  options?: { secret?: string }
): Promise<SessionPayload> {
  if (!token || typeof token !== "string" || token.trim() === "") {
    throw new AuthError("Missing or invalid session token", 401, "INVALID_TOKEN");
  }

  const secretKey = getSessionSecretKey(options?.secret);

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    const rawSellerId = payload.sellerId;
    const sellerId = typeof rawSellerId === "string" ? rawSellerId.trim() : "";
    if (!sellerId) {
      throw new AuthError("Token payload missing valid non-empty sellerId", 401, "MALFORMED_SESSION");
    }

    return {
      sellerId,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (err: any) {
    if (err instanceof AuthError) {
      throw err;
    }
    if (err?.code === "ERR_JWT_EXPIRED" || err?.name === "JWTExpired") {
      throw new AuthError("Session has expired", 401, "SESSION_EXPIRED");
    }
    throw new AuthError(err?.message || "Invalid session signature", 401, "INVALID_SIGNATURE");
  }
}

/**
 * Generates cookie attributes matching security criteria:
 * HttpOnly: true, SameSite: Lax, Secure: true in production, maxAge: 7 days.
 */
export function createSessionCookie(
  token: string,
  options?: {
    isProduction?: boolean;
    maxAge?: number;
  }
): SessionCookieOptions {
  const isProd = options?.isProduction ?? process.env.NODE_ENV === "production";

  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: options?.maxAge ?? SESSION_DURATION_SECONDS,
  };
}

/**
 * Generates cookie options to clear an existing session cookie.
 */
export function createClearSessionCookie(): SessionCookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

/**
 * Extracts session token from Request / NextRequest cookies or Authorization header.
 */
export function extractTokenFromRequest(req?: Request | NextRequest): string | null {
  if (!req) return null;

  // 1. NextRequest cookies map
  if ("cookies" in req && typeof (req as any).cookies?.get === "function") {
    const cookie = (req as any).cookies.get(SESSION_COOKIE_NAME);
    if (cookie?.value) return cookie.value;
  }

  // 2. Standard Cookie header
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) {
      return decodeURIComponent(match.substring(SESSION_COOKIE_NAME.length + 1));
    }
  }

  // 3. Authorization Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return null;
}

export interface AuthenticatedSeller {
  sellerId: string;
  seller?: Seller;
  phone?: string;
  slug?: string;
}

export interface RequireSellerOptions {
  fetchSeller?: boolean;
  secret?: string;
}

/**
 * Route authorization guard. Verifies the request session and returns the seller identity.
 * Resolves current seller details from the database when fetchSeller is true.
 * Throws an HTTP 401 AuthError if unauthenticated, session expired, or seller not found.
 */
export async function requireSeller(
  req?: Request | NextRequest,
  options?: RequireSellerOptions
): Promise<AuthenticatedSeller> {
  let token = extractTokenFromRequest(req);

  // If token was not found on req, try next/headers cookies() if in server context
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
    } catch {
      // outside Next.js request context (e.g. standalone test)
    }
  }

  if (!token) {
    throw new AuthError("Unauthorized: Missing session token", 401, "UNAUTHORIZED");
  }

  const session = await verifySessionToken(token, { secret: options?.secret });

  if (options?.fetchSeller) {
    const seller = await db.seller.findUnique({
      where: { id: session.sellerId },
    });
    if (!seller) {
      throw new AuthError("Unauthorized: Seller account not found", 401, "SELLER_NOT_FOUND");
    }
    return {
      sellerId: session.sellerId,
      seller,
      phone: seller.phone,
      slug: seller.slug,
    };
  }

  return {
    sellerId: session.sellerId,
  };
}

/**
 * Safe session reader. Returns decoded payload if session is valid, or null if unauthenticated.
 * Never throws.
 */
export async function getSession(
  req?: Request | NextRequest,
  options?: { secret?: string }
): Promise<SessionPayload | null> {
  try {
    let token = extractTokenFromRequest(req);
    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
      } catch {
        // outside Next.js request context
      }
    }

    if (!token) return null;
    return await verifySessionToken(token, { secret: options?.secret });
  } catch {
    return null;
  }
}
