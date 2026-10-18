/**
 * SMSHub API Client
 * Wraps /api/sms, /api/test, /api/verify/send, /api/verify/check, and /api/balance.
 * Sections 8.1, 8.2, 8.3, 8.5
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

export class SMSHubClient {
  private apiKey: string;
  private baseUrl: string;
  private mode: "test" | "live";

  constructor(options?: { apiKey?: string; baseUrl?: string; mode?: "test" | "live" }) {
    this.apiKey = options?.apiKey ?? env.SMSHUB_API_KEY;
    this.baseUrl = (options?.baseUrl || "https://smshub.et").replace(/\/$/, "");
    this.mode = options?.mode ?? env.SMSHUB_MODE;
  }

  private async request<T>(path: string, method: string = "GET", body?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = await res.json();
      return json as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Sends an SMS message.
   * Dispatches to /api/sms if mode is live, or /api/test if mode is test.
   */
  async sendSMS(options: SMSHubSendOptions): Promise<SMSHubSendResponse> {
    const endpoint = this.mode === "live" ? "/api/sms" : "/api/test";
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
  async getBalance(): Promise<{ status: string; credits?: number; error?: string }> {
    return this.request<{ status: string; credits?: number; error?: string }>("/api/balance", "GET");
  }

  getMode() {
    return this.mode;
  }
}

export const smshub = new SMSHubClient();
