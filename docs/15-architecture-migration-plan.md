# Order-by-SMS: Next.js to NestJS Backend Architecture Migration Plan

## 1. Executive Summary & Context

This document defines the official engineering plan for migrating **Order-by-SMS** (`fenet-as/order-by-sms`) from a full-stack Next.js application into a clean monorepo comprising a separate **Next.js App Router frontend** (`apps/web`) and a **NestJS modular monolith backend** (`apps/api`).

**This is an architecture migration of an existing, functioning codebase—not a greenfield rewrite.**
Significant business logic, cryptographic invariants, SMSHub integration facilities, database models, session security mechanisms, and automated test suites have already been implemented, reviewed, and merged in PRs #46 through #53. This plan establishes the boundaries, directory structure, module breakdown, file migration map, documentation updates, and an incremental, dependency-ordered backlog that preserves every working capability without downtime or regressions.

---

## 2. Comprehensive Audit of Current Repository & Functionality

### 2.1 Workspace, Tooling & Build Setup
- **Current Runtime & Package Manager:** Node.js (v20+ / v22+), single root `package.json` with npm and `package-lock.json`.
- **Framework:** Next.js `15.1.0` (App Router) with React `19.0.0` and Tailwind CSS `3.4.16`.
- **TypeScript:** TypeScript `5.7.2` with `tsconfig.json` defining path alias `@/* -> ./src/*`.
- **Test Runner:** Vitest `2.1.8` (`vitest.config.ts`) executing 10 test suites comprising 110 passed unit and integration tests.
- **Database & ORM:** PostgreSQL accessed via Prisma `5.22.0` (`prisma/schema.prisma`).
- **Build Output:** Production bundle successfully compiles 16 static/dynamic routes in under 5 seconds.

### 2.2 Database Schema & Data Layer
- **Schema Location:** `prisma/schema.prisma` defining 12 relational models and 2 enums:
  - `OrderState` enum: `new`, `accepted`, `rejected`, `ready`, `completed`.
  - `MessageStatus` enum: `queued`, `sent`, `failed`, `unknown`, `skipped`, `test_passed`.
  - Core models: `Seller`, `Product`, `Order`, `OrderItem`, `OrderEvent`, `PhoneVerification`, `PickupCode`, `ActionToken`, `Message`, `MessageEvent`, `SuppressionList`, `RateCounter`.
- **Singleton Database Client:** `src/lib/db.ts` managing `globalThis` PrismaClient caching.
- **Database Seed:** `prisma/seed.ts` seeding predictable demo seller (`habesha-cafe`), 3 catalog products, and a sample order with strict production rejection guards (`NODE_ENV === "production"`) and data preservation.

### 2.3 Shared Libraries & Security Utilities
- **`src/env.ts`:** Zod-based environment schema validating `SMSHUB_API_KEY`, `SMSHUB_MODE`, `SESSION_SECRET` (min 32 chars, production placeholder rejection), `PICKUP_CODE_SECRET`, `DATABASE_URL`, and `NEXT_PUBLIC_APP_URL`.
- **`src/lib/crypto.ts`:**
  - `generateActionToken()`: 16-byte URL-safe base64url string.
  - `hashActionToken()`: SHA-256 hash stored in database.
  - `generatePickupCode()`: 4-digit cryptographically random numeric string (1000–9999).
  - `hashPickupCode()`: Keyed HMAC-SHA256 with `PICKUP_CODE_SECRET`.
  - `verifyPickupCodeHash()`: Constant-time comparison (`crypto.timingSafeEqual`).
  - `verifySMSHubWebhookSignature()`: Validates `t={timestamp},v1={hex_hmac}` with 5-minute replay window.
