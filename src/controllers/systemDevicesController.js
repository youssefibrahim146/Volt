import { PrismaClient } from "@prisma/client";
import { formatResponse, getPaginationParams } from "../utils.js";

const prisma = new PrismaClient();

async function getSystemDevices(req, res) {
    try {
        const { page, limit, skip } = getPaginationParams(req.query);
        
        const [devices, totalCount] = await Promise.all([
            prisma.systemDevice.findMany({
                skip,
                take: limit,
                orderBy: { 
                    createdAt: 'desc' 
                }
            }),
            prisma.systemDevice.count()
        ]);
        
        const totalPages = Math.ceil(totalCount / limit);
        
        return formatResponse(res, 200, "System devices retrieved successfully", {
            devices,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error("Error fetching system devices:", error);
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

// Export the controller function
export { getSystemDevices };
