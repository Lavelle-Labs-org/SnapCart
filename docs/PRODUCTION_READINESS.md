# Order-by-SMS: Production-Readiness Audit Report

**Date:** October 22, 2026  
**Auditor:** Senior Engineering Production Readiness Audit  
**Target Repository:** `fenet-as/order-by-sms`  
**Stack:** Next.js (App Router, TypeScript) + NestJS (Modular Monolith, TypeScript) + PostgreSQL (Prisma ORM) + SMSHub.et Gateway  

---

## 1. Executive Summary & Verdict

### Verdict: **NO-GO FOR PRODUCTION** 🛑

**Summary of Verdict:**  
While the application demonstrates commendable engineering rigor in several core areas—notably 100% passing tests (539/539 tests across 66 suites), clean build pipelines, strict 4-digit HMAC pickup code handling, GSM-7/UCS-2 SMS template segmenting, and timing-safe webhook verification—it **cannot be deployed to production in its current state**.

Critical security and architectural vulnerabilities block launch:
1. **Critical Authentication Bypass & IDOR:** Every server-side dashboard route (`/dashboard`, `/dashboard/products`, `/dashboard/settings`, `/dashboard/messages`) allows unauthenticated access simply by appending `?sellerId=<victim-id>` to the URL. In addition, the frontend JWT decoder (`extractSellerIdFromToken`) splits strings and reads base64 payloads without cryptographic signature verification (`jwtVerify`), allowing arbitrary session forgery.
2. **Unauthenticated Order Detail Leak & Mock Fallback:** `/dashboard/orders/[id]` has no authentication check and falls back to mock demo data ("Abebe Bikila") when an order is not found, leaking customer phone numbers and item details upon guessing an ID.
3. **Live Production Supabase Database Credentials in Workspace:** Real live Supabase credentials (`aws-1-eu-west-3.pooler.supabase.com:6543`) are stored in `.env`.
4. **Webhook Endpoint Path Mismatch:** SMSHub expects `POST /webhooks/smshub` (per specification `docs/05-smshub-integration.md`), but NestJS applies a global prefix `api` (`POST /api/webhooks/smshub`), and Next.js rewrites do not proxy `/webhooks/*`. All external carrier webhooks will return 404 in production.
5. **Dormant Rate Limiting:** A database-backed rate limiter utility exists and passes tests, but is not attached to any live endpoint. Endpoints for checkout OTP dispatch, seller signup, and login have zero brute-force or budget abuse protection.

---

## 2. Audit Scope & Component Mapping

| Component | Technology | Primary Role | Monorepo Path |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js 15.1 (App Router), React 19, Tailwind CSS | Storefront, Guest Checkout, Seller Dashboard, Mobile Action Link | `apps/web/` |
| **Backend** | NestJS 10.4, Express, TypeScript | Modular Monolith API, Auth, Orders, SMSHub Client, Webhooks | `apps/api/` |
| **Shared Contracts** | TypeScript, Zod | Shared DTOs, Envelopes, Templates, Formatting Utilities | `packages/contracts/` |
| **Database & ORM** | PostgreSQL 16, Prisma ORM 5.22 | Persistence, Relational Data, Event Sourcing, Suppression List | `prisma/schema.prisma` |
| **Integrations** | SMSHub.et REST API | SMS Notifications, Guest Phone Verification OTP | `apps/api/src/modules/smshub/` |
| **Payments** | Cash on Pickup / Delivery (Active MVP Scope) | Cash transaction upon handover. *Note: Chapa online payment is out of MVP scope per product specification `docs/01-product-overview-and-scope.md:31,97`; no Chapa endpoints exist in current codebase.* | N/A |
| **CI / Infra** | GitHub Actions, Docker Compose | Automated Quality Gate, Containerized Local Services | `.github/workflows/ci.yml`, `docker-compose.yml` |

---

## 3. Findings Summary Matrix

