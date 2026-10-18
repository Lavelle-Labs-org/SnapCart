# Order-by-SMS: Routes & API Specification

## 1. Overview of Endpoints & Application Boundaries

In the target monorepo architecture, application boundaries are separated between the **Next.js Frontend** (`apps/web`) and the **NestJS Backend** (`apps/api`):
- **HTML Pages:** Rendered by the Next.js App Router (`apps/web`) on port 3000.
- **JSON REST APIs:** Handled by NestJS controllers (`apps/api`) on port 4000 (prefixed with `/api`).
- **Proxy Rewrites:** In development and unified deployment, `apps/web/next.config.mjs` configures internal rewrites (`/api/:path* -> http://localhost:4000/api/:path*`), allowing all cookie transactions to remain first-party same-site cookies.

The system exposes three distinct categories of routes:
1. **Public Storefront & Guest Checkout** (No seller login required)
2. **Authenticated Seller Dashboard & APIs** (Cookie session or Bearer token required)
3. **Public Signed Action Links & External Webhooks** (Token or HMAC signature required)

---

## 2. Public Storefront Routes

| Route | Method | Host / Application | Description |
| --- | --- | --- | --- |
| `/s/{slug}` | `GET` | Next.js (`apps/web`) | Public storefront displaying active products and cart drawer |
| `/s/{slug}/checkout` | `GET` | Next.js (`apps/web`) | Mobile checkout screen: name, phone, consent checkbox |
| `/s/{slug}/verify/{draftId}` | `GET` | Next.js (`apps/web`) | 6-digit OTP verification screen with countdown |
| `/s/{slug}/done` | `GET` | Next.js (`apps/web`) | Order placed confirmation screen displaying order number |
| `/x/{token}` | `GET` | Next.js (`apps/web`) | Buyer opt-out page ("Stop SMS updates") |
| `/api/checkout` | `POST` | NestJS (`apps/api`) | Validates form input, creates verification draft, triggers Verify API OTP |
| `/api/checkout/resend` | `POST` | NestJS (`apps/api`) | Re-triggers OTP if 60 seconds have elapsed |
| `/api/checkout/verify` | `POST` | NestJS (`apps/api`) | Validates OTP, creates order, calculates santim total, alerts seller |
| `/api/stop/{token}` | `POST` | NestJS (`apps/api`) | Adds phone to suppression list, stops further notifications |

---

## 3. Seller Dashboard Routes (Protected)

| Route | Method | Host / Application | Description |
| --- | --- | --- | --- |
| `/signup` | `GET` | Next.js (`apps/web`) | Seller account registration |
| `/login` | `GET` | Next.js (`apps/web`) | Seller login screen |
| `/dashboard` | `GET` | Next.js (`apps/web`) | Order list, status badges, metrics |
| `/dashboard/orders/{id}` | `GET` | Next.js (`apps/web`) | Order detail, state timeline, order SMS log, actions |
| `/dashboard/products` | `GET` | Next.js (`apps/web`) | Product catalog list, add/edit/delete modals |
| `/dashboard/messages` | `GET` | Next.js (`apps/web`) | Complete SMS message log with statuses, credits, resend buttons |
| `/dashboard/settings` | `GET` | Next.js (`apps/web`) | Shop name, SMS sender name, storefront link copy |
| `/api/auth/signup` | `POST` | NestJS (`apps/api`) | Register seller account and dispatch phone code |
| `/api/auth/verify-phone` | `POST` | NestJS (`apps/api`) | Confirms seller phone OTP |
| `/api/auth/login` | `POST` | NestJS (`apps/api`) | Establishes authenticated cookie session |
| `/api/auth/logout` | `POST` | NestJS (`apps/api`) | Clears session cookie |
| `/api/products` | `POST` | NestJS (`apps/api`) | Adds new product |
| `/api/products/{id}` | `PATCH` | NestJS (`apps/api`) | Updates product name, price_santim, availability |
| `/api/products/{id}` | `DELETE`| NestJS (`apps/api`) | Soft-deletes product |
| `/api/orders/{id}/accept` | `POST` | NestJS (`apps/api`) | Transitions order from `new` to `accepted` |
| `/api/orders/{id}/reject` | `POST` | NestJS (`apps/api`) | Transitions order from `new` to `rejected` |
| `/api/orders/{id}/ready` | `POST` | NestJS (`apps/api`) | Transitions order to `ready`, generates pickup code |
| `/api/orders/{id}/complete` | `POST` | NestJS (`apps/api`) | Completes order when matching pickup code is submitted |
| `/api/orders/{id}/pickup-code/reissue` | `POST` | NestJS (`apps/api`) | Generates and texts a fresh pickup code to buyer |
| `/api/messages/{id}/resend` | `POST` | NestJS (`apps/api`) | Manually retries failed or unknown SMS message |

---

## 4. Action Links & Webhook Endpoints

| Route | Method | Host / Application | Description |
| --- | --- | --- | --- |
| `/a/{token}` | `GET` | Next.js (`apps/web`) | Seller's single-use mobile action page (no login required) |
| `/api/a/{token}/accept` | `POST` | NestJS (`apps/api`) | Accept order from SMS link |
| `/api/a/{token}/reject` | `POST` | NestJS (`apps/api`) | Reject order from SMS link |
| `/api/a/{token}/ready` | `POST` | NestJS (`apps/api`) | Mark order ready and generate pickup code |
| `/api/a/{token}/complete` | `POST` | NestJS (`apps/api`) | Submit pickup code and complete order |
| `/api/webhooks/smshub` | `POST` | NestJS (`apps/api`) | Receives signed SMSHub delivery events |
| `/api/health` | `GET` | NestJS (`apps/api`) | Liveness & readiness check for hosting environment |

---

## 5. API Response Contracts & Standard Errors

Every `/api` response follows a consistent JSON envelope:

### Success Response:
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_ACCEPTED",
    "message": "This order has already been accepted."
  }
}
```

### Standard Status Codes:
- `200 OK`: Successful operation
- `400 Bad Request`: Input validation failed (Zod schema mismatch)
- `401 Unauthorized`: Missing or invalid seller session
- `403 Forbidden`: Authenticated seller does not own the requested resource
- `404 Not Found`: Entity not found or action token invalid/expired
- `409 Conflict`: Disallowed state transition (e.g. attempting to complete an order that is not `ready`)
- `429 Too Many Requests`: Rate limit or SMS cooldown triggered
