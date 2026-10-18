/**
 * Order State Machine & Rules
 * Enforces FR-18, FR-19, and Section 6.
 *
 * Allowed transitions:
 *   new -> accepted | rejected
 *   accepted -> ready
 *   ready -> completed (requires valid pickup code)
 *
 * All other transitions are rejected with 409 Conflict.
 */

export type OrderState = "new" | "accepted" | "rejected" | "ready" | "completed";

export const ALLOWED_TRANSITIONS: Record<OrderState, OrderState[]> = {
  new: ["accepted", "rejected"],
  accepted: ["ready"],
  rejected: [], // Terminal
  ready: ["completed"],
  completed: [], // Terminal
};

export interface TransitionValidationResult {
  allowed: boolean;
  isIdempotent: boolean;
  message?: string;
}

export function validateStateTransition(
  currentState: OrderState,
  targetState: OrderState
): TransitionValidationResult {
  // If attempting to transition to the exact same state, treat as idempotent repeat
  if (currentState === targetState) {
    return {
      allowed: true,
      isIdempotent: true,
      message: `Order is already in state '${currentState}'. No change needed.`,
    };
  }

  const allowedNextStates = ALLOWED_TRANSITIONS[currentState] || [];
  if (allowedNextStates.includes(targetState)) {
    return {
      allowed: true,
      isIdempotent: false,
    };
  }

  return {
    allowed: false,
    isIdempotent: false,
    message: `Cannot transition order from '${currentState}' to '${targetState}'. Allowed transitions: ${
      allowedNextStates.length ? allowedNextStates.join(", ") : "None (Terminal state)"
    }`,
  };
}

/**
 * Returns true if the given order state is terminal (cannot transition further).
 */
export function isTerminalState(state: OrderState): boolean {
  return (ALLOWED_TRANSITIONS[state] || []).length === 0;
}

/**
 * Returns the list of permitted next states for a given order state.
 */
export function getNextAllowedStates(state: OrderState): OrderState[] {
  return ALLOWED_TRANSITIONS[state] || [];
}

