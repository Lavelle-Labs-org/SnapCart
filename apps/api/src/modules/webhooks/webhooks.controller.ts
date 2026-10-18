import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  UseGuards,
  Inject,
} from "@nestjs/common";
import type { Request } from "express";
import { WebhooksService } from "./webhooks.service";
import { WebhookSignatureGuard } from "./webhook-signature.guard";

@Controller("webhooks")
export class WebhooksController {
  constructor(
    @Inject(WebhooksService)
    private readonly webhooksService: WebhooksService
  ) {}

  @Post("smshub")
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
}
