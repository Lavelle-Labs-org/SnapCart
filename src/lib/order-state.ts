/**
 * Order State Machine & Rules
 * Re-exported from @order-by-sms/contracts for backward compatibility.
 */

export {
  type OrderState,
  type TransitionValidationResult,
  ALLOWED_TRANSITIONS,
  validateStateTransition,
  isTerminalState,
  getNextAllowedStates,
} from "@order-by-sms/contracts";
