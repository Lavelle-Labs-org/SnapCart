import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { ChapaService } from "./chapa.service";
import {
  BILLING_PACKAGES,
  BillingBalanceDto,
  BillingPackage,
  PaymentTransactionDto,
  InitializeCheckoutResponse,
} from "@order-by-sms/contracts";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ChapaService)
    private readonly chapaService: ChapaService
  ) {}

  /**
   * Retrieves current SMS credit balance and status for a seller.
   */
  async getBalance(sellerId: string): Promise<BillingBalanceDto> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { sms_credits: true, sms_credits_used: true },
    });

    if (!seller) {
      throw new NotFoundException("Seller not found");
    }

    const smsCredits = seller.sms_credits ?? 0;
    const smsCreditsUsed = seller.sms_credits_used ?? 0;

    return {
      smsCredits,
      smsCreditsUsed,
      lowBalance: smsCredits <= 3 && smsCredits > 0,
      isOutOfCredits: smsCredits <= 0,
    };
  }

  /**
   * Returns list of top-up packages available for purchase.
   */
  getPackages(): BillingPackage[] {
    return BILLING_PACKAGES;
  }

  /**
   * Retrieves recent transaction history for a seller.
   */
  async getTransactions(sellerId: string): Promise<PaymentTransactionDto[]> {
    const transactions = await this.prisma.paymentTransaction.findMany({
      where: { seller_id: sellerId },
      orderBy: { created_at: "desc" },
      take: 30,
    });

    return transactions.map((t) => ({
      id: t.id,
      txRef: t.tx_ref,
      packageId: t.package_id,
      creditsAdded: t.credits_added,
      amountEtb: t.amount_etb,
      currency: t.currency,
      status: t.status as "pending" | "completed" | "failed",
      paymentMethod: t.payment_method,
      createdAt: t.created_at.toISOString(),
    }));
  }

  /**
   * Creates a pending payment transaction and initializes a Chapa hosted checkout session.
   */
  async initializeCheckout(
    sellerId: string,
    packageId: string,
    customReturnUrl?: string
  ): Promise<InitializeCheckoutResponse> {
    const pkg = BILLING_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      throw new BadRequestException(`Invalid package ID: ${packageId}`);
    }

    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException("Seller not found");
    }

    const txRef = `obs_${Date.now()}_${randomBytes(4).toString("hex")}`;
    const frontendUrl = (
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");

    // 1. Create pending transaction in database
    await this.prisma.paymentTransaction.create({
      data: {
        seller_id: seller.id,
        tx_ref: txRef,
        package_id: pkg.id,
        credits_added: pkg.credits,
        amount_etb: pkg.priceEtb,
        currency: "ETB",
        status: "pending",
      },
    });

    const defaultReturnUrl = `${frontendUrl}/dashboard/billing/return?tx_ref=${txRef}`;
    const callbackUrl = `${frontendUrl}/api/webhooks/chapa`;

    // 2. Initialize with Chapa
    const cleanSlug = (seller.slug || "seller").replace(/[^a-zA-Z0-9_-]/g, "");
    const emailDomain = process.env.CHAPA_EMAIL_DOMAIN || "gmail.com";
    const cleanPhone = seller.phone.replace(/[^0-9]/g, "");

    const chapaRes = await this.chapaService.initializeTransaction({
      amount: pkg.priceEtb,
      currency: "ETB",
      email: `${cleanSlug}@${emailDomain}`,
      firstName: (seller.business_name || "Seller").slice(0, 30),
      phoneNumber: cleanPhone,
      txRef,
      callbackUrl,
      returnUrl: customReturnUrl || defaultReturnUrl,
      title: (pkg.name || "Snapcart").trim().slice(0, 16),
      description: `${pkg.name} - ${pkg.credits} SMS Credits`.replace(/[^\w\s.-]/g, "").slice(0, 100),
    });

    if (chapaRes.status !== "success" || !chapaRes.checkoutUrl) {
      throw new BadRequestException(
        typeof chapaRes.message === "string"
          ? chapaRes.message
          : "Failed to initialize payment gateway session"
      );
    }

    this.logger.log(
      `Initialized Chapa checkout for seller ${seller.id} (Package: ${pkg.name}, Ref: ${txRef})`
    );

    return {
      checkoutUrl: chapaRes.checkoutUrl,
      txRef,
    };
  }

  /**
   * Verifies payment status and credits seller account if successful.
   */
  async verifyAndApplyPayment(
    txRef: string,
    sellerId?: string
  ): Promise<{ status: string; newBalance: number }> {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { tx_ref: txRef },
      include: { seller: true },
    });

    if (!transaction) {
      throw new NotFoundException("Transaction reference not found");
    }

    if (sellerId && transaction.seller_id !== sellerId) {
      throw new BadRequestException("Unauthorized access to transaction");
    }

    // If already credited idempotently
    if (transaction.status === "completed") {
      return {
        status: "completed",
        newBalance: transaction.seller.sms_credits,
      };
    }

    // Call Chapa verification API
    const verifyRes = await this.chapaService.verifyTransaction(txRef);
    if (verifyRes.status === "success" && verifyRes.data?.status === "success") {
      return this.creditSellerAccount(
        transaction.id,
        verifyRes.data.reference || `chapa_${Date.now()}`,
        verifyRes.data.payment_method || "telebirr"
      );
    }

    return {
      status: transaction.status,
      newBalance: transaction.seller.sms_credits,
    };
  }

  /**
   * Webhook processing: atomically credits seller account when Chapa signals success.
   */
  async processWebhookEvent(payload: any): Promise<{ processed: boolean; reason?: string }> {
    const txRef = payload?.tx_ref;
    if (!txRef) {
      return { processed: false, reason: "Missing tx_ref" };
    }

    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { tx_ref: txRef },
    });

    if (!transaction) {
      return { processed: false, reason: `Unknown tx_ref: ${txRef}` };
    }

    if (transaction.status === "completed") {
      return { processed: true, reason: "Already completed" };
    }

    const status = (payload?.status || "").toLowerCase();
    if (status === "success") {
      await this.creditSellerAccount(
        transaction.id,
        payload.reference || payload.id,
        payload.payment_method || "chapa"
      );
      return { processed: true };
    }

    if (status === "failed") {
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: "failed" },
      });
      return { processed: true, reason: "Transaction marked failed" };
    }

    return { processed: false, reason: `Ignored status: ${status}` };
  }

  /**
   * Internal helper: Atomically marks transaction completed and increments seller credits.
   */
  private async creditSellerAccount(
    transactionId: string,
    chapaReference?: string,
    paymentMethod?: string
  ): Promise<{ status: string; newBalance: number }> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentTransaction.findUnique({
        where: { id: transactionId },
      });

      if (!current || current.status === "completed") {
        const seller = await tx.seller.findUnique({
          where: { id: current?.seller_id },
        });
        return { status: "completed", newBalance: seller?.sms_credits ?? 0 };
      }

      // 1. Mark transaction completed
      await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          status: "completed",
          chapa_reference: chapaReference,
          payment_method: paymentMethod,
        },
      });

      // 2. Increment seller credits
      const updatedSeller = await tx.seller.update({
        where: { id: current.seller_id },
        data: {
          sms_credits: { increment: current.credits_added },
        },
      });

      this.logger.log(
        `[Credit Top-Up Succeeded] Seller ${updatedSeller.id} credited +${current.credits_added} SMS. New balance: ${updatedSeller.sms_credits}`
      );

      return {
        status: "completed",
        newBalance: updatedSeller.sms_credits,
      };
    });
  }
}
