import { NextResponse } from "next/server";
import { createClearSessionCookie } from "@/services/auth";

export async function POST() {
  const clearCookie = createClearSessionCookie();

  const response = NextResponse.json({
    success: true,
    data: {
      message: "Logged out successfully",
    },
  });

  response.cookies.set(clearCookie);
  return response;
}
