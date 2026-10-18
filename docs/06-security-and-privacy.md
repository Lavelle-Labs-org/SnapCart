# Order-by-SMS: Security & Privacy Specification

## 1. Signed Single-Use Action Links

Seller action links (`/a/{token}`) and buyer stop links (`/x/{token}`) allow actions without persistent logins. Their design strictly prevents guessing, scraping, and accidental execution.

### Token Construction & Security
- **Entropy:** Generated with 16 cryptographically secure random bytes (`crypto.randomBytes(16)`), formatted as 22-character URL-safe Base64 strings.
- **Database Storage:** Stored strictly as a SHA-256 hash (`action_tokens.token_hash`). The plaintext token is never stored in the database.
- **Strict Binding:** Each token is bound to a single `order_id`, `purpose`, and `seller_id`.
- **Expiration:** Default 48-hour expiration. Tokens are invalidated immediately upon completion or rejection of the order.
- **No Side-Effects on GET:** Opening `/a/{token}` only renders the HTML review page. Actual state transitions (`accept`, `reject`, `ready`, `complete`) require HTTP `POST` requests. This prevents link preview scrapers (Telegram, WhatsApp, SMS apps) from mutating orders.
- **Headers & Privacy:** Action pages emit `Referrer-Policy: no-referrer` to prevent token leakage in HTTP referrer headers.

---

## 2. OTP & Pickup Code Security

| Attribute | Phone Verification Code (OTP) | Handover Pickup Code |
| --- | --- | --- |
| **Generator** | SMSHub Verify API | Node.js CSPRNG (`crypto.randomInt(1000, 9999)`) |
| **Storage** | SMSHub only (App stores only `verification_id`) | Keyed HMAC-SHA256 (`PICKUP_CODE_SECRET`), never plaintext |
| **Length** | 6 digits | 4 digits (e.g. `4821`) |
| **Validity** | 5 minutes | 7 days (or until order completion) |
| **Max Attempts** | 5 attempts -> Locked | 5 attempts -> Locked |
| **Reissue Rule** | 60-second cooldown | Reissuable by seller via dashboard/action page |
| **Rate Limit** | Max 5 per phone/hr, 10 per IP/hr | 1 active code per order |

### Defense against Code Guessing
- With 4 digits, 5 wrong attempts yield a trivial 5 / 10,000 = 0.05% brute-force probability per order.
- Attempts are incremented atomically. When attempts >= 5, verification fails immediately, requiring code reissue.
- Plain codes are never written to server logs, database tables, or error payloads.

---

## 3. Secrets & Repository Hygiene

1. **Zero Secrets in Git:**
   - `.gitignore` includes `.env`, `.env.local`, and credential files from commit #1.
   - `.env.example` provides explicit variable definitions with mock placeholder values.
2. **Distinct Key Isolation:**
   - Separate secret environment variables: `SMSHUB_API_KEY`, `SMSHUB_WEBHOOK_SECRET`, `SESSION_SECRET`, and `PICKUP_CODE_SECRET`.
   - Separate SMSHub API keys for development (`test` mode) vs live staging/demo.
3. **Session Hardening:**
   - Seller sessions utilize `HttpOnly`, `Secure`, and `SameSite=Lax` cookies.
   - Passwords hashed using Argon2id or Bcrypt with high cost factors.
4. **Leak Response Protocol:**
   - Any compromised secret is immediately revoked in the SMSHub console and rotated on the hosting platform.

---

## 4. Customer Data, Privacy & Moderation

- **Minimal Data Storage:**
  - Buyer: Name, normalized phone number, order items, and SMS consent audit timestamp.
  - Seller: Business name, phone, password hash, storefront slug.
  - Never collected/stored: National IDs, payment card numbers, plaintext OTPs.
- **Masking:** All UI views (e.g. message logs) and server logs mask phone numbers (e.g., `09•• ••• 567`).
- **Abuse & Phishing Prevention:**
  - Sellers cannot write arbitrary free-form SMS messages; only fixed system templates with parameterized variables are transmitted.
  - Shop names are validated to contain alphanumeric characters, spaces, and standard punctuation (max 20 characters), blocking URLs and phone numbers.
  - A global emergency switch (`SMS_SENDING_PAUSED=true`) pauses all outbound live messages immediately if abuse or credit drain is detected.
- **Sender Allowlist:** In demo/staging mode, an optional comma-separated list of allowed recipient numbers (`SMS_ALLOWLIST`) guarantees SMS are never sent to unintended phone numbers during evaluation.
