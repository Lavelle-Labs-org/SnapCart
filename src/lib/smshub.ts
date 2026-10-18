/**
 * SMSHub API Client
 * Wraps /api/sms, /api/test, /api/verify/send, /api/verify/check, and /api/balance.
 * Sections 8.1, 8.2, 8.3, 8.5
 * Invariant Section 11: SMSHub Gateway Client Invariant
 */

import { env } from "@/env";

export interface SMSHubSendOptions {
  msisdn: string;
  text: string;
  trackLinks?: boolean;
}

export interface SMSHubSendResponse {
  status: "success" | "error";
  data?: {
    message_id?: string;
    network?: string;
    message_status?: string;
    credits_used?: number;
    credits_remaining?: number;
    signature_applied?: string;
    request_id?: string;
    // Returned in test mode:
    would_send?: boolean;
    final_text?: string;
    characters?: number;
    character_limit?: number;
    encoding?: string;
  };
  error_type?: string;
  message?: string;
  request_id?: string;
}

export interface SMSHubVerifySendResponse {
  status: "success" | "error";
  data?: {
    verification_id: string;
    expires_in: number;
  };
  error_type?: string;
  message?: string;
}

export interface SMSHubVerifyCheckResponse {
  status: "success" | "error";
  data?: {
    valid: boolean;
    verification_status: "pending" | "approved" | "expired" | "failed" | "replaced";
  };
  error_type?: string;
  message?: string;
}

export interface SMSHubBalanceResponse {
  status: "success" | "error";
  credits?: number;
  data?: {
    credits: number;
    credit_rule?: { ethio: number; safaricom: number };
    low_credit_threshold?: number;
  };
  error?: string;
}

export class SMSHubError extends Error {
  public readonly status: number;
  public readonly errorType?: string;
  public readonly requestId?: string;
  public readonly retryAfterSeconds?: number;
  public readonly retryable: boolean;
  public readonly data?: any;

  constructor(options: {
    message: string;
    status: number;
    errorType?: string;
    requestId?: string;
    retryAfterSeconds?: number;
    data?: any;
  }) {
    super(options.message);
    this.name = "SMSHubError";
    this.status = options.status;
    this.errorType = options.errorType;
    this.requestId = options.requestId;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.retryable = [429, 500, 502, 503, 408].includes(options.status);
    this.data = options.data;
  }
}

export interface SMSHubClientOptions {
  apiKey?: string;
  baseUrl?: string;
  mode?: "test" | "live";
  fetch?: typeof fetch;
  retryDelays?: number[];
  maxRetries?: number;
  timeoutMs?: number;
  minRequestIntervalMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds;
  }
  const dateMs = Date.parse(headerValue);
  if (!isNaN(dateMs)) {
    const diffSeconds = Math.ceil((dateMs - Date.now()) / 1000);
    return Math.max(0, diffSeconds);
  }
  return null;
}

export class SMSHubClient {
  private explicitApiKey?: string;
  private baseUrl: string;
  private explicitMode?: "test" | "live";
  private fetchFn: typeof fetch;
  private retryDelays: number[];
  private maxRetries: number;
  private timeoutMs: number;
  private minRequestIntervalMs: number;
  private sleep: (ms: number) => Promise<void>;
  private nextAvailableTime = 0;

  constructor(options?: SMSHubClientOptions) {
    this.explicitApiKey = options?.apiKey;
    this.baseUrl = (options?.baseUrl || "https://smshub.et").replace(/\/$/, "");
    this.explicitMode = options?.mode;
    this.fetchFn = options?.fetch ?? globalThis.fetch;
    // Default backoff retries: 1s, 4s (per BE-003 acceptance criteria)
    this.retryDelays = options?.retryDelays ?? [1000, 4000];
    this.maxRetries = options?.maxRetries ?? 3;
    this.timeoutMs = options?.timeoutMs ?? 30000; // 30s timeout
    this.sleep = options?.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

    if (options?.minRequestIntervalMs !== undefined) {
      this.minRequestIntervalMs = options.minRequestIntervalMs;
    } else {
      // In tests, don't artificially delay unless requested; in prod, pace at 1000ms (< 60 req/min)
      this.minRequestIntervalMs = process.env.NODE_ENV === "test" ? 0 : 1000;
    }
  }

  private getApiKey(): string {
    if (this.explicitApiKey) {
      return this.explicitApiKey;
    }
    return env.SMSHUB_API_KEY;
  }

