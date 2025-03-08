import { PrismaClient } from "@prisma/client";
import { formatResponse, getPaginationParams } from "../utils.js";
const prisma = new PrismaClient();

async function addHomeDeviceToUser(req,res) {
    const { homeDeviceId } = req.params;
    const { userId } = req.user;
    const { chosenVoltage } = req.body;  
    try {
        const systemDevice = await prisma.systemDevice.findUnique({
            where: { id: Number(homeDeviceId) },
        });
        if (!systemDevice) {
            return res.status(404).json(formatResponse("Device not found"));
        }
        if (!systemDevice.VoltagesAvailable.includes(chosenVoltage)) {
            return res.status(400).json(formatResponse("Invalid voltage choice"));
        }
        const userHomeDevice = await prisma.userHomeDevice.create({
            data: {
                userId,
                systemDeviceId: systemDevice.id,
                chosenVoltage
            },
        });
        return res.status(200)
                  .json(formatResponse("Home device added to user", userHomeDevice));
    }
    catch (error) {
        console.error(error);
        return res.status(500).json(formatResponse("Internal server error"));
    }
}