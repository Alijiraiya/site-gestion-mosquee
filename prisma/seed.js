// Seed script: creates the default imam account, a default mosque, its
// settings, and a handful of sample donors/families/donations so the app
// has real data to test dashboards, SVF scoring, and distribution against.
// Run with: npx prisma db seed
//
// NOTE: The SVF scoring weights and the Water-Filling min/max amounts live
// in code (src/lib/svf.js and src/lib/waterFilling.js), because the schema
// has no table to store them. Only the two settings the schema DOES persist
// (reservePercentage + minimumDistributionAmount) are seeded here.

import { PrismaClient } from "../src/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg(
  { connectionString: process.env.DATABASE_URL },
  { schema: "public" }
);
const prisma = new PrismaClient({ adapter });

const WF_RESERVE = 0.1; // 10% emergency reserve -> reservePercentage
const WF_MIN_AMT = 1000; // minimum per family (DA) -> minimumDistributionAmount

async function main() {
  const email = process.env.SEED_IMAM_EMAIL || "imam@mosque.dz";
  const password = process.env.SEED_IMAM_PASSWORD || "imam1234";
  const passwordHash = await bcrypt.hash(password, 10);

  // 1. Imam user (isActive MUST be true -- the login endpoint rejects inactive users)
  const imam = await prisma.user.upsert({
    where: { email },
    update: { isActive: true },
    create: {
      email,
      firstName: "Imam",
      lastName: "Admin",
      passwordHash,
      role: "IMAM",
      isActive: true,
    },
  });

  // 2. A mosque owned by the imam (most endpoints are scoped to the user's mosque)
  const mosque = await prisma.mosque.upsert({
    where: { imamId: imam.id },
    update: {},
    create: {
      name: "Default Mosque",
      wilaya: "Alger",
      commune: "Alger Centre",
      address: "N/A",
      phone: "0000000000",
      email: "mosque@mosque.dz",
      imamId: imam.id,
      status: "ACTIVE",
      verificationStatus: "APPROVED",
      isVerified: true,
      balance: 500000,
    },
  });

  // 3. Mosque settings (the only settings the schema persists)
  await prisma.mosqueSettings.upsert({
    where: { mosqueId: mosque.id },
    update: {},
    create: {
      mosqueId: mosque.id,
      reservePercentage: WF_RESERVE,
      minimumDistributionAmount: WF_MIN_AMT,
    },
  });

  // 4. A sample donor
  const donor = await prisma.donor.upsert({
    where: { id: "seed-donor-1" },
    update: {},
    create: {
      id: "seed-donor-1",
      mosqueId: mosque.id,
      name: "Ahmed Benali",
      phone: "0555000111",
      email: "ahmed.benali@example.dz",
      donorType: "INDIVIDUAL",
      totalDonated: 50000,
      createdById: imam.id,
    },
  });

  // 5. A sample donation from that donor
  await prisma.donation.upsert({
    where: { id: "seed-donation-1" },
    update: {},
    create: {
      id: "seed-donation-1",
      mosqueId: mosque.id,
      donorId: donor.id,
      isAnonymous: false,
      amount: 50000,
      category: "ZAKAT_MAL",
      paymentMethod: "CCP",
      notes: "Seed donation for testing.",
      createdById: imam.id,
    },
  });

  // 6. A sample family (createdByMosque + linked via MosqueFamily)
  const family = await prisma.family.upsert({
    where: { ccp: "0000000000000000" },
    update: {},
    create: {
      firstName: "Yacine",
      lastName: "Kaci",
      dateOfBirth: new Date("1985-04-12"),
      ccp: "0000000000000000",
      phone: "0555111222",
      wilaya: "Alger",
      address: "Cité 100 Logements, Alger",
      monthlyIncome: 15000,
      employmentStatus: "PART_TIME",
      incomeSources: ["SOCIAL_AID"],
      rentAmount: 8000,
      maritalStatus: "MARRIED",
      childrenSchoolCount: 2,
      orphanCount: 0,
      elderlyCount: 1,
      diseases: "",
      hasDisability: false,
      housingStatus: "TENANT",
      housingType: "APARTMENT",
      status: "ACTIVE",
      svfScore: 72.5,
      priority: "VULNERABLE",
      createdByMosqueId: mosque.id,
    },
  });

  await prisma.mosqueFamily.upsert({
    where: { mosqueId_familyId: { mosqueId: mosque.id, familyId: family.id } },
    update: {},
    create: {
      mosqueId: mosque.id,
      familyId: family.id,
      isActive: true,
      createdById: imam.id,
    },
  });

  // 7. A family member (spouse) for that family
  await prisma.familyMember.upsert({
    where: { id: "seed-member-1" },
    update: {},
    create: {
      id: "seed-member-1",
      familyId: family.id,
      firstName: "Amina",
      lastName: "Kaci",
      dateOfBirth: new Date("1988-09-03"),
      role: "SPOUSE",
      hasDisability: false,
      occupation: "Housewife",
    },
  });

  console.log(`Seed complete.`);
  console.log(`Imam login: ${email} / ${password}`);
  console.log(`Mosque: ${mosque.name} (id ${mosque.id})`);
  console.log(`Donor: ${donor.name} (id ${donor.id})`);
  console.log(`Family: ${family.firstName} ${family.lastName} (id ${family.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });