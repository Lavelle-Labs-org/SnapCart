import { NextRequest, NextResponse } from "next/server";
import { verifySMSHubWebhookSignature } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-smshub-signature") || "";
    const eventType = req.headers.get("x-smshub-event") || "";
    const deliveryId = req.headers.get("x-smshub-delivery") || "";

    // Verify webhook cryptographic signature
    const verification = verifySMSHubWebhookSignature(rawBody, signature);
    if (!verification.isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature", details: verification.error },
        { status: 400 }
      );
    }

    const payload = JSON.parse(rawBody);

    // Fast 200 acknowledgement within 6 seconds as required by SMSHub
    return NextResponse.json({
      received: true,
      event: eventType,
      deliveryId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to process webhook event", message: err.message },
      { status: 500 }
    );
  }
}
