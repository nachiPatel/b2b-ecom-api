/*
  Warnings:

  - You are about to drop the column `inventory` on the `Product` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Company` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `stock` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Made the column `categoryId` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "taxType" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "hsnCode" TEXT,
ADD COLUMN     "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 18.0;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "inventory",
ADD COLUMN     "hsnCode" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "msrp" DECIMAL(65,30),
ADD COLUMN     "specifications" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "stock" INTEGER NOT NULL,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 18.0,
ALTER COLUMN "categoryId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingState" TEXT,
ADD COLUMN     "gstNumber" TEXT;

-- CreateTable
CREATE TABLE "PackagingOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagingOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilterGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilterGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilterOption" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "filterGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilterOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CategoryToFilterGroup" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToFilterGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_FilterOptionToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FilterOptionToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CategoryToFilterGroup_B_index" ON "_CategoryToFilterGroup"("B");

-- CreateIndex
CREATE INDEX "_FilterOptionToProduct_B_index" ON "_FilterOptionToProduct"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingOption" ADD CONSTRAINT "PackagingOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilterOption" ADD CONSTRAINT "FilterOption_filterGroupId_fkey" FOREIGN KEY ("filterGroupId") REFERENCES "FilterGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToFilterGroup" ADD CONSTRAINT "_CategoryToFilterGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToFilterGroup" ADD CONSTRAINT "_CategoryToFilterGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "FilterGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FilterOptionToProduct" ADD CONSTRAINT "_FilterOptionToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "FilterOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FilterOptionToProduct" ADD CONSTRAINT "_FilterOptionToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