- **`src/lib/password.ts`:** Salted `bcryptjs` password hashing (cost factor 10) and verification.
- **`src/lib/phone.ts`:** Ethiopian phone normalization to canonical 10-digit format (`09...` for Ethio Telecom, `07...` for Safaricom) and privacy-compliant phone masking (`09•• ••• 567`).
- **`src/lib/order-state.ts`:** Deterministic order lifecycle state machine enforcing permitted transitions, terminal states, and idempotent repeats.
- **`src/lib/templates.ts`:** GSM-7 vs UCS-2 character set detection, character length boundaries (160 vs 70), seller shop name truncation (max 20 chars), and ASCII SMS template formatting.
- **`src/lib/smshub.ts`:** High-reliability SMSHub client wrapping `/api/sms`, `/api/test`, `/api/verify/send`, `/api/verify/check`, and `/api/balance` with rate pacing (<60 req/min), bounded `Retry-After` (max 60s), idempotency keys, and explicit error typing (`SMSHubError`).
- **`src/services/auth.ts`:** Encrypted 7-day session token generation and verification using `jose` (`HS256`), containing minimal claims (`sellerId`), cookie helpers (`HttpOnly`, `SameSite=Lax`, `Secure`), and `requireSeller()` authorization guard.

### 2.4 Implemented API Handlers
- **`POST /api/auth/signup`:** Zod validation, Ethiopian phone canonicalization, phone uniqueness verification, bcrypt hashing, SMSHub Verify OTP dispatch, unverified seller creation, and pending phone verification storage.
- **`POST /api/auth/verify-phone`:** Confirms 6-digit OTP via SMSHub Verify Check API, sets `phone_verified_at = now()`, issues secure session cookie, and returns sanitized seller profile.
- **`POST /api/auth/login`:** Validates credentials via `verifyPassword()`, checks `phone_verified_at !== null`, and issues secure session cookie.
- **`POST /api/auth/logout`:** Clears session cookie (`maxAge: 0`).
- **`GET /api/health`:** Liveness probe returning status, uptime, and timestamp.
- **`POST /api/webhooks/smshub`:** Verifies HMAC-SHA256 webhook signature, returns fast 200 acknowledgment.

### 2.5 Scaffolded Frontend Pages
- Next.js App Router UI shells in `src/app/`:
  - Customer Storefront: `/s/[slug]`, `/s/[slug]/checkout`, `/s/[slug]/verify/[draftId]`, `/s/[slug]/done`.
  - Seller Mobile Action Page: `/a/[token]`.
  - Buyer Opt-Out Page: `/x/[token]`.
  - Seller Auth Screens: `/login`, `/signup`.
  - Seller Dashboard: `/dashboard`, `/dashboard/orders`, `/dashboard/products`, `/dashboard/messages`, `/dashboard/settings`.

### 2.6 Work Completed & Pull Request Traceability
| Issue | Task ID | PR | Status | Scope Completed |
| :--- | :--- | :--- | :--- | :--- |
| #1 | INFRA-001 | #46 | MERGED | Environment schema validation (`src/env.ts`) |
| #2 | INFRA-002 | #47 | MERGED | Password hashing (`src/lib/password.ts`) & database setup |
| #3 | INFRA-003 | #48 | MERGED | Database seed script (`prisma/seed.ts`) & production guards |
| #7 | BE-001 | #49 | MERGED | Order state machine & transition invariant tests |
| #8 | BE-002 | #50 | MERGED | SMS template verification & GSM-7/UCS-2 checks |
| #9 | BE-003 | #51 | MERGED | SMSHub client hardening, rate pacing, retries & mock support |
| #10 | BE-004 | #52 | MERGED | Seller auth service, JWT sessions, and security guards |
| #11 | BE-005 | #53 | MERGED | Seller auth & phone verification API handlers and tests |

---

## 3. Target Architecture & Project Structure

### 3.1 Monorepo Workspace Design
The repository will be structured as an **npm workspaces monorepo** with clear separation between frontend application, backend service, shared contracts, and database specifications:

