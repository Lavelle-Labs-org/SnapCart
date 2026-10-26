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
  seller_id?: string;
  name: string;
  priceSantim: number;
  price_santim?: number;
  available: boolean;
  imageUrl?: string | null;
  image_url?: string | null;
  createdAt: string;
  created_at?: string;
  deletedAt?: string | null;
  deleted_at?: string | null;
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
  customerId?: string | null;
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
  events?: OrderEventDto[];
  messages?: MessageDto[];
}

export interface CustomerDto {
  id: string;
  phone: string;
  name: string;
  phoneVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface SignupInput {
  business_name: string;
  sms_name: string;
  phone: string;
  password: string;
}

export interface SellerSignupResponse {
  sellerId: string;
  phone: string;
  verificationId: string;
}

export interface VerifyPhoneInput {
  phone: string;
  code: string;
}

export interface LoginInput {
  phone: string;
  password: string;
}

export interface AuthSessionResponse {
  seller: SellerDto;
  sessionToken?: string;
}

export interface StorefrontDto {
  seller: SellerDto;
  products: ProductDto[];
}

export interface CheckoutResponse {
  verified?: boolean;
  draftId?: string;
  phone?: string;
  expiresAt?: string;
  orderId?: string;
  orderNumber?: number;
  order?: OrderDto;
}

export interface VerifyCheckoutInput {
  draftId: string;
  code: string;
}

export interface CreateProductInput {
  name: string;
  priceSantim?: number;
  price_santim?: number;
  available?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  priceSantim?: number;
  price_santim?: number;
  available?: boolean;
}

export interface ActionOrderDto {
  order: OrderDto;
  actionToken: string;
}

export interface OptOutResponse {
  suppressed: boolean;
  phone?: string;
  alreadySuppressed?: boolean;
}

export interface OptOutPreviewResponse {
  valid: boolean;
  orderNumber: number;
  shopName: string;
  maskedPhone: string;
  alreadySuppressed: boolean;
}