  getMode(): "test" | "live" {
    if (this.explicitMode) {
      return this.explicitMode;
    }
    try {
      return env.SMSHUB_MODE;
    } catch {
      return "test";
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Rate pacing: guarantees at least `minRequestIntervalMs` between consecutive outgoing requests.
   */
  private async pace(): Promise<void> {
    if (this.minRequestIntervalMs <= 0) return;
    const now = Date.now();
    const scheduledTime = Math.max(now, this.nextAvailableTime);
    this.nextAvailableTime = scheduledTime + this.minRequestIntervalMs;
    const waitMs = scheduledTime - now;
    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
  }

  private async request<T>(path: string, method: string = "GET", body?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const apiKey = this.getApiKey();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    let attempt = 0;
    let timeoutRetries = 0;

    while (attempt < this.maxRetries) {
      attempt++;
      await this.pace();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await this.fetchFn(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const rawText = await res.text();
        let json: any = null;
        try {
          json = rawText ? JSON.parse(rawText) : null;
        } catch {
          // not valid JSON
        }

        if (res.ok) {
          if (json && json.status === "error") {
            throw new SMSHubError({
              message: json.message || "SMSHub API returned error status",
              status: res.status,
              errorType: json.error_type,
              requestId: json.request_id,
              data: json,
            });
          }
          return (json ?? {}) as T;
        }

        // res.status >= 400
        const errorType = json?.error_type;
        const requestId = json?.request_id;
        const message =
          json?.message || `SMSHub HTTP ${res.status}: ${res.statusText || rawText.slice(0, 100)}`;
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterSec = parseRetryAfter(retryAfterHeader);

        const error = new SMSHubError({
          message,
          status: res.status,
          errorType,
          requestId,
          retryAfterSeconds: retryAfterSec ?? undefined,
          data: json,
        });

        // Retryable status codes: 429, 500, 502, 503
        const isRetryableStatus = [429, 500, 502, 503].includes(res.status);

        if (isRetryableStatus && attempt < this.maxRetries) {
          if (res.status === 429) {
            const pauseSeconds =
              retryAfterSec !== null && retryAfterSec > 0 ? retryAfterSec : 1;
            await this.sleep(pauseSeconds * 1000);
            continue;
          }

          if (res.status === 503 && retryAfterSec !== null && retryAfterSec > 0) {
            await this.sleep(retryAfterSec * 1000);
            continue;
          }

          const delayIndex = attempt - 1;
          const delayMs =
            this.retryDelays[delayIndex] ??
            this.retryDelays[this.retryDelays.length - 1] ??
            1000;
          await this.sleep(delayMs);
          continue;
        }

        // Non-retryable (400, 401, 402, 403, 422, etc.) or max retries reached
        throw error;
      } catch (err: any) {
        clearTimeout(timeout);

        if (err instanceof SMSHubError) {
          throw err;
        }

        const isTimeout =
          err?.name === "AbortError" ||
          err?.message?.toLowerCase().includes("timeout") ||
          err?.message?.toLowerCase().includes("aborted") ||
          controller.signal.aborted;

        if (isTimeout) {
          timeoutRetries++;
          // Invariant Section 11: Connection timeouts (maximum 1 retry)
          if (timeoutRetries <= 1 && attempt < this.maxRetries) {
            const delayIndex = attempt - 1;
            const delayMs = this.retryDelays[delayIndex] ?? 1000;
            await this.sleep(delayMs);
            continue;
          }

          throw new SMSHubError({
            message: `SMSHub request timed out after ${this.timeoutMs}ms`,
            status: 408,
            errorType: "timeout",
          });
        }

        // Other network errors (e.g. DNS / socket drop)
        if (attempt < this.maxRetries) {
          const delayIndex = attempt - 1;
          const delayMs = this.retryDelays[delayIndex] ?? 1000;
          await this.sleep(delayMs);
          continue;
        }

        throw new SMSHubError({
          message: err?.message || "SMSHub network request failed",
          status: 500,
          errorType: "network_error",
        });
      }
    }

    throw new SMSHubError({
      message: "SMSHub request failed after maximum retries",
      status: 500,
      errorType: "max_retries_exceeded",
    });
  }

  /**
   * Sends an SMS message.
   * Dispatches to /api/sms if mode is live, or /api/test if mode is test.
   */
  async sendSMS(options: SMSHubSendOptions): Promise<SMSHubSendResponse> {
    const endpoint = this.getMode() === "live" ? "/api/sms" : "/api/test";
    return this.request<SMSHubSendResponse>(endpoint, "POST", {
      msisdn: options.msisdn,
      text: options.text,
      track_links: options.trackLinks ?? false,
    });
  }

  /**
   * Phone verification: initiates 6-digit OTP dispatch.
   */
  async verifySend(
    msisdn: string,
    appName: string,
    codeLength: number = 6,
    expiresIn: number = 300
  ): Promise<SMSHubVerifySendResponse> {
    return this.request<SMSHubVerifySendResponse>("/api/verify/send", "POST", {
      msisdn,
      app_name: appName,
      code_length: codeLength,
      expires_in: expiresIn,
    });
  }

  /**
   * Phone verification: validates the user-submitted code.
   */
  async verifyCheck(verificationId: string, code: string): Promise<SMSHubVerifyCheckResponse> {
    return this.request<SMSHubVerifyCheckResponse>("/api/verify/check", "POST", {
      verification_id: verificationId,
      code,
    });
  }

  /**
   * Fetches real-time account balance & credit count.
   */
  async getBalance(): Promise<SMSHubBalanceResponse> {
    return this.request<SMSHubBalanceResponse>("/api/balance", "GET");
  }
}

export const smshub = new SMSHubClient();
