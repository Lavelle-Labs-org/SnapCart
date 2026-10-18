# Order-by-SMS: System Architecture & Tech Stack

## 1. System Topology

```
+──────────────────────────+             +──────────────────────────+
│       Buyer Phone        │             │       Seller Phone       │
│  (Storefront / Checkout) │             │ (Action Link / Dashboard)│
+─────────────┬────────────+             +─────────────┬────────────+
              │                                        │
              │ HTTPS                                  │ HTTPS
              ▼                                        ▼
+───────────────────────────────────────────────────────────────────+
│                       Next.js Web Application                     │
│                                                                   │
│  +─────────────────────────+     +─────────────────────────────+  │
│  │    App Router Pages     │     │        API Handlers         │  │
│  │   Storefront / Actions  │     │   Checkout, Orders, Auth    │  │
│  │    Seller Dashboard     │     │     Webhooks Endpoint       │  │
│  +─────────────────────────+     +──────────────┬──────────────+  │
│                                                 │                 │
│  +──────────────────────────────────────────────▼──────────────+  │
│  │                        Services                             │  │
│  │   OrderService   │   SMSService   │   PickupCodeService     │  │
│  +──────────────┬───────────────────────────────┬──────────────+  │
│                 │                               │                 │
+─────────────────┼───────────────────────────────┼─────────────────+
                  │                               │
                  ▼                               ▼ HTTPS (Bearer Key)
+──────────────────────────────────+    +───────────────────────────+
│       PostgreSQL Database        │    │        SMSHub.et          │
│          (via Prisma)            │    │  - SMS API (/api/sms)     │
│ - sellers      - orders          │    │  - Verify API (/verify/*) │
│ - products     - messages        │    │  - Webhooks dispatcher    │
│ - order_items  - suppression     │    +─────────────┬─────────────+
│ - action_tokens- pickup_codes    │                  │
+──────────────────────────────────+                  │ Outbound SMS
                                                      ▼
                                        +───────────────────────────+
                                        │ Telecommunications MNOs   │
                                        │  Ethio Telecom (09...)    │
                                        │  Safaricom Ethiopia (07..)│
                                        +───────────────────────────+
```

---

## 2. Key Request Flows

### 2.1 Checkout & Order Creation Flow
1. Buyer configures cart at `/s/{slug}` and proceeds to `/s/{slug}/checkout`.
2. Buyer enters name, phone, and optional SMS consent.
3. Client submits `POST /api/checkout`. Server validates fields, creates draft in `phone_verifications`, and calls SMSHub `POST /api/verify/send`.
4. SMSHub texts 6-digit OTP to buyer. Buyer is redirected to `/s/{slug}/verify/{draftId}`.
5. Buyer enters code -> `POST /api/checkout/verify`.
6. Server checks code via SMSHub `POST /api/verify/check`.
7. Upon approval:
   - Server computes authoritative price santim from `products`.
   - Inserts row in `orders` (state: `new`, number: `#1001+`).
   - Inserts `order_items` (freezing item name and price).
   - Generates action token for seller (`/a/{token}`).
   - Dispatches "New order" SMS alert to seller via SMSHub.
   - Redirects buyer to order confirmation `/s/{slug}/done`.

### 2.2 Seller Action Link Flow
1. Seller receives SMS with `/a/{token}` and opens in mobile browser.
2. Page displays order summary and allowed transitions (`Accept` or `Reject`).
3. Seller taps `Accept` -> `POST /api/a/{token}/accept`.
4. Server transitions order to `accepted`.
5. If buyer gave consent and is not suppressed, server formats template and dispatches "Order accepted" SMS to buyer.

### 2.3 Ready & Handover Flow
1. Seller prepares order, visits `/a/{token}` or dashboard, and taps `Ready`.
2. Server updates state to `ready`, generates cryptographically random 4-digit pickup code, hashes it with server secret, and stores in `pickup_codes`.
3. Server texts "Order ready" with pickup code to buyer.
4. At handover, seller inputs code -> `POST /api/a/{token}/complete`.
5. Server performs timing-safe hash comparison. If matched, order state becomes `completed`. Code is invalidated.

---

## 3. Technology Stack

| Layer | Selection | Rationale |
| --- | --- | --- |
| **Runtime & Language** | Node.js (v20+) & TypeScript | Type safety across order state machine and SMS payload contracts |
| **Application Framework**| Next.js (App Router) | Unified SSR storefront, authenticated dashboard, and serverless API routes |
| **Database & ORM** | PostgreSQL + Prisma ORM | Strong consistency, schema migrations, and relational integrity |
| **Styling** | Tailwind CSS (mobile-first) | Rapid responsive UI creation, lightweight CSS output, optimized for mobile |
| **Validation** | Zod | End-to-end type inference for forms, API bodies, and phone normalization |
| **Authentication** | Iron Session / Jose / Cookie sessions | Lightweight encrypted session cookies (HttpOnly, SameSite, Secure) |
| **Security Utilities** | Native `crypto` (`randomInt`, `randomBytes`, `timingSafeEqual`) | Standard cryptographic primitives without bulky dependencies |
| **SMS Gateway Client** | Custom native `fetch` module | Low overhead, explicit typed errors, transparent retry logic |
| **Testing** | Vitest | Fast test execution for unit and integration testing |

---

## 4. Deployment Architecture

- **Hosting Platform:** Node.js hosting (e.g. Vercel, Railway, Render, or VPS).
- **Public URL & Tunneling:** Required for SMSHub webhooks (`https://...`). Local development uses tools like ngrok/cloudflared.
- **Short Domain Considerations:** SMS character budgets require a short domain name (e.g. 15-20 characters total for the base URL) so URLs inside SMS remain ~39 characters.
- **Environment Flags:**
  - `SMSHUB_MODE="test"`: Local and CI tests; invokes `POST /api/test` (0 credits used).
  - `SMSHUB_MODE="live"`: Production demo; invokes `POST /api/sms`.
