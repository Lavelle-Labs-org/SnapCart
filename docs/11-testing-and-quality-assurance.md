# Order-by-SMS: Testing & Quality Assurance Plan

## 1. Zero-Cost Testing Strategy

To protect the team's SMSHub credit budget, testing is organized across distinct tiers:

| Tier | Focus | Infrastructure | Credit Cost |
| --- | --- | --- | --- |
| **Unit Tests** | State machines, phone normalization, cryptographic tokens, templating, money calculations | Vitest in-memory | 0 credits |
| **Integration Tests** | Route handlers, session cookies, database cascade integrity | Local Postgres + Mock SMSHub Server | 0 credits |
| **Template Validation** | SMS size and encoding limits across boundary cases | SMSHub `POST /api/test` endpoint | 0 credits |
| **End-to-End Verification** | Full ordering, SMS delivery, pickup code completion | Real devices on live network | ~4–8 credits / run |

---

## 2. End-to-End Test Matrix (E1 to E11)

| Test ID | Scenario Description | Expected Outcome |
| --- | --- | --- |
| **E1** | **Happy Path:** Buyer orders & verifies; seller accepts via SMS link, marks ready, and completes with pickup code | 4 SMS sent (buyer OTP, seller alert, accepted, ready with code). Order ends `completed`. 4 rows in message log. |
| **E2** | **Order Rejection:** Seller rejects a new order | Buyer receives "order rejected" SMS. Order state is `rejected` (terminal). Link actions disabled. |
| **E3** | **No Consent:** Buyer leaves consent box unticked | Only buyer OTP SMS is sent. Subsequent notifications skipped (logged as `skipped` with reason `opted_out`). Order completes normally. |
| **E4** | **Opt-out via Stop Link:** Buyer clicks `/x/{token}` after accepted SMS | Buyer phone added to `suppression_list`. "Ready" SMS skipped. Order completes normally. |
| **E5** | **Locked Pickup Code:** 5 wrong pickup codes submitted, then seller reissues | Code locks on 5th attempt. Seller triggers reissue. New code texted to buyer and completes order. |
| **E6** | **OTP Limit & Cooldown:** User attempts resend within 60s, or enters 5 wrong codes | Resend blocked with timer notice. 5th invalid attempt locks verification. |
| **E7** | **Idempotent Replay:** Seller taps Accept button repeatedly | First tap changes state to `accepted` and triggers SMS. Subsequent taps return current state without sending duplicate SMS. |
| **E8** | **Dead / Expired Action Link:** Opening link after order completion or after 48h | Returns 404 / friendly expired notification without exposing order data. |
| **E9** | **Dashboard Parity:** Performing accept/ready/complete from dashboard | Produces identical state changes and SMS events as the SMS action links. |
| **E10** | **Webhook Integrity:** Inbound webhook arrives with valid, duplicate, and forged signatures | Valid updates message status. Duplicate delivery ID is safely ignored. Invalid signature returns 400. |
| **E11** | **Amharic Shop Name:** Seller with Ge'ez shop name | Backend warns/validates character limits, preserving message delivery. |

---

## 3. Failure Simulations & Resilience

| Failure Mode | Simulation Method | Resilient Behavior |
| --- | --- | --- |
| **SMSHub 502 Bad Gateway** | Mock server returns 502 | Up to 3 retries with backoff. If exhausted, status marked `failed`, resend button active, order state preserved. |
| **SMSHub 422 `message_rejected`** | Mock server returns moderation error | No retry. Logged as `failed` with moderation reference. Dev team notified. |
| **SMSHub 429 Rate Limit** | Mock server returns 429 + `Retry-After: 5` | Client pauses and retries after designated delay. |
| **SMSHub 402 Out of Credits** | Mock server returns 402 | All outbound sends paused. Dashboard displays low-credit alert banner. |
| **Carrier Timeout** | Drop request or 30s delay | 1 retry. Status marked `unknown` with manual resend available. |
| **Process Crash mid-transaction** | Process interrupted between state save & SMS | State is already committed in database. Missing SMS visible in message log with "Resend" action. |
