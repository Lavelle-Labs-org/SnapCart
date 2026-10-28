import { Injectable, Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

export interface ChapaInitializeOptions {
  amount: number;
  currency?: string;
  email: string;
  firstName: string;
  phoneNumber: string;
  txRef: string;
  callbackUrl: string;
  returnUrl: string;
  title?: string;
  description?: string;
}

export interface ChapaInitializeResult {
  status: "success" | "error";
  message?: string;
  checkoutUrl?: string;
}

export interface ChapaVerifyResult {
  status: "success" | "error";
  message?: string;
  data?: {
    tx_ref: string;
    reference?: string;
    status: string; // 'success' | 'pending' | 'failed'
    amount?: number;
    currency?: string;
    payment_method?: string;
  };
}

@Injectable()
export class ChapaService {
  private readonly logger = new Logger(ChapaService.name);
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor() {
    this.baseUrl = (process.env.CHAPA_BASE_URL || "https://api.chapa.co/v1").replace(/\/$/, "");
    this.secretKey = process.env.CHAPA_SECRET_KEY || "";
    this.webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || "";
  }

  /**
   * Initializes a transaction on Chapa hosted checkout.
   */
  async initializeTransaction(options: ChapaInitializeOptions): Promise<ChapaInitializeResult> {
    const isMock =
      !this.secretKey ||
      this.secretKey.includes("mock") ||
      this.secretKey.includes("xxxx") ||
      process.env.NODE_ENV === "test";

    if (isMock) {
      this.logger.log(`[Chapa Mock] Simulated transaction initialization for tx_ref ${options.txRef}`);
      const mockSeparator = options.returnUrl.includes("?") ? "&" : "?";
      return {
        status: "success",
        message: "Mock hosted checkout link",
        checkoutUrl: `${options.returnUrl}${mockSeparator}mock_tx_ref=${options.txRef}&status=success`,
      };
    }

    try {
      const payload = {
        amount: options.amount.toString(),
        currency: options.currency || "ETB",
        email: options.email,
        first_name: (options.firstName || "Seller").slice(0, 30),
        phone_number: options.phoneNumber,
        tx_ref: options.txRef,
        callback_url: options.callbackUrl,
        return_url: options.returnUrl,
        customization: {
          title: (options.title || "Snapcart").slice(0, 16),
          description: (options.description || "SMS Credits Package").slice(0, 100),
        },
      };

      const res = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;

      if (!res.ok || data?.status !== "success") {
        let errorMsg = "Failed to initialize payment with Chapa";
        if (typeof data?.message === "string") {
          errorMsg = data.message;
        } else if (data?.message && typeof data.message === "object") {
          errorMsg = Object.entries(data.message)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : String(errs)}`)
            .join("; ");
        } else if (res.statusText) {
          errorMsg = res.statusText;
        }

        this.logger.error(`[Chapa Init Error] ${errorMsg}`, JSON.stringify(data));
        return {
          status: "error",
          message: errorMsg,
        };
      }

      return {
        status: "success",
        message: data.message,
        checkoutUrl: data.data?.checkout_url,
      };
    } catch (err: any) {
      this.logger.error(`[Chapa Init Exception] ${err?.message || err}`, err?.stack);
      return {
        status: "error",
        message: err?.message || "Payment service connection error",
      };
    }
  }

  /**
   * Verifies a transaction status with Chapa.
   */
  async verifyTransaction(txRef: string): Promise<ChapaVerifyResult> {
    const isMock =
      !this.secretKey ||
      this.secretKey.includes("mock") ||
      this.secretKey.includes("xxxx") ||
      process.env.NODE_ENV === "test";

    if (isMock) {
      this.logger.log(`[Chapa Mock] Simulated verification for tx_ref ${txRef}`);
      return {
        status: "success",
        data: {
          tx_ref: txRef,
          reference: `chapa_mock_${Date.now()}`,
          status: "success",
          amount: 50,
          currency: "ETB",
          payment_method: "telebirr",
        },
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/transaction/verify/${encodeURIComponent(txRef)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const data = (await res.json()) as any;

      if (!res.ok || data?.status !== "success") {
        return {
          status: "error",
          message: data?.message || "Failed to verify transaction with Chapa",
        };
      }

      return {
        status: "success",
        data: data.data,
      };
    } catch (err: any) {
      this.logger.error(`[Chapa Verify Exception] ${err?.message || err}`, err?.stack);
      return {
        status: "error",
        message: err?.message || "Payment verification connection error",
      };
    }
  }

  /**
   * Verifies HMAC SHA-256 signature from Chapa webhook.
   */
  verifyWebhookSignature(signature: string | undefined, rawPayload: string): boolean {
    if (!signature || !this.webhookSecret) {
      return false;
    }

    try {
      const expected = createHmac("sha256", this.webhookSecret)
        .update(rawPayload)
        .digest("hex");

      const sigBuf = Buffer.from(signature, "utf-8");
      const expBuf = Buffer.from(expected, "utf-8");

      if (sigBuf.length !== expBuf.length) {
        return false;
      }

      return timingSafeEqual(sigBuf, expBuf);
    } catch (err: any) {
      this.logger.warn(`Failed to verify Chapa signature: ${err?.message || err}`);
      return false;
    }
  }
}
