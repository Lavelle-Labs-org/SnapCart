/**
 * Standalone Mock SMSHub HTTP Server (QA-001, #38)
 * Simulates SMSHub gateway endpoints for zero-credit, offline test execution:
 * - POST /api/sms
 * - POST /api/test
 * - POST /api/verify/send
 * - POST /api/verify/check
 * - GET  /api/balance
 *
 * Supports on-demand failure simulations (502, 429, 402, 422, etc.) and
 * signed webhook payload generation.
 */

import http from "http";
import crypto from "crypto";
import { AddressInfo } from "net";

export interface SimulatedError {
  status: number;
  errorType?: string;
  message?: string;
  retryAfter?: number;
}

export interface MockVerificationRecord {
  verificationId: string;
  msisdn: string;
  code: string;
  appName?: string;
  status: "pending" | "approved" | "expired" | "failed";
  expiresAt: Date;
}

export interface MockSentMessage {
  endpoint: string;
  msisdn: string;
  text: string;
  trackLinks?: boolean;
  messageId: string;
  receivedAt: Date;
  idempotencyKey?: string;
}

export interface MockServerRequest {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
  body: any;
  receivedAt: Date;
}

export class MockSMSHubServer {
  private server: http.Server | null = null;
  private port: number = 0;
  private baseUrl: string = "";

  // Server state
  private balanceCredits: number = 100;
  private simulatedErrors: Map<string, SimulatedError> = new Map();
  private verifications: Map<string, MockVerificationRecord> = new Map();
  private sentMessages: MockSentMessage[] = [];
  private requestLog: MockServerRequest[] = [];
  private defaultOtpCode: string = "123456";

  constructor(options?: { initialBalance?: number; defaultOtp?: string }) {
    if (options?.initialBalance !== undefined) {
      this.balanceCredits = options.initialBalance;
    }
    if (options?.defaultOtp) {
      this.defaultOtpCode = options.defaultOtp;
    }
  }

