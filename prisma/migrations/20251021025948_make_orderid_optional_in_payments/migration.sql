-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_orderId_fkey";

-- AlterTable
ALTER TABLE "public"."Payment" ALTER COLUMN "orderId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
