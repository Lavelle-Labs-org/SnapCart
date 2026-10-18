# Order-by-SMS: SMS Strategy, Templates & Encoding

## 1. SMS Events and Recipients

The application orchestrates seven types of SMS messages. Notably, no SMS is sent for the `completed` state.

| Event | Recipient | Trigger / Condition | Requires Buyer Consent? |
| --- | --- | --- | --- |
| **Seller phone code** | Seller | Seller registration (`/signup`) | No (mandatory verification) |
| **Buyer phone code** | Buyer | Checkout submission (`/s/{slug}/checkout`) | No (mandatory verification) |
| **New order alert** | Seller | Buyer completes phone verification | No |
| **Order accepted** | Buyer | Seller accepts order (via link or dashboard) | **Yes** (checks `sms_consent` & suppression) |
| **Order rejected** | Buyer | Seller rejects order | **Yes** (checks `sms_consent` & suppression) |
| **Order ready** | Buyer | Seller marks order ready; includes 4-digit pickup code | **Yes** (checks `sms_consent` & suppression) |
| **New pickup code** | Buyer | Seller reissues locked/expired pickup code | **Yes** (checks `sms_consent` & suppression) |

---

## 2. Message Templates

`{Shop}` represents the seller's SMS shop name truncated to 20 characters maximum.
`{link}` represents a short link (around 39 chars: `https://[short-domain]/[path]/[22-char-token]`).
Order numbers are 4 digits (starting at `#1001`).

### 2.1 English Templates (MVP Target)

| Event | English Template | Example Output |
| --- | --- | --- |
| **Phone code** | Managed by SMSHub Verify API | `Your Habesha Cafe verification code is 482190` |
| **New order (Seller)** | `New order #{orderNumber}: {count} items, {totalBirr} birr. Open: {link}` | `New order #1043: 3 items, 850 birr. Open: https://ord.et/a/K9x2m1ZbQrT4...` |
| **Order accepted** | `{Shop}: order #{orderNumber} accepted. We will text when ready. Stop texts: {link}` | `Habesha Cafe: order #1043 accepted. We will text when ready. Stop texts: https://ord.et/x/Z7y1...` |
| **Order rejected** | `{Shop}: sorry, your order #{orderNumber} was not accepted. Please contact the seller.` | `Habesha Cafe: sorry, your order #1043 was not accepted. Please contact the seller.` |
| **Order ready** | `{Shop}: order #{orderNumber} is ready. Pickup code: {code}. Show it when you collect.` | `Habesha Cafe: order #1043 is ready. Pickup code: 4821. Show it when you collect.` |
| **New pickup code** | `{Shop}: new pickup code for order #{orderNumber} is {code}.` | `Habesha Cafe: new pickup code for order #1043 is 7305.` |

### 2.2 Amharic Templates (Nice-to-Have Drafts)

*Note: Requires review by a native Amharic speaker before activation.*

| Event | Amharic Draft |
| --- | --- |
| **Phone code** | *Managed by SMSHub Verify API* |
| **New order (Seller)** | `ትዕዛዝ #{orderNumber} {link}` |
| **Order accepted** | `ትዕዛዝዎ #{orderNumber} ተቀብሏል። ዝግጁ ሲሆን እናሳውቅዎታለን።` |
| **Order rejected** | `ይቅርታ፣ ትዕዛዝዎ #{orderNumber} አልተቀበለም።` |
| **Order ready** | `ትዕዛዝዎ #{orderNumber} ዝግጁ ነው። የመረከቢያ ኮድ፡ {code}` |
| **New pickup code** | `አዲስ የመረከቢያ ኮድ፡ {code} (ትዕዛዝ #{orderNumber})` |

---

## 3. Character Limits and Encoding

SMSHub sends each message as a single SMS segment. The character ceiling depends strictly on character encoding:

- **GSM-7 (Standard Latin):** 160 characters per segment.
- **UCS-2 (Unicode / Amharic / Emoji):** 70 characters per segment. A single non-GSM character converts the entire message (including signature) to UCS-2.

### Signatures
- SMSHub automatically appends the account's sender signature to every outgoing message (separated by a blank line).
- By default, this is the account owner's ID-verified legal name (~25 characters).
- An 11-character custom signature can be requested via SMSHub settings.
- **English messages** easily fit within 160 characters (templates use 62–120 characters + 25-character signature = ~87–145 chars).
- **Amharic messages** are limited to 70 characters. The Amharic seller alert with a 25-character default signature would exceed 70 characters. Hence, in the MVP, seller alerts remain strictly in English.

### Text Safeguards
1. **Punctuation:** Use ASCII single quotes (`'`), straight quotes (`"`), and standard punctuation. Never use smart curly quotes (`’`, `”`) or emoji in templates, as they trigger UCS-2 encoding.
2. **Shop Name Encoding:** If a seller types an Amharic shop name, the entire SMS converts to UCS-2. The backend validates character length and encoding against `POST /api/test` before saving shop settings.
3. **Link Tracking Disabled:** `track_links` must remain `false`. When enabled, it appends `?utm_source=smshub`, wasting 17 critical characters.

---

## 4. Credit Usage & Budgeting

In SMSHub:
- **Ethio Telecom (09…):** 1 credit per SMS.
- **Safaricom (07…):** 2 credits per SMS.

### Cost Per Order (Happy Path: 4 SMS)
1. Buyer phone OTP (Verify API)
2. Seller new-order alert
3. Buyer order accepted
4. Buyer order ready + pickup code

| Buyer Network | Seller Network | Credits / Order | Orders per 100 Credits |
| --- | --- | --- | --- |
| Ethio Telecom | Ethio Telecom | 4 | 25 |
| Ethio Telecom | Safaricom | 5 | 20 |
| Safaricom | Ethio Telecom | 7 | 14 |
| Safaricom | Safaricom | 8 | 12 |

### Budget Discipline
- All automated unit/integration tests run against `POST /api/test` (0 credits consumed).
- Reserve at least 40 credits for final production demo recordings and testing on real phones.
- Capture the `msg_…` ID of the first successful live message for submission evidence.

---

## 5. Opt-Out & Suppression Handling

Buyers retain full control over notifications:
1. **Checkout Consent Checkbox:** Unticked by default. Checked status, exact wording, and ISO timestamp are saved in `orders`.
2. **Stop Link (`/x/{token}`):** Included in the "Order accepted" SMS. Clicking opens an unauthenticated page with a single "Stop SMS notifications" confirmation button.
3. **Suppression Table (`suppression_list`):** When a user opts out, their normalized phone number is stored in the database.
4. **Pre-flight Enforcement:** Before sending any buyer SMS, the system checks:
   - Was consent given at checkout (`sms_consent == true`)?
   - Is the phone number present in `suppression_list`?
   - If opted-out or suppressed, the send is cancelled, cost is 0 credits, and the `messages` table logs status as `skipped` with `skip_reason: "opted_out"`.
