/*
  Warnings:

  - You are about to drop the column `requireApprovalForDistribution` on the `MosqueSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MosqueSettings" DROP COLUMN "requireApprovalForDistribution";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;
