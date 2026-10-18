/**
 * Order-by-SMS Frontend API Client
 * Consumes standard API response envelopes and DTOs from @order-by-sms/contracts.
 * Handles same-site session cookies, typed error mapping, and proxy rewrites.
 */

import type {
  ApiEnvelope,
  ApiResponse,
  ApiErrorResponse,
  SellerDto,
  ProductDto,
  OrderDto,
  MessageDto,
  CheckoutInput,
  SignupInput,
  SellerSignupResponse,
  VerifyPhoneInput,
  LoginInput,
  AuthSessionResponse,
  StorefrontDto,
  CheckoutResponse,
  VerifyCheckoutInput,
  CreateProductInput,
  UpdateProductInput,
  ActionOrderDto,
} from "@order-by-sms/contracts";

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string = "INTERNAL_SERVER_ERROR",
    status: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  defaultHeaders?: Record<string, string>;
}

export class OrderBySmsApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.fetchFn = options.fetchFn ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : (fetch as unknown as typeof fetch));
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  /**
   * Core request dispatcher with JSON envelope unboxing and error mapping.
   */
  public async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers(this.defaultHeaders);

    if (init?.headers) {
      const incomingHeaders = new Headers(init.headers);
      incomingHeaders.forEach((value, key) => {
        headers.set(key, value);
      });
    }

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    const hasBody = init?.body !== undefined && init?.body !== null;
    const isJsonBody = hasBody && !(init?.body instanceof FormData) && !(init?.body instanceof URLSearchParams);

    if (isJsonBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    let body = init?.body;
    if (isJsonBody && typeof body !== "string") {
      body = JSON.stringify(body);
    }

    const response = await this.fetchFn(url, {
      ...init,
      headers,
      body,
      credentials: init?.credentials ?? "include",
    });

    const contentType = response.headers.get("content-type") || "";
    let data: unknown;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (typeof data === "object" && data !== null && "success" in data) {
      const envelope = data as ApiEnvelope<T>;
      if (envelope.success === true) {
        return envelope.data;
      } else {
        throw new ApiClientError(
          envelope.error.message || "API request failed",
          envelope.error.code || "API_ERROR",
          response.status,
          envelope.error.details
        );
      }
    }

    if (!response.ok) {
      throw new ApiClientError(
        response.statusText || `Request failed with status ${response.status}`,
        "HTTP_ERROR",
        response.status,
        data
      );
    }

    return data as T;
  }

  // --- Health Probe ---
  public async health(): Promise<{ status: string; uptime: number; timestamp: string }> {
    return this.request<{ status: string; uptime: number; timestamp: string }>("/api/health");
  }

  // --- Seller Authentication & Sessions ---
  public async signup(input: SignupInput): Promise<SellerSignupResponse> {
    return this.request<SellerSignupResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  public async verifyPhone(input: VerifyPhoneInput): Promise<AuthSessionResponse> {
    return this.request<AuthSessionResponse>("/api/auth/verify-phone", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  public async login(input: LoginInput): Promise<AuthSessionResponse> {
    return this.request<AuthSessionResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  public async logout(): Promise<{ loggedOut: boolean }> {
    return this.request<{ loggedOut: boolean }>("/api/auth/logout", {
      method: "POST",
    });
  }

  // --- Public Storefront & Buyer Checkout ---
  public async getStorefront(slug: string): Promise<StorefrontDto> {
    return this.request<StorefrontDto>(`/api/s/${encodeURIComponent(slug)}`);
  }

  public async checkout(input: CheckoutInput): Promise<CheckoutResponse> {
    return this.request<CheckoutResponse>("/api/checkout", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  public async verifyCheckout(input: VerifyCheckoutInput): Promise<{ order: OrderDto }> {
    return this.request<{ order: OrderDto }>("/api/checkout/verify", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  public async resendCheckoutOtp(draftId: string): Promise<{ sent: boolean; retryAfter?: number }> {
    return this.request<{ sent: boolean; retryAfter?: number }>("/api/checkout/resend", {
      method: "POST",
      body: JSON.stringify({ draftId }),
    });
  }

  // --- Seller Orders ---
  public async getOrders(): Promise<OrderDto[]> {
    return this.request<OrderDto[]>("/api/orders");
  }

  public async getOrder(id: string): Promise<OrderDto> {
    return this.request<OrderDto>(`/api/orders/${encodeURIComponent(id)}`);
  }

  public async acceptOrder(id: string): Promise<OrderDto> {
    return this.request<OrderDto>(`/api/orders/${encodeURIComponent(id)}/accept`, {
      method: "POST",
    });
  }

  public async rejectOrder(id: string): Promise<OrderDto> {
    return this.request<OrderDto>(`/api/orders/${encodeURIComponent(id)}/reject`, {
      method: "POST",
    });
  }

  public async readyOrder(id: string): Promise<OrderDto> {
    return this.request<OrderDto>(`/api/orders/${encodeURIComponent(id)}/ready`, {
      method: "POST",
    });
  }

  public async completeOrder(id: string, pickupCode: string): Promise<OrderDto> {
    return this.request<OrderDto>(`/api/orders/${encodeURIComponent(id)}/complete`, {
      method: "POST",
      body: JSON.stringify({ pickupCode }),
    });
  }

  public async reissuePickupCode(id: string): Promise<{ reissued: boolean }> {
    return this.request<{ reissued: boolean }>(`/api/orders/${encodeURIComponent(id)}/pickup-code/reissue`, {
      method: "POST",
    });
  }

  // --- Seller Products ---
  public async getProducts(): Promise<ProductDto[]> {
    return this.request<ProductDto[]>("/api/products");
  }

  public async createProduct(input: CreateProductInput): Promise<ProductDto> {
    return this.request<ProductDto>("/api/products", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  public async updateProduct(id: string, input: UpdateProductInput): Promise<ProductDto> {
    return this.request<ProductDto>(`/api/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  public async deleteProduct(id: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/api/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  // --- SMS Audit Messages ---
  public async getMessages(): Promise<MessageDto[]> {
    return this.request<MessageDto[]>("/api/messages");
  }

  public async resendMessage(id: string): Promise<{ resent: boolean }> {
    return this.request<{ resent: boolean }>(`/api/messages/${encodeURIComponent(id)}/resend`, {
      method: "POST",
    });
  }

  // --- Seller Settings ---
  public async getSettings(): Promise<SellerDto> {
    return this.request<SellerDto>("/api/settings");
  }

  public async updateSettings(
    input: Partial<Pick<SellerDto, "businessName" | "smsName">>
  ): Promise<SellerDto> {
    return this.request<SellerDto>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  // --- Mobile Action Links ---
  public async getActionOrder(token: string): Promise<ActionOrderDto> {
    return this.request<ActionOrderDto>(`/api/a/${encodeURIComponent(token)}`);
  }

  public async acceptAction(token: string): Promise<OrderDto> {
    return this.request<OrderDto>(`/api/a/${encodeURIComponent(token)}/accept`, {
      method: "POST",
    });
  }

  public async rejectAction(token: string): Promise<OrderDto> {
    return this.request<OrderDto>(`/api/a/${encodeURIComponent(token)}/reject`, {
      method: "POST",
    });
  }

  public async readyAction(token: string): Promise<OrderDto> {
    return this.request<OrderDto>(`/api/a/${encodeURIComponent(token)}/ready`, {
      method: "POST",
    });
  }

  public async completeAction(token: string, pickupCode: string): Promise<OrderDto> {
    return this.request<OrderDto>(`/api/a/${encodeURIComponent(token)}/complete`, {
      method: "POST",
      body: JSON.stringify({ pickupCode }),
    });
  }

  // --- Buyer SMS Opt-Out ---
  public async optOut(token: string): Promise<{ suppressed: boolean }> {
    return this.request<{ suppressed: boolean }>(`/api/stop/${encodeURIComponent(token)}`, {
      method: "POST",
    });
  }
}

export function createApiClient(options?: ApiClientOptions): OrderBySmsApiClient {
  return new OrderBySmsApiClient(options);
}

export const api = new OrderBySmsApiClient();
