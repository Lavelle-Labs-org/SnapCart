import { describe, it, expect } from "vitest";
import { SMSHubClient, SMSHubError, parseRetryAfter } from "@/lib/smshub";

describe("SMSHubClient (BE-003)", () => {
  const MOCK_API_KEY = "mock_api_key_test_123";

  describe("Mode routing (/api/test vs /api/sms)", () => {
    it("routes sendSMS to /api/test when mode is 'test'", async () => {
      let requestedUrl = "";
      let requestedMethod = "";
      let requestedBody: any = null;

      const mockFetch: typeof fetch = async (input, init) => {
        requestedUrl = input.toString();
        requestedMethod = init?.method ?? "GET";
        requestedBody = JSON.parse((init?.body as string) || "{}");
        return new Response(
          JSON.stringify({
            status: "success",
            data: {
              mode: "test",
              message_status: "test_passed",
              would_send: true,
              final_text: "Test SMS",
            },
            request_id: "req_test_001",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        baseUrl: "https://smshub.et",
        mode: "test",
        fetch: mockFetch,
        minRequestIntervalMs: 0,
      });

      const response = await client.sendSMS({
        msisdn: "0911234567",
        text: "Test SMS",
      });

      expect(requestedUrl).toBe("https://smshub.et/api/test");
      expect(requestedMethod).toBe("POST");
      expect(requestedBody).toEqual({
        msisdn: "0911234567",
        text: "Test SMS",
        track_links: false,
      });
      expect(response.status).toBe("success");
      expect(response.data?.would_send).toBe(true);
    });

    it("routes sendSMS to /api/sms when mode is 'live'", async () => {
      let requestedUrl = "";

      const mockFetch: typeof fetch = async (input) => {
        requestedUrl = input.toString();
        return new Response(
          JSON.stringify({
            status: "success",
            data: {
              message_id: "msg_live_001",
              message_status: "sent",
              credits_used: 1,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        baseUrl: "https://smshub.et",
        mode: "live",
        fetch: mockFetch,
        minRequestIntervalMs: 0,
      });

      const response = await client.sendSMS({
        msisdn: "0911234567",
        text: "Live SMS",
      });

      expect(requestedUrl).toBe("https://smshub.et/api/sms");
      expect(response.status).toBe("success");
      expect(response.data?.message_id).toBe("msg_live_001");
    });
  });

  describe("502 Bad Gateway retries and backoff", () => {
    it("502 Bad Gateway triggers backoff retries (1s, 4s) before throwing", async () => {
      let callCount = 0;
      const sleepDelays: number[] = [];

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            status: "error",
            error_type: "provider_error",
            message: "Carrier did not accept message. Credit refunded.",
            request_id: "req_502_err",
          }),
          { status: 502, statusText: "Bad Gateway", headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        retryDelays: [1000, 4000],
        maxRetries: 3,
        minRequestIntervalMs: 0,
        sleepFn: async (ms) => {
          sleepDelays.push(ms);
        },
      });

      await expect(
        client.sendSMS({ msisdn: "0911234567", text: "Hello" })
      ).rejects.toThrow(SMSHubError);

      expect(callCount).toBe(3);
      expect(sleepDelays).toEqual([1000, 4000]);
    });

    it("succeeds if 502 resolves on a subsequent retry", async () => {
      let callCount = 0;
      const sleepDelays: number[] = [];

      const mockFetch: typeof fetch = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              status: "error",
              error_type: "provider_error",
              message: "Temporary glitch",
            }),
            { status: 502, statusText: "Bad Gateway", headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            status: "success",
            data: { message_id: "msg_success_after_502", message_status: "sent" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        retryDelays: [1000, 4000],
        maxRetries: 3,
        minRequestIntervalMs: 0,
        sleepFn: async (ms) => {
          sleepDelays.push(ms);
        },
      });

      const res = await client.sendSMS({ msisdn: "0911234567", text: "Hello" });

      expect(callCount).toBe(2);
      expect(sleepDelays).toEqual([1000]);
      expect(res.data?.message_id).toBe("msg_success_after_502");
    });
  });

  describe("429 Rate Limited & Retry-After handling", () => {
    it("429 Rate Limited pauses execution for Retry-After seconds", async () => {
      let callCount = 0;
      const sleepDelays: number[] = [];

      const mockFetch: typeof fetch = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              status: "error",
              error_type: "rate_limited",
              message: "Over 60 requests/minute",
              request_id: "req_rate_limit",
            }),
            {
              status: 429,
              statusText: "Too Many Requests",
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "3",
              },
            }
          );
        }

        return new Response(
          JSON.stringify({
            status: "success",
            data: { message_id: "msg_429_recovered", message_status: "sent" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        maxRetries: 3,
        minRequestIntervalMs: 0,
        sleepFn: async (ms) => {
          sleepDelays.push(ms);
        },
      });

      const res = await client.sendSMS({ msisdn: "0911234567", text: "Hello" });

      expect(callCount).toBe(2);
      expect(sleepDelays).toEqual([3000]); // 3 seconds Retry-After = 3000ms
      expect(res.data?.message_id).toBe("msg_429_recovered");
    });

    it("throws SMSHubError when 429 persists through all retries", async () => {
      let callCount = 0;
      const sleepDelays: number[] = [];

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            status: "error",
            error_type: "rate_limited",
            message: "Over 60 requests/minute",
            request_id: "req_429_repeat",
          }),
          {
            status: 429,
            statusText: "Too Many Requests",
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "2",
            },
          }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        maxRetries: 3,
        minRequestIntervalMs: 0,
        sleepFn: async (ms) => {
          sleepDelays.push(ms);
        },
      });

      let thrownError: any = null;
      try {
        await client.sendSMS({ msisdn: "0911234567", text: "Hello" });
      } catch (err) {
        thrownError = err;
      }

      expect(callCount).toBe(3);
      expect(sleepDelays).toEqual([2000, 2000]);
      expect(thrownError).toBeInstanceOf(SMSHubError);
      expect(thrownError.status).toBe(429);
      expect(thrownError.errorType).toBe("rate_limited");
      expect(thrownError.requestId).toBe("req_429_repeat");
      expect(thrownError.retryable).toBe(true);
    });
  });

  describe("Bounded Retry-After Validation", () => {
    describe("parseRetryAfter helper", () => {
      it("returns null for empty or null header", () => {
        expect(parseRetryAfter(null)).toEqual({ seconds: null });
        expect(parseRetryAfter("")).toEqual({ seconds: null });
        expect(parseRetryAfter("   ")).toEqual({ seconds: null });
      });

      it("parses valid integer seconds within bound", () => {
        expect(parseRetryAfter("30", 60)).toEqual({ seconds: 30 });
        expect(parseRetryAfter("0", 60)).toEqual({ seconds: 0 });
      });

      it("flags excessively large Retry-After values exceeding maxSeconds", () => {
        const result = parseRetryAfter("3600", 60);
        expect(result.exceedsMax).toBe(true);
        expect(result.seconds).toBe(3600);
      });

      it("flags negative or malformed integer values", () => {
        expect(parseRetryAfter("-10", 60).isMalformed).toBe(true);
        expect(parseRetryAfter("abc", 60).isMalformed).toBe(true);
        expect(parseRetryAfter("NaN", 60).isMalformed).toBe(true);
      });

      it("parses valid future HTTP-date strings", () => {
        const futureDate = new Date(Date.now() + 15000).toUTCString();
        const res = parseRetryAfter(futureDate, 60);
        expect(res.seconds).toBeGreaterThanOrEqual(14);
        expect(res.seconds).toBeLessThanOrEqual(16);
      });

      it("clamps past HTTP-date strings to 0 seconds", () => {
        const pastDate = new Date(Date.now() - 5000).toUTCString();
        const res = parseRetryAfter(pastDate, 60);
        expect(res.seconds).toBe(0);
      });
    });

    it("rejects immediately with SMSHubError when Retry-After exceeds maxRetryAfterSeconds", async () => {
      let callCount = 0;
      const sleepDelays: number[] = [];

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            status: "error",
            error_type: "maintenance",
            message: "Scheduled maintenance",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "900", // 15 minutes wait requested
            },
          }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        maxRetryAfterSeconds: 60, // bound at 60s
        minRequestIntervalMs: 0,
        sleepFn: async (ms) => {
          sleepDelays.push(ms);
        },
      });

      let thrownError: any = null;
      try {
        await client.sendSMS({ msisdn: "0911234567", text: "Hello" });
      } catch (err) {
        thrownError = err;
      }

      // Must fail fast without sleeping for 900 seconds
      expect(callCount).toBe(1);
      expect(sleepDelays).toEqual([]);
      expect(thrownError).toBeInstanceOf(SMSHubError);
      expect(thrownError.status).toBe(503);
      expect(thrownError.errorType).toBe("retry_after_exceeded");
      expect(thrownError.message).toContain("exceeds maximum allowed wait of 60s");
    });
  });

  describe("Duplicate SMS Prevention on Uncertain Failures", () => {
    it("never retries live POST /api/sms after a timeout without idempotency key", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        throw err;
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        mode: "live",
        fetch: mockFetch,
        maxRetries: 3,
        minRequestIntervalMs: 0,
      });

      let thrownError: any = null;
      try {
        await client.sendSMS({ msisdn: "0911234567", text: "Live SMS" });
      } catch (err) {
        thrownError = err;
      }

      // Must fail after attempt 1 and NOT retry to prevent duplicate SMS
      expect(callCount).toBe(1);
      expect(thrownError).toBeInstanceOf(SMSHubError);
      expect(thrownError.status).toBe(408);
      expect(thrownError.uncertainAcceptance).toBe(true);
      expect(thrownError.retryable).toBe(false);
      expect(thrownError.message).toContain("acceptance uncertain");
    });

    it("never retries live POST /api/sms after ambiguous 500 server error without idempotency key", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        });
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        mode: "live",
        fetch: mockFetch,
        maxRetries: 3,
        minRequestIntervalMs: 0,
      });

      let thrownError: any = null;
      try {
        await client.sendSMS({ msisdn: "0911234567", text: "Live SMS" });
      } catch (err) {
        thrownError = err;
      }

      // Must NOT blindly resend live SMS on ambiguous 500
      expect(callCount).toBe(1);
      expect(thrownError).toBeInstanceOf(SMSHubError);
      expect(thrownError.status).toBe(500);
      expect(thrownError.uncertainAcceptance).toBe(true);
      expect(thrownError.retryable).toBe(false);
    });

    it("DOES retry live POST /api/sms when 502 explicitly confirms provider_error and refund", async () => {
      let callCount = 0;
      const sleepDelays: number[] = [];

      const mockFetch: typeof fetch = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              status: "error",
              error_type: "provider_error",
              message: "Carrier did not accept message. Credit refunded.",
            }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            status: "success",
            data: { message_id: "msg_recovered", message_status: "sent" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        mode: "live",
        fetch: mockFetch,
        maxRetries: 3,
        minRequestIntervalMs: 0,
        sleepFn: async (ms) => {
          sleepDelays.push(ms);
        },
      });

      const res = await client.sendSMS({ msisdn: "0911234567", text: "Live SMS" });

      expect(callCount).toBe(2);
      expect(sleepDelays).toEqual([1000]);
      expect(res.data?.message_id).toBe("msg_recovered");
    });

    it("DOES retry live POST /api/sms on timeout when idempotencyKey is supplied", async () => {
      let callCount = 0;
      let lastHeaders: any = null;

      const mockFetch: typeof fetch = async (url, init) => {
        callCount++;
        lastHeaders = init?.headers;
        if (callCount === 1) {
          const err = new Error("Abort");
          err.name = "AbortError";
          throw err;
        }
        return new Response(
          JSON.stringify({
            status: "success",
            data: { message_id: "msg_idempotent_ok", message_status: "sent" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        mode: "live",
        fetch: mockFetch,
        maxRetries: 3,
        minRequestIntervalMs: 0,
        sleepFn: async () => {},
      });

      const res = await client.sendSMS({
        msisdn: "0911234567",
        text: "Idempotent SMS",
        idempotencyKey: "idem_abc_123",
      });

      expect(callCount).toBe(2);
      expect(lastHeaders["Idempotency-Key"]).toBe("idem_abc_123");
      expect(res.data?.message_id).toBe("msg_idempotent_ok");
    });

    it("DOES retry POST /api/test on timeout because test mode never sends real SMS", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error("Abort");
          err.name = "AbortError";
          throw err;
        }
        return new Response(
          JSON.stringify({
            status: "success",
            data: { would_send: true, message_status: "test_passed" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        mode: "test",
        fetch: mockFetch,
        maxRetries: 3,
        minRequestIntervalMs: 0,
        sleepFn: async () => {},
      });

      const res = await client.sendSMS({ msisdn: "0911234567", text: "Test SMS" });

      expect(callCount).toBe(2);
      expect(res.data?.would_send).toBe(true);
    });
  });

  describe("Non-retryable client errors (Zero retries)", () => {
    it("fails immediately on 402 insufficient_credits without retrying", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            status: "error",
            error_type: "insufficient_credits",
            message: "Not enough credits for this message",
            request_id: "req_no_credits",
          }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        maxRetries: 3,
        minRequestIntervalMs: 0,
      });

      let thrownError: any = null;
      try {
        await client.sendSMS({ msisdn: "0911234567", text: "Hello" });
      } catch (err) {
        thrownError = err;
      }

      expect(callCount).toBe(1);
      expect(thrownError).toBeInstanceOf(SMSHubError);
      expect(thrownError.status).toBe(402);
      expect(thrownError.errorType).toBe("insufficient_credits");
      expect(thrownError.requestId).toBe("req_no_credits");
      expect(thrownError.retryable).toBe(false);
    });

    it("fails immediately on 422 invalid_msisdn without retrying", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            status: "error",
            error_type: "invalid_msisdn",
            message: "Invalid phone number",
            request_id: "req_invalid_num",
          }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        maxRetries: 3,
        minRequestIntervalMs: 0,
      });

      let thrownError: any = null;
      try {
        await client.sendSMS({ msisdn: "123", text: "Hello" });
      } catch (err) {
        thrownError = err;
      }

      expect(callCount).toBe(1);
      expect(thrownError).toBeInstanceOf(SMSHubError);
      expect(thrownError.status).toBe(422);
      expect(thrownError.errorType).toBe("invalid_msisdn");
      expect(thrownError.retryable).toBe(false);
    });

    it("fails immediately on 401 invalid_api_key without retrying", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            status: "error",
            error_type: "invalid_api_key",
            message: "Key is invalid or revoked",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        maxRetries: 3,
        minRequestIntervalMs: 0,
      });

      await expect(
        client.sendSMS({ msisdn: "0911234567", text: "Hello" })
      ).rejects.toThrow(SMSHubError);

      expect(callCount).toBe(1);
    });
  });

  describe("Concurrency-Safe Rate Pacing Mechanism", () => {
    it("guarantees concurrent requests actually start at least minRequestIntervalMs apart in FIFO order", async () => {
      const startTimes: { id: string; time: number }[] = [];
      const PACE_MS = 50;

      const mockFetch: typeof fetch = async (url, init) => {
        const body = JSON.parse((init?.body as string) || "{}");
        startTimes.push({ id: body.text, time: Date.now() });
        return new Response(
          JSON.stringify({
            status: "success",
            data: { message_id: `msg_${body.text}` },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        minRequestIntervalMs: PACE_MS,
      });

      // Launch 3 requests concurrently
      await Promise.all([
        client.sendSMS({ msisdn: "0911234567", text: "req_1" }),
        client.sendSMS({ msisdn: "0911234567", text: "req_2" }),
        client.sendSMS({ msisdn: "0911234567", text: "req_3" }),
      ]);

      expect(startTimes.length).toBe(3);

      // Verify FIFO ordering
      expect(startTimes.map((s) => s.id)).toEqual(["req_1", "req_2", "req_3"]);

      // Verify each outgoing request started at least PACE_MS after the previous one started
      const diff1 = startTimes[1].time - startTimes[0].time;
      const diff2 = startTimes[2].time - startTimes[1].time;

      // Allow 5ms tolerance for system timer resolution
      expect(diff1).toBeGreaterThanOrEqual(PACE_MS - 5);
      expect(diff2).toBeGreaterThanOrEqual(PACE_MS - 5);
    });
  });

  describe("Verify and Balance endpoints", () => {
    it("calls /api/verify/send with expected parameters", async () => {
      let requestedUrl = "";
      let requestedBody: any = null;

      const mockFetch: typeof fetch = async (url, init) => {
        requestedUrl = url.toString();
        requestedBody = JSON.parse((init?.body as string) || "{}");
        return new Response(
          JSON.stringify({
            status: "success",
            data: { verification_id: "ver_12345", expires_in: 300 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        minRequestIntervalMs: 0,
      });

      const res = await client.verifySend("0911234567", "Habesha Cafe", 6, 300);

      expect(requestedUrl).toBe("https://smshub.et/api/verify/send");
      expect(requestedBody).toEqual({
        msisdn: "0911234567",
        app_name: "Habesha Cafe",
        code_length: 6,
        expires_in: 300,
      });
      expect(res.data?.verification_id).toBe("ver_12345");
    });

    it("calls /api/verify/check with expected parameters", async () => {
      let requestedUrl = "";
      let requestedBody: any = null;

      const mockFetch: typeof fetch = async (url, init) => {
        requestedUrl = url.toString();
        requestedBody = JSON.parse((init?.body as string) || "{}");
        return new Response(
          JSON.stringify({
            status: "success",
            data: { valid: true, verification_status: "approved" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        minRequestIntervalMs: 0,
      });

      const res = await client.verifyCheck("ver_12345", "123456");

      expect(requestedUrl).toBe("https://smshub.et/api/verify/check");
      expect(requestedBody).toEqual({
        verification_id: "ver_12345",
        code: "123456",
      });
      expect(res.data?.valid).toBe(true);
      expect(res.data?.verification_status).toBe("approved");
    });

    it("calls /api/balance and returns balance data", async () => {
      let requestedUrl = "";

      const mockFetch: typeof fetch = async (url) => {
        requestedUrl = url.toString();
        return new Response(
          JSON.stringify({
            status: "success",
            data: { credits: 4210 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        minRequestIntervalMs: 0,
      });

      const res = await client.getBalance();

      expect(requestedUrl).toBe("https://smshub.et/api/balance");
      expect(res.status).toBe("success");
      expect(res.data?.credits).toBe(4210);
    });
  });
});
