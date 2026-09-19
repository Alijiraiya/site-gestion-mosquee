-- AlterTable: declared household size becomes a real column.
-- The count INCLUDES the head of family, so the floor is 1 (head alone) and
-- 2 for a married head (head + spouse).
ALTER TABLE "Family" ADD COLUMN "membersCount" INTEGER NOT NULL DEFAULT 1;

-- Backfill 1/3: recover the size the imam originally typed. Before this
-- migration the intake form appended "Membres déclarés: N" to the notes text,
-- so that number is the only surviving record of the declared household size.
UPDATE "Family"
SET "membersCount" = GREATEST(
  1,
  (substring("notes" from 'Membres déclarés: ([0-9]+)'))::INTEGER
)
WHERE "notes" ~ 'Membres déclarés: [0-9]+';

-- Backfill 2/3: the head of family is now a real member row. Existing families
-- only ever stored the head on the Family record itself, so create the missing
-- HEAD rows from that data. md5() builds the TEXT id instead of
-- gen_random_uuid() so the migration needs no pgcrypto extension.
INSERT INTO "FamilyMember" (
  "id",
  "familyId",
  "firstName",
  "lastName",
  "dateOfBirth",
  "role",
  "hasDisability",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(f."id" || '-head'),
  f."id",
  f."firstName",
  f."lastName",
  f."dateOfBirth",
  'HEAD'::"FamilyMemberRole",
  f."hasDisability",
  NOW(),
  NOW()
FROM "Family" f
WHERE NOT EXISTS (
  SELECT 1
  FROM "FamilyMember" m
  WHERE m."familyId" = f."id" AND m."role" = 'HEAD'
);

-- Backfill 3/3: enforce the invariant everywhere. The declared size can never
-- be smaller than the married floor, nor smaller than the rows that exist.
UPDATE "Family" f
SET "membersCount" = GREATEST(
  f."membersCount",
  CASE WHEN f."maritalStatus" = 'MARRIED' THEN 2 ELSE 1 END,
  (
    SELECT COUNT(*)::INTEGER
    FROM "FamilyMember" m
    WHERE m."familyId" = f."id"
  )
);
