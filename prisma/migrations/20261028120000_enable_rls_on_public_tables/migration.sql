-- Enable Row Level Security (RLS) on all public tables
-- Resolves Supabase Security Advisor warning: rls_disabled_in_public (Lint 0013_rls_disabled_in_public)
--
-- Security Context:
-- Snapcart is a 3-tier application where all client requests are authenticated and authorized
-- through NestJS backend guards and Next.js server components. The backend connects directly
-- to PostgreSQL via Prisma as the database owner (postgres), which possesses the PostgreSQL
-- BYPASSRLS privilege.
--
-- Enabling RLS on every public table closes the auto-exposed Supabase PostgREST Data API
-- (/rest/v1/*) to unauthenticated (anon) and authenticated client-side callers by default (default-deny),
-- preventing unauthorized extraction of sensitive seller hashes, customer orders, pickup codes,
-- action tokens, or SMS logs, while allowing the backend application to operate uninterrupted.

ALTER TABLE "sellers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "phone_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pickup_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "action_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppression_list" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;
