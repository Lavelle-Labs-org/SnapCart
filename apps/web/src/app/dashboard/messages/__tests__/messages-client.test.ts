import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  maskPhoneNumber,
  formatMessageTime,
  getMessageStatusBadge,
  resendMessageApi,
  fetchMessagesApi,
} from "../messages-client";

describe("MessagesClient Helpers & API Actions (FE-012, Issue #35)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Status Badge Rendering (Acceptance Criterion 1, Invariant #8)", () => {
    it("renders 'Sent (Carrier Accepted)' for sent messages and NEVER 'Delivered'", () => {
      const badge = getStatusBadgeText("sent");
      expect(badge).toContain("Sent (Carrier Accepted)");
      expect(badge.toLowerCase()).not.toContain("delivered");
    });

    it("renders 'Failed' for failed messages", () => {
      const badge = getStatusBadgeText("failed");
      expect(badge).toContain("Failed");
    });

    it("renders 'Skipped' with reason for skipped messages", () => {
      const badge = getStatusBadgeText("skipped", "opted_out");
      expect(badge).toContain("Skipped");
      expect(badge).toContain("Buyer Opted Out");
    });

    it("renders 'Test Mode (Passed)' for test_passed messages", () => {
      const badge = getStatusBadgeText("test_passed");
      expect(badge).toContain("Test Mode (Passed)");
    });

    it("renders 'Unknown' for unknown messages", () => {
      const badge = getStatusBadgeText("unknown");
      expect(badge).toContain("Unknown");
    });

    it("renders 'Queued' for queued messages", () => {
      const badge = getStatusBadgeText("queued");
      expect(badge).toContain("Queued");
    });
  });

  describe("Phone Number Masking (Invariant #6)", () => {
    it("masks Ethiopian phone numbers leaving 2-digit prefix and 3-digit suffix", () => {
      expect(maskPhoneNumber("0911223344")).toBe("09•• ••• 344");
      expect(maskPhoneNumber("0799887766")).toBe("07•• ••• 766");
      expect(maskPhoneNumber("+251911223344")).toBe("09•• ••• 344");
    });

    it("preserves already masked phone strings", () => {
      expect(maskPhoneNumber("09•• ••• 344")).toBe("09•• ••• 344");
    });
  });

  describe("Message Timestamp Formatting", () => {
    it("formats ISO date strings into readable time strings", () => {
      const formatted = formatMessageTime("2026-10-20T10:30:00Z");
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe("string");
    });

    it("handles invalid date strings gracefully", () => {
      expect(formatMessageTime("invalid-date")).toBe("Recently");
    });
  });

  describe("Resend Message API Call (Acceptance Criterion 3)", () => {
    it("submits POST request to /api/messages/:id/resend", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            resent: true,
            message: {
              id: "msg-1",
              status: "sent",
              attempts: 2,
              smshubMessageId: "smshub-new-123",
            },
          },
        }),
      });

      const res = await resendMessageApi("msg-1", mockFetch as any);

      expect(mockFetch).toHaveBeenCalledWith("/api/messages/msg-1/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      expect(res.success).toBe(true);
      expect(res.data.resent).toBe(true);
      expect(res.data.message.status).toBe("sent");
      expect(res.data.message.attempts).toBe(2);
    });

    it("throws informative error on failed resend response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: {
            code: "INVALID_MESSAGE_STATUS",
            message: "Only failed or unknown messages can be resent",
          },
        }),
      });

      await expect(resendMessageApi("msg-sent-1", mockFetch as any)).rejects.toThrow(
        "Only failed or unknown messages can be resent"
      );
    });
  });

  describe("Fetch Messages API Call", () => {
    it("submits GET request to /api/messages", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "msg-1",
              recipientPhone: "0911223344",
              event: "seller_new_order",
              status: "sent",
            },
          ],
        }),
      });

      const messages = await fetchMessagesApi(mockFetch as any);

      expect(mockFetch).toHaveBeenCalledWith("/api/messages", {
        headers: { Accept: "application/json" },
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("msg-1");
    });
  });
});

// Helper to extract text from JSX element returned by getMessageStatusBadge
function getStatusBadgeText(status: string, skipReason?: string | null): string {
  const badge = getMessageStatusBadge(status, skipReason);
  return extractTextFromNode(badge);
}

function extractTextFromNode(node: any): string {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join(" ");
  if (node.props?.children) return extractTextFromNode(node.props.children);
  return "";
}
