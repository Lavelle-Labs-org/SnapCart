export interface BillingPackage {
  id: string;
  name: string;
  credits: number;
  priceEtb: number;
  badge?: string;
  discount?: string;
  description: string;
}

export const BILLING_PACKAGES: BillingPackage[] = [
  {
    id: "starter_50",
    name: "Starter Pack",
    credits: 50,
    priceEtb: 50,
    badge: "Starter",
    description: "Ideal for testing and small shops processing up to 25 orders.",
  },
  {
    id: "growth_200",
    name: "Growth Pack",
    credits: 200,
    priceEtb: 180,
    badge: "Most Popular",
    discount: "10% OFF",
    description: "Best for active restaurants and stores sending frequent updates.",
  },
  {
    id: "pro_500",
    name: "Pro Volume",
    credits: 500,
    priceEtb: 400,
    badge: "Best Value",
    discount: "20% OFF",
    description: "High volume tier for busy shops with automated order confirmations.",
  },
];

export interface BillingBalanceDto {
  smsCredits: number;
  smsCreditsUsed: number;
  lowBalance: boolean;
  isOutOfCredits: boolean;
}

export interface InitializeCheckoutDto {
  packageId: string;
  returnUrl?: string;
}

export interface InitializeCheckoutResponse {
  checkoutUrl: string;
  txRef: string;
}

export interface PaymentTransactionDto {
  id: string;
  txRef: string;
  packageId: string;
  creditsAdded: number;
  amountEtb: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  paymentMethod?: string | null;
  createdAt: string;
}
