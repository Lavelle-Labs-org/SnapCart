# Order-by-SMS

> **A business you can run entirely from text messages.**
> A seller pastes one storefront link into Telegram or Instagram, customers order through it without an account, and every subsequent step (seller order alerts, confirmations, ready status, and pickup handover) happens via SMS. No native app to install and no dashboard the seller is forced to monitor.

---

## The Problem

Micro and small businesses in Ethiopia (food stalls, dry cleaners, tailors, print shops) take orders through Telegram channels, Instagram DMs, and incoming phone calls. This leads to:
1. **Lost Orders:** Sellers preparing orders miss incoming chat messages during busy rush hours.
2. **Fake or Unreliable Numbers:** Orders placed from chats provide no verified phone contact, leading to wasted preparation time.
3. **Disputed Handovers:** When a rider or pickup goes wrong, neither party has proof that the correct customer received the package.

## The Solution

Order-by-SMS solves this end-to-end:
1. **Storefront Link:** Seller shares a short link (`/s/{slug}`) on social media.
2. **Guest Checkout + Phone OTP:** Buyer selects items and verifies their phone number via an SMSHub OTP code. No login required.
3. **One-Tap Seller Actions:** The seller receives an instant SMS with a signed, unguessable link (`/a/{token}`) to Accept, Reject, or Mark Ready directly from their mobile phone without logging in.
4. **Pickup Code Handover:** When the order is marked ready, the buyer receives a 4-digit pickup code via SMS. The seller enters this code at collection to complete the order.
5. **Audited Delivery & Opt-Out:** Every SMS status is confirmed via signed webhooks, failed messages have manual resend controls, and buyers can opt out at any time.

---

## Key Features (MVP)

- **Seller Onboarding:** Fast registration with phone number verification.
- **Product Management:** Name, price in Ethiopian Birr (stored as Santim integer), and availability toggle.
- **Mobile-First Storefront:** Lightweight, low-bandwidth catalog designed for 3G/EDGE networks.
- **SMSHub Verify API:** Automated 6-digit phone verification OTP with 60-second cooldown and attempt limits.
- **Signed Action Links (`/a/{token}`):** Cryptographically secure, single-use, 48-hour links for one-thumb order handling.
- **HMAC Pickup Codes:** 4-digit handover codes protected against brute-force (locks after 5 wrong attempts).
- **Message Audit Log:** Real-time visibility into SMSHub status (`sent`, `failed`, `skipped`), credit consumption, and `msg_...` IDs.
- **Customer Privacy & Consent:** Unticked-by-default SMS consent and single-tap opt-out suppression.

---

## Architecture & SMSHub Integration

```
Buyer / Seller Phone ──► Next.js Frontend (apps/web)
                                │ (REST API / Proxy)
                                ▼
                       NestJS Backend (apps/api) ──► PostgreSQL (Prisma)
                                │        ▲
                Outbound SMS    │        │ Webhooks (HMAC-SHA256)
                                ▼        │
                          SMSHub Gateway (Ethio Telecom / Safaricom)
```

- **Monorepo Structure:** Structured with npm workspaces (`apps/web`, `apps/api`, `packages/contracts`, `prisma/`).
- **SMS Dispatch & Test Mode:** Supports `SMSHUB_MODE="test"` (calls `POST /api/test`, 0 credits) and `SMSHUB_MODE="live"` (calls `POST /api/sms`).
- **OTP Verification:** Uses `POST /api/verify/send` and `POST /api/verify/check`.
- **Signed Webhooks:** Validates `X-SMSHub-Signature` via HMAC-SHA256 with 5-minute replay attack protection.
- **Error Matrix:** Automatic backoff retries for 502/500 gateway errors and 429 rate limit pacing.

---

## Tech Stack

- **Monorepo:** npm workspaces (`apps/web`, `apps/api`, `packages/contracts`)
- **Backend:** NestJS (Modular Monolith) + TypeScript
- **Frontend:** Next.js (App Router) + TypeScript + React
- **Database:** PostgreSQL + Prisma ORM
- **Styling:** Tailwind CSS (mobile-first responsive)
- **Validation:** Zod schemas
- **Testing:** Vitest & Supertest
- **Security:** CSPRNG tokens, HMAC-SHA256, bcrypt password hashing, HttpOnly sessions

---

## Getting Started Locally

### 1. Prerequisites
- Node.js v20+ or v24
- PostgreSQL database
- SMSHub.et API account

### 2. Installation
```bash
git clone <repo-url>
cd "order by sms"
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
```
Edit `.env` to configure your database URL and SMSHub credentials. Note that `SMSHUB_MODE="test"` runs all sends against the zero-credit test endpoint.

### 4. Database Setup (Local PostgreSQL or Docker)

Order-by-SMS requires a PostgreSQL instance. You can run PostgreSQL either locally or via Docker:

#### Option A: Docker (Recommended for quick local dev)
Start a dedicated PostgreSQL 16 container matching `.env.example`:
```bash
docker run --name order-by-sms-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=order_by_sms \
  -p 5432:5432 \
  -d postgres:16-alpine
```

Or using Docker Compose:
```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    container_name: order-by-sms-db
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: order_by_sms
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```
Run `docker compose up -d` to launch the database container.

#### Option B: Native PostgreSQL
1. Ensure PostgreSQL service is running on your system (`localhost:5432`).
2. Create the development database:
```sql
CREATE DATABASE order_by_sms;
```
3. Update `DATABASE_URL` in `.env` if using custom credentials.

#### Apply Schema to Database
Once your PostgreSQL instance is running, push the Prisma schema:
```bash
npm run prisma:push
```
To inspect your database visually:
```bash
npm run prisma:studio
```

### 5. Run the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Run Unit Tests
```bash
npm test
```

---

## Documentation Suite

Detailed architectural specifications and guides are located in the [`docs/`](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/) directory:
- [01. Product Overview & Scope](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/01-product-overview-and-scope.md)
- [02. User Journeys & Lifecycle](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/02-user-journeys-and-lifecycle.md)
- [03. Functional Requirements](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/03-functional-requirements.md)
- [04. SMS Strategy & Templates](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/04-sms-strategy-and-templates.md)
- [05. SMSHub Integration](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/05-smshub-integration.md)
- [06. Security & Privacy](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/06-security-and-privacy.md)
- [07. System Architecture](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/07-system-architecture-and-tech-stack.md)
- [08. Data Model & Database](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/08-data-model-and-database.md)
- [09. Routes & API Specification](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/09-routes-and-api-spec.md)
- [10. UI & UX Specifications](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/10-ui-ux-design-specs.md)
- [11. Testing & QA Plan](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/11-testing-and-quality-assurance.md)
