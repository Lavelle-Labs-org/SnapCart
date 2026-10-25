-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed');

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN "sms_credits" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "sellers" ADD COLUMN "sms_credits_used" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "tx_ref" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "credits_added" INTEGER NOT NULL,
    "amount_etb" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "chapa_reference" TEXT,
    "payment_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_tx_ref_key" ON "payment_transactions"("tx_ref");

-- CreateIndex
CREATE INDEX "payment_transactions_seller_id_status_idx" ON "payment_transactions"("seller_id", "status");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
