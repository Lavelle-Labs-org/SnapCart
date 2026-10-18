import { describe, it, expect, vi } from "vitest";
import { SMSHubClient, SMSHubError } from "@/lib/smshub";

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

  describe("500 & 503 transient errors", () => {
    it("retries 500 server error with exponential backoff", async () => {
      let callCount = 0;
      const sleepDelays: number[] = [];

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        });
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

    it("respects Retry-After header on 503 Service Unavailable", async () => {
      let callCount = 0;
      const sleepDelays: number[] = [];

      const mockFetch: typeof fetch = async () => {
        callCount++;
        if (callCount === 1) {
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
                "Retry-After": "5",
              },
            }
          );
        }
        return new Response(
          JSON.stringify({ status: "success", data: { message_id: "msg_503_recovered" } }),
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
      expect(sleepDelays).toEqual([5000]);
      expect(res.data?.message_id).toBe("msg_503_recovered");
    });
  });

  describe("Timeout handling (maximum 1 retry)", () => {
    it("retries at most once on timeout before throwing", async () => {
      let callCount = 0;
      const sleepDelays: number[] = [];

      const mockFetch: typeof fetch = async () => {
        callCount++;
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        throw err;
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        retryDelays: [500, 1000],
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

      // Maximum 1 timeout retry means 2 attempts total
      expect(callCount).toBe(2);
      expect(sleepDelays).toEqual([500]);
      expect(thrownError).toBeInstanceOf(SMSHubError);
      expect(thrownError.status).toBe(408);
      expect(thrownError.errorType).toBe("timeout");
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

  describe("Rate pacing mechanism", () => {
    it("spaces out rapid sequential requests by minRequestIntervalMs", async () => {
      const sleepDelays: number[] = [];

      const mockFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            status: "success",
            data: { message_id: "msg_pacing" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const client = new SMSHubClient({
        apiKey: MOCK_API_KEY,
        fetch: mockFetch,
        minRequestIntervalMs: 1000,
        sleepFn: async (ms) => {
          sleepDelays.push(ms);
        },
      });

      // Call 3 requests back to back
      await Promise.all([
        client.sendSMS({ msisdn: "0911234567", text: "1" }),
        client.sendSMS({ msisdn: "0911234567", text: "2" }),
        client.sendSMS({ msisdn: "0911234567", text: "3" }),
      ]);

      // At least 2 requests must have been delayed to respect the 1000ms pace
      expect(sleepDelays.length).toBe(2);
      expect(sleepDelays[0]).toBeGreaterThanOrEqual(900);
      expect(sleepDelays[1]).toBeGreaterThanOrEqual(1800);
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
