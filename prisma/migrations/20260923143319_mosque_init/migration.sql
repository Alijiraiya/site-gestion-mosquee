/*
  Warnings:

  - A unique constraint covering the columns `[name,wilaya,commune]` on the table `Mosque` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Mosque_name_wilaya_commune_key" ON "Mosque"("name", "wilaya", "commune");
