/*
  Warnings:

  - You are about to drop the `userHomeDevices` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "userHomeDevices" DROP CONSTRAINT "userHomeDevices_systemDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "userHomeDevices" DROP CONSTRAINT "userHomeDevices_userId_fkey";

-- AlterTable
CREATE SEQUENCE userhomedevice_id_seq;
ALTER TABLE "userHomeDevice" ALTER COLUMN "id" SET DEFAULT nextval('userhomedevice_id_seq');
ALTER SEQUENCE userhomedevice_id_seq OWNED BY "userHomeDevice"."id";

-- DropTable
DROP TABLE "userHomeDevices";