  /**
   * Starts the mock HTTP server on an available/ephemeral port.
   */
  async start(port: number = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(port, "127.0.0.1", () => {
        const addr = this.server!.address() as AddressInfo;
        this.port = addr.port;
        this.baseUrl = `http://127.0.0.1:${this.port}`;
        resolve(this.baseUrl);
      });

      this.server.on("error", (err) => {
        reject(err);
      });
    });
  }

  /**
   * Stops the mock HTTP server.
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Returns the base URL of the running mock server (e.g. http://127.0.0.1:54321).
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Returns the port the mock server is listening on.
   */
  getPort(): number {
    return this.port;
  }

  // ==========================================
  // Simulation Controls (Acceptance Criteria)
  // ==========================================

  /**
   * Sets a simulated error response for a given endpoint path.
   * Matches either exact path (e.g. "/api/sms") or partial path.
   */
  setSimulatedError(endpoint: string, error: SimulatedError): void {
    this.simulatedErrors.set(endpoint, error);
  }

  /**
   * Simulates a 502 Bad Gateway carrier error.
   */
  simulateBadGateway(endpoint: string = "/api/sms"): void {
    this.setSimulatedError(endpoint, {
      status: 502,
      errorType: "provider_error",
      message: "Gateway or upstream carrier error occurred.",
    });
  }

  /**
   * Simulates a 429 Rate Limited error with Retry-After header.
   */
  simulateRateLimit(endpoint: string = "/api/sms", retryAfterSeconds: number = 5): void {
    this.setSimulatedError(endpoint, {
      status: 429,
      errorType: "rate_limited",
      message: "Too many requests. Please slow down.",
      retryAfter: retryAfterSeconds,
    });
  }

  /**
   * Simulates a 402 Insufficient Credits payment required error.
   */
  simulateInsufficientCredits(endpoint: string = "/api/sms"): void {
    this.setSimulatedError(endpoint, {
      status: 402,
      errorType: "insufficient_credits",
      message: "Account credit balance exhausted.",
    });
  }

  /**
   * Simulates a 422 Carrier / Validation error (e.g. carrier_rejected, invalid_msisdn).
   */
  simulateCarrierError(
    endpoint: string = "/api/sms",
    errorType: string = "carrier_rejected",
    message: string = "Carrier rejected message dispatch."
  ): void {
    this.setSimulatedError(endpoint, {
      status: 422,
      errorType,
      message,
    });
  }

  /**
   * Clears all active simulated errors.
   */
  clearSimulatedErrors(): void {
    this.simulatedErrors.clear();
  }

  /**
   * Sets the current credit balance returned by /api/balance.
   */
  setBalance(credits: number): void {
    this.balanceCredits = credits;
  }

  /**
   * Configures the default OTP generated for phone verification.
   */
  setDefaultOtp(code: string): void {
    this.defaultOtpCode = code;
  }

  // ==========================================
  // Inspection & Verification State
  // ==========================================

  getSentMessages(): MockSentMessage[] {
    return [...this.sentMessages];
  }

  getLastMessage(): MockSentMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  getRequests(): MockServerRequest[] {
    return [...this.requestLog];
  }

  getVerification(verificationId: string): MockVerificationRecord | undefined {
    return this.verifications.get(verificationId);
  }

  reset(): void {
    this.simulatedErrors.clear();
    this.sentMessages = [];
    this.requestLog = [];
    this.verifications.clear();
    this.balanceCredits = 100;
  }

  // ==========================================
  // Webhook Signature Helper
  // ==========================================

  /**
   * Creates signed headers for testing SMSHub delivery webhooks (t={timestamp},v1={hex_hmac}).
   */
  createWebhookHeaders(
    rawBody: string,
    event: string = "message.sent",
    secret: string = "mock_webhook_secret_for_tests",
    deliveryId?: string,
    timestampSeconds?: number
  ): Record<string, string> {
    const t = timestampSeconds ?? Math.floor(Date.now() / 1000);
    const delivery = deliveryId ?? `del_${crypto.randomUUID()}`;
    const payloadToSign = `${t}.${rawBody}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payloadToSign)
      .digest("hex");

    return {
      "Content-Type": "application/json",
      "X-SMSHub-Event": event,
      "X-SMSHub-Delivery": delivery,
      "X-SMSHub-Signature": `t=${t},v1=${signature}`,
    };
  }

  // ==========================================
  // Internal Request Router
  // ==========================================

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;
    const method = (req.method || "GET").toUpperCase();

    let bodyChunks: Buffer[] = [];
    req.on("data", (chunk) => {
      bodyChunks.push(chunk);
    });

    req.on("end", () => {
      const rawBody = Buffer.concat(bodyChunks).toString("utf8");
      let parsedBody: any = {};
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }
      }

      this.requestLog.push({
        method,
        path: pathname,
        headers: req.headers,
        body: parsedBody,
        receivedAt: new Date(),
      });

      // 1. Check for simulated error rules
      const simulatedError = this.findMatchingError(pathname);
      if (simulatedError) {
        res.statusCode = simulatedError.status;
        res.setHeader("Content-Type", "application/json");

        if (simulatedError.retryAfter) {
          res.setHeader("Retry-After", String(simulatedError.retryAfter));
        }

        res.end(
          JSON.stringify({
            status: "error",
            error_type: simulatedError.errorType || "simulated_error",
            message: simulatedError.message || "Simulated failure",
            request_id: `req_${crypto.randomBytes(6).toString("hex")}`,
          })
        );
        return;
      }

      // 2. Route endpoint
      if (method === "POST" && pathname === "/api/sms") {
        this.handleSendSms(parsedBody, req.headers, res);
      } else if (method === "POST" && pathname === "/api/test") {
        this.handleTestSms(parsedBody, req.headers, res);
      } else if (method === "POST" && pathname === "/api/verify/send") {
        this.handleVerifySend(parsedBody, res);
      } else if (method === "POST" && pathname === "/api/verify/check") {
        this.handleVerifyCheck(parsedBody, res);
      } else if (method === "GET" && pathname === "/api/balance") {
        this.handleGetBalance(res);
      } else {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            status: "error",
            message: `Mock endpoint not found: ${method} ${pathname}`,
          })
        );
      }
    });
  }

  private findMatchingError(pathname: string): SimulatedError | undefined {
    for (const [key, error] of this.simulatedErrors.entries()) {
      if (pathname === key || pathname.startsWith(key)) {
        return error;
      }
    }
    return undefined;
  }

  private handleSendSms(
    body: any,
    headers: http.IncomingHttpHeaders,
    res: http.ServerResponse
  ): void {
    const msisdn = body?.msisdn || "";
    const text = body?.text || "";
    const messageId = `msg_${crypto.randomBytes(10).toString("hex")}`;
    const requestId = `req_${crypto.randomBytes(6).toString("hex")}`;
    const idempotencyKey = headers["idempotency-key"] as string | undefined;

    // Check credit balance
    if (this.balanceCredits < 1) {
      res.statusCode = 402;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "error",
          error_type: "insufficient_credits",
          message: "Zero credits available",
          request_id: requestId,
        })
      );
      return;
    }

    this.balanceCredits -= 1;

    this.sentMessages.push({
      endpoint: "/api/sms",
      msisdn,
      text,
      trackLinks: body?.track_links,
      messageId,
      receivedAt: new Date(),
      idempotencyKey,
    });

    const isEthio = msisdn.startsWith("09") || msisdn.startsWith("+2519");
    const network = isEthio ? "ethio_telecom" : "safaricom";

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: "success",
        data: {
          message_id: messageId,
          network,
          message_status: "sent",
          credits_used: 1,
          credits_remaining: this.balanceCredits,
          signature_applied: "Order-by-SMS",
          request_id: requestId,
        },
      })
    );
  }

  private handleTestSms(
    body: any,
    headers: http.IncomingHttpHeaders,
    res: http.ServerResponse
  ): void {
    const msisdn = body?.msisdn || "";
    const text = body?.text || "";
    const idempotencyKey = headers["idempotency-key"] as string | undefined;

    this.sentMessages.push({
      endpoint: "/api/test",
      msisdn,
      text,
      trackLinks: body?.track_links,
      messageId: `test_${crypto.randomBytes(8).toString("hex")}`,
      receivedAt: new Date(),
      idempotencyKey,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: "success",
        data: {
          would_send: true,
          final_text: text,
          characters: text.length,
          character_limit: 160,
          encoding: "GSM-7",
        },
      })
    );
  }

  private handleVerifySend(body: any, res: http.ServerResponse): void {
    const msisdn = body?.msisdn || "";
    const verificationId = `ver_${crypto.randomBytes(10).toString("hex")}`;
    const expiresIn = body?.expires_in || 300;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const code = this.defaultOtpCode;

    this.verifications.set(verificationId, {
      verificationId,
      msisdn,
      code,
      appName: body?.app_name,
      status: "pending",
      expiresAt,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: "success",
        data: {
          verification_id: verificationId,
          expires_in: expiresIn,
        },
      })
    );
  }

  private handleVerifyCheck(body: any, res: http.ServerResponse): void {
    const verificationId = body?.verification_id;
    const inputCode = String(body?.code || "").trim();

    const record = this.verifications.get(verificationId);

    if (!record) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            valid: false,
            verification_status: "failed",
          },
        })
      );
      return;
    }

    if (record.status === "approved") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            valid: false,
            verification_status: "failed",
          },
        })
      );
      return;
    }

    if (record.expiresAt < new Date()) {
      record.status = "expired";
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            valid: false,
            verification_status: "expired",
          },
        })
      );
      return;
    }

    const isValid = record.code === inputCode;
    if (isValid) {
      record.status = "approved";
    } else {
      record.status = "failed";
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: "success",
        data: {
          valid: isValid,
          verification_status: isValid ? "approved" : "failed",
        },
      })
    );
  }

  private handleGetBalance(res: http.ServerResponse): void {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: "success",
        data: {
          credits: this.balanceCredits,
          credit_rule: {
            ethio: 1,
            safaricom: 1,
          },
          low_credit_threshold: 10,
        },
      })
    );
  }
}