```
order-by-sms/
├── apps/
│   ├── api/                          # NestJS Backend Application
│   │   ├── src/
│   │   │   ├── common/               # Global filters, interceptors, pipes, decorators
│   │   │   │   ├── decorators/       # @CurrentSeller(), @Public()
│   │   │   │   ├── filters/          # HttpExceptionFilter (standard JSON envelope)
│   │   │   │   ├── guards/           # SellerAuthGuard, WebhookSignatureGuard
│   │   │   │   ├── interceptors/     # TransformInterceptor, LoggingInterceptor
│   │   │   │   └── pipes/            # ZodValidationPipe
│   │   │   ├── config/               # Environment configuration & Zod validation
│   │   │   ├── modules/              # Domain-driven NestJS modules
│   │   │   │   ├── auth/             # Seller authentication & session token service
│   │   │   │   ├── sellers/          # Seller profile & shop settings
│   │   │   │   ├── products/         # Product catalog management
│   │   │   │   ├── orders/           # Order placement, state machine, pickup codes
│   │   │   │   ├── verification/     # Buyer & seller phone verification
│   │   │   │   ├── smshub/           # SMSHub API client, rate pacing, templates
│   │   │   │   ├── webhooks/         # Inbound SMSHub webhook signature & processing
│   │   │   │   └── health/           # Liveness & readiness probes
│   │   │   ├── prisma/               # PrismaService & database access provider
│   │   │   ├── app.module.ts         # Root NestJS module importing domain modules
│   │   │   └── main.ts               # Application entrypoint (CORS, cookies, port 4000)
│   │   ├── test/                     # End-to-end API tests (supertest)
│   │   ├── tsconfig.json             # Backend TypeScript configuration
│   │   ├── package.json              # Backend dependencies (@nestjs/*, etc.)
│   │   └── .env.example              # Backend environment variables
│   │
│   └── web/                          # Next.js App Router Frontend Application
│       ├── src/
│       │   ├── app/                  # App Router pages (storefront, dashboard, actions)
│       │   ├── components/           # Reusable UI components (modals, forms, badges)
│       │   ├── lib/                  # Frontend utilities, formatters, API client
│       │   │   └── api-client.ts     # Typed fetch client communicating with apps/api
│       │   └── styles/               # Tailwind CSS & global styles
│       ├── public/                   # Static assets, icons, fonts
│       ├── tsconfig.json             # Frontend TypeScript configuration
│       ├── package.json              # Frontend dependencies (next, react, tailwindcss)
│       ├── next.config.mjs           # Next.js configuration (API proxy rewrites)
│       └── .env.example              # Frontend environment variables (API URL)
│
├── packages/
│   └── contracts/                    # Shared TypeScript interfaces & DTOs
│       ├── src/
│       │   ├── api.ts                # Standard API response envelopes & error codes
│       │   ├── order.ts              # OrderState enum, order item & total contracts
│       │   ├── seller.ts             # Seller profile & session contracts
│       │   ├── product.ts            # Product data contracts
│       │   └── sms.ts                # SMS delivery event contracts & status enums
│       ├── package.json
│       └── tsconfig.json
│
├── prisma/                           # Authoritative Database Schema & Migrations
│   ├── schema.prisma                 # Authoritative Prisma schema definition
│   ├── migrations/                   # SQL migration history
│   └── seed.ts                       # Production-safe seed script
│
├── docs/                             # Architecture & Product Specifications
├── .agents/skills/                   # Local implementation skill & validation scripts
├── package.json                      # Root workspace configuration
└── package-lock.json                 # Lockfile pinning all dependencies
```

### 3.2 NestJS Modular Monolith Architecture
Each domain module in `apps/api` maintains strict encapsulation:
1. **Controller (`*.controller.ts`):** Handles HTTP routing, input validation via `ZodValidationPipe`, session extraction via `@CurrentSeller()`, and returns standard response envelopes. Controllers contain zero business logic.
2. **Service (`*.service.ts`):** Encapsulates core business rules, transactional database operations, state transitions, cryptographic operations, and provider dispatch.
3. **Data Access:** Utilizes the global `PrismaService` for type-safe database queries.
4. **Guards & Decorators:**
   - `SellerAuthGuard`: Validates session cookie or Bearer token, queries seller account, and binds seller context to `req.seller`.
   - `WebhookSignatureGuard`: Verifies `X-SMSHub-Signature` HMAC-SHA256 headers before routing to webhook handlers.
   - `@CurrentSeller()`: Parameter decorator injecting authenticated seller data into controller methods.