**Master Tracking Issue:** [#138 - [PR-TRACKING] Production Readiness Audit Remediation](https://github.com/fenet-as/order-by-sms/issues/138)

| ID | Title | Area | Severity | Effort | Tracking Issue |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PR-001** | Unauthenticated Dashboard Access & IDOR via `?sellerId=` & Unsigned JWT Parsing | Frontend / Security | **Blocker** | M | [#120](https://github.com/fenet-as/order-by-sms/issues/120) |
| **PR-002** | Missing Authentication & Insecure Mock Fallback on Order Detail Route (`/dashboard/orders/[id]`) | Frontend / Security | **Blocker** | S | [#121](https://github.com/fenet-as/order-by-sms/issues/121) |
| **PR-003** | Live Production Database Credentials Present in Local `.env` | Security / Config | **Blocker** | S | [#122](https://github.com/fenet-as/order-by-sms/issues/122) |
| **PR-004** | Webhook Path Routing Mismatch Between SMSHub Spec and NestJS Global Prefix | Integration / Backend | **Blocker** | S | [#123](https://github.com/fenet-as/order-by-sms/issues/123) |
| **PR-005** | Rate Limiting Logic Implemented But Not Connected to Any Live Endpoints | Backend / Security | **High** | M | [#124](https://github.com/fenet-as/order-by-sms/issues/124) |
| **PR-006** | Absence of Versioned Database Migrations (Relies on Unsafe `prisma db push`) | Backend / Data | **High** | M | [#125](https://github.com/fenet-as/order-by-sms/issues/125) |
| **PR-007** | Missing Database Indexes on High-Traffic Order, Message, and Product Queries | Backend / Data | **High** | S | [#126](https://github.com/fenet-as/order-by-sms/issues/126) |
| **PR-008** | Order Number Generation Concurrency Race Condition During Simultaneous Checkouts | Backend / Concurrency | **High** | M | [#127](https://github.com/fenet-as/order-by-sms/issues/127) |
| **PR-009** | Broken Storefront Navigation Link in Dashboard Header (`/c/{slug}` vs `/s/{slug}`) | Frontend / Integration | **High** | S | [#128](https://github.com/fenet-as/order-by-sms/issues/128) |
| **PR-010** | Direct Database Coupling in Next.js Server Components Bypasses NestJS API | Integration / Architecture | **High** | L | [#129](https://github.com/fenet-as/order-by-sms/issues/129) |
| **PR-011** | Broken ESLint Configuration Causing `npm run lint` Failure in Non-Interactive Runs | Frontend / Tooling | **Medium** | S | [#130](https://github.com/fenet-as/order-by-sms/issues/130) |
| **PR-012** | Seller Settings Route Path Mismatch in API Client (`/api/settings` vs `/api/auth/settings`) | Integration / Frontend | **Medium** | S | [#131](https://github.com/fenet-as/order-by-sms/issues/131) |
| **PR-013** | Shallow Health Check Probe Returns False Positive When Database is Disconnected | Backend / Reliability | **Medium** | S | [#132](https://github.com/fenet-as/order-by-sms/issues/132) |
| **PR-014** | Synchronous In-Band SMS Gateway Dispatch Blocks HTTP Request Thread | Backend / Performance | **Medium** | L | [#133](https://github.com/fenet-as/order-by-sms/issues/133) |
| **PR-015** | Missing HTTP Security Headers (Helmet) on NestJS API | Backend / Security | **Medium** | S | [#134](https://github.com/fenet-as/order-by-sms/issues/134) |
| **PR-016** | 23 NPM Vulnerabilities in Dependencies (Including Critical Tooling Prototype Pollution) | Security / Dependencies | **Medium** | M | [#135](https://github.com/fenet-as/order-by-sms/issues/135) |
| **PR-017** | Absence of Global DTO Validation Pipe with Whitelisting in NestJS API | Backend / Security | **Low** | S | [#136](https://github.com/fenet-as/order-by-sms/issues/136) |
| **PR-018** | CI Quality Gate Pipeline Lacks Linting, Dependency Auditing, and Migration Verification | Tooling / CI/CD | **Low** | S | [#137](https://github.com/fenet-as/order-by-sms/issues/137) |

---

## 4. Detailed Audit Findings

### PR-001: Unauthenticated Dashboard Access & IDOR via `?sellerId=` & Unsigned JWT Parsing
- **Area:** Frontend / Security
- **Severity:** Blocker
- **Effort:** Medium
- **File References:**
  - [`apps/web/src/app/dashboard/dashboard-helpers.tsx:11-26`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/app/dashboard/dashboard-helpers.tsx#L11-L26)
  - [`apps/web/src/app/dashboard/page.tsx:35-44`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/app/dashboard/page.tsx#L35-L44)
  - [`apps/web/src/app/dashboard/products/page.tsx:30-39`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/app/dashboard/products/page.tsx#L30-L39)
  - [`apps/web/src/app/dashboard/settings/page.tsx:31-40`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/app/dashboard/settings/page.tsx#L31-L40)
  - [`apps/web/src/app/dashboard/messages/page.tsx:31-40`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/app/dashboard/messages/page.tsx#L31-L40)
- **Problem:**
  1. Every dashboard page contains fallback code that accepts an arbitrary `sellerId` from URL query parameters:
     ```tsx
     if (!sellerId && searchParams) {
       const resolved = await searchParams;
       if (typeof resolved?.sellerId === "string") {
         sellerId = resolved.sellerId;
       }
     }
     ```
     An unauthenticated attacker can view any seller's order queue, product list, SMS message audit logs, and customer phone numbers simply by navigating to `/dashboard?sellerId=<target_seller_uuid>`.
  2. `extractSellerIdFromToken` decodes the second segment of the JWT with `Buffer.from(base64).toString('utf8')` without verifying the HMAC-SHA256 signature against `SESSION_SECRET`. Any user can craft a forged cookie `seller_session` with an arbitrary `sellerId`.
- **Impact:** Complete exposure of seller PII, buyer phone numbers, order histories, and store settings (IDOR and Broken Authentication).
- **Fix:**
  1. Remove `searchParams.sellerId` fallback completely from all dashboard routes.
  2. In `dashboard-helpers.tsx`, replace raw base64 decoding with cryptographic verification using `jose`'s `jwtVerify(token, secretKey)`.
- **Acceptance Criteria:**
  - [ ] Navigating to `/dashboard?sellerId=<any-id>` without a valid cookie redirects to `/login`.
  - [ ] Tampered or unsigned JWT tokens in `seller_session` cookie are rejected and redirected to `/login`.
  - [ ] Unit tests verify signature verification and rejection of forged cookies.

---

### PR-002: Missing Authentication & Insecure Mock Fallback on Order Detail Route (`/dashboard/orders/[id]`)
- **Area:** Frontend / Security
- **Severity:** Blocker
- **Effort:** Small
- **File Reference:** [`apps/web/src/app/dashboard/orders/[id]/page.tsx:87-120`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/app/dashboard/orders/%5Bid%5D/page.tsx#L87-L120)
- **Problem:**
  `OrderDetailPage` does not read or validate the `seller_session` cookie. It performs a raw query: `prisma.order.findUnique({ where: { id } })`. If an attacker guesses or obtains any order ID, they can access the full order details. Furthermore, if the order is not found in the database, lines 114–120 fall back to a hardcoded mock order ("Abebe Bikila", "0911223344", 850 ETB) instead of throwing `notFound()`.
- **Impact:** Unauthenticated data leakage and dummy data leakage in production.
- **Fix:**
  Extract and cryptographically verify `sellerId` from `seller_session`. Ensure `dbOrder.seller_id === sellerId`. Call Next.js `notFound()` if the order does not exist or does not belong to the seller. Remove mock fallback data.
- **Acceptance Criteria:**
  - [ ] Unauthenticated requests to `/dashboard/orders/[id]` redirect to `/login`.
  - [ ] An authenticated seller attempting to access another seller's order ID receives a 404/403.
  - [ ] Invalid order IDs return a clean 404 page, never dummy demo data.

---

### PR-003: Live Production Database Credentials Present in Local `.env`
- **Area:** Security / Config
- **Severity:** Blocker
- **Effort:** Small
- **File Reference:** [`.env:12,14,25`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/.env#L12)
- **Problem:**
  Live Supabase connection strings containing plaintext credentials (`aws-1-eu-west-3.pooler.supabase.com:6543`) were present in the local `.env` file on disk. While git history is clean and `.env` is listed in `.gitignore`, storing live cloud database credentials on development machines creates severe risk of data compromise, accidental destruction via local `prisma db push` or `seed.ts`, or accidental credential leakage.
- **Impact:** High risk of remote production database corruption or data loss.
- **Fix:**
  Rotate the Supabase database password immediately via the Supabase Console. Replace `.env` values with local PostgreSQL credentials (`postgresql://postgres:postgres@localhost:5432/order_by_sms`). Store cloud database connection strings solely in production deployment environment vaults.
- **Acceptance Criteria:**
  - [ ] Supabase production password rotated.
  - [ ] Local `.env` contains only local Docker/native PostgreSQL URLs.
  - [ ] Secret scanner (`npm run check:secrets`) continues to pass cleanly.

---

### PR-004: Webhook Path Routing Mismatch Between SMSHub Spec and NestJS Global Prefix
- **Area:** Integration / Backend
- **Severity:** Blocker
- **Effort:** Small
- **File References:**
  - [`apps/api/src/main.ts:18`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/main.ts#L18) (`app.setGlobalPrefix("api")`)
  - [`apps/api/src/modules/webhooks/webhooks.controller.ts:16,23`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/modules/webhooks/webhooks.controller.ts#L16-L23) (`@Controller("webhooks")`, `@Post("smshub")`)
  - [`apps/web/next.config.mjs:4-11`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/next.config.mjs#L4-L11) (rewrites only `/api/:path*`)
  - [`docs/05-smshub-integration.md:88`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/05-smshub-integration.md#L88)
- **Problem:**
  The SMSHub documentation specifies the webhook ingestion endpoint as `POST /webhooks/smshub`. However, NestJS applies a global prefix `api`, causing the route to register at `/api/webhooks/smshub`. Additionally, `next.config.mjs` only rewrites `/api/:path*` to the backend. Inbound webhook deliveries dispatched to `/webhooks/smshub` will return 404 from Next.js and will never reach NestJS.
- **Impact:** Delivery status synchronization (`message.sent`, `message.failed`), balance alerts, and automated resend triggers will fail in production.
- **Fix:**
  Configure global prefix exclusion in `apps/api/src/main.ts`:
  ```ts
  app.setGlobalPrefix("api", {
    exclude: ["webhooks/smshub", "webhooks/(.*)"],
  });
  ```
  And add a rewrite rule in `apps/web/next.config.mjs` for `/webhooks/:path*`.
- **Acceptance Criteria:**
  - [ ] `POST /webhooks/smshub` reaches the NestJS webhook controller and passes signature verification.
  - [ ] Next.js proxies `POST /webhooks/smshub` transparently in production deployments.

---

### PR-005: Rate Limiting Logic Implemented But Not Connected to Any Live Endpoints
- **Area:** Backend / Security
- **Severity:** High
- **Effort:** Medium
- **File References:**
  - [`apps/api/src/lib/rate-limit.ts:24-150`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/lib/rate-limit.ts#L24-L150)
  - [`apps/api/src/modules/checkout/checkout.controller.ts:18`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/modules/checkout/checkout.controller.ts#L18)
  - [`apps/api/src/modules/auth/auth.controller.ts:31,48`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/modules/auth/auth.controller.ts#L31-L48)
- **Problem:**
  `apps/api/src/lib/rate-limit.ts` defines comprehensive fixed-window rate limiters utilizing Prisma `rate_counters` (`consumeRateLimit`, `checkPhoneRateLimit`, `checkIpRateLimit`), but it is only imported by its unit test (`rate-limit.test.ts`). None of the controllers or services invoke rate limiting.
- **Impact:** Endpoints like `/api/checkout` (which triggers external SMSHub Verify OTPs), `/api/auth/login`, and `/api/auth/signup` can be flooded, leading to SMS credit exhaustion, carrier spam bans, or credential stuffing attacks.
- **Fix:**
  Implement a NestJS `RateLimitGuard` or apply `checkIpRateLimit` and `checkPhoneRateLimit` directly inside `checkout.service.ts` and `auth.service.ts`.
- **Acceptance Criteria:**
  - [ ] Exceeding 5 checkout attempts per phone/hr returns HTTP 429 with `Retry-After`.
  - [ ] Exceeding 10 checkout/auth attempts per IP/hr returns HTTP 429.
  - [ ] Unit and e2e integration tests confirm 429 responses upon threshold breach.

---

### PR-006: Absence of Versioned Database Migrations (Relies on Unsafe `prisma db push`)
- **Area:** Backend / Data
- **Severity:** High
- **Effort:** Medium
- **File References:**
  - [`prisma/`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/prisma/) (no `migrations/` directory)
  - [`package.json:22-23`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/package.json#L22-L23) (`"prisma:push": "prisma db push"`)
  - [`README.md:143`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/README.md#L143)
- **Problem:**
  The repository contains only `schema.prisma` and `seed.ts`. There are no versioned SQL migration files in `prisma/migrations`. Development relies on `prisma db push`. In production, `prisma db push` cannot handle complex schema evolutions, can cause data loss on column alterations, and provides no reproducible rollback mechanism.
- **Impact:** Schema drift, unrepeatable deployments, and risk of accidental data deletion during automated CI/CD runs.
- **Fix:**
  Run `npx prisma migrate dev --name init` against a clean database to generate initial SQL migrations. Commit the `prisma/migrations` folder to git. Update deployment scripts and Dockerfiles to execute `prisma migrate deploy`.
- **Acceptance Criteria:**
  - [ ] `prisma/migrations/` directory contains versioned baseline migration SQL files.
  - [ ] `npx prisma migrate deploy` succeeds on fresh PostgreSQL instances without warnings.

---

### PR-007: Missing Database Indexes on High-Traffic Order, Message, and Product Queries
- **Area:** Backend / Data
- **Severity:** High
- **Effort:** Small
- **File References:** [`prisma/schema.prisma:60-82, 150-173`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/prisma/schema.prisma#L60-L82)
- **Problem:**
  The Prisma schema lacks composite and foreign key indexes for frequently filtered and ordered queries:
  - `Order`: queried by `[seller_id, created_at]` and `state`.
  - `Message`: queried by `[seller_id, created_at]`, `order_id`, and `recipient_phone`.
  - `Product`: queried by `[seller_id, available, deleted_at]`.
- **Impact:** As the database scales beyond hundreds of rows, order queues and audit logs will cause sequential table scans, degrading database CPU and query response times.
- **Fix:**
  Add the following indexes to `prisma/schema.prisma`:
  ```prisma
  model Order {
    ...
    @@index([seller_id, created_at])
    @@index([seller_id, state])
  }

  model Message {
    ...
    @@index([seller_id, created_at])
    @@index([order_id])
    @@index([recipient_phone])
  }

  model Product {
    ...
    @@index([seller_id, available, deleted_at])
  }
  ```
- **Acceptance Criteria:**
  - [ ] Indexes are added to `schema.prisma` and reflected in a generated migration.
  - [ ] Query plans (`EXPLAIN ANALYZE`) show index scans for seller dashboard queries.

---

### PR-008: Order Number Generation Concurrency Race Condition During Simultaneous Checkouts
- **Area:** Backend / Concurrency
- **Severity:** High
- **Effort:** Medium
- **File References:**
  - [`apps/api/src/modules/checkout/checkout.service.ts:496-501`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/modules/checkout/checkout.service.ts#L496-L501)
  - [`prisma/schema.prisma:80`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/prisma/schema.prisma#L80) (`@@unique([seller_id, number])`)
- **Problem:**
  In `verifyCheckout`:
  ```ts
  const lastOrder = await tx.order.findFirst({
    where: { seller_id: draftData.sellerId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const orderNumber = lastOrder ? lastOrder.number + 1 : 1001;
  ```
  If two buyers verify orders for the same seller simultaneously, both transactions read the same `lastOrder.number`. The second transaction to insert violates `@@unique([seller_id, number])` and crashes with Prisma error `P2002`. Because SMSHub OTP was already verified, the second buyer is permanently blocked.
- **Impact:** Order loss and failed checkout during peak concurrent customer traffic.
- **Fix:**
  Implement optimistic retry on `P2002` error within `verifyCheckout` (re-attempting order creation with the next number up to 3 times), or use an atomic counter table.
- **Acceptance Criteria:**
  - [ ] Concurrency test simulating 5 simultaneous checkouts for the same seller completes with 5 sequential order numbers without `P2002` errors.

---

### PR-009: Broken Storefront Navigation Link in Dashboard Header (`/c/{slug}` vs `/s/{slug}`)
- **Area:** Frontend / Integration
- **Severity:** High
- **Effort:** Small
- **File Reference:** [`apps/web/src/app/dashboard/layout.tsx:119`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/app/dashboard/layout.tsx#L119)
- **Problem:**
  The dashboard header renders a "View Storefront" link pointing to `/c/${seller.slug}`:
  ```tsx
  <a href={`/c/${seller.slug}`} target="_blank" rel="noopener noreferrer">
    View Storefront
  </a>
  ```
  The storefront route is located at `/s/[slug]`. There is no `/c` route in the Next.js app.
- **Impact:** Sellers clicking the link to test their shop receive an immediate 404 Not Found.
- **Fix:** Change `href={`/c/${seller.slug}`}` to `href={`/s/${seller.slug}`}`.
- **Acceptance Criteria:**
  - [ ] Clicking "View Storefront" opens the live storefront catalog `/s/[slug]`.

---

### PR-010: Direct Database Coupling in Next.js Server Components Bypasses NestJS API
- **Area:** Integration / Architecture
- **Severity:** High
- **Effort:** Large
- **File References:**
  - [`apps/web/src/lib/prisma.ts:1-18`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/lib/prisma.ts#L1-L18)
  - [`apps/web/src/app/dashboard/page.tsx:50-64`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/app/dashboard/page.tsx#L50-L64)
  - [`apps/web/src/app/dashboard/messages/page.tsx:46-61`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/app/dashboard/messages/page.tsx#L46-L61)
  - [`apps/web/src/app/dashboard/products/page.tsx:45-56`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/app/dashboard/products/page.tsx#L45-L56)
- **Problem:**
  The Next.js App Router server components directly instantiate `PrismaClient` to read database records. If Next.js is deployed in a standard frontend container without direct network access to PostgreSQL, the catch blocks catch the error and return empty arrays `[]`. The pages never attempt to fetch data from the NestJS API endpoints (`GET /api/orders`, `GET /api/messages`, `GET /api/products`).
- **Impact:** Frontend cannot run independently from the database; breaks microservice separation and fails completely in split deployments.
- **Fix:**
  Update server components to fetch from the internal NestJS API using `OrderBySmsApiClient`, passing along the session cookie.
- **Acceptance Criteria:**
  - [ ] Dashboard pages load orders, products, and messages correctly when `DATABASE_URL` is omitted from `apps/web`.

---

### PR-011: Broken ESLint Configuration Causing `npm run lint` Failure in Non-Interactive Runs
- **Area:** Frontend / Tooling
- **Severity:** Medium
- **Effort:** Small
- **File References:**
  - [`package.json:18`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/package.json#L18)
  - [`apps/web/package.json:10`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/package.json#L10)
- **Problem:**
  `npm run lint` executes `next lint` in `apps/web`, but `apps/web` has no `.eslintrc.json`. `next lint` prompts interactively for setup, immediately failing with exit code 1 in non-interactive CI/CD runs. Furthermore, `apps/api` has no lint script.
- **Impact:** CI/CD cannot run automated lint checks.
- **Fix:** Add a standard `.eslintrc.json` extending `next/core-web-vitals` in `apps/web`, and add ESLint tooling to `apps/api`.
- **Acceptance Criteria:**
  - [ ] `npm run lint` completes non-interactively with code 0.

---

### PR-012: Seller Settings Route Path Mismatch in API Client (`/api/settings` vs `/api/auth/settings`)
- **Area:** Integration / Frontend
- **Severity:** Medium
- **Effort:** Small
- **File References:**
  - [`apps/web/src/lib/api-client.ts:280,286`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/web/src/lib/api-client.ts#L280)
  - [`apps/api/src/modules/auth/auth.controller.ts:85`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/modules/auth/auth.controller.ts#L85)
- **Problem:**
  `OrderBySmsApiClient` defines `getSettings()` as `GET /api/settings` and `updateSettings()` as `PATCH /api/settings`. The NestJS backend implements this route under `@Controller("auth")` as `PATCH /api/auth/settings`. Calling `api.updateSettings()` returns 404 Not Found.
- **Impact:** Any component using `api.updateSettings()` fails.
- **Fix:** Update `api-client.ts` to call `/api/auth/settings`, or add an alias controller in NestJS.
- **Acceptance Criteria:**
  - [ ] `api.updateSettings(...)` sends request to the correct backend route and returns HTTP 200.

---

### PR-013: Shallow Health Check Probe Returns False Positive When Database is Disconnected
- **Area:** Backend / Reliability
- **Severity:** Medium
- **Effort:** Small
- **File Reference:** [`apps/api/src/modules/health/health.service.ts:13-22`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/modules/health/health.service.ts#L13-L22)
- **Problem:**
  `HealthService.getHealth()` returns `{ status: "ok" }` based purely on `process.uptime()`. It does not execute a ping query against PostgreSQL.
- **Impact:** Orchestrators (Kubernetes, AWS ECS, Docker) will continue routing traffic to containers even if their database connection has crashed.
- **Fix:** Add a Prisma health check (`SELECT 1`) to `HealthService.getHealth()`. Return HTTP 503 if unreachable.
- **Acceptance Criteria:**
  - [ ] `GET /api/health` returns HTTP 503 if PostgreSQL is disconnected.

---

### PR-014: Synchronous In-Band SMS Gateway Dispatch Blocks HTTP Request Thread
- **Area:** Backend / Performance
- **Severity:** Medium
- **Effort:** Large
- **File References:**
  - [`apps/api/src/modules/checkout/checkout.service.ts:564-578`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/modules/checkout/checkout.service.ts#L564-L578)
  - [`apps/api/src/modules/smshub/sms-orchestrator.service.ts:223-247`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/modules/smshub/sms-orchestrator.service.ts#L223-L247)
- **Problem:**
  All outbound SMS messages are dispatched synchronously inside customer checkout and order state change handlers. If the SMSHub gateway experiences network latency or carrier delays (up to the 30-second abort timeout), the client HTTP connection remains blocked.
- **Impact:** High latency for buyers and sellers; risk of gateway timeouts during carrier congestion.
- **Fix:** Persist SMS message intents to the database with `status: "queued"`, and process outbound dispatches asynchronously via background worker or queue.
- **Acceptance Criteria:**
  - [ ] `POST /api/checkout/verify` returns response within 500ms regardless of SMSHub carrier response time.

---

### PR-015: Missing HTTP Security Headers (Helmet) on NestJS API
- **Area:** Backend / Security
- **Severity:** Medium
- **Effort:** Small
- **File Reference:** [`apps/api/src/main.ts:15-35`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/main.ts#L15-L35)
- **Problem:**
  `apps/api/src/main.ts` does not integrate `helmet`. Standard security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, `HSTS`) are missing from backend responses.
- **Impact:** Vulnerability to clickjacking, MIME-sniffing, and cross-site scripting attacks.
- **Fix:** Install `helmet` and add `app.use(helmet())` in `apps/api/src/main.ts`.
- **Acceptance Criteria:**
  - [ ] Responses from NestJS API include standard security headers (`X-Content-Type-Options: nosniff`, etc.).

---

### PR-016: 23 NPM Vulnerabilities in Dependencies (Including Critical Tooling Prototype Pollution)
- **Area:** Security / Dependencies
- **Severity:** Medium
- **Effort:** Medium
- **File References:** `package.json`, `apps/api/package.json`, `apps/web/package.json`
- **Problem:**
  `npm audit` identifies 23 vulnerabilities (2 Critical in `tinypool` prototype pollution, 9 High in `multer`, `braces`, `postcss`, and 11 Moderate in `@nestjs/common`, `qs`, `file-type`).
- **Impact:** Supply-chain security risks and potential denial-of-service via malformed multipart payloads.
- **Fix:** Run `npm audit fix` for safe dependency bumps, and evaluate upgrading `@nestjs/*` dependencies.
- **Acceptance Criteria:**
  - [ ] Zero critical or high severity vulnerabilities reported in `npm audit`.

---

### PR-017: Absence of Global DTO Validation Pipe with Whitelisting in NestJS API
- **Area:** Backend / Security
- **Severity:** Low
- **Effort:** Small
- **File Reference:** [`apps/api/src/main.ts:32-35`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/apps/api/src/main.ts#L32-L35)
- **Problem:**
  NestJS does not configure a global `ValidationPipe` with `{ whitelist: true, forbidNonWhitelisted: true }`. Handlers accepting `@Body() body: any` rely solely on internal Zod parsing, leaving unexpected payload properties unstripped at the controller boundary.
- **Impact:** Potential parameter tampering or prototype pollution if unvalidated objects are passed deeper into services.
- **Fix:** Register a global NestJS ValidationPipe or Zod validation pipe in `main.ts`.
- **Acceptance Criteria:**
  - [ ] Unwhitelisted payload properties are stripped before controller execution.

---

### PR-018: CI Quality Gate Pipeline Lacks Linting, Dependency Auditing, and Migration Verification
- **Area:** Tooling / CI/CD
- **Severity:** Low
- **Effort:** Small
- **File Reference:** [`.github/workflows/ci.yml:33-51`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/.github/workflows/ci.yml#L33-L51)
- **Problem:**
  `ci.yml` runs typechecking and unit tests, but does not execute `npm run lint`, `npm audit`, or database migration checks. Code violating style guides or containing known vulnerabilities can be merged into `main`.
- **Fix:** Add `npm run lint` and `npm audit --audit-level=high` steps to `.github/workflows/ci.yml`.
- **Acceptance Criteria:**
  - [ ] CI pipeline fails if lint errors or high/critical vulnerabilities exist.

---

## 5. What Already Works Well

1. **Test Coverage & Quality:** 539 unit, integration, and e2e tests pass with zero failures across 66 test suites. Simulated gateway failure tests (`QA-007`) and failure scenario tests verify resilient error handling.
2. **Cryptographic Invariants:** Pickup code verification uses keyed HMAC-SHA256 with constant-time equality comparisons (`timingSafeEqual`), strictly enforcing lockout after 5 incorrect attempts.
3. **Action Token Security:** Single-use, 22-character CSPRNG tokens with 48-hour expiration and SHA-256 database storage prevent link predictability.
4. **Authoritative Server-Side Pricing:** Cart totals are re-calculated from current database prices during both checkout draft creation and OTP verification, successfully preventing amount tampering.
5. **Webhook Signature Verification:** `WebhookSignatureGuard` correctly uses `rawBody` with HMAC-SHA256, enforces 5-minute replay attack windows, and deduplicates inbound deliveries by UUID.
6. **SMS Safety & Zero Credit Waste:** Clean separation of `SMSHUB_MODE="test"` vs `"live"`, suppression list checks for opted-out buyers, and strict ASCII GSM-7 template length validation.

---

## 6. Recommended Fix Order

### Phase 1: Launch Blockers (Must fix before any real user access)
1. **PR-003**: Rotate Supabase credentials and sanitize local `.env`.
2. **PR-001**: Remove `searchParams.sellerId` fallback and enforce cryptographic JWT verification on all dashboard routes.
3. **PR-002**: Add seller authentication and ownership checks to `/dashboard/orders/[id]`, removing mock fallback data.
4. **PR-004**: Fix webhook routing prefix mismatch so SMSHub callbacks reach NestJS.

### Phase 2: Pre-Launch High Priority (Must fix before public launch)
5. **PR-005**: Wire rate limiting guards to checkout, login, signup, and resend endpoints.
6. **PR-006**: Generate and commit versioned Prisma database migrations.
7. **PR-007**: Add database indexes for orders, messages, and products.
8. **PR-008**: Resolve checkout order number generation race conditions.
9. **PR-009**: Fix storefront link (`/c/` -> `/s/`) in dashboard layout.
10. **PR-010**: Decouple frontend server components from direct database access.

### Phase 3: Post-Launch Hardening & Polish
11. **PR-011**: Configure ESLint for `apps/web` and `apps/api`.
12. **PR-012**: Fix settings route mismatch in `api-client.ts`.
13. **PR-013**: Enhance health check probe with database connectivity check.
14. **PR-014**: Introduce asynchronous background queue for outbound SMS dispatch.
15. **PR-015**: Add Helmet security headers to NestJS backend.
16. **PR-016**: Resolve dependency vulnerabilities reported by `npm audit`.
17. **PR-017**: Register global DTO validation pipe in NestJS.
18. **PR-018**: Expand CI workflow to include linting and security audit gates.

---

## 7. Items Needing Live Verification

- **Carrier Handset Delivery:** Handset delivery on Ethio Telecom and Safaricom networks requires a real-device validation run (`QA-008`, Issue #45).
- **Production Reverse Proxy Webhook Forwarding:** Verification of TLS termination and header forwarding (`X-SMSHub-Signature`) through Cloudflare/NGINX reverse proxies in the live production environment.
- **SMSHub Live Credit Deduction:** Verification that `POST https://smshub.et/api/sms` consumes credits accurately in live carrier mode.
