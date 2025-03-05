-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "budget" INTEGER NOT NULL,
    "totalVoltage" INTEGER NOT NULL,
    "minBudget" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "systemDevice" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "img" TEXT NOT NULL,
    "VoltagesAvailable" INTEGER[],
    "deviceWorkAllDay" BOOLEAN NOT NULL,

    CONSTRAINT "systemDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "userHomeDevice" (
    "id" INTEGER NOT NULL,
    "userInputWorkTime" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "systemDeviceId" INTEGER NOT NULL,

    CONSTRAINT "userHomeDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "userHomeDevices" (
    "id" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "systemDeviceId" INTEGER NOT NULL,

    CONSTRAINT "userHomeDevices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_email_key" ON "admin"("email");

-- AddForeignKey
ALTER TABLE "userHomeDevice" ADD CONSTRAINT "userHomeDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userHomeDevice" ADD CONSTRAINT "userHomeDevice_systemDeviceId_fkey" FOREIGN KEY ("systemDeviceId") REFERENCES "systemDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userHomeDevices" ADD CONSTRAINT "userHomeDevices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userHomeDevices" ADD CONSTRAINT "userHomeDevices_systemDeviceId_fkey" FOREIGN KEY ("systemDeviceId") REFERENCES "systemDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
