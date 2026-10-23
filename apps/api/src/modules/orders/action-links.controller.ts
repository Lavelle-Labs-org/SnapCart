import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  NotFoundException,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CryptoService,
  hashActionToken as defaultHashActionToken,
} from "../crypto/crypto.service";
import { OrderDto, OrderState } from "@order-by-sms/contracts";
import { CompleteOrderDto } from "./orders.types";

@Controller("a")
export class ActionLinksController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService,
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
    @Optional()
    @Inject(CryptoService)
    private readonly cryptoService?: CryptoService
  ) {}

  /**
   * Helper to verify action token against database.
   * Rejects with 404 if token does not exist, is expired (>48h), or has been revoked.
   */
  private async resolveTokenRecord(token: string) {
    if (this.prisma?.actionToken?.findUnique) {
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

    return this.ordersService.resolveActionToken(token);
  }

  /**
   * Transforms Prisma order entity to shared OrderDto format.
   */
  private formatOrderDto(order: any, stateOverride?: OrderState): OrderDto {
    return {
      id: order.id,
      sellerId: order.seller_id,
      number: order.number,
      buyerName: order.buyer_name,
      buyerPhone: order.buyer_phone,
      smsConsent: order.sms_consent,
      consentWording: order.consent_wording,
      consentAt: order.consent_at ? new Date(order.consent_at).toISOString() : null,
      state: (stateOverride || order.state) as OrderState,
      totalSantim: order.total_santim,
      createdAt: order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString(),
      items: order.order_items?.map((item: any) => ({
        id: item.id,
        orderId: item.order_id,
        productId: item.product_id,
        nameAtOrder: item.name_at_order,
        unitPriceSantim: item.unit_price_santim,
        quantity: item.quantity,
      })),
    };
  }

  /**
   * GET /api/a/:token
   * Read-only preview of order details for the seller action link.
   * Strictly read-only (FR-21 & Invariants).
   */
  @Get(":token")
  @HttpCode(HttpStatus.OK)
  async getActionOrder(@Param("token") token: string) {
    const tokenRecord = await this.resolveTokenRecord(token);
    const orderDto = this.formatOrderDto(tokenRecord.order);

    return {
      ...orderDto,
      order: orderDto,
      actionToken: token,
      orderNumber: orderDto.number,
    };
  }

  /**
   * POST /api/a/:token/accept
   * Accepts an order from the mobile SMS link.
   * Invokes centralized OrdersService.transitionOrderState('accepted', 'seller_link').
   */
  @Post(":token/accept")
  @HttpCode(HttpStatus.OK)
  async acceptOrder(@Param("token") token: string) {
    const tokenRecord = await this.resolveTokenRecord(token);
    const result = await this.ordersService.transitionOrderState(
      tokenRecord.order_id,
      "accepted",
      "seller_link"
    );

    const orderDto = this.formatOrderDto(tokenRecord.order, result.currentState);

    return {
      ...orderDto,
      isIdempotent: result.isIdempotent,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      currentState: result.currentState,
      previousState: result.previousState,
      smsStatus: result.smsResult?.status,
      smsMessageId:
        result.smsResult?.smshubMessageId || result.smsResult?.messageId,
      order: orderDto,
    };
  }

  /**
   * POST /api/a/:token/reject
   * Rejects an order from the mobile SMS link.
   * Invokes centralized OrdersService.transitionOrderState('rejected', 'seller_link').
   */
  @Post(":token/reject")
  @HttpCode(HttpStatus.OK)
  async rejectOrder(@Param("token") token: string) {
    const tokenRecord = await this.resolveTokenRecord(token);
    const result = await this.ordersService.transitionOrderState(
      tokenRecord.order_id,
      "rejected",
      "seller_link"
    );

    const orderDto = this.formatOrderDto(tokenRecord.order, result.currentState);

    return {
      ...orderDto,
      isIdempotent: result.isIdempotent,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      currentState: result.currentState,
      previousState: result.previousState,
      smsStatus: result.smsResult?.status,
      smsMessageId:
        result.smsResult?.smshubMessageId || result.smsResult?.messageId,
      order: orderDto,
    };
  }

  /**
   * POST /api/a/:token/ready
   * Marks an order ready from the mobile SMS link.
   * Invokes centralized OrdersService.transitionOrderState('ready', 'seller_link').
   */
  @Post(":token/ready")
  @HttpCode(HttpStatus.OK)
  async readyOrder(@Param("token") token: string) {
    const tokenRecord = await this.resolveTokenRecord(token);
    const result = await this.ordersService.transitionOrderState(
      tokenRecord.order_id,
      "ready",
      "seller_link"
    );

    const orderDto = this.formatOrderDto(tokenRecord.order, result.currentState);

    return {
      ...orderDto,
      isIdempotent: result.isIdempotent,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      currentState: result.currentState,
      previousState: result.previousState,
      pickupCode: result.pickupCode,
      smsStatus: result.smsResult?.status,
      smsMessageId:
        result.smsResult?.smshubMessageId || result.smsResult?.messageId,
      order: orderDto,
    };
  }

  /**
   * POST /api/a/:token/complete
   * Submits 4-digit pickup code and completes the order from the mobile SMS link.
   * Invokes centralized OrdersService.completeWithPickupCode (BE-012, FR-20).
   */
  @Post(":token/complete")
  @HttpCode(HttpStatus.OK)
  async completeOrder(
    @Param("token") token: string,
    @Body() body: CompleteOrderDto
  ) {
    const tokenRecord = await this.resolveTokenRecord(token);
    const code = body?.code ?? body?.pickupCode ?? body?.pickup_code ?? "";

    const result = await this.ordersService.completeWithPickupCode(
      tokenRecord.order_id,
      code,
      "seller_link"
    );

    const orderDto = this.formatOrderDto(tokenRecord.order, result.currentState);

    return {
      ...orderDto,
      isIdempotent: result.isIdempotent,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      currentState: result.currentState,
      previousState: result.previousState,
      order: orderDto,
    };
  }
}
