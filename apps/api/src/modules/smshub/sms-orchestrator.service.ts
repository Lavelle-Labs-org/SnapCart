import { Injectable, Inject, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SMSHubService, SMSHubError } from "./smshub.service";
import { SMS_TEMPLATES } from "./templates";
import { normalizePhoneNumber } from "@order-by-sms/contracts";
import {
  SendOrderSMSOptions,
  SendSMSResult,
  isBuyerConsentRequiredEvent,
  maskCodeInText,
} from "./sms.types";

@Injectable()
export class SMSOrchestratorService {
  private readonly logger = new Logger(SMSOrchestratorService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SMSHubService)
    private readonly smshubService: SMSHubService
  ) {}

  /**
   * Authoritative SMS Notification Orchestrator (BE-007)
   * Dispatches SMS events through SMSHub while strictly enforcing:
   * 1. Recipient phone normalization (Ethiopian 10-digit format).
   * 2. Buyer consent verification (checks checkout consent).
   * 3. Suppression list enforcement (skips opted-out phones with zero credit consumption).
   * 4. Privacy masking (plain pickup codes masked with **** before writing to messages.text).
   * 5. Immutable audit logging in the `messages` table.
   */
  async sendOrderSMS(options: SendOrderSMSOptions): Promise<SendSMSResult> {
    const normalizedPhone = normalizePhoneNumber(options.recipientPhone);

    // Render template text or use pre-rendered text
    const rawText = this.renderEventText(options);
    const maskedText = maskCodeInText(rawText, options.code);

    // 1. Suppression list check (opted-out numbers never receive SMS)
    const suppressionRecord = await this.prisma.suppressionList.findUnique({
      where: { phone: normalizedPhone },
    });

    if (suppressionRecord) {
      this.logger.warn(
        `[SMS Skipped] Phone ${normalizedPhone} is in suppression_list (reason: ${suppressionRecord.reason}). Event: ${options.event}`
      );

      const msg = await this.prisma.message.create({
        data: {
          seller_id: options.sellerId ?? null,
          order_id: options.orderId ?? null,
          recipient_phone: normalizedPhone,
          event: options.event,
          text: maskedText,
          status: "skipped",
          skip_reason: "opted_out",
          attempts: 0,
        },
      });

      return {
        status: "skipped",
        messageId: msg.id,
        skipReason: "opted_out",
        text: maskedText,
      };
    }

    // 2. Buyer consent check (buyer notification events strictly require checkout consent)
    if (isBuyerConsentRequiredEvent(options.event)) {
      let consent = options.smsConsent;

      if (consent === undefined && options.orderId) {
        const order = await this.prisma.order.findUnique({
          where: { id: options.orderId },
        });
        consent = order ? order.sms_consent : false;
      }

      if (consent === false) {
        this.logger.warn(
          `[SMS Skipped] Buyer has not consented to SMS for order ${options.orderId}. Event: ${options.event}`
        );

        const msg = await this.prisma.message.create({
          data: {
            seller_id: options.sellerId ?? null,
            order_id: options.orderId ?? null,
            recipient_phone: normalizedPhone,
            event: options.event,
            text: maskedText,
            status: "skipped",
            skip_reason: "opted_out",
            attempts: 0,
          },
        });

        return {
          status: "skipped",
          messageId: msg.id,
          skipReason: "opted_out",
          text: maskedText,
        };
      }
    }

    // 3. Dispatch to SMSHub gateway
    try {
      const sendRes = await this.smshubService.sendSMS({
        msisdn: normalizedPhone,
        text: rawText,
        trackLinks: false,
        idempotencyKey: options.idempotencyKey,
      });

      const isTestPassed = sendRes.data?.would_send === true;
      const status = isTestPassed ? "test_passed" : "sent";

      const msg = await this.prisma.message.create({
        data: {
          seller_id: options.sellerId ?? null,
          order_id: options.orderId ?? null,
          recipient_phone: normalizedPhone,
          event: options.event,
          text: maskedText,
          status,
          smshub_message_id: sendRes.data?.message_id ?? null,
          request_id: sendRes.data?.request_id ?? sendRes.request_id ?? null,
          network: sendRes.data?.network ?? null,
          credits_used: sendRes.data?.credits_used ?? null,
          attempts: 1,
        },
      });

      this.logger.log(
        `[SMS Dispatched] Event ${options.event} to ${normalizedPhone} - Status: ${status}, MessageId: ${sendRes.data?.message_id}`
      );

      return {
        status,
        messageId: msg.id,
        smshubMessageId: sendRes.data?.message_id,
        creditsUsed: sendRes.data?.credits_used,
        text: maskedText,
      };
    } catch (err: any) {
      const errorType =
        err instanceof SMSHubError
          ? err.errorType
          : err?.error_type || err?.code || "DISPATCH_FAILED";
      const requestId =
        err instanceof SMSHubError ? err.requestId : err?.request_id || null;

      this.logger.error(
        `[SMS Dispatch Failed] Event ${options.event} to ${normalizedPhone}: ${err?.message || err}`,
        err?.stack
      );

      const msg = await this.prisma.message.create({
        data: {
          seller_id: options.sellerId ?? null,
          order_id: options.orderId ?? null,
          recipient_phone: normalizedPhone,
          event: options.event,
          text: maskedText,
          status: "failed",
          error_type: errorType,
          request_id: requestId,
          attempts: 1,
        },
      });

      if (options.throwOnError) {
        throw err;
      }

      return {
        status: "failed",
        messageId: msg.id,
        errorType,
        text: maskedText,
      };
    }
  }

  /**
   * Resolves the SMS message body according to event type and options.
   */
  private renderEventText(opts: SendOrderSMSOptions): string {
    if (opts.text && opts.text.trim().length > 0) {
      return opts.text;
    }

    const event = opts.event.toLowerCase();

    switch (event) {
      case "seller_new_order":
      case "new_order":
        return SMS_TEMPLATES.sellerNewOrder({
          shopName: opts.shopName ?? "Shop",
          orderNumber: opts.orderNumber ?? 0,
          itemCount: opts.itemCount ?? 0,
          totalBirr: opts.totalBirr ?? 0,
          link: opts.link ?? "",
        });

      case "buyer_order_accepted":
      case "accepted":
        return SMS_TEMPLATES.buyerAccepted({
          shopName: opts.shopName ?? "Shop",
          orderNumber: opts.orderNumber ?? 0,
          link: opts.link ?? "",
        });

      case "buyer_order_rejected":
      case "rejected":
        return SMS_TEMPLATES.buyerRejected({
          shopName: opts.shopName ?? "Shop",
          orderNumber: opts.orderNumber ?? 0,
        });

      case "buyer_order_ready":
      case "ready":
        return SMS_TEMPLATES.buyerReady({
          shopName: opts.shopName ?? "Shop",
          orderNumber: opts.orderNumber ?? 0,
          code: opts.code ?? "0000",
        });

      case "buyer_new_pickup_code":
      case "new_pickup_code":
        return SMS_TEMPLATES.buyerNewPickupCode({
          shopName: opts.shopName ?? "Shop",
          orderNumber: opts.orderNumber ?? 0,
          code: opts.code ?? "0000",
        });

      case "seller_phone_code":
        return `Your ${opts.shopName ?? "Order-by-SMS"} verification code is ${opts.code ?? "000000"}`;

      case "buyer_phone_code":
        return `Your verification code for ${opts.shopName ?? "your order"} is ${opts.code ?? "000000"}`;

      default:
        return `${opts.shopName ?? "Shop"}: order #${opts.orderNumber ?? 0} update.`;
    }
  }
}
