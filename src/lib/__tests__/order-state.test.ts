import { describe, it, expect } from "vitest";
import {
  validateStateTransition,
  isTerminalState,
  getNextAllowedStates,
  ALLOWED_TRANSITIONS,
  OrderState,
} from "@/lib/order-state";

describe("Order State Machine (BE-001, FR-18, FR-19)", () => {
  const allStates: OrderState[] = ["new", "accepted", "rejected", "ready", "completed"];

  describe("Valid Forward Transitions", () => {
    it("allows 'new' -> 'accepted'", () => {
      const result = validateStateTransition("new", "accepted");
      expect(result.allowed).toBe(true);
      expect(result.isIdempotent).toBe(false);
    });

    it("allows 'new' -> 'rejected'", () => {
      const result = validateStateTransition("new", "rejected");
      expect(result.allowed).toBe(true);
      expect(result.isIdempotent).toBe(false);
    });

    it("allows 'accepted' -> 'ready'", () => {
      const result = validateStateTransition("accepted", "ready");
      expect(result.allowed).toBe(true);
      expect(result.isIdempotent).toBe(false);
    });

    it("allows 'ready' -> 'completed'", () => {
      const result = validateStateTransition("ready", "completed");
      expect(result.allowed).toBe(true);
      expect(result.isIdempotent).toBe(false);
    });
  });

  describe("Terminal State Enforcement", () => {
    it("forbids any transition out of terminal state 'rejected'", () => {
      const targetStates: OrderState[] = ["new", "accepted", "ready", "completed"];
      for (const target of targetStates) {
        const result = validateStateTransition("rejected", target);
        expect(result.allowed).toBe(false);
        expect(result.isIdempotent).toBe(false);
        expect(result.message).toMatch(/Cannot transition order from 'rejected'/);
      }
    });

    it("forbids any transition out of terminal state 'completed'", () => {
      const targetStates: OrderState[] = ["new", "accepted", "rejected", "ready"];
      for (const target of targetStates) {
        const result = validateStateTransition("completed", target);
        expect(result.allowed).toBe(false);
        expect(result.isIdempotent).toBe(false);
        expect(result.message).toMatch(/Cannot transition order from 'completed'/);
      }
    });

    it("correctly identifies terminal states with isTerminalState helper", () => {
      expect(isTerminalState("rejected")).toBe(true);
      expect(isTerminalState("completed")).toBe(true);
      expect(isTerminalState("new")).toBe(false);
      expect(isTerminalState("accepted")).toBe(false);
      expect(isTerminalState("ready")).toBe(false);
    });
  });

  describe("Invalid Transitions & Skipping Steps", () => {
    it("forbids skipping steps from 'new' directly to 'ready' or 'completed'", () => {
      const resReady = validateStateTransition("new", "ready");
      expect(resReady.allowed).toBe(false);

      const resCompleted = validateStateTransition("new", "completed");
      expect(resCompleted.allowed).toBe(false);
    });

    it("forbids transitioning backwards or rejecting once 'accepted'", () => {
      const resBack = validateStateTransition("accepted", "new");
      expect(resBack.allowed).toBe(false);

      const resReject = validateStateTransition("accepted", "rejected");
      expect(resReject.allowed).toBe(false);

      const resSkip = validateStateTransition("accepted", "completed");
      expect(resSkip.allowed).toBe(false);
    });

    it("forbids transitioning backwards or rejecting once 'ready'", () => {
      const resNew = validateStateTransition("ready", "new");
      expect(resNew.allowed).toBe(false);

      const resAccepted = validateStateTransition("ready", "accepted");
      expect(resAccepted.allowed).toBe(false);

      const resReject = validateStateTransition("ready", "rejected");
      expect(resReject.allowed).toBe(false);
    });
  });

  describe("Idempotent Re-submissions", () => {
    it("returns isIdempotent: true when transitioning to the identical state", () => {
      for (const state of allStates) {
        const result = validateStateTransition(state, state);
        expect(result.allowed).toBe(true);
        expect(result.isIdempotent).toBe(true);
        expect(result.message).toMatch(/already in state/);
      }
    });
  });

  describe("getNextAllowedStates Helper", () => {
    it("returns correct next states for all lifecycle stages", () => {
      expect(getNextAllowedStates("new")).toEqual(["accepted", "rejected"]);
      expect(getNextAllowedStates("accepted")).toEqual(["ready"]);
      expect(getNextAllowedStates("ready")).toEqual(["completed"]);
      expect(getNextAllowedStates("rejected")).toEqual([]);
      expect(getNextAllowedStates("completed")).toEqual([]);
    });
  });

  describe("Full 5x5 State Transition Matrix Assertion", () => {
    it("strictly verifies all 25 possible state combinations", () => {
      let allowedCount = 0;
      let idempotentCount = 0;
      let rejectedCount = 0;

      for (const current of allStates) {
        for (const target of allStates) {
          const res = validateStateTransition(current, target);
          if (current === target) {
            expect(res.allowed).toBe(true);
            expect(res.isIdempotent).toBe(true);
            idempotentCount++;
          } else if (ALLOWED_TRANSITIONS[current].includes(target)) {
            expect(res.allowed).toBe(true);
            expect(res.isIdempotent).toBe(false);
            allowedCount++;
          } else {
            expect(res.allowed).toBe(false);
            expect(res.isIdempotent).toBe(false);
            rejectedCount++;
          }
        }
      }

      // Exactly 4 valid forward transitions
      expect(allowedCount).toBe(4);
      // Exactly 5 idempotent self-transitions
      expect(idempotentCount).toBe(5);
      // Exactly 16 invalid combinations
      expect(rejectedCount).toBe(16);
    });
  });
});
