# Snapcart ⚡

> **A business you can run entirely from text messages.**
> Ethiopian conversational SMS commerce platform. A seller shares one storefront link on Telegram, TikTok, or Instagram, customers order in seconds with verified phone numbers, and every operational step — order alerts, approvals, fulfillment status, and pickup handover — runs seamlessly over SMS.

[![CI Quality Gates](https://github.com/fenet-as/order-by-sms/actions/workflows/ci.yml/badge.svg)](https://github.com/fenet-as/order-by-sms/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.x-black.svg)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-ea2845.svg)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748.svg)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC.svg)](https://tailwindcss.com/)
[![SMSHub](https://img.shields.io/badge/SMSHub-Gateway-FF6B00.svg)](https://smshub.et)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## The Problem

Micro and small enterprises in Ethiopia (cafés, fast-food stalls, dry cleaners, tailors, boutique shops, and print houses) handle daily customer orders through Telegram channels, Instagram DMs, TikTok, and phone calls. This informal commerce workflow suffers from:

1. **Missed & Lost Orders:** Busy sellers preparing goods overlook incoming chat notifications during rush hours.
2. **Fake / Unreachable Phone Numbers:** Cash-on-Delivery (COD) orders placed via chat frequently give invalid contact numbers, causing wasted inventory and delivery driver delays.
3. **Disputed Handovers & Package Theft:** Without verifiable proof of handover, neither the merchant, courier, nor customer has definitive proof of collection.
4. **App Fatigue & Connectivity Friction:** Asking Ethiopian buyers to download a heavy native app or register with passwords causes instant checkout drop-off, especially on 3G and congested networks.

---

## The Solution: Snapcart

Snapcart transforms the chaotic social commerce flow into a reliable, automated SMS-first pipeline:

```
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│ 1. Storefront   │  ──►  │ 2. Verified Checkout │  ──►  │ 3. One-Tap Actions     │
│ Seller shares   │       │ Buyer places order;  │       │ Seller receives SMS    │
│ /s/{slug} link  │       │ OTP validates phone  │       │ with secure /a/{token} │
└─────────────────┘       └──────────────────────┘       └────────────────────────┘
                                                                     │
                                                                     ▼
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│ 6. Real-time    │  ◄──  │ 5. Pickup Security   │  ◄──  │ 4. Order Preparation   │
│ Audit & Webhook │       │ Buyer shows 4-digit  │       │ Buyer gets SMS update; │
│ SMSHub reports  │       │ HMAC code at counter │       │ seller marks as ready  │
└─────────────────┘       └──────────────────────┘       └────────────────────────┘
```

1. **Shareable Storefront (`/s/{slug}`):** Sellers share their branded, ultra-fast mobile catalog link on social media.
2. **Guest Checkout + SMSHub Phone OTP:** Buyers build their cart and verify their phone number via SMS OTP in seconds. No account registration needed.
3. **One-Tap Seller Action Links (`/a/{token}`):** The merchant immediately receives an SMS notification with a signed, single-use, 48-hour link to Accept, Reject, or Mark Ready directly from their phone with one thumb.
4. **Tamper-Proof Pickup Handover:** When ready, the buyer receives a 4-digit HMAC pickup code via SMS. The seller verifies this code at the counter to close the order (locks after 5 failed attempts).
5. **Audited SMS Lifecycle & Webhooks:** Delivery webhooks track Ethio Telecom / Safaricom transmission in real-time, failed messages feature instant manual resend, and buyers retain full opt-out privacy.

---

## Key Features

### 🇪🇹 Bilingual Experience (Amharic & English)
- Instant, reactive language toggle (`en` / `am`) across all pages without layout shift.
- Full native Amharic translations for landing page, customer storefront, checkout flow, OTP modals, order confirmation, pickup screens, seller action links, and merchant dashboard.

### 🌗 Modern Responsive Design & Dark Mode
- Universal dark mode & light mode toggle with system preference sync across landing, auth, dashboard, storefronts, and action links.
- Sleek speed-cart SVG vector brand identity with warm saffron amber accents and ambient aurora glow.
- Interactive order flow simulator on the landing page demonstrating the end-to-end customer and seller SMS journey.

### 📱 SMS-Driven Merchant Operations
- **Zero-Dashboard Operation:** Sellers can run daily sales entirely via incoming SMS and signed action links without logging into a web dashboard.
- **Message Audit Log:** Real-time visibility into SMSHub status (`sent`, `failed`, `skipped`), carrier network (`ethio` / `safaricom`), credit consumption, and `msg_...` IDs.
- **Fail-Safe Resend Controls:** Single-click manual resend for undelivered SMS alerts directly from the dashboard.

### 🔐 Zero-Trust Security & Privacy
- **Signed Action Links:** Cryptographically secure 22-character CSPRNG action tokens with 48-hour single-use validity.
- **HMAC-SHA256 Handover Codes:** Constant-time `timingSafeEqual` 4-digit pickup code comparison with automatic 5-attempt rate-limit lockout.
- **Database Row Level Security (RLS):** Supabase PostgreSQL protected with RLS enabled across public tables.
- **Carrier Replay Protection:** Inbound webhooks enforce 300-second timestamp validation against replay attacks.
- **Strict Privacy Compliance:** Unticked-by-default SMS consent and single-tap buyer opt-out suppression.

### ☁️ Cloudflare R2 Media Storage
- Fast, S3-compatible cloud storage for merchant profile pictures and product catalog images.
- Automated file validation, safe file naming, and direct CDN-backed asset delivery.

### 💳 Chapa Subscription Billing
- Integrated Chapa payment gateway for seller subscriptions with 14-day free trials.
- Tiered merchant plans (Free Trial, Starter, Growth, Pro) with automated billing webhook synchronization.

---

## Monorepo Architecture

The codebase is organized as an enterprise-grade npm monorepo:

```
order-by-sms/
├── apps/
│   ├── web/                     # Next.js 14+ App Router frontend
│   │   ├── src/app/             # Pages: Landing, Auth, Dashboard, Storefront (/s/[slug]), Actions (/a/[token])
│   │   ├── src/lib/             # i18n dictionaries (en/am), Prisma client, auth session
│   │   └── next.config.mjs      # Proxy rewrites (/api/* -> INTERNAL_API_URL)
│   └── api/                     # NestJS 10 modular backend service
│       └── src/
│           ├── modules/         # Auth, Orders, Products, Webhooks, SMSHub, Chapa, Settings
│           └── config/          # Zod-validated environment configuration
├── packages/
│   └── contracts/               # Shared TypeScript schemas, DTOs, and Zod validators
├── prisma/
│   ├── schema.prisma            # Canonical database schema
│   ├── migrations/              # Versioned PostgreSQL migrations & RLS policies
│   └── seed.ts                  # Database seed script for local development
└── docs/                        # Complete architecture and product specifications
```

---

## Tech Stack

| Domain | Technology |
|---|---|
| **Frontend Framework** | [Next.js](https://nextjs.org/) (App Router, React 18, TypeScript) |
| **Backend Framework** | [NestJS](https://nestjs.com/) (Modular Monolith, Fastify/Express) |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/) (Supabase) + [Prisma ORM](https://www.prisma.io/) |
| **SMS Gateway & OTP** | [SMSHub.et](https://smshub.et) (Ethio Telecom & Safaricom routing) |
| **Object Storage** | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) (S3-compatible) |
| **Payment Gateway** | [Chapa](https://chapa.co/) (Ethiopian Birr merchant subscription billing) |
| **Styling & Icons** | [Tailwind CSS](https://tailwindcss.com/) + Lucide Icons + Custom Vector SVG branding |
| **Validation & State** | [Zod](https://zod.dev/) + TypeScript strict mode |
| **Testing Suite** | [Vitest](https://vitest.dev/), Supertest, Testing Library (80+ suites, 600+ tests) |
| **Security** | CSPRNG, HMAC-SHA256, bcrypt, timingSafeEqual, Helmet, Rate-Limiting, Row Level Security |

---

## Getting Started Locally

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10+`
- **PostgreSQL**: Local instance, Docker container, or Supabase project
- **SMSHub Account**: Free sandbox credentials from [SMSHub.et](https://smshub.et)

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/fenet-as/order-by-sms.git
cd "order by sms"
npm install
```

### 3. Environment Configuration
Copy the template configuration:
```bash
cp .env.example .env
```

Key environment variables to configure in `.env`:
```env
# ------------------------------------------------------------------------------
# 1. Database Connection (PostgreSQL / Supabase)
# ------------------------------------------------------------------------------
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/order_by_sms?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/order_by_sms?schema=public"

# ------------------------------------------------------------------------------
# 2. Service URLs & Cross-Origin Communication
# ------------------------------------------------------------------------------
PORT=3001
NEXT_PUBLIC_APP_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"
INTERNAL_API_URL="http://localhost:3001"

# ------------------------------------------------------------------------------
# 3. Security & Session Secrets
# ------------------------------------------------------------------------------
SESSION_SECRET="your-32-character-session-secret-here"
PICKUP_CODE_SALT="your-cryptographic-pickup-salt"

# ------------------------------------------------------------------------------
# 4. SMSHub Integration (Ethio Telecom / Safaricom SMS Gateway)
# ------------------------------------------------------------------------------
SMSHUB_API_KEY="your_smshub_api_key"
SMSHUB_SENDER_ID="Snapcart"
SMSHUB_MODE="test"                    # "test" for zero-credit testing, "live" for production
SMSHUB_WEBHOOK_SECRET="your_webhook_signing_secret_here"

# ------------------------------------------------------------------------------
# 5. Media Storage (Cloudflare R2) & Payments (Chapa) - Optional for local dev
# ------------------------------------------------------------------------------
R2_ACCOUNT_ID="your_cloudflare_account_id"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="snapcart-media"
R2_PUBLIC_URL="https://your-custom-domain.com"

CHAPA_SECRET_KEY="CHASECK_TEST-your-key"
CHAPA_WEBHOOK_SECRET="your-chapa-webhook-secret"
```

### 4. Database Setup & Migrations
You can spin up a local PostgreSQL container using Docker:
```bash
docker run --name snapcart-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=order_by_sms \
  -p 5432:5432 \
  -d postgres:16-alpine
```

Apply database migrations:
```bash
# Apply pending Prisma migrations
npm run prisma:migrate

# Seed development database with demo merchant & sample catalog
npm run db:seed
```

### 5. Running the Monorepo
Start both the Next.js frontend and NestJS API concurrently:
```bash
npm run dev
```

- **Frontend Application:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:3001](http://localhost:3001)
- **API Health Check:** [http://localhost:3001/api/health](http://localhost:3001/api/health)

To run either service independently:
```bash
npm run dev:web    # Runs Next.js frontend only
npm run dev:api    # Runs NestJS backend only
```

---

## SMSHub Webhook Integration ("Hooked" Quest)

To earn the **"Hooked" quest badge (+15 pts)** in the SMSHub Buildathon, Snapcart provides a fully verified inbound delivery webhook pipeline:

### 1. Webhook Endpoints
Both routes are available and verify inbound carrier delivery reports:
- Primary: `POST https://<your-domain>/webhooks/smshub`
- API Route: `POST https://<your-domain>/api/webhooks/smshub`

### 2. Cryptographic Verification & Replay Protection
- Verifies the `X-SMSHub-Signature` header (`t={timestamp},v1={hmac}`) using HMAC-SHA256.
- Enforces a 300-second (5-minute) replay attack tolerance window.
- Automatically handles test pings with `{ "received": true, "event": "ping" }`.

### 3. Local Webhook Testing via Tunnel
Expose your local development port to the web:
```bash
# Using cloudflared:
cloudflared tunnel --url http://localhost:3000

# Or using ngrok:
ngrok http 3000
```
Register `https://<tunnel-subdomain>/webhooks/smshub` in your [SMSHub Webhooks Dashboard](https://smshub.et/dashboard/webhooks).

---

## Testing & Quality Assurance

Snapcart maintains rigorous test coverage with over 80 test suites and 600+ tests:

```bash
# Run all unit, integration, and e2e tests
npm test

# Run tests in watch mode during development
npx vitest

# Run targeted test suites
npx vitest run test/e2e/webhook-sync.test.ts
npx vitest run apps/api/src/modules/auth/__tests__/
```

### Automated Quality Gates
All commits and Pull Requests are verified against automated CI quality gates:
```bash
# Linting checks
npm run lint

# Secret scanning (verifies no live API keys or credentials are staged)
npm run check:secrets

# TypeScript typechecking
npx tsc --noEmit

# High-severity dependency vulnerability audit
npm audit --audit-level=high
```

---

## Production Deployment Guide

Snapcart is architected for decoupled cloud deployment:

### Frontend (Next.js on Vercel)
1. Deploy `apps/web` to Vercel (Root Directory: `./`).
2. Configure Environment Variables on Vercel:
   - `INTERNAL_API_URL`: Public HTTPS URL of the deployed NestJS API (e.g. `https://api.yourdomain.com`).
   - `DATABASE_URL`: Supabase Transaction Pooler URL (port `6543`).
   - `DIRECT_URL`: Supabase Direct Connection URL (port `5432`).
   - `SESSION_SECRET`: Cryptographically random 32+ character string.
   - `NEXT_PUBLIC_APP_URL`: Public frontend URL (e.g. `https://snapcart.vercel.app`).
3. The Next.js rewrite engine automatically routes `/api/*` requests directly to `INTERNAL_API_URL`.

### Backend (NestJS on Railway / Render / Fly.io / VPS)
1. Deploy `apps/api` using the included production Dockerfile or container runner.
2. Configure Environment Variables:
   - `DATABASE_URL` & `DIRECT_URL`: Supabase database credentials.
   - `FRONTEND_URL`: Public frontend domain for CORS authorization.
   - `SESSION_SECRET`: Identical to the frontend session secret.
   - `SMSHUB_API_KEY`, `SMSHUB_SENDER_ID`, `SMSHUB_MODE="live"`.
   - `SMSHUB_WEBHOOK_SECRET`: SMSHub dashboard webhook signing key.
   - `R2_*` and `CHAPA_*`: Production credentials for Cloudflare R2 and Chapa.

---

## Documentation Suite

Comprehensive architectural, security, and product specifications are maintained in the [`docs/`](./docs/) directory:

- [01. Product Overview & Scope](./docs/01-product-overview-and-scope.md)
- [02. User Journeys & Lifecycle](./docs/02-user-journeys-and-lifecycle.md)
- [03. Functional Requirements](./docs/03-functional-requirements.md)
- [04. SMS Strategy & Templates](./docs/04-sms-strategy-and-templates.md)
- [05. SMSHub Integration](./docs/05-smshub-integration.md)
- [06. Security & Privacy](./docs/06-security-and-privacy.md)
- [07. System Architecture](./docs/07-system-architecture-and-tech-stack.md)
- [08. Data Model & Database](./docs/08-data-model-and-database.md)
- [09. Routes & API Specification](./docs/09-routes-and-api-spec.md)
- [10. UI & UX Specifications](./docs/10-ui-ux-design-specs.md)
- [11. Testing & Quality Assurance](./docs/11-testing-and-quality-assurance.md)

---

## Contributing

1. Create a descriptive feature branch: `git checkout -b feat/your-feature-name`
2. Implement your changes adhering to existing architectural standards.
3. Verify all tests pass: `npm test`
4. Run all quality gates: `npm run lint && npm run check:secrets && npx tsc --noEmit`
5. Push to GitHub and open a Pull Request.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
