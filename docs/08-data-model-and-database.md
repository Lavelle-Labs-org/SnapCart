# Order-by-SMS: Data Model & Database Schema

## 1. Core Principles

1. **Monetary Values in Santim:** All prices and monetary totals are stored as integers representing Ethiopian Santim (1 Birr = 100 Santim) to prevent floating-point rounding errors.
2. **Normalized Phone Numbers:** All Ethiopian mobile numbers are normalized to a consistent format (`09xxxxxxxx` or `07xxxxxxxx`) before lookup or insertion.
3. **Immutable Historical Snapshots:** `order_items` copies product name and price at the time of checkout. Modifying products never alters past orders.
4. **Order Numbers:** Auto-increment per seller starting at `#1001`, ensuring short, consistent 4-digit numbers for SMS templates.
5. **Masked Sensitive Data:** Plain OTPs are never stored. Pickup codes are hashed with HMAC-SHA256 (`PICKUP_CODE_SECRET`).

---

## 2. Relational Model & Tables

### 2.1 Table Definitions

#### `sellers`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `business_name` | String | Seller's legal or public business name |
| `sms_name` | String(20) | Short name included in SMS alerts (max 20 chars) |
| `phone` | String | Normalized phone (`09...` or `07...`), Unique |
| `phone_verified_at` | DateTime? | Nullable until OTP verified at registration |
| `password_hash` | String | Argon2id / Bcrypt hash |
| `slug` | String | Unique URL slug (e.g., `habesha-cafe`) |
| `created_at` | DateTime | Default now |

#### `products`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `seller_id` | String | Foreign Key -> `sellers.id` |
| `name` | String | Product name |
| `price_santim` | Int | Price in santim (e.g. 25000 = 250.00 Birr) |
| `available` | Boolean | Availability toggle (default: true) |
| `created_at` | DateTime | Default now |
| `deleted_at` | DateTime? | Soft delete flag |

#### `orders`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `seller_id` | String | Foreign Key -> `sellers.id` |
| `number` | Int | Unique per seller (`@@unique([seller_id, number])`) |
| `buyer_name` | String | Buyer name provided at checkout |
| `buyer_phone` | String | Normalized buyer phone number |
| `sms_consent` | Boolean | True if consent box was ticked |
| `consent_wording` | String | Exact consent text displayed at checkout |
| `consent_at` | DateTime? | Timestamp when consent was recorded |
| `state` | Enum / String | `new`, `accepted`, `rejected`, `ready`, `completed` |
| `total_santim` | Int | Authoritative sum of items in santim |
| `created_at` | DateTime | Default now |

#### `order_items`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `order_id` | String | Foreign Key -> `orders.id` (onDelete: Cascade) |
| `product_id` | String? | Foreign Key -> `products.id` (onDelete: SetNull) |
| `name_at_order` | String | Product name frozen at time of checkout |
| `unit_price_santim` | Int | Unit price frozen at time of checkout |
| `quantity` | Int | Number of units purchased |

#### `order_events`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `order_id` | String | Foreign Key -> `orders.id` |
| `from_state` | String? | Previous state |
| `to_state` | String | New state |
| `actor` | String | Who triggered: `buyer`, `seller_link`, `seller_dash`, `system` |
| `created_at` | DateTime | Default now |

#### `phone_verifications`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `phone` | String | Normalized phone |
| `purpose` | String | `seller_signup` or `buyer_checkout` |
| `verification_id` | String | SMSHub Verify API verification ID |
| `status` | String | `pending`, `approved`, `expired`, `failed` |
| `expires_at` | DateTime | Expiry timestamp |
| `last_sent_at` | DateTime | Cooldown enforcement (60s) |
| `draft` | JSON / Text? | Serialized checkout cart + buyer name + consent |

#### `pickup_codes`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `order_id` | String | Unique Foreign Key -> `orders.id` |
| `code_hash` | String | Keyed HMAC-SHA256 of 4-digit code |
| `expires_at` | DateTime | Expiration timestamp (default: 7 days) |
| `attempts` | Int | Wrong attempt counter (locked when >= 5) |
| `issued_at` | DateTime | Default now |

#### `action_tokens`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `order_id` | String | Foreign Key -> `orders.id` |
| `purpose` | String | `seller_action` or `buyer_stop` |
| `token_hash` | String | SHA-256 hash of 22-char token (Unique) |
| `expires_at` | DateTime | Expiration timestamp (48h) |
| `revoked_at` | DateTime? | Timestamp when completed/rejected |

#### `messages`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `seller_id` | String? | Foreign Key -> `sellers.id` |
| `order_id` | String? | Foreign Key -> `orders.id` |
| `recipient_phone` | String | Normalized recipient phone number |
| `event` | String | `seller_code`, `buyer_code`, `new_order`, `accepted`, etc. |
| `text` | String | Sanitized SMS body (codes masked) |
| `status` | String | `queued`, `sent`, `failed`, `unknown`, `skipped`, `test_passed` |
| `skip_reason` | String? | `opted_out`, `suppressed`, `allowlist_blocked` |
| `smshub_message_id` | String? | `msg_...` identifier from SMSHub (Unique) |
| `request_id` | String? | `req_...` identifier |
| `network` | String? | `ethio_telecom` or `safaricom` |
| `credits_used` | Int? | Credits billed (1 or 2) |
| `error_type` | String? | SMSHub error code if failed |
| `attempts` | Int | Transmission retry counter |
| `created_at` | DateTime | Default now |
| `updated_at` | DateTime | Auto-updated |

#### `message_events`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `message_id` | String? | Foreign Key -> `messages.id` |
| `delivery_id` | String | `X-SMSHub-Delivery` UUID (Unique, for deduplication) |
| `event_type` | String | `message.sent`, `message.failed`, etc. |
| `raw_payload` | JSON / Text | Sanitized payload (sensitive codes removed) |
| `received_at` | DateTime | Default now |

#### `suppression_list`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID / String | Primary Key |
| `phone` | String | Normalized phone, Unique |
| `reason` | String | e.g. `buyer_opt_out` |
| `order_id` | String? | Associated order triggering opt-out |
| `created_at` | DateTime | Default now |

#### `rate_counters`
| Column | Type | Constraints / Description |
| --- | --- | --- |
| `key` | String | Primary Key (e.g. `ip:192.168.1.1:otp` or `phone:0911...`) |
| `window_start` | DateTime | Start of rate window |
| `count` | Int | Total hits in window |
