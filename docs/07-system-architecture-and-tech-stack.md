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
│              Next.js Frontend Application (apps/web)              │
│                                                                   │
│  +─────────────────────────+     +─────────────────────────────+  │
│  │    App Router Pages     │     │      Typed API Client       │  │
│  │   Storefront / Actions  │────►│   Communicates with NestJS  │  │
│  │    Seller Dashboard     │     │  Reverse Proxy /api/ rewrite│  │
│  +─────────────────────────+     +──────────────┬──────────────+  │
+─────────────────────────────────────────────────┼─────────────────+
                                                  │
                                                  │ REST API / JSON Envelope
                                                  ▼
+───────────────────────────────────────────────────────────────────+
│               NestJS Backend Application (apps/api)               │
│                                                                   │
│  +─────────────────────────────────────────────────────────────+  │
│  │                       NestJS Modules                        │  │
│  │  AuthModule  │  OrdersModule  │  ProductsModule  │  Health  │  │
│  │  SMSHubModule│  WebhooksModule│  VerificationMod │  Prisma  │  │
│  +──────────────────────────────┬──────────────────────────────+  │
│                                 │                                 │
│  +──────────────────────────────▼──────────────────────────────+  │
│  │                      Services & Guards                      │  │
│  │   SellerAuthGuard  │   OrderService   │   SMSHubService     │  │
│  │   ZodValidationPipe│   CryptoService  │   PrismaService     │  │
│  +──────────────┬───────────────────────────────┬──────────────+  │
│                 │                               │                 │
+─────────────────┼───────────────────────────────┼─────────────────+
                  │                               │
                  ▼                               ▼ HTTPS (Bearer Key)
+──────────────────────────────────+    +───────────────────────────+
│       PostgreSQL Database        │    │        SMSHub.et          │
│       (via PrismaService)        │    │  - SMS API (/api/sms)     │
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
1. Buyer configures cart at `/s/{slug}` and proceeds to `/s/{slug}/checkout` on `apps/web`.
2. Buyer enters name, phone, and optional SMS consent.
3. Client submits `POST /api/checkout` to the NestJS backend (`apps/api`). Server validates fields via Zod pipe, creates draft in `phone_verifications`, and calls SMSHub `POST /api/verify/send`.
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
1. Seller receives SMS with `/a/{token}` and opens in mobile browser (`apps/web`).
2. Page displays order summary and allowed transitions (`Accept` or `Reject`).
3. Seller taps `Accept` -> `POST /api/a/{token}/accept` to NestJS `OrdersController`.
4. Server transitions order to `accepted`.
5. If buyer gave consent and is not suppressed, server formats template and dispatches "Order accepted" SMS to buyer.

### 2.3 Ready & Handover Flow
1. Seller prepares order, visits `/a/{token}` or dashboard, and taps `Ready`.
2. NestJS server updates state to `ready`, generates cryptographically random 4-digit pickup code, hashes it with server secret via `CryptoService`, and stores in `pickup_codes`.
3. Server texts "Order ready" with pickup code to buyer.
4. At handover, seller inputs code -> `POST /api/a/{token}/complete`.
5. Server performs timing-safe hash comparison. If matched, order state becomes `completed`. Code is invalidated.

---

## 3. Technology Stack

| Layer | Selection | Rationale |
| --- | --- | --- |
| **Workspace Architecture** | Monorepo (npm workspaces) | Clean separation of `apps/web`, `apps/api`, and `packages/contracts` without third-party monorepo tool overhead |
| **Backend Framework** | NestJS (v10+) + TypeScript | Modular monolith architecture, dependency injection, testability, enterprise maintainability |
| **Frontend Framework**| Next.js (App Router) + TypeScript | Fast SSR storefront, mobile responsiveness, lightweight bundle |
| **Database & ORM** | PostgreSQL + Prisma ORM | Strong consistency, schema migrations, authoritative data access in `apps/api` |
| **Styling** | Tailwind CSS (mobile-first) | Rapid responsive UI creation, lightweight CSS output, optimized for mobile |
| **Validation** | Zod + Custom NestJS Pipe | End-to-end type safety, preserving established regexes and Ethiopian phone normalization |
| **Authentication** | Jose JWT / HttpOnly Cookie Sessions | 7-day secure sessions (`HttpOnly`, `SameSite=Lax`, `Secure`), authenticated seller guards |
| **Security Utilities** | Native `crypto` (`randomInt`, `randomBytes`, `timingSafeEqual`) | Standard cryptographic primitives without bulky external dependencies |
| **SMS Gateway Client** | NestJS `SMSHubService` | Encapsulated rate pacing (<60 req/min), bounded retries, test mode safety |
| **Testing** | Vitest & Supertest | Fast unit tests for logic and end-to-end HTTP integration tests for NestJS controllers |

---

## 4. Deployment & Communication Architecture

- **Independent Deployment:** Frontend (`apps/web`) and Backend (`apps/api`) can be deployed independently (e.g. Vercel for frontend, Railway/Render/VPS for backend).
- **Communication & Same-Origin Cookies:**
  - In development, Next.js App Router configures an internal proxy rewrite (`/api/:path* -> http://localhost:4000/api/:path*`), allowing cookies to remain strictly same-origin.
  - In production, applications can share a root domain or use CORS with credentials (`credentials: true`).
- **Public URL & Webhook Tunneling:** Required for SMSHub webhooks (`https://.../api/webhooks/smshub`). Local development uses tools like ngrok/cloudflared.
- **Environment Flags:**
  - `SMSHUB_MODE="test"`: Local and CI tests; invokes `POST /api/test` (0 credits used).
  - `SMSHUB_MODE="live"`: Production demo; invokes `POST /api/sms`.
