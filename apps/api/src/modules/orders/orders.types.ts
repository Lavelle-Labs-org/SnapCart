import { z } from "zod";
import { OrderState } from "@order-by-sms/contracts";
import { SendSMSResult } from "../smshub/sms.types";
import { createZodDto } from "../../common/pipes/zod-validation.pipe";

export type OrderActor = "seller_link" | "seller_dash" | "buyer" | "system" | string;

export interface TransitionOrderOptions {
  pickupCode?: string;
  link?: string;
  throwOnSMSFailure?: boolean;
  reason?: string;
}

export interface TransitionOrderResult {
  success: boolean;
  isIdempotent: boolean;
  orderId: string;
  orderNumber: number;
  previousState: string | null;
  currentState: OrderState;
  pickupCode?: string;
  stopToken?: string;
  smsResult?: SendSMSResult;
  message?: string;
}

export interface ReissuePickupCodeResult {
  success: boolean;
  orderId: string;
  orderNumber: number;
  pickupCode: string;
  smsResult?: SendSMSResult;
}

export const CompleteOrderSchema = z.object({
  code: z.string().trim().optional(),
  pickupCode: z.string().trim().optional(),
  pickup_code: z.string().trim().optional(),
});

export class CompleteOrderDto extends createZodDto(CompleteOrderSchema) {}
