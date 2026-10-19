import { Injectable, Inject, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface WebhookProcessingResult {
  received: boolean;
  event: string;
  deliveryId: string;
  duplicate?: boolean;
}

/**
 * Strips sensitive plaintext (pickup codes, OTPs, tokens, and secret fields)
 * from webhook payloads before persisting to `message_events.raw_payload` (docs/05, docs/06).
 */
export function sanitizeWebhookPayload(payload: any, rawBody?: string): string {
  if (payload && typeof payload === "object") {
    try {
      const copy = JSON.parse(JSON.stringify(payload));

      const sanitizeObject = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        for (const key of Object.keys(obj)) {
          const lowerKey = key.toLowerCase();
          // Redact explicit code/otp/token keys
          if (
            lowerKey === "code" ||
            lowerKey === "otp" ||
            lowerKey === "pickup_code" ||
            lowerKey === "pickupcode" ||
            lowerKey === "token" ||
            lowerKey === "password" ||
            lowerKey === "secret"
          ) {
            obj[key] = "[REDACTED]";
          } else if (
            typeof obj[key] === "string" &&
            (lowerKey === "text" || lowerKey === "message" || lowerKey === "body")
          ) {
            // Strip sensitive numeric codes (4-digit pickup code or 6-digit OTP) from text
            obj[key] = obj[key]
              .replace(/\b\d{4,6}\b/g, "[REDACTED]")
              .replace(/(code:\s*)[^\s.]+/gi, "$1[REDACTED]");
          } else if (typeof obj[key] === "object") {
            sanitizeObject(obj[key]);
          }
        }
      };

      sanitizeObject(copy);
      return JSON.stringify(copy);
    } catch {
      // fallback to regex sanitization below
    }
  }

  if (rawBody && typeof rawBody === "string") {
    return rawBody
      .replace(/"(code|otp|pickup_code|pickupcode)":\s*"[^"]*"/gi, '"$1":"[REDACTED]"')
      .replace(/(Pickup\s+code:\s*)\d{4}/gi, "$1[REDACTED]")
      .replace(/(code\s+is\s*)\d{4,6}/gi, "$1[REDACTED]");
  }

  return rawBody || "{}";
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async handleSMSHubWebhook(options: {
    eventType: string;
    deliveryId: string;
    payload: any;
    rawBody: string;
  }): Promise<WebhookProcessingResult> {
    const { eventType, deliveryId, payload, rawBody } = options;

    // 1. Idempotency Check: prevent duplicate event processing if delivery_id is already recorded
    if (deliveryId) {
      const existing = await this.prisma.messageEvent.findUnique({
        where: { delivery_id: deliveryId },
      });

      if (existing) {
        this.logger.log(
          `Idempotent duplicate webhook delivery detected: ${deliveryId}. Acknowledging without reprocessing.`
        );
        return {
          received: true,
          event: eventType,
          deliveryId,
          duplicate: true,
        };
      }
    }

    // 2. Locate associated Message by smshub_message_id
    const smshubMessageId =
      payload?.data?.message_id ||
      payload?.message_id ||
      payload?.data?.id ||
      payload?.id;

    let messageRecord: { id: string } | null = null;
    if (smshubMessageId && typeof smshubMessageId === "string") {
      messageRecord = await this.prisma.message.findUnique({
        where: { smshub_message_id: smshubMessageId },
        select: { id: true },
      });

      if (messageRecord) {
        // On message.sent (or message.delivered), update status to 'sent'
        if (eventType === "message.sent" || eventType === "message.delivered") {
          await this.prisma.message.update({
            where: { id: messageRecord.id },
            data: {
              status: "sent",
              updated_at: new Date(),
            },
          });
          this.logger.log(
            `Updated message ${messageRecord.id} (SMSHub ID: ${smshubMessageId}) status to 'sent'`
          );
        } else if (
          eventType === "message.failed" ||
          eventType === "message.undelivered"
        ) {
          // On message.failed, update status to 'failed' with error_type
          const errorType =
            payload?.data?.error_type ||
            payload?.error_type ||
            payload?.data?.error ||
            payload?.error ||
            "carrier_failure";

          await this.prisma.message.update({
            where: { id: messageRecord.id },
            data: {
              status: "failed",
              error_type: errorType,
              updated_at: new Date(),
            },
          });
          this.logger.warn(
            `Updated message ${messageRecord.id} (SMSHub ID: ${smshubMessageId}) status to 'failed' (error_type: ${errorType})`
          );
        }
      }
    }

    // 3. Sanitize payload: strip any plain pickup codes, OTPs, or sensitive text before saving
    const sanitizedRaw = sanitizeWebhookPayload(payload, rawBody);

    // 4. Save to message_events table for delivery auditing
    if (deliveryId) {
      try {
        await this.prisma.messageEvent.create({
          data: {
            delivery_id: deliveryId,
            message_id: messageRecord?.id ?? null,
            event_type: eventType || "unknown",
            raw_payload: sanitizedRaw,
          },
        });
      } catch (err: any) {
        // If unique constraint violation race happens, treat as idempotent success
        if (err?.code === "P2002") {
          return {
            received: true,
            event: eventType,
            deliveryId,
            duplicate: true,
          };
        }
        throw err;
      }
    }

    // 5. Fast 200 acknowledgment response within 6 seconds
    return {
      received: true,
      event: eventType,
      deliveryId,
    };
  }
}
