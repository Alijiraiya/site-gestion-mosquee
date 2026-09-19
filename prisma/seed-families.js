// Seeds a few realistic TEST families linked to your mosque, so the dashboard
// and distribution/calculate endpoints have real data to work with.
//
// Run from the project root (uses tsx because the generated client is TypeScript):
//   npx tsx prisma/seed-families.js
//
// Safe to re-run: families are upserted by their unique CCP.
import "dotenv/config";
import { PrismaClient } from "../src/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(
  { connectionString: process.env.DATABASE_URL },
  { schema: "public" }
);
const prisma = new PrismaClient({ adapter });

// Varied profiles -> different SVF scores / priorities / marital statuses.
const FAMILIES = [
  {
    firstName: "Amina",
    lastName: "Benali",
    dateOfBirth: new Date("1980-06-12"),
    ccp: "0011223344",
    phone: "0550111111",
    wilaya: "Alger",
    address: "Rue des Martyrs, Bab El Oued",
    monthlyIncome: 8000,
    employmentStatus: "UNEMPLOYED",
    incomeSources: ["SOCIAL_AID"],
    rentAmount: 12000,
    maritalStatus: "WIDOWED",
    childrenSchoolCount: 2,
    orphanCount: 3,
    hasDisability: true,
    housingStatus: "TENANT",
    housingType: "APARTMENT",
    svfScore: 82,
    priority: "URGENT",
    notes: "Widowed, 3 orphaned children, disability, renting.",
  },
  {
    firstName: "Karim",
    lastName: "Haddad",
    dateOfBirth: new Date("1988-02-20"),
    ccp: "0022334455",
    phone: "0550222222",
    wilaya: "Blida",
    address: "Cite 200 logements, Blida",
    monthlyIncome: 15000,
    employmentStatus: "UNEMPLOYED",
    incomeSources: ["NONE"],
    rentAmount: 0,
    maritalStatus: "MARRIED",
    childrenSchoolCount: 2,
    hasDisability: false,
    housingStatus: "OWNER",
    housingType: "HOUSE",
    svfScore: 58,
    priority: "VULNERABLE",
    notes: "Unemployed, no income sources, 2 school-age children.",
  },
  {
    firstName: "Yacine",
    lastName: "Toumi",
    dateOfBirth: new Date("1990-11-05"),
    ccp: "0033445566",
    phone: "0550333333",
    wilaya: "Alger",
    address: "Kouba, Alger",
    monthlyIncome: 32000,
    employmentStatus: "PART_TIME",
    incomeSources: ["SALARY"],
    rentAmount: 0,
    maritalStatus: "MARRIED",
    childrenSchoolCount: 1,
    hasDisability: false,
    housingStatus: "OWNER",
    housingType: "APARTMENT",
    svfScore: 34,
    priority: "MODERATE",
    notes: "Part-time salary, small household.",
  },
  {
    firstName: "Fatima",
    lastName: "Cherif",
    dateOfBirth: new Date("1955-01-30"),
    ccp: "0044556677",
    phone: "0550444444",
    wilaya: "Oran",
    address: "Es Senia, Oran",
    monthlyIncome: 20000,
    employmentStatus: "RETIRED",
    incomeSources: ["PENSION"],
    rentAmount: 0,
    maritalStatus: "WIDOWED",
    elderlyCount: 1,
    diseases: "Diabetes",
    hasDisability: false,
    housingStatus: "OWNER",
    housingType: "HOUSE",
    svfScore: 40,
    priority: "MODERATE",
    notes: "Elderly widow on pension, chronic illness.",
  },
];

async function main() {
  const mosque = await prisma.mosque.findFirst();
  if (!mosque) {
    throw new Error("No mosque found. Run `npx prisma db seed` first.");
  }
  const creatorId = mosque.imamId;

  for (const f of FAMILIES) {
    const family = await prisma.family.upsert({
      where: { ccp: f.ccp },
      update: {},
      create: { ...f, createdByMosqueId: mosque.id },
    });

    await prisma.mosqueFamily.upsert({
      where: { mosqueId_familyId: { mosqueId: mosque.id, familyId: family.id } },
      update: { isActive: true },
      create: {
        mosqueId: mosque.id,
        familyId: family.id,
        isActive: true,
        createdById: creatorId,
      },
    });
  }

  const count = await prisma.family.count();
  console.log(`Seeded ${FAMILIES.length} families. Total families now: ${count}.`);
  console.log(`Linked to mosque: ${mosque.name} (${mosque.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
