# Order-by-SMS: Functional Requirements

Complete list of functional requirements (FR-1 to FR-30) for the Order-by-SMS platform.

---

### 1. Seller Accounts and Products

- **FR-1:** A seller registers with business name, phone number, and password (at least 10 characters, stored using a slow password hash like Argon2/bcrypt).
- **FR-2:** The seller's phone number is verified with an SMS code at sign-up, because it receives every new-order alert.
- **FR-3:** Phone numbers are accepted in multiple Ethiopian formats (`09…`, `07…`, `251…`, or `+251…`), normalized to one canonical standard format (`09…` or `07…`), and rejected if international.
- **FR-4:** A seller can create, edit, hide (toggle availability), and soft-delete products with name, price in birr (santim integer), and an `available` flag.
- **FR-5:** Each seller gets one storefront link with a short readable URL slug (e.g. `/s/habesha-cafe`).

---

### 2. Storefront and Guest Checkout

- **FR-6:** The storefront is public, mobile-first, and lists only active/available products.
- **FR-7:** A buyer selects quantities and sees a running cart total in birr, which the server recalculates and trusts over client input.
- **FR-8:** Checkout asks for name and phone number only, requiring no buyer login or account creation.
- **FR-9:** Checkout includes an unticked-by-default consent checkbox for SMS updates about this order ("Send me SMS updates about this order").
- **FR-10:** The order is created only after phone verification succeeds, and the buyer sees an order number on a confirmation page.

---

### 3. Phone Verification (OTP)

- **FR-11:** The app invokes SMSHub's Verify API to create and text a 6-digit code (`POST /api/verify/send`), passing the shop name (up to 20-30 characters) as `app_name`.
- **FR-12:** SMSHub creates, stores, and checks the code, with a 5-minute expiry set when sent. The app stores only the `verification_id` and status, never the raw code.
- **FR-13:** A resend is allowed after 60 seconds on the application side (SMSHub requires 30), up to 5 codes per number per hour. A code locks after 5 incorrect attempts.
- **FR-14:** The buyer's input is verified using `POST /api/verify/check`. An approved code works only once.
- **FR-15:** SMSHub words the code message so every network accepts it. No application message asks the recipient to reply with a code.

---

### 4. Order Management

- **FR-16:** The dashboard lists a seller's orders, sorted newest first, showing order number, buyer name, total amount, and current state.
- **FR-17:** An order detail view displays itemized breakdown, buyer name and phone number, state transition history, and all SMS messages sent for that order.
- **FR-18:** A seller can accept, reject, mark ready, and complete an order from the dashboard, adhering to identical state machine rules as the action links.
- **FR-19:** Only valid transitions defined in the order lifecycle are permitted. Repeated actions return a clear idempotent message instead of triggering redundant mutations.
- **FR-20:** Entering the correct 4-digit pickup code completes the order. The seller can reissue a new code if the previous one locks.

---

### 5. Seller Action Links (Accept, Reject, Ready)

- **FR-21:** Each new-order SMS sent to the seller contains a unique URL link bound to one order and one seller, generated from an unguessable 16-byte (22-char URL-safe) token (`/a/{token}`).
- **FR-22:** The link opens a mobile-optimized webpage showing order details, presenting `Accept` and `Reject` buttons when `new`, and a `Ready` button once `accepted`. No login is required.
- **FR-23:** Each transition happens once. Opening the link again shows the current state without duplicating actions.
- **FR-24:** Action tokens expire after a configurable duration (default 48 hours) and become permanently inactive once the order is completed or rejected.
- **FR-25:** Link URLs and text are kept minimal and plain so they pass SMSHub phishing moderation filters and stay well within the single-segment SMS character limits.

---

### 6. Message Log and Resend

- **FR-26:** Every SMS message the app attempts to send is recorded in the `messages` table with order ID, recipient phone, event type, sanitized text, SMSHub message ID (`msg_…`), credits used, timestamp, and status.
- **FR-27:** The log displays the real delivery status taken from the SMSHub API response and incoming webhook events (never presumed). "Sent" denotes carrier acceptance, not device delivery.
- **FR-28:** Failed sends (e.g., HTTP 502, network issues) are stored as `failed` with error type and request ID, highlighted visually in the UI.
- **FR-29:** Sellers can manually trigger a resend for failed or unknown messages directly from the message log. Webhook events update the same record by `message_id`.
- **FR-30:** Every webhook payload received from SMSHub is verified against `X-SMSHub-Signature` (HMAC-SHA256) before processing or updating any database record.