### 3.3 Architecture Decision Records (ADRs)

#### ADR-1: Native npm Workspaces Monorepo
- **Context:** We need a clean monorepo structure separating `apps/web` and `apps/api`.
- **Decision:** Use native npm workspaces (`workspaces: ["apps/*", "packages/*"]`).
- **Rationale:** Avoids introducing external tooling (Turborepo, Nx, Lerna) that adds overhead and complexity during a tight 10-day buildathon window. Standard npm natively manages cross-package linking and shared scripts.

#### ADR-2: Validation Strategy (Zod in NestJS)
- **Context:** NestJS traditionally uses `class-validator` and `class-transformer`. However, our existing codebase has battle-tested Zod schemas with custom regexes, phone normalization, and refinement logic.
- **Decision:** Retain Zod as the authoritative validation engine across both backend and shared contracts, integrating it into NestJS using a custom `ZodValidationPipe`.
- **Rationale:** Rewriting existing schemas to `class-validator` decorators introduces unnecessary regression risk and duplicates logic. Zod provides seamless end-to-end type inference across `packages/contracts`, `apps/api`, and `apps/web`.

#### ADR-3: Authentication, Session Cookies & Cross-Origin Strategy
- **Context:** The frontend and backend run as separate applications (e.g. `localhost:3000` and `localhost:4000` locally, or separate domains/subdomains in production).
- **Decision:**
  - Preserve the 7-day HMAC-SHA256 JWT session token with minimal claim (`sellerId`).
  - The NestJS backend supports both `HttpOnly` cookies (`seller_session`) and `Authorization: Bearer <token>` headers.
  - In development, Next.js App Router configures an internal rewrite proxy in `next.config.mjs` (`/api/:path* -> http://localhost:4000/api/:path*`), allowing all cookie transactions to remain first-party same-origin (`SameSite=Lax`) without cross-site cookie blocking.
  - In production, Next.js and NestJS can either be hosted on the same root domain with path routing (reverse proxy) or use CORS with credentials (`credentials: true`, specific `origin`).

#### ADR-4: Database Schema & Prisma Ownership
- **Context:** Both frontend and backend could theoretically query the database.
- **Decision:** Database schema, migrations, and database queries are **100% owned by `apps/api`**.
- **Rationale:** The frontend must never connect directly to PostgreSQL. Keeping Prisma schema and seed scripts under authoritative management ensures that only the backend executes transactions, state machine changes, and data mutations.

#### ADR-5: SMSHub Client & Invariant Isolation
- **Context:** The SMSHub API key, webhook secret, session secret, and pickup code secret must remain protected.
- **Decision:** Secrets exist solely within `apps/api/.env`.
- **Rationale:** The frontend receives only rendered view models or opaque action links. Provider credentials and cryptographic keys never enter the client bundle.

#### ADR-6: Response Envelope Standard
- **Context:** Section 5 of `docs/09-routes-and-api-spec.md` specifies a standard JSON envelope for all API endpoints.
- **Decision:** Implement a global NestJS `TransformInterceptor` and `HttpExceptionFilter` in `apps/api/src/common/` that automatically formats all controller responses to:
  ```json
  { "success": true, "data": { ... } }
  ```
  and all exceptions to:
  ```json
  { "success": false, "error": { "code": "ERROR_CODE", "message": "Human readable message", "details": ... } }
  ```
- **Rationale:** Ensures strict API contract consistency across all endpoints without manual envelope boilerplate in controllers.

---

## 4. File-by-File Migration Map

