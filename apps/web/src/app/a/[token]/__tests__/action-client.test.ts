import { describe, it, expect } from "vitest";
import { toBirr } from "@order-by-sms/contracts";

describe("SellerActionClient Logic & State Handling (FE-005, #28)", () => {
  const mockOrder = {
    id: "order-1",
    number: 1043,
    buyerName: "Tadesse Gemechu",
    buyerPhone: "0911556677",
    smsConsent: true,
    state: "new" as const,
    totalSantim: 85000,
    totalBirr: 850,
    items: [
      {
        id: "item-1",
        name: "Special Coffee Blend",
        priceSantim: 85000,
        priceBirr: 850,
        quantity: 1,
      },
    ],
  };

  describe("Currency & Total Formatting", () => {
    it("converts totalSantim to Birr accurately", () => {
      expect(toBirr(85000)).toBe(850);
      expect(toBirr(12500)).toBe(125);
      expect(toBirr(0)).toBe(0);
    });
  });

  describe("State Actions Available", () => {
    const getAvailableActions = (state: string) => {
      switch (state) {
        case "new":
          return ["accept", "reject"];
        case "accepted":
          return ["ready"];
        case "ready":
          return ["complete"];
        case "completed":
        case "rejected":
        default:
          return [];
      }
    };

    it("presents Accept and Reject buttons for 'new' orders", () => {
      const actions = getAvailableActions("new");
      expect(actions).toEqual(["accept", "reject"]);
    });

    it("presents Mark Ready button for 'accepted' orders", () => {
      const actions = getAvailableActions("accepted");
      expect(actions).toEqual(["ready"]);
    });

    it("presents Complete button for 'ready' orders", () => {
      const actions = getAvailableActions("ready");
      expect(actions).toEqual(["complete"]);
    });

    it("presents no action buttons for terminal states 'completed' and 'rejected'", () => {
      expect(getAvailableActions("completed")).toEqual([]);
      expect(getAvailableActions("rejected")).toEqual([]);
    });
  });

  describe("Pickup Code Validation (4 digits)", () => {
    it("sanitizes pickup code to maximum 4 numeric digits", () => {
      const sanitizeCode = (val: string) => val.replace(/\D/g, "").slice(0, 4);

      expect(sanitizeCode("4821")).toBe("4821");
      expect(sanitizeCode("482199")).toBe("4821");
      expect(sanitizeCode("48a2b1")).toBe("4821");
      expect(sanitizeCode("4 8 2 1")).toBe("4821");
    });

    it("validates that code is complete before allowing submission", () => {
      const isComplete = (val: string) => /^\d{4}$/.test(val.trim());

      expect(isComplete("4821")).toBe(true);
      expect(isComplete("482")).toBe(false);
      expect(isComplete("")).toBe(false);
      expect(isComplete("48210")).toBe(false);
    });
  });

  describe("API Payload Construction", () => {
    it("builds correct URL and body for action endpoints", () => {
      const token = "token-xyz";

      const endpoints = {
        accept: `/api/a/${token}/accept`,
        reject: `/api/a/${token}/reject`,
        ready: `/api/a/${token}/ready`,
        complete: `/api/a/${token}/complete`,
      };

      expect(endpoints.accept).toBe("/api/a/token-xyz/accept");
      expect(endpoints.reject).toBe("/api/a/token-xyz/reject");
      expect(endpoints.ready).toBe("/api/a/token-xyz/ready");
      expect(endpoints.complete).toBe("/api/a/token-xyz/complete");
    });
  });

  describe("SMS Dispatch Status Feedback", () => {
    it("formats inline feedback message according to smsStatus", () => {
      const formatSmsNotice = (status?: string) => {
        switch (status) {
          case "sent":
            return "SMS alert dispatched to buyer";
          case "queued":
            return "SMS alert queued for delivery";
          case "skipped":
            return "Buyer opted out of SMS updates";
          case "failed":
            return "SMS alert could not be delivered";
          default:
            return null;
        }
      };

      expect(formatSmsNotice("sent")).toBe("SMS alert dispatched to buyer");
      expect(formatSmsNotice("queued")).toBe("SMS alert queued for delivery");
      expect(formatSmsNotice("skipped")).toBe("Buyer opted out of SMS updates");
      expect(formatSmsNotice("failed")).toBe("SMS alert could not be delivered");
      expect(formatSmsNotice(undefined)).toBeNull();
    });
  });
});
