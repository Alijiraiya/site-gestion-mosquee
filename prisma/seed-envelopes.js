import "dotenv/config";
import { PrismaClient } from "../src/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(
  { connectionString: process.env.DATABASE_URL },
  { schema: "public" }
);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding budget envelopes...");

  // Find first active mosque and its imam/user
  const mosque = await prisma.mosque.findFirst({
    include: { imam: true },
  });

  if (!mosque) {
    console.error("No mosque found in the database. Please run prisma db seed first.");
    process.exit(1);
  }

  const userId = mosque.imamId;
  const mosqueId = mosque.id;

  const currentYear = new Date().getFullYear();

  const sampleEnvelopes = [
    {
      name: "Factures Électricité, Gaz & Eau (Sonelgaz)",
      category: "UTILITIES",
      periodType: "ANNUAL",
      allocatedAmount: 180000,
      spentAmount: 152000, // ~84.4% -> WARNING (threshold 80%)
      alertThreshold: 80,
      startDate: new Date(`${currentYear}-01-01T00:00:00Z`),
      endDate: new Date(`${currentYear}-12-31T23:59:59Z`),
      status: "ACTIVE",
      description: "Prise en charge des factures trimestrielles d'électricité, de chauffage et d'eau de la grande mosquée.",
      color: "#3b82f6",
    },
    {
      name: "Maintenance Sanitaires & Climatisation",
      category: "MAINTENANCE",
      periodType: "ANNUAL",
      allocatedAmount: 250000,
      spentAmount: 115000, // 46% -> HEALTHY
      alertThreshold: 80,
      startDate: new Date(`${currentYear}-01-01T00:00:00Z`),
      endDate: new Date(`${currentYear}-12-31T23:59:59Z`),
      status: "ACTIVE",
      description: "Travaux de réfection des robinetteries d'ablution, filtres et révision des climatiseurs.",
      color: "#f59e0b",
    },
    {
      name: "Rémunération Personnel d'Entretien & Gardiennage",
      category: "SALARIES",
      periodType: "ANNUAL",
      allocatedAmount: 480000,
      spentAmount: 360000, // 75% -> HEALTHY
      alertThreshold: 80,
      startDate: new Date(`${currentYear}-01-01T00:00:00Z`),
      endDate: new Date(`${currentYear}-12-31T23:59:59Z`),
      status: "ACTIVE",
      description: "Indemnités mensuelles accordées à l'équipe de nettoyage et aux agents d'accueil.",
      color: "#10b981",
    },
    {
      name: "Iftar Ramadan & Événements Religieux 2026",
      category: "EVENTS",
      periodType: "CUSTOM",
      allocatedAmount: 300000,
      spentAmount: 305000, // >100% -> EXHAUSTED
      alertThreshold: 90,
      startDate: new Date(`${currentYear}-02-15T00:00:00Z`),
      endDate: new Date(`${currentYear}-04-15T23:59:59Z`),
      status: "EXHAUSTED",
      description: "Achats pour la table d'Iftar collective, repas aux jeûneurs de passage et célébration de Laylat Al-Qadr.",
      color: "#8b5cf6",
    },
    {
      name: "Fonds d'Urgence Sociale & Secours Médical",
      category: "SOCIAL",
      periodType: "ANNUAL",
      allocatedAmount: 200000,
      spentAmount: 45000, // 22.5% -> HEALTHY
      alertThreshold: 75,
      startDate: new Date(`${currentYear}-01-01T00:00:00Z`),
      endDate: new Date(`${currentYear}-12-31T23:59:59Z`),
      status: "ACTIVE",
      description: "Aide ponctuelle d'urgence pour ordonnances urgentes et familles en détresse immédiate.",
      color: "#ec4899",
    },
    {
      name: "Fournitures de Bureau & Produits d'Hygiène",
      category: "SUPPLIES",
      periodType: "QUARTERLY",
      allocatedAmount: 60000,
      spentAmount: 18500, // 30.8% -> HEALTHY
      alertThreshold: 80,
      startDate: new Date(`${currentYear}-01-01T00:00:00Z`),
      endDate: new Date(`${currentYear}-03-31T23:59:59Z`),
      status: "ACTIVE",
      description: "Savons, désinfectants, papier hygiénique, rames de papier et cartouches d'imprimante.",
      color: "#06b6d4",
    },
    {
      name: "Rénovation Moquette & Sonorisation (Clôturé)",
      category: "MAINTENANCE",
      periodType: "CUSTOM",
      allocatedAmount: 150000,
      spentAmount: 150000, // 100% -> CLOSED
      alertThreshold: 80,
      startDate: new Date(`${currentYear - 1}-06-01T00:00:00Z`),
      endDate: new Date(`${currentYear - 1}-12-31T23:59:59Z`),
      status: "CLOSED",
      description: "Chantier d'installation de microphones sans fil et remplacement de la moquette de la salle de prière.",
      color: "#6b7280",
    },
  ];

  for (const env of sampleEnvelopes) {
    const existing = await prisma.budgetEnvelope.findFirst({
      where: {
        mosqueId,
        name: env.name,
      },
    });

    if (existing) {
      await prisma.budgetEnvelope.update({
        where: { id: existing.id },
        data: {
          ...env,
        },
      });
      console.log(`Updated envelope: ${env.name}`);
    } else {
      await prisma.budgetEnvelope.create({
        data: {
          ...env,
          mosqueId,
          createdById: userId,
        },
      });
      console.log(`Created envelope: ${env.name}`);
    }
  }

  console.log("Seeding envelopes complete!");
}

main()
  .catch((e) => {
    console.error("Error seeding envelopes:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