| Current File | Target Location | Action | Migration Details & Rationale |
| :--- | :--- | :--- | :--- |
| `package.json` | `package.json` (Root) | **Adapt** | Transform into workspace root with `workspaces: ["apps/*", "packages/*"]` and root scripts. |
| `package-lock.json` | `package-lock.json` (Root) | **Adapt** | Automatically updated by npm workspace installation. |
| `tsconfig.json` | `tsconfig.json` (Root) | **Adapt** | Base TypeScript configuration extended by child packages. |
| `vitest.config.ts` | `vitest.config.ts` (Root) | **Adapt** | Configure workspace test runner or keep per-app test runners. |
| `src/env.ts` | `apps/api/src/config/env.ts` | **Move & Adapt** | Adapted into NestJS `ConfigModule` provider while preserving Zod schema validation and production safety guards. |
| `src/lib/db.ts` | `apps/api/src/prisma/prisma.service.ts` | **Move & Adapt** | Adapted into NestJS `PrismaService` extending `PrismaClient` with `onModuleInit` lifecycle hooks. |
| `src/lib/crypto.ts` | `apps/api/src/modules/crypto/crypto.service.ts` | **Move & Adapt** | Wrapped in NestJS `CryptoService` or shared utility module; preserves pickup code hashing, action tokens, and webhook HMAC validation. |
| `src/lib/password.ts` | `apps/api/src/modules/auth/password.service.ts` | **Move & Adapt** | Adapted into `PasswordService` in `AuthModule`; preserves bcryptjs cost factor 10. |
| `src/lib/phone.ts` | `packages/contracts/src/phone.ts` | **Move & Share** | Shared between `apps/api` and `apps/web` so both frontend client forms and backend validation canonicalize Ethiopian phone numbers identically. |
| `src/lib/order-state.ts` | `packages/contracts/src/order-state.ts` | **Move & Share** | Shared state machine definitions, transition validation, and terminal state predicates. |
| `src/lib/templates.ts` | `apps/api/src/modules/smshub/templates.ts` | **Move & Adapt** | Adapted into SMSHub module for formatting outbound SMS text. |
| `src/lib/smshub.ts` | `apps/api/src/modules/smshub/smshub.service.ts` | **Move & Adapt** | Adapted into injectable `SMSHubService` with rate pacing, bounded retry logic, and mock mode support. |
| `src/services/auth.ts` | `apps/api/src/modules/auth/auth.service.ts` | **Move & Adapt** | Adapted into `AuthService` and `SellerAuthGuard`; preserves `jose` JWT generation, 7-day expiry, and session resolution. |
| `src/app/api/auth/signup/route.ts` | `apps/api/src/modules/auth/auth.controller.ts` | **Move & Adapt** | Handled by `@Post('auth/signup')` in `AuthController`. |
| `src/app/api/auth/verify-phone/route.ts` | `apps/api/src/modules/auth/auth.controller.ts` | **Move & Adapt** | Handled by `@Post('auth/verify-phone')` in `AuthController`. |
| `src/app/api/auth/login/route.ts` | `apps/api/src/modules/auth/auth.controller.ts` | **Move & Adapt** | Handled by `@Post('auth/login')` in `AuthController`. |
| `src/app/api/auth/logout/route.ts` | `apps/api/src/modules/auth/auth.controller.ts` | **Move & Adapt** | Handled by `@Post('auth/logout')` in `AuthController`. |
| `src/app/api/health/route.ts` | `apps/api/src/modules/health/health.controller.ts`| **Move & Adapt** | Handled by `@Get('health')` in `HealthController`. |
| `src/app/api/webhooks/smshub/route.ts`| `apps/api/src/modules/webhooks/webhooks.controller.ts`| **Move & Adapt** | Handled by `@Post('webhooks/smshub')` in `WebhooksController`. |
| `src/app/**` (Pages & UI) | `apps/web/src/app/**` | **Move** | Next.js App Router storefront, dashboard, action links, layout, and global CSS move directly to `apps/web`. |
| `prisma/schema.prisma` | `prisma/schema.prisma` | **Keep** | Single authoritative schema at root, utilized by `apps/api`. |
| `prisma/seed.ts` | `prisma/seed.ts` | **Keep** | Database seed script retained at root with production guards. |
| All existing tests (`src/**/__tests__/*`) | `apps/api/src/**/__tests__/*` | **Move & Adapt** | All 10 existing test suites preserved and executed in the NestJS backend workspace. |

