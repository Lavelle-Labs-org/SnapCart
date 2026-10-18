# Order-by-SMS: UI & UX Design Specifications

## 1. Master Screen Inventory

Fourteen focused screens cover the entire application surface:

| Screen # | Screen Name | Route | Primary User | Purpose |
| --- | --- | --- | --- | --- |
| 1 | Storefront | `/s/{slug}` | Buyer | Mobile catalog browsing & cart builder |
| 2 | Checkout | `/s/{slug}/checkout` | Buyer | Buyer contact, order summary, SMS consent |
| 3 | Verify Code | `/s/{slug}/verify/{draftId}` | Buyer | 6-digit OTP verification with 60s cooldown |
| 4 | Order Confirmation | `/s/{slug}/done` | Buyer | Order summary, assigned order #, next steps |
| 5 | Stop Texts | `/x/{token}` | Buyer | Single-tap SMS opt-out page |
| 6 | Seller Registration | `/signup` | Seller | Business name, phone, password |
| 7 | Seller Phone Verification | `/signup` (step 2) | Seller | OTP verification for alert phone number |
| 8 | Seller Login | `/login` | Seller | Phone & password credentials |
| 9 | Orders Dashboard | `/dashboard` | Seller | Active order queue, status indicators |
| 10 | Order Detail | `/dashboard/orders/{id}` | Seller | Timeline, customer details, actions, SMS logs |
| 11 | Products Catalog | `/dashboard/products` | Seller | Product CRUD, price in birr, stock switch |
| 12 | Message Log | `/dashboard/messages` | Seller | Audit trail of every SMS, status badge, resend |
| 13 | Shop Settings | `/dashboard/settings` | Seller | Storefront slug, SMS sender name, template preview |
| 14 | Seller Action Page | `/a/{token}` | Seller (Guest) | Mobile one-tap order actions without login |

---

## 2. Key Screen UX Specifications

### 2.1 Public Storefront (`/s/{slug}`)
- **Header:** Prominent business name (`sms_name`), clean branding.
- **Product List:** Clean vertical card stack. Product title, price in Ethiopian Birr (`ETB ...`), and quantity increment/decrement controls.
- **Floating Cart Bar:** Fixed bottom bar displaying item count, subtotal in Birr, and prominent "Continue to Checkout" CTA.
- **Empty State:** Friendly notice when a seller has no products marked available.

### 2.2 Mobile Checkout (`/s/{slug}/checkout`)
- **Inputs:** Name and Ethiopian mobile number (`09...` or `07...`). Clear input masks and inline validation.
- **SMS Consent:** Unticked-by-default checkbox clearly worded:
  > *"Send me SMS updates about this order"*
- Notice explains that one verification code will always be texted to confirm the phone number.
- Single tap prevention: button disables on click with spinner.

### 2.3 Verify Code Screen (`/s/{slug}/verify/{draftId}`)
- Single large 6-digit numeric input with `inputmode="numeric"`.
- 60-second animated circular countdown before "Resend Code" activates.
- Link allowing user to return and correct a mistyped phone number.

### 2.4 Mobile Action Page (`/a/{token}`)
- Designed specifically for one-thumb mobile interaction.
- Displays order number, itemized quantities, total in Birr, buyer name, and one-tap `tel:` phone link.
- **Dynamic Buttons based on state:**
  - `new`: Prominent green **Accept** button and secondary red **Reject** button (with confirmation prompt).
  - `accepted`: Prominent blue **Mark Ready** button.
  - `ready`: Numeric input for 4-digit pickup code + **Complete Order** button.
  - `completed` or `rejected`: Final static state card.
- Immediate inline status indicator showing whether the triggered SMS was sent, queued, or failed.

### 2.5 Seller Message Log (`/dashboard/messages`)
- Columns: Timestamp (EAT), Masked Phone (`09•• ••• 567`), Event Type, Status Badge, Credits, Message ID (`msg_...`) with one-click copy button.
- Statuses:
  - `sent` (Green)
  - `failed` (Red)
  - `skipped` (Gray, with hover reason like "Buyer Opted Out")
  - `test_passed` (Blue)
- Row action: "Resend" button for failed/unknown messages.
- Top banner alert if SMS sending is paused or balance is low.

---

## 3. Ergonomics & Accessibility

- **Mobile First (360px+):** Layout optimized for compact Android/iOS devices used by street vendors and market stall owners.
- **Touch Targets:** Minimum 44px x 44px tap area for all buttons and interactive controls.
- **Visual Feedback:** High contrast typography, explicit text labels accompanying all status colors, and zero reliance on color alone.
- **Performance:** Lightweight CSS, zero heavy image dependencies, fast loads on 3G/EDGE mobile networks.
- **Localization:** Clean English typography by default, with an architecture ready for Amharic Ethiopic script (`ፊደል`).
