# Order-by-SMS: SMSHub Integration Guide

## 1. Authentication & Security

- **Base URL:** `https://smshub.et`
- **Header:** `Authorization: Bearer sk_live_...`
- **Key Storage:** Stored exclusively in server-side environment variable `SMSHUB_API_KEY`. Never exposed to client bundles or browser code.
- **Client Architecture:** A centralized module (`src/lib/smshub.ts`) wraps all HTTP requests, applies a 30-second abort timeout, standardizes JSON serialization, and formats errors into typed domain exceptions.

---

## 2. API Endpoints

### 2.1 Send SMS (Live Mode)
- **Endpoint:** `POST https://smshub.et/api/sms`
- **Payload:**
  ```json
  {
    "msisdn": "0912345678",
    "text": "Your message here...",
    "track_links": false
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "message_id": "msg_9f8a7b6c5d4e3f2a1b0c",
      "network": "ethio_telecom",
      "message_status": "sent",
      "credits_used": 1,
      "credits_remaining": 95,
      "signature_applied": "Your Brand",
      "request_id": "req_1a2b3c4d5e"
    }
  }
  ```
  *Note:* `message_status: "sent"` means carrier accepted the payload; it does not guarantee handset delivery.

### 2.2 Test SMS Mode
- **Endpoint:** `POST https://smshub.et/api/test`
- Identical headers and request body as `/api/sms`.
- Executes all validation rules (auth, credit balance, rate limits, phone formatting, character limits, spam/phishing filters) without dispatching SMS or deducting credits.
- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "would_send": true,
      "final_text": "Your message here...\n\nYour Brand",
      "characters": 38,
      "character_limit": 160,
      "encoding": "GSM-7"
    }
  }
  ```

### 2.3 Verify API (Phone OTP)
The app delegates phone verification OTP generation, transmission, and validation to SMSHub:
1. **Send Code:** `POST https://smshub.et/api/verify/send`
   ```json
   {
     "msisdn": "0912345678",
     "app_name": "Habesha Cafe",
     "code_length": 6,
     "expires_in": 300
   }
   ```
   *Response:* Returns `verification_id`. The app stores `verification_id` and expiry. The raw 6-digit code is never returned to or stored by the app.
2. **Check Code:** `POST https://smshub.et/api/verify/check`
   ```json
   {
     "verification_id": "ver_...",
     "code": "482190"
   }
   ```
   *Response:* Returns status (`approved`, `failed`, `expired`, etc.). An approved code is valid only once.

### 2.4 Account Balance
- **Endpoint:** `GET https://smshub.et/api/balance`
- Returns total available credits. Used for dashboard alerts and automated pause thresholds.

---

## 3. Webhooks Architecture

- **Endpoint:** `POST /webhooks/smshub`
- **Subscribed Events:**
  - `message.sent`: Carrier accepted message. Confirms message record.
  - `message.failed`: Delivery/carrier failure. Credit is refunded. Updates record to `failed` and exposes the "Resend" action.
  - `credits.low`: Balance dropped below critical limit. Activates dashboard banner and pauses live sends.
  - `verification.approved`: Secondary validation confirmation.
  - `ping`: Health verification from SMSHub dashboard.

### Signature Verification
Every inbound webhook includes headers:
- `X-SMSHub-Event`: Event name
- `X-SMSHub-Delivery`: Unique delivery UUID (used for deduplication / idempotency)
- `X-SMSHub-Signature`: Format `t={timestamp},v1={hex_hmac}`

**Verification Procedure:**
1. Extract `t` and `v1` from `X-SMSHub-Signature`.
2. Ensure `|current_time - t| <= 300` seconds (prevent replay attacks).
3. Compute `expected = HMAC_SHA256(key=SMSHUB_WEBHOOK_SECRET, data="${t}.${rawRequestBody}")`.
4. Perform timing-safe equality check between `expected` and `v1`. Reject with 400 if invalid.
5. Return 200 OK within 6 seconds. Perform asynchronous processing of state changes.
6. Strip any plain code or sensitive text from payloads before saving to `message_events`.

---

## 4. Error Handling & Retry Matrix

| Response Code | `error_type` | System Action |
| --- | --- | --- |
| **400** | `invalid_json` | Client formatting bug. No retry. Alert dev team. |
| **401** | `missing_authorization`, `invalid_api_key` | Critical auth error. No retry. Alert admin. |
| **402** | `insufficient_credits` | Mark message `failed`. Pause all live sends. Display low-credit banner. |
| **403** | `account_not_verified`, `kyc_not_approved`, `account_suspended`, `ip_not_allowed` | Critical account state error. No retry. |
| **422** | `invalid_msisdn` | Phone format invalid. No retry. Prompt user to correct number. |
| **422** | `missing_text`, `message_too_long`, `signature_too_long` | Template sizing defect. No retry. Log template defect. |
| **422** | `message_rejected` | Phishing/moderation filter flagged text. No retry. Check `MOD-` reference. |
| **422** | `carrier_rejected` | Carrier (e.g. Safaricom) rejected text. Credit refunded. Reword template. |
| **429** | `rate_limited` | Exceeded 60 req/min. Wait `Retry-After` seconds, then retry (up to 3x). |
| **500** | *None* | Server error. Exponential backoff (1s, 4s, 10s), up to 3 tries. |
| **502** | `provider_error` | Gateway issue. Credit refunded. Retry with backoff (up to 3x). |
| **503** | `network_unavailable`, `maintenance` | Service down. Wait `Retry-After` seconds and retry. |
| **Timeout / No response** | *None* | Retry once. If still unresponsive, mark `unknown` and allow manual resend. |
