import { OrderState } from "@order-by-sms/contracts";
import { SendSMSResult } from "../smshub/sms.types";

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
