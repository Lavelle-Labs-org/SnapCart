/**
 * Shared Domain Interfaces & Data Transfer Objects (DTOs)
 * Corresponds to Prisma models in prisma/schema.prisma and specs in docs/08-data-model-and-database.md.
 */

import type { OrderState } from "./order-state";

export type MessageStatus =
  | "queued"
  | "sent"
  | "failed"
  | "unknown"
  | "skipped"
  | "test_passed";

export interface SellerDto {
  id: string;
  businessName: string;
  smsName: string;
  phone: string;
  phoneVerifiedAt?: string | null;
  slug: string;
  createdAt: string;
}

export interface ProductDto {
  id: string;
  sellerId: string;
  name: string;
  priceSantim: number;
  available: boolean;
  createdAt: string;
  deletedAt?: string | null;
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  productId?: string | null;
  nameAtOrder: string;
  unitPriceSantim: number;
  quantity: number;
}

export interface OrderDto {
  id: string;
  sellerId: string;
  number: number;
  buyerName: string;
  buyerPhone: string;
  smsConsent: boolean;
  consentWording: string;
  consentAt?: string | null;
  state: OrderState;
  totalSantim: number;
  createdAt: string;
  items?: OrderItemDto[];
}

export interface OrderEventDto {
  id: string;
  orderId: string;
  fromState?: string | null;
  toState: string;
  actor: string;
  createdAt: string;
}

export interface MessageDto {
  id: string;
  sellerId?: string | null;
  orderId?: string | null;
  recipientPhone: string;
  event: string;
  text: string;
  status: MessageStatus;
  skipReason?: string | null;
  smshubMessageId?: string | null;
  requestId?: string | null;
  network?: string | null;
  creditsUsed?: number | null;
  errorType?: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export interface CheckoutInput {
  slug: string;
  buyerName: string;
  buyerPhone: string;
  smsConsent: boolean;
  consentWording: string;
  items: CheckoutItemInput[];
}

export interface VerificationDraftDto {
  id: string;
  phone: string;
  purpose: "seller_signup" | "buyer_checkout" | string;
  status: "pending" | "approved" | "expired" | "failed" | string;
  expiresAt: string;
  lastSentAt: string;
  draft?: string | null;
}
