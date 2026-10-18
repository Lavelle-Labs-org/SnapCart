import { Injectable, Inject, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface WebhookProcessingResult {
  received: boolean;
  event: string;
  deliveryId: string;
  duplicate?: boolean;
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

    // 1. Idempotency Check: prevent duplicate event processing
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
      payload?.data?.message_id || payload?.message_id || payload?.data?.id;

    let messageRecord: { id: string } | null = null;
    if (smshubMessageId && typeof smshubMessageId === "string") {
      messageRecord = await this.prisma.message.findUnique({
        where: { smshub_message_id: smshubMessageId },
        select: { id: true },
      });

      if (messageRecord) {
        if (eventType === "message.sent" || eventType === "message.delivered") {
          await this.prisma.message.update({
            where: { id: messageRecord.id },
            data: {
              status: "sent",
              updated_at: new Date(),
            },
          });
        } else if (eventType === "message.failed") {
          await this.prisma.message.update({
            where: { id: messageRecord.id },
            data: {
              status: "failed",
              error_type:
                payload?.data?.error_type || payload?.error_type || "carrier_failure",
              updated_at: new Date(),
            },
          });
        }
      }
    }

    // 3. Sanitize payload: strip any plain pickup codes or OTPs before saving
    let sanitizedRaw = rawBody;
    try {
      if (payload && typeof payload === "object") {
        const copy = JSON.parse(JSON.stringify(payload));
        if (copy.code) copy.code = "[REDACTED]";
        if (copy.data?.code) copy.data.code = "[REDACTED]";
        if (copy.otp) copy.otp = "[REDACTED]";
        if (copy.data?.otp) copy.data.otp = "[REDACTED]";
        sanitizedRaw = JSON.stringify(copy);
      }
    } catch {
      // fallback to original string
    }

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
