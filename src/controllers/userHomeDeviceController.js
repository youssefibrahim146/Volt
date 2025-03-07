import { PrismaClient } from "@prisma/client";
import { formatResponse, getPaginationParams } from "../utils.js";
const prisma = new PrismaClient();

async function addHomeDeviceToUser(req,res) {
    const  {homeDeviceId} = req.params;
    const {userId} = req.user;
    try {
        const homeDevice = await prisma.homeDevice.findUnique({
            where: {
                id: homeDeviceId,
            },
        });
        if (!homeDevice) {
            return res.status(404).json(formatResponse("Home device not found"));
        }
        const userHomeDevice = await prisma.userHomeDevice.create({
            data: {
                userId,
                homeDeviceId,
            },
        });
        return res.status(200).json(formatResponse("Home device added to user", userHomeDevice));
    }
    catch (error) {
        console.error(error);
        return res.status(500).json(formatResponse("Internal server error"));
    }
}  