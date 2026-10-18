/**
 * Centralized Order State Orchestration Service (BE-010)
 * Re-exports the authoritative NestJS OrdersService and types from apps/api/src/modules/orders/.
 * Also provides a standalone helper function transitionOrderState(...) matching the issue specification.
 */

import { OrdersService } from "../modules/orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { SMSOrchestratorService } from "../modules/smshub/sms-orchestrator.service";
import { SMSHubService } from "../modules/smshub/smshub.service";
import { CryptoService } from "../modules/crypto/crypto.service";
import { OrderState } from "@order-by-sms/contracts";
import {
  OrderActor,
  TransitionOrderOptions,
  TransitionOrderResult,
} from "../modules/orders/orders.types";

export * from "../modules/orders/orders.types";
export * from "../modules/orders/orders.service";

let defaultOrdersService: OrdersService | null = null;

export function getOrdersService(): OrdersService {
  if (!defaultOrdersService) {
    const prisma = new PrismaService();
    const smshub = new SMSHubService();
    const orchestrator = new SMSOrchestratorService(prisma, smshub);
    const crypto = new CryptoService();
    defaultOrdersService = new OrdersService(prisma, orchestrator, crypto);
  }
  return defaultOrdersService;
}

/**
 * Convenience export for transitioning order state.
 */
export async function transitionOrderState(
  orderId: string,
  targetState: OrderState,
  actor: OrderActor,
  options?: TransitionOrderOptions,
  service?: OrdersService
): Promise<TransitionOrderResult> {
  const instance = service || getOrdersService();
  return instance.transitionOrderState(orderId, targetState, actor, options);
}
