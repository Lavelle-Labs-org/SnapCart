# Order-by-SMS: Routes & API Specification

## 1. Overview of Endpoints

The system exposes three distinct categories of routes:
1. **Public Storefront & Guest Checkout** (No seller login required)
2. **Authenticated Seller Dashboard & APIs** (Cookie session required)
3. **Public Signed Action Links & External Webhooks** (Token or HMAC signature required)

---

## 2. Public Storefront Routes

| Route | Method | Type | Description |
| --- | --- | --- | --- |
| `/s/{slug}` | `GET` | HTML Page | Public storefront displaying active products and cart drawer |
| `/s/{slug}/checkout` | `GET` | HTML Page | Mobile checkout screen: name, phone, consent checkbox |
| `/s/{slug}/verify/{draftId}` | `GET` | HTML Page | 6-digit OTP verification screen with countdown |
| `/s/{slug}/done` | `GET` | HTML Page | Order placed confirmation screen displaying order number |
| `/x/{token}` | `GET` | HTML Page | Buyer opt-out page ("Stop SMS updates") |
| `/api/checkout` | `POST` | JSON API | Validates form input, creates verification draft, triggers Verify API OTP |
| `/api/checkout/resend` | `POST` | JSON API | Re-triggers OTP if 60 seconds have elapsed |
| `/api/checkout/verify` | `POST` | JSON API | Validates OTP, creates order, calculates santim total, alerts seller |
| `/api/stop/{token}` | `POST` | JSON API | Adds phone to suppression list, stops further notifications |

---

## 3. Seller Dashboard Routes (Protected)

| Route | Method | Type | Description |
| --- | --- | --- | --- |
| `/signup` | `GET` | HTML Page | Seller account registration |
| `/login` | `GET` | HTML Page | Seller login screen |
| `/dashboard` | `GET` | HTML Page | Order list, status badges, metrics |
| `/dashboard/orders/{id}` | `GET` | HTML Page | Order detail, state timeline, order SMS log, actions |
| `/dashboard/products` | `GET` | HTML Page | Product catalog list, add/edit/delete modals |
| `/dashboard/messages` | `GET` | HTML Page | Complete SMS message log with statuses, credits, resend buttons |
| `/dashboard/settings` | `GET` | HTML Page | Shop name, SMS sender name, storefront link copy |
| `/api/auth/signup` | `POST` | JSON API | Register seller account and dispatch phone code |
| `/api/auth/verify-phone` | `POST` | JSON API | Confirms seller phone OTP |
| `/api/auth/login` | `POST` | JSON API | Establishes authenticated cookie session |
| `/api/auth/logout` | `POST` | JSON API | Clears session cookie |
| `/api/products` | `POST` | JSON API | Adds new product |
| `/api/products/{id}` | `PATCH` | JSON API | Updates product name, price_santim, availability |
| `/api/products/{id}` | `DELETE`| JSON API | Soft-deletes product |
| `/api/orders/{id}/accept` | `POST` | JSON API | Transitions order from `new` to `accepted` |
| `/api/orders/{id}/reject` | `POST` | JSON API | Transitions order from `new` to `rejected` |
| `/api/orders/{id}/ready` | `POST` | JSON API | Transitions order to `ready`, generates pickup code |
| `/api/orders/{id}/complete` | `POST` | JSON API | Completes order when matching pickup code is submitted |
| `/api/orders/{id}/pickup-code/reissue` | `POST` | JSON API | Generates and texts a fresh pickup code to buyer |
| `/api/messages/{id}/resend` | `POST` | JSON API | Manually retries failed or unknown SMS message |

---

## 4. Action Links & Webhook Endpoints

| Route | Method | Type | Description |
| --- | --- | --- | --- |
| `/a/{token}` | `GET` | HTML Page | Seller's single-use mobile action page (no login required) |
| `/api/a/{token}/accept` | `POST` | JSON API | Accept order from SMS link |
| `/api/a/{token}/reject` | `POST` | JSON API | Reject order from SMS link |
| `/api/a/{token}/ready` | `POST` | JSON API | Mark order ready and generate pickup code |
| `/api/a/{token}/complete` | `POST` | JSON API | Submit pickup code and complete order |
| `/webhooks/smshub` | `POST` | JSON API | Receives signed SMSHub delivery events |
| `/api/health` | `GET` | JSON API | Liveness & readiness check for hosting environment |

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
