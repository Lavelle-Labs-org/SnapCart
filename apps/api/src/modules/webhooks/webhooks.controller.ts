import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { WebhooksService } from "./webhooks.service";
import { WebhookSignatureGuard } from "./webhook-signature.guard";
import { BillingService } from "../billing/billing.service";
import { ChapaService } from "../billing/chapa.service";

@Controller("webhooks")
export class WebhooksController {
  constructor(
    @Inject(WebhooksService)
    private readonly webhooksService: WebhooksService,
    @Inject(BillingService)
    private readonly billingService: BillingService,
    @Inject(ChapaService)
    private readonly chapaService: ChapaService
  ) {}

  @Post("smshub")
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookSignatureGuard)
  async handleSMSHub(
    @Headers("x-smshub-event") eventHeader: string | undefined,
    @Headers("x-smshub-delivery") deliveryHeader: string | undefined,
    @Body() body: any,
    @Req() req: Request
  ) {
    const eventType =
      eventHeader || body?.event || "ping";
    const deliveryId =
      deliveryHeader || body?.delivery_id || "";
    const rawBody =
      (req as any).verifiedRawBody ||
      ((req as any).rawBody
        ? (req as any).rawBody.toString("utf8")
        : typeof body === "string"
          ? body
          : JSON.stringify(body));

    return this.webhooksService.handleSMSHubWebhook({
      eventType,
      deliveryId,
      payload: body,
      rawBody,
    });
  }

  @Post("chapa")
  @HttpCode(HttpStatus.OK)
  async handleChapa(
    @Headers("x-chapa-signature") signature: string | undefined,
    @Body() body: any,
    @Req() req: Request
  ) {
    const rawBody =
      (req as any).verifiedRawBody ||
      ((req as any).rawBody
        ? (req as any).rawBody.toString("utf8")
        : typeof body === "string"
          ? body
          : JSON.stringify(body));

    const isMock =
      process.env.NODE_ENV === "test" ||
      !process.env.CHAPA_WEBHOOK_SECRET ||
      process.env.CHAPA_WEBHOOK_SECRET === "chapa_webhook_secret_key";

    if (!isMock && !this.chapaService.verifyWebhookSignature(signature, rawBody)) {
      throw new UnauthorizedException("Invalid Chapa webhook signature");
    }

    return this.billingService.processWebhookEvent(body);
  }
}