---

## 5. Documentation Update Register

The following documentation files contain assumptions that backend endpoints are implemented as Next.js API routes or run within a unified monolith. They will be updated systematically:

| Document | Current Assumption | Required Architecture Update |
| :--- | :--- | :--- |
| `docs/07-system-architecture-and-tech-stack.md` | Single Next.js box serving both pages and API routes. | Update system topology diagram to show separate Next.js Frontend (`apps/web`) and NestJS Backend (`apps/api`), npm workspaces, NestJS module breakdown, and inter-app communication. |
| `docs/09-routes-and-api-spec.md` | API routes described as Next.js serverless route handlers. | Clarify distinction between Next.js frontend pages and NestJS backend REST controllers. Document API base URL conventions, reverse proxy rewrites, and CORS headers. |
| `docs/11-testing-and-quality-assurance.md` | Single test suite testing Next.js route handlers. | Update testing strategy to describe NestJS unit tests, integration testing with `@nestjs/testing`, supertest E2E API tests, and frontend component tests. |
| `docs/README.md` | Index of 14 specifications. | Add reference to `15-architecture-migration-plan.md` in master table. |
| `README.md` | High-level architecture shows unified Next.js App Router app. | Update system overview, tech stack table, and local development setup instructions to reflect frontend and backend monorepo workspaces. |
| `docs/implementation/02-backlog.md` | Backlog lists backend tasks as Next.js route handlers. | Add Architecture Migration Phase and map subsequent `BE` tasks to NestJS controllers/services and `FE` tasks to `apps/web`. |
| `docs/implementation/03-dependency-map.md` | Dependency graph assumes single Next.js project. | Update dependency graph to show the foundational NestJS bootstrap milestone unblocking subsequent backend tasks. |

---

## 6. Dependency-Ordered Migration Backlog

To ensure safety, stability, and small reviewable PRs, the migration is decomposed into sequential, independently verifiable issues:

```
[MIG-001: Workspace Setup]
          │
          ▼
[MIG-002: NestJS Bootstrap & Health Probe]
          │
          ▼
[MIG-003: Prisma Module & Database Provider]
          │
          ▼
[MIG-004: Shared Contracts Package & Utilities]
          │
          ▼
[MIG-005: SMSHub Module Migration]
          │
          ▼
[MIG-006: Auth Module & Session Guard Migration]
          │
          ▼
[MIG-007: Webhooks Module Migration]
          │
          ▼
[MIG-008: Next.js Frontend Restructuring & API Client]
```

### MIG-001: Monorepo Workspace Restructuring & Root Configuration
- **Priority:** `P0`
- **Scope:**
  - Configure npm workspaces in root `package.json` (`apps/*`, `packages/*`).
  - Create directory layout: `apps/web`, `apps/api`, `packages/contracts`.
  - Establish base `tsconfig.json` with workspace project references.
  - Retain root `prisma/` directory and ensure `npm run prisma:*` scripts remain operational.
- **Acceptance Criteria:**
  - `npm install` cleanly resolves dependencies across workspaces without collisions.
  - Root scripts can target individual workspaces (e.g. `npm run --workspace=api test`).
  - No existing functionality is broken.
- **Preserved Functionality:** All existing tests in `src/` continue to pass.

### MIG-002: NestJS Core Bootstrap, Configuration & Health Module
- **Priority:** `P0`
- **Scope:**
  - Initialize `apps/api` with NestJS core dependencies (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `reflect-metadata`).
  - Implement `apps/api/src/main.ts` with global prefix (`/api`), CORS configuration, cookie parser, and shutdown hooks.
  - Port `src/env.ts` into `apps/api/src/config/` with Zod validation and production safety guards.
  - Implement standard JSON response envelopes (`TransformInterceptor`) and error filter (`HttpExceptionFilter`).
  - Implement `HealthModule` and `HealthController` (`GET /api/health`).
