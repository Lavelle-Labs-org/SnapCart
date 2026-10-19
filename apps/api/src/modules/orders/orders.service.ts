import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SMSOrchestratorService } from "../smshub/sms-orchestrator.service";
import {
  CryptoService,
  generatePickupCode as defaultGeneratePickupCode,
  hashPickupCode as defaultHashPickupCode,
  verifyPickupCodeHash as defaultVerifyPickupCodeHash,
  hashActionToken as defaultHashActionToken,
} from "../crypto/crypto.service";
import { OrderState, validateStateTransition } from "@order-by-sms/contracts";
import {
  OrderActor,
  TransitionOrderOptions,
  TransitionOrderResult,
  ReissuePickupCodeResult,
} from "./orders.types";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(SMSOrchestratorService)
    private readonly smsOrchestrator?: SMSOrchestratorService,
    @Optional()
    @Inject(CryptoService)
    private readonly cryptoService?: CryptoService
  ) {}

  /**
   * Centralized Order State Orchestrator (BE-010)
   * Enforces business rules, transitions order lifecycle, records audit events,
   * generates & hashes pickup codes on 'ready', and dispatches buyer SMS notifications.
   *
   * Allowed Transitions:
   *   new -> accepted | rejected
   *   accepted -> ready
   *   ready -> completed
   */
  async transitionOrderState(
    orderId: string,
    targetState: OrderState,
    actor: OrderActor,
    options?: TransitionOrderOptions
  ): Promise<TransitionOrderResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { seller: true },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    const currentState = order.state as OrderState;
    const validation = validateStateTransition(currentState, targetState);

    // Idempotency: If already in target state, return success without duplicate mutations
    if (validation.isIdempotent) {
      this.logger.log(
        `[Order Transition Idempotent] Order #${order.number} (${orderId}) already in state '${targetState}'. No action taken.`
      );
      return {
        success: true,
        isIdempotent: true,
        orderId: order.id,
        orderNumber: order.number,
        previousState: currentState,
        currentState: targetState,
        message: validation.message,
      };
    }

    // Invalid transition check: reject with 409 Conflict
    if (!validation.allowed) {
      this.logger.warn(
        `[Order Transition Rejected] Invalid transition from '${currentState}' to '${targetState}' for order #${order.number} (${orderId})`
      );
      throw new ConflictException(
        validation.message ||
          `Cannot transition order from '${currentState}' to '${targetState}'`
      );
    }

    // Perform atomic state mutation and audit logging
    let generatedPickupCode: string | undefined;

    await this.prisma.$transaction(async (tx) => {
      // 1. Update order state
      await tx.order.update({
        where: { id: orderId },
        data: { state: targetState },
      });

      // 2. Insert audit event into order_events
      await tx.orderEvent.create({
        data: {
          order_id: orderId,
          from_state: currentState,
          to_state: targetState,
          actor,
        },
      });

      // 3. Side effects: When transitioning to 'ready', generate and store 4-digit pickup code
      if (targetState === "ready") {
        generatedPickupCode =
          options?.pickupCode ||
          (this.cryptoService
            ? this.cryptoService.generatePickupCode()
            : defaultGeneratePickupCode());

        const codeHash = this.cryptoService
          ? this.cryptoService.hashPickupCode(generatedPickupCode)
          : defaultHashPickupCode(generatedPickupCode);

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await tx.pickupCode.upsert({
          where: { order_id: orderId },
          create: {
            order_id: orderId,
            code_hash: codeHash,
            expires_at: expiresAt,
            attempts: 0,
            issued_at: new Date(),
          },
          update: {
            code_hash: codeHash,
            expires_at: expiresAt,
            attempts: 0,
            issued_at: new Date(),
          },
        });
      }

      // 4. Side effects: When reaching terminal states 'completed' or 'rejected', revoke active action tokens
      if (targetState === "completed" || targetState === "rejected") {
        await tx.actionToken.updateMany({
          where: { order_id: orderId, revoked_at: null },
          data: { revoked_at: new Date() },
        });
      }
    });

    this.logger.log(
      `[Order Transition Committed] Order #${order.number} (${orderId}) transitioned from '${currentState}' to '${targetState}' by '${actor}'`
    );

    // 5. Outbound SMS Notifications (Dispatched after DB commit; SMS failures never roll back state)
    let smsResult;
    const shopName =
      order.seller?.sms_name || order.seller?.business_name || "Shop";

    if (this.smsOrchestrator) {
      if (targetState === "accepted") {
        smsResult = await this.smsOrchestrator.sendOrderSMS({
          orderId: order.id,
          sellerId: order.seller_id,
          recipientPhone: order.buyer_phone,
          event: "buyer_order_accepted",
          shopName,
          orderNumber: order.number,
          link: options?.link ?? "",
          smsConsent: order.sms_consent,
          throwOnError: options?.throwOnSMSFailure ?? false,
        });
      } else if (targetState === "rejected") {
        smsResult = await this.smsOrchestrator.sendOrderSMS({
          orderId: order.id,
          sellerId: order.seller_id,
          recipientPhone: order.buyer_phone,
          event: "buyer_order_rejected",
          shopName,
          orderNumber: order.number,
          smsConsent: order.sms_consent,
          throwOnError: options?.throwOnSMSFailure ?? false,
        });
      } else if (targetState === "ready") {
        smsResult = await this.smsOrchestrator.sendOrderSMS({
          orderId: order.id,
          sellerId: order.seller_id,
          recipientPhone: order.buyer_phone,
          event: "buyer_order_ready",
          shopName,
          orderNumber: order.number,
          code: generatedPickupCode,
          smsConsent: order.sms_consent,
          throwOnError: options?.throwOnSMSFailure ?? false,
        });
      }
      // 'completed' triggers no outbound SMS per FR-18
    }

    return {
      success: true,
      isIdempotent: false,
      orderId: order.id,
      orderNumber: order.number,
      previousState: currentState,
      currentState: targetState,
      pickupCode: generatedPickupCode,
      smsResult,
    };
  }

  /**
   * Reissues a fresh 4-digit pickup code for an order in 'ready' state.
   * Resets attempts to 0, sets 7-day expiration, records audit event,
   * and texts the buyer the new code via SMS.
   */
  async reissuePickupCode(
    orderId: string,
    actor: OrderActor = "seller_dash"
  ): Promise<ReissuePickupCodeResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { seller: true },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    if (order.state !== "ready") {
      throw new ConflictException(
        `Cannot reissue pickup code unless order is in 'ready' state (current: '${order.state}')`
      );
    }

    const newCode = this.cryptoService
      ? this.cryptoService.generatePickupCode()
      : defaultGeneratePickupCode();

    const codeHash = this.cryptoService
      ? this.cryptoService.hashPickupCode(newCode)
      : defaultHashPickupCode(newCode);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.$transaction(async (tx) => {
      await tx.pickupCode.update({
        where: { order_id: orderId },
        data: {
          code_hash: codeHash,
          attempts: 0,
          expires_at: expiresAt,
          issued_at: new Date(),
        },
      });

      await tx.orderEvent.create({
        data: {
          order_id: orderId,
          from_state: "ready",
          to_state: "ready",
          actor,
        },
      });
    });

    this.logger.log(
      `[Pickup Code Reissued] Order #${order.number} (${orderId}) reissued code by '${actor}'`
    );

    let smsResult;
    if (this.smsOrchestrator) {
      const shopName =
        order.seller?.sms_name || order.seller?.business_name || "Shop";

      smsResult = await this.smsOrchestrator.sendOrderSMS({
        orderId: order.id,
        sellerId: order.seller_id,
        recipientPhone: order.buyer_phone,
        event: "buyer_new_pickup_code",
        shopName,
        orderNumber: order.number,
        code: newCode,
        smsConsent: order.sms_consent,
        throwOnError: false,
      });
    }

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.number,
      pickupCode: newCode,
      smsResult,
    };
  }

  /**
   * Resolves and verifies an unguessable 16-byte (22-char base64url) seller action token.
   * Enforces:
   * 1. SHA-256 hash lookup in action_tokens.
   * 2. Rejection if token does not exist (404).
   * 3. Rejection if token is expired (>48h) (404).
   * 4. Rejection if token has been revoked (404).
   * 5. Rejection if purpose is not 'seller_action' (404).
   */
  async resolveActionToken(token: string) {
    if (!token || typeof token !== "string") {
      throw new NotFoundException("Invalid or missing action token");
    }

    const tokenHash = this.cryptoService
      ? this.cryptoService.hashActionToken(token)
      : defaultHashActionToken(token);

    const tokenRecord = await this.prisma.actionToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        order: {
          include: {
            seller: true,
            order_items: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new NotFoundException("Invalid or unknown action token");
    }

    if (tokenRecord.revoked_at !== null) {
      throw new NotFoundException(
        "Action link has been revoked or already completed"
      );
    }

    if (tokenRecord.expires_at < new Date()) {
      throw new NotFoundException("Action link has expired");
    }

    if (tokenRecord.purpose !== "seller_action") {
      throw new NotFoundException("Invalid action token purpose");
    }

    if (!tokenRecord.order) {
      throw new NotFoundException("Order associated with token not found");
    }

    return tokenRecord;
  }

  /**
   * Verifies 4-digit pickup code and completes handover (BE-012, FR-20, Sec 9.2).
   * 1. Validates order is in 'ready' state.
   * 2. Checks pickup_codes attempts; if >= 5, rejects as locked.
   * 3. Checks expiration (7 days).
   * 4. Constant-time comparison of code HMAC hash.
   * 5. On failure: increments attempts, calculates remaining attempts, throws 400.
   * 6. On success: transitions order state to 'completed', commits order event, revokes action tokens.
   */
  async completeWithPickupCode(
    orderId: string,
    rawCode: string,
    actor: "seller_link" | "seller_dash"
  ): Promise<TransitionOrderResult> {
    if (!rawCode || typeof rawCode !== "string") {
      throw new BadRequestException("Pickup code is required");
    }

    const cleanCode = rawCode.trim();
    if (!/^\d{4}$/.test(cleanCode)) {
      throw new BadRequestException("Pickup code must be exactly 4 digits");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: true,
        pickup_code: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.state !== "ready") {
      throw new ConflictException(
        `Cannot complete order #${order.number}: current state is '${order.state}', expected 'ready'`
      );
    }

    let pickupRecord = order.pickup_code;
    if (!pickupRecord) {
      pickupRecord = await this.prisma.pickupCode.findUnique({
        where: { order_id: orderId },
      });
    }

    if (!pickupRecord) {
      throw new BadRequestException(
        "No pickup code found for this order. Please reissue code."
      );
    }

    // 1. Check if locked (>= 5 attempts)
    if (pickupRecord.attempts >= 5) {
      throw new HttpException(
        {
          code: "PICKUP_CODE_LOCKED",
          message:
            "Pickup code is locked after 5 failed attempts. Seller must reissue code.",
          remainingAttempts: 0,
          isLocked: true,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // 2. Check expiration
    if (pickupRecord.expires_at < new Date()) {
      throw new HttpException(
        {
          code: "PICKUP_CODE_EXPIRED",
          message: "Pickup code has expired. Seller must reissue code.",
          remainingAttempts: 0,
          isLocked: true,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // 3. Constant-time HMAC comparison
    const isValid = this.cryptoService
      ? this.cryptoService.verifyPickupCodeHash(cleanCode, pickupRecord.code_hash)
      : defaultVerifyPickupCodeHash(cleanCode, pickupRecord.code_hash);

    if (!isValid) {
      const newAttempts = pickupRecord.attempts + 1;
      await this.prisma.pickupCode.update({
        where: { order_id: orderId },
        data: { attempts: newAttempts },
      });

      const remainingAttempts = Math.max(0, 5 - newAttempts);
      const isLocked = newAttempts >= 5;

      this.logger.warn(
        `[Pickup Code Failed] Order #${order.number} (${orderId}): attempt ${newAttempts}/5 failed`
      );

      throw new HttpException(
        {
          code: "INVALID_PICKUP_CODE",
          message: isLocked
            ? "Pickup code locked after 5 failed attempts. Please reissue a new code."
            : `Invalid pickup code. ${remainingAttempts} attempts remaining.`,
          remainingAttempts,
          isLocked,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // 4. Code matches! Transition order to 'completed'
    return this.transitionOrderState(orderId, "completed", actor);
  }
}

