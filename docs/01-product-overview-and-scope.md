# Order-by-SMS: Product Overview & Scope

## 1. Overview

### 1.1 Vision and One-Line Pitch
A business you can run from text messages. A seller pastes one order link into Telegram or Instagram, customers order through it, and every step after that (alerting the seller, confirming, "ready", pickup) happens by SMS. There is no app to install and no dashboard the seller has to watch.

### 1.2 Problem
Small businesses take orders through social media, messaging apps, and phone calls, which makes it hard to organize orders, track fulfillment, and keep customers updated without messaging each person by hand.

Three gaps follow from that:
- **Sellers are busy.** They are preparing orders, not watching a dashboard, so new orders get noticed late.
- **Buyers have no account.** An order placed from a chat link gives the seller no reliable way to reach them, and a typo or fake number wastes preparation time.
- **Handover has no proof.** When a rider or a pickup goes wrong, nothing shows that the right person received the order.

### 1.3 Solution Summary
The seller adds products and gets a shareable storefront link. A guest buyer opens it on their phone, places an order, and confirms their phone number with a code. The seller receives an SMS with a signed one-tap link to accept, reject, or mark the order ready, with no login. The buyer receives SMS updates, including a pickup code when the order is ready, and the seller enters that code at handover to complete the order.

The seller dashboard lists orders and shows a message log with the real status of every SMS, taken from the SMSHub response and its webhooks, with a resend button for failures.

### 1.4 Goals and Non-Goals

**Goals**
- SMS is the core workflow for both seller and buyer, not a side notification.
- The full order flow works end to end on real phones in the demo.
- Delivery is reported honestly: store the real status, show failures, allow resend.
- Buyers consent to messages at checkout and can stop them with a link.
- The repository is clean, has no secrets, and has a README another person can follow.

**Non-goals**
- Online payments (cash on pickup or delivery for the MVP).
- Buyer accounts, seller verification, and an admin panel.
- Delivery or rider tracking.
- Reply-based SMS flows. The SMSHub docs do not describe inbound SMS, so nothing depends on buyers replying.

### 1.5 Success Criteria
The project succeeds if all of this works in the demo before the deadline on Wed 28 Oct, 23:59 EAT:
1. A seller creates a storefront with products and shares its link.
2. A guest buyer places an order and verifies their phone with a code.
3. The seller accepts the order from an SMS link, and the buyer receives the "accepted" and "ready + pickup code" messages.
4. The seller enters the pickup code and the order completes.
5. The dashboard shows each SMS with its real status (sent or failed) and message ID.
6. The submission is complete: public repository, README, demo video of 3 minutes or less, problem-and-solution text, and the `msg_…` ID of a real SMS the project sent.

---

## 2. Users and Personas

### 2.1 Seller
The seller is the owner of a small business who sells through chat apps and phone calls and handles orders alone or with one or two helpers. They carry a phone all day, use Telegram or Instagram, and may not be comfortable with dashboards.
- **Needs:** know the moment an order arrives, accept or reject it quickly, tell the customer when it is ready, and confirm the right person collected it.
- **Constraints:** little time at a desk, a basic phone, and mobile data that may be limited or unreliable.
- **Success for them:** fewer lost orders and fewer "is it ready?" messages, without learning a new tool.

### 2.2 Buyer
The buyer is a customer who finds the seller in a Telegram channel or Instagram bio and opens the order link on their phone. They do not want to create an account or install anything.
- **Needs:** a quick way to order, proof the order was received, a clear signal when it is ready, and a code that shows the handover is theirs.
- **Constraints:** no account, possibly slow data, and an Ethio Telecom or Safaricom number that is the only way to reach them.
- **Success for them:** one short checkout, then texts that tell them what is happening.

### 2.3 Target Niche
The product targets any small seller who takes orders for products that are prepared, picked up, or delivered, so it is not tied to one vertical. Examples are food sellers, tailors, laundries, print shops, and garages.

We keep it general on purpose and keep the data model neutral: a product has a name, a price, and an availability flag, and an order is a list of products for one buyer. The demo uses one concrete seller as its example, but nothing in the code is specific to that business.

---

## 3. Scope

### 3.1 MVP (Must Have)
Everything here must work end to end for the submission:
- Seller sign-up and sign-in.
- Product management: name, price, available or not.
- Shareable storefront link per seller, mobile-friendly.
- Guest checkout with buyer name and phone number.
- Phone verification by SMS code before an order is accepted.
- Order states: new, accepted or rejected, ready, completed.
- SMS to the seller on every new order, with a signed single-use link to accept, reject, or mark ready, with no login.
- SMS to the buyer on accepted, rejected, and ready, including the pickup code.
- Handover: the seller enters the pickup code to complete the order.
- Seller dashboard with an order list.
- Message log showing each SMS with its real status (sent or failed) from the SMSHub response and webhooks.
- Consent checkbox at checkout and a stop-texts link in the accepted message, both honored on every later message.
- Error handling for failed sends, with a visible failed state.
- Public repository, README with setup steps, no secrets committed.

### 3.2 Nice to Have
Built in this order only if the MVP is finished and tested:
1. Amharic message templates with a live character counter (70-character limit including signature).
2. A "resend" button for failed SMS in the message log.
3. Order history search and filters.
4. Per-message credit cost shown in the message log.
5. Seller toggle for which order events send an SMS.

### 3.3 Out of Scope
Not built, and not mentioned in the demo as features:
- Online payments, including Chapa. The MVP assumes cash on pickup or delivery.
- Buyer accounts and buyer order history.
- Seller verification and an admin panel.
- Delivery or rider tracking.
- Reply-based SMS flows, since the SMSHub docs do not describe inbound SMS.
- Social-media order imports, inventory management, and AI support.