- **Acceptance Criteria:**
  - `GET /api/health` returns standard envelope `{ success: true, data: { status: "ok", ... } }`.
  - Missing environment secrets trigger immediate, informative startup errors.
  - NestJS app boots cleanly and passes typecheck.
- **Verification:** Unit and supertest integration tests for `HealthController`.

### MIG-003: NestJS Prisma Module & Database Service
- **Priority:** `P0`
- **Scope:**
  - Implement `PrismaModule` and `PrismaService` in `apps/api/src/prisma/`.
  - Configure lifecycle hooks (`onModuleInit`, `onModuleDestroy`) for clean connection management.
  - Ensure database seed script (`prisma/seed.ts`) executes against the configured database.
- **Acceptance Criteria:**
  - `PrismaService` connects cleanly to PostgreSQL in development/test.
  - Database queries execute cleanly through NestJS dependency injection.
- **Verification:** Integration test verifying database connectivity and query execution.

### MIG-004: Shared Contracts Package & Core Domain Utilities
- **Priority:** `P0`
- **Scope:**
  - Establish `packages/contracts` containing shared interfaces, response envelopes, DTOs, and enums.
  - Move `src/lib/phone.ts` and `src/lib/order-state.ts` into shared contracts/utilities.
  - Move `src/lib/crypto.ts` into `apps/api/src/modules/crypto/`.
- **Acceptance Criteria:**
  - Phone normalization and masking are available to both frontend and backend.
  - Order state machine transitions and unit tests pass with zero regression.
  - Crypto utilities (HMAC pickup code, action tokens) pass all existing tests.
- **Verification:** `npm test` runs all phone, crypto, and order-state test suites.

### MIG-005: SMSHub Client & Service Migration
- **Priority:** `P0`
- **Scope:**
  - Migrate `src/lib/smshub.ts` and `src/lib/templates.ts` into `apps/api/src/modules/smshub/`.
  - Create injectable `SMSHubService` providing `sendSMS()`, `verifySend()`, `verifyCheck()`, and `getBalance()`.
  - Retain rate pacing, bounded `Retry-After`, test mode safety, and mock server support.
- **Acceptance Criteria:**
  - `SMSHubService` cleanly injects into other NestJS modules.
  - In `SMSHUB_MODE="test"`, calls route exclusively to `/api/test` (0 credits).
  - All 25 existing SMSHub unit tests pass cleanly in the NestJS context.
- **Verification:** Port `src/lib/__tests__/smshub.test.ts` to `apps/api`.

### MIG-006: Seller Authentication & Session Module Migration
- **Priority:** `P0`
- **Scope:**
  - Migrate `src/services/auth.ts`, `src/lib/password.ts`, and `src/app/api/auth/*` into `apps/api/src/modules/auth/`.
  - Implement `AuthController` with endpoints:
    - `POST /api/auth/signup`
    - `POST /api/auth/verify-phone`
    - `POST /api/auth/login`
    - `POST /api/auth/logout`
  - Implement `SellerAuthGuard` extracting JWT from `seller_session` cookie or `Authorization: Bearer` header.
  - Implement `@CurrentSeller()` decorator.
- **Acceptance Criteria:**
  - All 4 authentication endpoints return standard JSON envelopes.
  - Phone verification invariant enforced: unverified sellers cannot log in (`403 PHONE_NOT_VERIFIED`).
  - Session cookies issued with `HttpOnly`, `SameSite=Lax`, `Secure` (in prod).
  - All 14 existing auth route tests and 20 auth service tests pass cleanly.
- **Verification:** E2E supertest suite testing signup, OTP verification, login, logout, and protected routes.

