import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SellerAuthGuard } from "../auth/auth.guard";
import { CurrentSeller } from "../auth/current-seller.decorator";
import { OrderDto, OrderState } from "@order-by-sms/contracts";

@Controller("orders")
@UseGuards(SellerAuthGuard)
export class OrdersController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

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
      events: order.order_events?.map((evt: any) => ({
        id: evt.id,
        orderId: evt.order_id,
        fromState: evt.from_state,
        toState: evt.to_state,
        actor: evt.actor,
        createdAt: evt.created_at ? new Date(evt.created_at).toISOString() : new Date().toISOString(),
      })),
      messages: order.messages?.map((msg: any) => ({
        id: msg.id,
        sellerId: msg.seller_id ?? null,
        orderId: msg.order_id ?? null,
        recipientPhone: msg.recipient_phone,
        event: msg.event,
        text: msg.text,
        status: msg.status,
        skipReason: msg.skip_reason ?? null,
        smshubMessageId: msg.smshub_message_id ?? null,
        requestId: msg.request_id ?? null,
        network: msg.network ?? null,
        creditsUsed: msg.credits_used ?? null,
        errorType: msg.error_type ?? null,
        attempts: msg.attempts ?? 0,
        createdAt: msg.created_at ? new Date(msg.created_at).toISOString() : new Date().toISOString(),
        updatedAt: msg.updated_at ? new Date(msg.updated_at).toISOString() : new Date().toISOString(),
      })),
    };
  }

  /**
   * Helper to verify order existence and enforce authenticated seller ownership.
   */
  private async verifySellerOwnership(orderId: string, sellerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, seller_id: true, number: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.seller_id !== sellerId) {
      throw new ForbiddenException("You do not have permission to manage this order");
    }

    return order;
  }

  /**
   * GET /api/orders
   * Lists all orders belonging to the authenticated seller.
   */
  @Get()
  async getOrders(@CurrentSeller() seller: any) {
    const orders = await this.prisma.order.findMany({
      where: { seller_id: seller.id },
      include: {
        order_items: true,
      },
      orderBy: { created_at: "desc" },
    });

    return orders.map((order) => this.formatOrderDto(order));
  }

  /**
   * GET /api/orders/:id
   * Retrieves single order by ID for the authenticated seller.
   */
  @Get(":id")
  async getOrder(
    @CurrentSeller() seller: any,
    @Param("id") id: string
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        order_items: true,
        seller: true,
        order_events: {
          orderBy: { created_at: "asc" },
        },
        messages: {
          orderBy: { created_at: "asc" },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    if (order.seller_id !== seller.id) {
      throw new ForbiddenException("You do not have permission to view this order");
    }

    return this.formatOrderDto(order);
  }

  /**
   * POST /api/orders/:id/accept (BE-013, FR-18)
   * Accepts order from seller dashboard and texts buyer.
   */
  @Post(":id/accept")
  @HttpCode(HttpStatus.OK)
  async acceptOrder(
    @CurrentSeller() seller: any,
    @Param("id") id: string
  ) {
    await this.verifySellerOwnership(id, seller.id);
    return this.ordersService.transitionOrderState(
      id,
      "accepted",
      "seller_dash"
    );
  }

  /**
   * POST /api/orders/:id/reject (BE-013, FR-18)
   * Rejects order from seller dashboard and texts buyer.
   */
  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  async rejectOrder(
    @CurrentSeller() seller: any,
    @Param("id") id: string
  ) {
    await this.verifySellerOwnership(id, seller.id);
    return this.ordersService.transitionOrderState(
      id,
      "rejected",
      "seller_dash"
    );
  }

  /**
   * POST /api/orders/:id/ready (BE-013, FR-18)
   * Marks order ready, generates 4-digit pickup code, and texts buyer.
   */
  @Post(":id/ready")
  @HttpCode(HttpStatus.OK)
  async readyOrder(
    @CurrentSeller() seller: any,
    @Param("id") id: string
  ) {
    await this.verifySellerOwnership(id, seller.id);
    return this.ordersService.transitionOrderState(
      id,
      "ready",
      "seller_dash"
    );
  }

  /**
   * POST /api/orders/:id/complete (BE-012, BE-013, FR-20)
   * Completes order at handover when valid 4-digit pickup code is entered.
   */
  @Post(":id/complete")
  @HttpCode(HttpStatus.OK)
  async completeOrder(
    @CurrentSeller() seller: any,
    @Param("id") id: string,
    @Body() body: any
  ) {
    await this.verifySellerOwnership(id, seller.id);
    const code = body?.code ?? body?.pickupCode ?? body?.pickup_code;
    return this.ordersService.completeWithPickupCode(
      id,
      code,
      "seller_dash"
    );
  }

  /**
   * POST /api/orders/:id/pickup-code/reissue (BE-013, FR-18)
   * Generates fresh pickup code for order in ready state and texts to buyer.
   */
  @Post(":id/pickup-code/reissue")
  @HttpCode(HttpStatus.OK)
  async reissuePickupCode(
    @CurrentSeller() seller: any,
    @Param("id") id: string
  ) {
    await this.verifySellerOwnership(id, seller.id);
    return this.ordersService.reissuePickupCode(id, "seller_dash");
  }
}
