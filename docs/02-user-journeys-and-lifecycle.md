# Order-by-SMS: User Journeys & Order Lifecycle

## 1. User Journeys

### 1.1 Seller Journey
The seller sets up once, then handles orders from their phone through SMS.

1. **Registration:** Signs up with name, phone number, and password.
2. **Product Setup:** Adds products with a name, price, and availability flag.
3. **Storefront Link:** Copies the storefront link (`/s/{slug}`) and pastes it into a Telegram channel or Instagram bio.
4. **Order Alert:** Receives an SMS when an order arrives, with the order number, items, total, and a one-tap link (`/a/{token}`).
5. **Action:** Taps the link, reviews the order on a mobile page, and chooses **Accept** or **Reject**.
6. **Preparation:** Prepares the order, then taps the **Ready** link on the same page, which texts the buyer a pickup code.
7. **Handover:** At handover, enters the buyer's pickup code to complete the order.
8. **Dashboard Inspection:** Opens the dashboard when needed to see all orders and the message log, and to resend any failed SMS.

*Note:* If the seller does nothing, the order stays `new` and is visible on the dashboard. No automatic accept or expiry is part of the MVP.

### 1.2 Buyer Journey
The buyer never creates an account.

1. **Browse:** Opens the seller's link from Telegram or Instagram on their mobile phone.
2. **Cart:** Picks products and quantities.
3. **Checkout:** Enters their name and phone number, and ticks the box agreeing to receive SMS about this order.
4. **OTP Verification:** Receives an SMS with a verification code and enters it on the page (`/s/{slug}/verify/{draftId}`).
5. **Order Placed:** Sees a confirmation page (`/s/{slug}/done`) with the order number. The order is now created and sent to the seller.
6. **Accepted Notification:** Receives an SMS when the seller accepts or rejects the order.
7. **Ready Notification:** Receives an SMS when the order is ready, including the pickup code.

*Edge conditions:*
- If the buyer does not tick the consent box, they can still order but receive no further SMS after the verification code, and the seller is told to contact them another way.
- If the code is wrong 5 times or expires, the buyer requests a new one, with a 60-second wait between sends.

### 1.3 Handover Journey (Pickup Code)
The pickup code proves the right person received the order.

1. The buyer arrives, or the rider reaches them, and shows the pickup code from the SMS.
2. The seller or rider enters the code on the seller action page (`/a/{token}`) or dashboard.
3. The system checks the code against the stored hash, within its expiry (default 7 days) and attempt limit (5 attempts).
4. On a match, the order moves to `completed` and the code can never be used again.
5. On a mismatch, the attempt is counted. After 5 wrong attempts, the code locks, and the seller can reissue a new code from the dashboard or action link.

---

## 2. Order Lifecycle

### 2.1 Order State Machine

```
         [Guest Checkout + OTP Verified]
                       │
                       ▼
                    [ NEW ]
                   /       \
      (Seller accepts)    (Seller rejects)
                 /           \
                ▼             ▼
          [ ACCEPTED ]    [ REJECTED ] (Final)
                │
         (Seller marks ready)
                │
                ▼
            [ READY ] ──(Wrong code 5x)──> [ Pickup Code Locked ]
                │                                    │
                │ <───────(Seller reissues code)─────┘
                │
      (Valid Pickup Code entered)
                │
                ▼
          [ COMPLETED ] (Final)
```

| State | Allowed Transitions | Triggered Action / SMS |
| --- | --- | --- |
| `new` | `accepted`, `rejected` | Alert SMS sent to seller with `/a/{token}` link |
| `accepted` | `ready` | SMS sent to buyer: "Order accepted. We will text when ready." (if consented) |
| `rejected` | *Terminal* | SMS sent to buyer: "Sorry, order was not accepted." (if consented) |
| `ready` | `completed` | SMS sent to buyer with 4-digit pickup code (if consented) |
| `completed` | *Terminal* | No SMS sent. Order completed. |

### 2.2 Rules and Edge Cases

- **Only defined transitions are allowed:**
  - `new` -> `accepted` or `rejected`
  - `accepted` -> `ready`
  - `ready` -> `completed` (with correct pickup code)
  - Anything else returns a 409 conflict / clear error message and changes nothing.
- **Idempotency:** Each transition happens once. A repeated tap on an action link displays the current state instead of repeating the action.
- **No cancellation after accept:** In the MVP, a seller who cannot fulfill an accepted order contacts the buyer directly.
- **State saved before SMS send:** The database state is committed before the external SMS is dispatched. If the SMS fails, the order retains its updated state, and the failure is logged with a resend button. A carrier outage never blocks the business workflow.
- **Opt-out handling:** If a buyer opted out, order status transitions normally, the SMS send is skipped, and a log entry records the skip reason.
- **Lock is not a separate order state:** When 5 invalid pickup codes are entered, the order remains in `ready` state, the code is marked locked, and the seller can trigger `/api/orders/{id}/pickup-code/reissue`.
- **No "pending verification" order:** The order record is only inserted after the buyer's phone OTP check succeeds. Draft cart details live in `phone_verifications.draft`.
