import { Metadata } from "next";
import { BillingClient } from "./billing-client";

export const metadata: Metadata = {
  title: "Billing & SMS Credits | Order-by-SMS Dashboard",
  description: "Manage your SMS credit balance, view usage, and top up via Chapa (Telebirr & CBE Birr).",
};

export default function BillingPage() {
  return <BillingClient />;
}
