-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'IMAM');

-- CreateEnum
CREATE TYPE "MosqueStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('UNEMPLOYED', 'PART_TIME', 'FULL_TIME', 'RETIRED', 'DISABLED', 'NONE');

-- CreateEnum
CREATE TYPE "FamilyMemberRole" AS ENUM ('HEAD', 'SPOUSE', 'CHILD', 'PARENT', 'OTHER');

-- CreateEnum
CREATE TYPE "HousingStatus" AS ENUM ('OWNER', 'TENANT', 'HOMELESS', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "HousingType" AS ENUM ('HOUSE', 'APARTMENT', 'TEMPORARY', 'OTHER');

-- CreateEnum
CREATE TYPE "IncomeSource" AS ENUM ('SALARY', 'SOCIAL_AID', 'PENSION', 'SMALL_BUSINESS', 'FAMILY_SUPPORT', 'CHARITY', 'OTHER', 'NONE');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('URGENT', 'VULNERABLE', 'MODERATE', 'LOW');

-- CreateEnum
CREATE TYPE "DonorType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "DonationCategory" AS ENUM ('ZAKAT_MAL', 'ZAKAT_FITR', 'SADAQAH', 'KAFFARA', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CCP', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "DistributionMethod" AS ENUM ('WATER_FILLING', 'MANUAL');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DistributionItemPaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'DISTRIBUTE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SUCCESS', 'INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'IMAM',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mosque" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wilaya" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "imamId" TEXT NOT NULL,
    "status" "MosqueStatus" NOT NULL DEFAULT 'INACTIVE',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Mosque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MosqueSettings" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "svfMaxScore" INTEGER NOT NULL DEFAULT 100,
    "autoCalculateSVF" BOOLEAN NOT NULL DEFAULT true,
    "smigThreshold" DECIMAL(14,2) NOT NULL DEFAULT 20000,
    "pointsIfIncomeBelowSMIG" INTEGER NOT NULL DEFAULT 40,
    "pointsIfIncomeBelow2xSMIG" INTEGER NOT NULL DEFAULT 25,
    "pointsIfIncomeBelow3xSMIG" INTEGER NOT NULL DEFAULT 10,
    "pointsPerChild" INTEGER NOT NULL DEFAULT 5,
    "childPointsCap" INTEGER NOT NULL DEFAULT 20,
    "pointsIfWidowedDivorced" INTEGER NOT NULL DEFAULT 15,
    "pointsIfNoSupport" INTEGER NOT NULL DEFAULT 20,
    "pointsIfDisability" INTEGER NOT NULL DEFAULT 15,
    "pointsIfChronicIllness" INTEGER NOT NULL DEFAULT 10,
    "pointsIfTenant" INTEGER NOT NULL DEFAULT 10,
    "malusPerAidReceived" INTEGER NOT NULL DEFAULT 8,
    "malusCap" INTEGER NOT NULL DEFAULT 25,
    "seniorAgeThreshold" INTEGER NOT NULL DEFAULT 65,
    "pointsIfSeniorHead" INTEGER NOT NULL DEFAULT 10,
    "youngHeadAgeThreshold" INTEGER NOT NULL DEFAULT 25,
    "pointsIfYoungHead" INTEGER NOT NULL DEFAULT 5,
    "customCriteria" JSONB NOT NULL DEFAULT '[]',
    "povertyThresholdPerPerson" DECIMAL(14,2) NOT NULL DEFAULT 20000,
    "svfWeightExponent" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "minimumDistributionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reservePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowAnonymousDonations" BOOLEAN NOT NULL DEFAULT true,
    "requireApprovalForDistribution" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MosqueSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "ccp" TEXT NOT NULL,
    "phone" TEXT,
    "alternativePhone" TEXT,
    "wilaya" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "monthlyIncome" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'NONE',
    "incomeSources" "IncomeSource"[] DEFAULT ARRAY['NONE']::"IncomeSource"[],
    "rentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maritalStatus" "MaritalStatus" NOT NULL,
    "childrenSchoolCount" INTEGER NOT NULL DEFAULT 0,
    "orphanCount" INTEGER NOT NULL DEFAULT 0,
    "elderlyCount" INTEGER NOT NULL DEFAULT 0,
    "documentsOriginalName" TEXT,
    "diseases" TEXT NOT NULL DEFAULT '',
    "hasDisability" BOOLEAN NOT NULL DEFAULT false,
    "housingStatus" "HousingStatus" NOT NULL,
    "housingType" "HousingType" NOT NULL,
    "notes" TEXT,
    "status" "FamilyStatus" NOT NULL DEFAULT 'ACTIVE',
    "svfScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'LOW',
    "lastAidAt" TIMESTAMP(3),
    "createdByMosqueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "role" "FamilyMemberRole" NOT NULL,
    "hasDisability" BOOLEAN NOT NULL DEFAULT false,
    "diseases" TEXT,
    "occupation" TEXT,
    "monthlyIncome" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MosqueFamily" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "localNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MosqueFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyDocument" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "contentBase64" TEXT NOT NULL,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "donorType" "DonorType" NOT NULL DEFAULT 'INDIVIDUAL',
    "notes" TEXT,
    "totalDonated" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "donorId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(14,2) NOT NULL,
    "category" "DonationCategory" NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "distributionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalBudget" DECIMAL(14,2) NOT NULL,
    "totalDistributed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "method" "DistributionMethod" NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "generatedAutomatically" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Distribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionItem" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "svfSnapshot" DOUBLE PRECISION NOT NULL,
    "prioritySnapshot" "PriorityLevel" NOT NULL,
    "paymentStatus" "DistributionItemPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mosqueId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Mosque_email_key" ON "Mosque"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Mosque_imamId_key" ON "Mosque"("imamId");

-- CreateIndex
CREATE INDEX "Mosque_wilaya_commune_idx" ON "Mosque"("wilaya", "commune");

-- CreateIndex
CREATE INDEX "Mosque_verificationStatus_idx" ON "Mosque"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MosqueSettings_mosqueId_key" ON "MosqueSettings"("mosqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Family_ccp_key" ON "Family"("ccp");

-- CreateIndex
CREATE INDEX "Family_status_idx" ON "Family"("status");

-- CreateIndex
CREATE INDEX "Family_priority_idx" ON "Family"("priority");

-- CreateIndex
CREATE INDEX "Family_wilaya_idx" ON "Family"("wilaya");

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_idx" ON "FamilyMember"("familyId");

-- CreateIndex
CREATE INDEX "MosqueFamily_mosqueId_idx" ON "MosqueFamily"("mosqueId");

-- CreateIndex
CREATE INDEX "MosqueFamily_familyId_idx" ON "MosqueFamily"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "MosqueFamily_mosqueId_familyId_key" ON "MosqueFamily"("mosqueId", "familyId");

-- CreateIndex
CREATE INDEX "FamilyDocument_familyId_idx" ON "FamilyDocument"("familyId");

-- CreateIndex
CREATE INDEX "FamilyDocument_uploadedById_idx" ON "FamilyDocument"("uploadedById");

-- CreateIndex
CREATE INDEX "Donor_mosqueId_idx" ON "Donor"("mosqueId");

-- CreateIndex
CREATE INDEX "Donor_name_idx" ON "Donor"("name");

-- CreateIndex
CREATE INDEX "Donor_phone_idx" ON "Donor"("phone");

-- CreateIndex
CREATE INDEX "Donor_email_idx" ON "Donor"("email");

-- CreateIndex
CREATE INDEX "Donation_mosqueId_idx" ON "Donation"("mosqueId");

-- CreateIndex
CREATE INDEX "Donation_donorId_idx" ON "Donation"("donorId");

-- CreateIndex
CREATE INDEX "Donation_receivedAt_idx" ON "Donation"("receivedAt");

-- CreateIndex
CREATE INDEX "Donation_category_idx" ON "Donation"("category");

-- CreateIndex
CREATE INDEX "Distribution_mosqueId_idx" ON "Distribution"("mosqueId");

-- CreateIndex
CREATE INDEX "Distribution_distributionDate_idx" ON "Distribution"("distributionDate");

-- CreateIndex
CREATE INDEX "DistributionItem_familyId_idx" ON "DistributionItem"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionItem_distributionId_familyId_key" ON "DistributionItem"("distributionId", "familyId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_mosqueId_idx" ON "AuditLog"("mosqueId");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mosque" ADD CONSTRAINT "Mosque_imamId_fkey" FOREIGN KEY ("imamId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MosqueSettings" ADD CONSTRAINT "MosqueSettings_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_createdByMosqueId_fkey" FOREIGN KEY ("createdByMosqueId") REFERENCES "Mosque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MosqueFamily" ADD CONSTRAINT "MosqueFamily_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MosqueFamily" ADD CONSTRAINT "MosqueFamily_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MosqueFamily" ADD CONSTRAINT "MosqueFamily_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionItem" ADD CONSTRAINT "DistributionItem_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "Distribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionItem" ADD CONSTRAINT "DistributionItem_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