### MIG-007: SMSHub Webhook Ingestion Module Migration
- **Priority:** `P1`
- **Scope:**
  - Migrate `src/app/api/webhooks/smshub/route.ts` into `apps/api/src/modules/webhooks/`.
  - Implement `WebhooksController` with `POST /api/webhooks/smshub`.
  - Implement `WebhookSignatureGuard` verifying `X-SMSHub-Signature` HMAC-SHA256 header.
- **Acceptance Criteria:**
  - Webhook returns fast 200 acknowledgment within 6 seconds.
  - Signatures older than 5 minutes or with invalid HMAC are rejected with 400.
- **Verification:** Unit and integration tests with valid and forged webhook signatures.

### MIG-008: Next.js Frontend Restructuring & API Client Integration
- **Priority:** `P1`
- **Scope:**
  - Move Next.js App Router UI pages from `src/app` into `apps/web/src/app`.
  - Configure `next.config.mjs` API rewrite proxy forwarding `/api/:path*` to `http://localhost:4000/api/:path*`.
  - Implement typed `api-client.ts` consuming contracts from `packages/contracts`.
  - Verify storefront, checkout, seller dashboard, action links, and login UI screens render without errors.
- **Acceptance Criteria:**
  - `apps/web` compiles cleanly (`next build`).
  - UI client forms interact seamlessly with the NestJS backend via proxy rewrites.
  - Session cookies flow seamlessly between frontend and backend.
- **Verification:** Frontend build check and manual/mocked flow verification.

---

## 7. Risk Analysis, Non-Negotiable Invariants & Mitigations

### 7.1 Cross-Origin Session Cookie Propagation
- **Risk:** If frontend and backend run on different origins or ports (e.g. `localhost:3000` and `localhost:4000`), modern browsers may reject third-party cookies if `SameSite` or `Secure` flags are misconfigured.
- **Mitigation:**
  1. In development, configure Next.js App Router rewrites (`next.config.mjs`) so that browser calls to `/api/*` are reverse-proxied internally to the NestJS backend. Cookies remain strictly same-origin.
  2. The NestJS `SellerAuthGuard` will accept both cookies and `Authorization: Bearer <token>` headers, ensuring flexibility for native or mobile clients.

### 7.2 Zero-Credit SMS Safety
- **Risk:** Reorganizing SMSHub code into NestJS services could inadvertently execute live calls or bypass test mode safety controls.
- **Mitigation:**
  - `SMSHUB_MODE="test"` remains the hardcoded default in `apps/api/src/config/env.ts`.
  - Automated tests mock HTTP dispatchers or use the standalone mock server ([QA-001](https://github.com/fenet-as/order-by-sms/issues/38)).
  - Preflight checks continue scanning staged files for exposed live keys.

### 7.3 Domain & Cryptographic Invariants
All core invariants specified in Section 8 of `SKILL.md` are strictly preserved:
- **Order Creation:** Orders are created only after provider-verified OTP confirmation. The application never stores raw OTP codes.
- **Pickup Codes:** Exactly 4 digits, stored as keyed HMAC-SHA256, compared using `crypto.timingSafeEqual`, locked after 5 failed attempts, valid for 7 days.
- **State Machine Transitions:** Transitions strictly follow `new -> accepted|rejected`, `accepted -> ready`, `ready -> completed`. Idempotent repeats return 200; invalid transitions return 409 Conflict.
- **Action Tokens:** 16-byte random tokens stored as SHA-256 hashes, valid for 48 hours. `GET /a/{token}` is strictly read-only.
- **Transactional Persistence:** State change + event log committed in a single atomic database transaction before any SMS notification is dispatched. SMS failure never rolls back order state.

---

## 8. Transition & Review Protocol

1. **Planning Branch & PR:** All planning and documentation updates are submitted under branch `chore/arch-migration-plan` as a dedicated pull request for user review.
2. **No Premature Deletion:** The existing `src/` directory and test suites remain untouched until `apps/api` and `apps/web` workspaces are scaffolded and verified.
3. **Incremental Execution:** After the planning PR is reviewed and merged, the migration proceeds one issue at a time (MIG-001 through MIG-008) following the established Git workflow and quality gates.
