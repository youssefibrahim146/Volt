/*
  Warnings:

  - You are about to drop the column `totalVoltage` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `VoltagesAvailable` on the `systemDevice` table. All the data in the column will be lost.
  - You are about to drop the column `chosenVoltage` on the `userHomeDevice` table. All the data in the column will be lost.
  - Added the required column `totalWattage` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "totalVoltage",
ADD COLUMN     "totalWattage" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "systemDevice" DROP COLUMN "VoltagesAvailable",
ADD COLUMN     "wattsOptions" INTEGER[];

-- AlterTable
ALTER TABLE "userHomeDevice" DROP COLUMN "chosenVoltage",
ADD COLUMN     "chosenWatts" INTEGER;
