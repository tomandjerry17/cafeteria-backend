-- CreateEnum
CREATE TYPE "public"."CustomerType" AS ENUM ('student', 'walk_in');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('cash', 'gcash', 'card');

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerType" "public"."CustomerType" NOT NULL DEFAULT 'student',
ADD COLUMN     "processedById" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "processedById" TEXT NOT NULL,
    "amountDue" DECIMAL(65,30) NOT NULL,
    "amountReceived" DECIMAL(65,30) NOT NULL,
    "change" DECIMAL(65,30) NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
