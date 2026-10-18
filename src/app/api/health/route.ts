import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "order-by-sms",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
