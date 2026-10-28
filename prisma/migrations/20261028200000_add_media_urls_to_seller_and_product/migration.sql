-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" TEXT;

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
