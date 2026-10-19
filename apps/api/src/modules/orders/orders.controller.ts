import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../../prisma/prisma.service";
import { OrderDto, OrderState } from "@order-by-sms/contracts";

@Controller("orders")
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
    };
  }

  @Get(":id")
  async getOrder(@Param("id") id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        order_items: true,
        seller: true,
        order_events: {
          orderBy: { created_at: "asc" },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return this.formatOrderDto(order);
  }

  @Post(":id/accept")
  @HttpCode(HttpStatus.OK)
  async acceptOrder(@Param("id") id: string) {
    return this.ordersService.transitionOrderState(
      id,
      "accepted",
      "seller_dash"
    );
  }

  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  async rejectOrder(@Param("id") id: string) {
    return this.ordersService.transitionOrderState(
      id,
      "rejected",
      "seller_dash"
    );
  }

  @Post(":id/ready")
  @HttpCode(HttpStatus.OK)
  async readyOrder(@Param("id") id: string) {
    return this.ordersService.transitionOrderState(
      id,
      "ready",
      "seller_dash"
    );
  }

  /**
   * POST /api/orders/:id/complete (BE-012, FR-20)
   * Completes order at handover when valid 4-digit pickup code is entered.
   */
  @Post(":id/complete")
  @HttpCode(HttpStatus.OK)
  async completeOrder(
    @Param("id") id: string,
    @Body() body: any
  ) {
    const code = body?.code ?? body?.pickupCode ?? body?.pickup_code;
    return this.ordersService.completeWithPickupCode(
      id,
      code,
      "seller_dash"
    );
  }

  /**
   * POST /api/orders/:id/pickup-code/reissue
   * Generates fresh pickup code for order in ready state and texts to buyer.
   */
  @Post(":id/pickup-code/reissue")
  @HttpCode(HttpStatus.OK)
  async reissuePickupCode(@Param("id") id: string) {
    return this.ordersService.reissuePickupCode(id, "seller_dash");
  }
}
