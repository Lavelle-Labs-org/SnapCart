import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SMSHubService, SMSHubError } from "../smshub/smshub.service";
import {
  checkPhoneRateLimit,
  checkIpRateLimit,
  enforceRateLimit,
} from "../../lib/rate-limit";
import type { MessageDto, MessageStatus } from "@order-by-sms/contracts";

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SMSHubService)
    private readonly smshubService: SMSHubService
  ) {}

  /**
   * Formats a raw Prisma message entity into a typed MessageDto.
   */
  public formatMessageDto(message: any): MessageDto {
    return {
      id: message.id,
      sellerId: message.seller_id ?? null,
      orderId: message.order_id ?? null,
      recipientPhone: message.recipient_phone,
      event: message.event,
      text: message.text,
      status: message.status as MessageStatus,
      skipReason: message.skip_reason ?? null,
      smshubMessageId: message.smshub_message_id ?? null,
      requestId: message.request_id ?? null,
      network: message.network ?? null,
      creditsUsed: message.credits_used ?? null,
      errorType: message.error_type ?? null,
      attempts: message.attempts,
      createdAt: message.created_at
        ? new Date(message.created_at).toISOString()
        : new Date().toISOString(),
      updatedAt: message.updated_at
        ? new Date(message.updated_at).toISOString()
        : new Date().toISOString(),
    };
  }

  /**
   * Lists all messages belonging to the authenticated seller (ordered newest first).
   * Matches messages either directly attached to the seller or attached via one of the seller's orders.
   */
  async getMessages(sellerId: string): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { seller_id: sellerId },
          { order: { seller_id: sellerId } },
        ],
      },
      orderBy: { created_at: "desc" },
    });

    return messages.map((m) => this.formatMessageDto(m));
  }

  /**
   * Manually retries failed or unknown SMS messages for a seller (BE-016).
   * Enforces:
   * 1. Message existence check (404 Not Found).
   * 2. Seller ownership check (403 Forbidden).
   * 3. Status restriction: only "failed" or "unknown" messages can be resent (400 Bad Request, code: INVALID_MESSAGE_STATUS).
   * 4. Suppression check: skips opted-out recipients without credit consumption.
   * 5. External SMS dispatch via SMSHubService with incremented retry attempts.
   * 6. Database record update with fresh status, credits, message ID, and audit timestamps.
   */
  async resendMessage(
    messageId: string,
    sellerId: string,
    clientIp?: string
  ): Promise<{ resent: boolean; message: MessageDto }> {
    if (clientIp) {
      await enforceRateLimit(
        checkIpRateLimit(this.prisma, clientIp, 10, 3600),
        "Too many message resend attempts from this IP address. Please try again later."
      );
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID '${messageId}' not found`);
    }

    // Verify ownership: direct seller_id or seller_id of associated order
    let isOwner = message.seller_id === sellerId;
    if (!isOwner && message.order_id) {
      const order = await this.prisma.order.findUnique({
        where: { id: message.order_id },
        select: { seller_id: true },
      });
      isOwner = order?.seller_id === sellerId;
    }

    if (!isOwner) {
      throw new ForbiddenException(
        "You do not have permission to resend this message"
      );
    }

    // Enforce status constraint: only failed or unknown messages can be resent
    if (message.status !== "failed" && message.status !== "unknown") {
      throw new HttpException(
        {
          code: "INVALID_MESSAGE_STATUS",
          message: `Message with status '${message.status}' cannot be resent. Only failed or unknown messages are eligible.`,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    await enforceRateLimit(
      checkPhoneRateLimit(this.prisma, message.recipient_phone, 5, 3600),
      "Too many message resend attempts for this phone number. Please try again later."
    );

    // Check suppression list before attempting SMS dispatch
    const suppressionRecord = await this.prisma.suppressionList.findUnique({
      where: { phone: message.recipient_phone },
    });

    if (suppressionRecord) {
      this.logger.warn(
        `[Manual Resend Skipped] Phone ${message.recipient_phone} is in suppression list (reason: ${suppressionRecord.reason}). Message ID: ${messageId}`
      );

      const updated = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          status: "skipped",
          skip_reason: "opted_out",
          attempts: message.attempts + 1,
        },
      });

      return {
        resent: false,
        message: this.formatMessageDto(updated),
      };
    }

    // Dispatch via SMSHub gateway
    try {
      const sendRes = await this.smshubService.sendSMS({
        msisdn: message.recipient_phone,
        text: message.text,
        trackLinks: false,
      });

      const isTestPassed = sendRes.data?.would_send === true;
      const newStatus = isTestPassed ? "test_passed" : "sent";

      const updated = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          status: newStatus,
          smshub_message_id: sendRes.data?.message_id ?? null,
          request_id: sendRes.data?.request_id ?? sendRes.request_id ?? null,
          network: sendRes.data?.network ?? null,
          credits_used: sendRes.data?.credits_used ?? null,
          error_type: null,
          attempts: message.attempts + 1,
        },
      });

      this.logger.log(
        `[Manual Resend Succeeded] Message ${messageId} to ${message.recipient_phone} -> Status: ${newStatus}, SMSHub ID: ${sendRes.data?.message_id}`
      );

      return {
        resent: true,
        message: this.formatMessageDto(updated),
      };
    } catch (err: any) {
      const errorType =
        err instanceof SMSHubError
          ? err.errorType
          : err?.error_type || err?.code || "DISPATCH_FAILED";
      const requestId =
        err instanceof SMSHubError ? err.requestId : err?.request_id || null;

      this.logger.error(
        `[Manual Resend Failed] Message ${messageId} to ${message.recipient_phone}: ${err?.message || err}`
      );

      const updated = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          status: "failed",
          error_type: errorType,
          request_id: requestId,
          attempts: message.attempts + 1,
        },
      });

      return {
        resent: false,
        message: this.formatMessageDto(updated),
      };
    }
  }
}
