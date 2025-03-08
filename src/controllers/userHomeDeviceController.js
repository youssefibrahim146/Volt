import { PrismaClient } from "@prisma/client";
import { formatResponse, getPaginationParams } from "../utils.js";
const prisma = new PrismaClient();
import { calculateDeviceCost } from "../utils.js";

/**
 * Add a home device to a user
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function addHomeDeviceToUser(req, res) {
    const { homeDeviceId } = req.params;
    const userId = req.user.id;
    const { chosenWatts, userInputWorkTime } = req.body;
    
    try {
        const systemDevice = await prisma.systemDevice.findUnique({
            where: { id: Number(homeDeviceId) },
        });
        
        if (!systemDevice) {
            return formatResponse(res, 404, "Device not found", null, false);
        }
        
        if (!systemDevice.wattsOptions.includes(Number(chosenWatts))) {
            return formatResponse(res, 400, "Invalid wattage choice", null, false);
        }
        
        const actualWorkTime = systemDevice.deviceWorkAllDay ? 24 : userInputWorkTime || 0;
        
        const userHomeDevice = await prisma.userHomeDevice.create({
            data: {
                userId,
                systemDeviceId: Number(homeDeviceId),
                chosenWatts: Number(chosenWatts),
                userInputWorkTime: actualWorkTime
            },
        });
        
        if (!userHomeDevice) {
            return formatResponse(res, 400, "Failed to add device to user", null, false);
        }
        
        if (systemDevice.deviceWorkAllDay) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    minBudget: { increment: calculateDeviceCost(chosenWatts, 24) },
                    totalWattage: { increment: Number(chosenWatts) }
                }
            });
        }
        
        return formatResponse(res, 201, "Home device added to user", userHomeDevice);
    } catch (error) {
        console.error(error);
        return formatResponse(res, 500, "Internal server error", null, false);
    }
}

/**
 * Get all home devices for a user
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function getUserHomeDevices(req, res) {
    try {
        const userId = req.user.id;
        const { page, limit, skip } = getPaginationParams(req.query);
        
        const [devices, totalCount] = await Promise.all([
            prisma.userHomeDevice.findMany({
                where: { userId },
                skip,
                take: limit,
                include: {
                    systemDevice: true
                },
                orderBy: { id: 'desc' }
            }),
            prisma.userHomeDevice.count({ where: { userId } })
        ]);
        
        const totalPages = Math.ceil(totalCount / limit);
        
        return formatResponse(res, 200, "User home devices retrieved successfully", {
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
        console.error(error);
        return formatResponse(res, 500, "Internal server error", null, false);
    }
}

/**
 * Get a specific user home device by ID
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function getUserHomeDeviceById(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        
        const device = await prisma.userHomeDevice.findUnique({
            where: { 
                id: Number(id),
                userId
            },
            include: {
                systemDevice: true
            }
        });
        
        if (!device) {
            return formatResponse(res, 404, "Device not found", null, false);
        }
        
        return formatResponse(res, 200, "User home device retrieved successfully", device);
    } catch (error) {
        console.error(error);
        return formatResponse(res, 500, "Internal server error", null, false);
    }
}

/**
 * Update a user home device
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function updateUserHomeDevice(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { chosenWatts, userInputWorkTime } = req.body;
        
        // First check if the device exists and belongs to the user
        const existingDevice = await prisma.userHomeDevice.findFirst({
            where: {
                id: Number(id),
                userId
            },
            include: {
                systemDevice: true
            }
        });
        
        if (!existingDevice) {
            return formatResponse(res, 404, "Device not found", null, false);
        }
        
        if (chosenWatts && !existingDevice.systemDevice.wattsOptions.includes(Number(chosenWatts))) {
            return formatResponse(res, 400, "Invalid wattage choice", null, false);
        }
        
        const updateData = {};
        
        if (chosenWatts !== undefined) {
            updateData.chosenWatts = Number(chosenWatts);
        }
        
        // Only allow updating work time if the device doesn't work all day
        if (!existingDevice.systemDevice.deviceWorkAllDay && userInputWorkTime !== undefined) {
            updateData.userInputWorkTime = Number(userInputWorkTime);
        }
        
        // Update the device
        const updatedDevice = await prisma.userHomeDevice.update({
            where: { id: Number(id) },
            data: updateData,
            include: {
                systemDevice: true
            }
        });
        
        if (existingDevice.systemDevice.deviceWorkAllDay && 
            chosenWatts && 
            existingDevice.chosenWatts !== Number(chosenWatts)) {
            
            const wattsDifference = Number(chosenWatts) - existingDevice.chosenWatts;
            const costDifference = calculateDeviceCost(chosenWatts, 24) - 
                                  calculateDeviceCost(existingDevice.chosenWatts, 24);
            
            await prisma.user.update({
                where: { id: userId },
                data: {
                    minBudget: { increment: costDifference },
                    totalWattage: { increment: wattsDifference }
                }
            });
        }
        
        return formatResponse(res, 200, "User home device updated successfully", updatedDevice);
    } catch (error) {
        console.error(error);
        return formatResponse(res, 500, "Internal server error", null, false);
    }
}

/**
 * Delete a user home device
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function deleteUserHomeDevice(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        
        const existingDevice = await prisma.userHomeDevice.findFirst({
            where: {
                id: Number(id),
                userId
            },
            include: {
                systemDevice: true
            }
        });
        
        if (!existingDevice) {
            return formatResponse(res, 404, "Device not found", null, false);
        }
        
        await prisma.userHomeDevice.delete({
            where: { id: Number(id) }
        });
        
        // If it was an all-day device, update user's total wattage and min budget
        if (existingDevice.systemDevice.deviceWorkAllDay && existingDevice.chosenWatts) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    minBudget: { 
                        decrement: calculateDeviceCost(existingDevice.chosenWatts, 24) 
                    },
                    totalWattage: { 
                        decrement: existingDevice.chosenWatts 
                    }
                }
            });
        }
        
        return formatResponse(res, 200, "User home device deleted successfully");
    } catch (error) {
        console.error(error);
        return formatResponse(res, 500, "Internal server error", null, false);
    }
}

/**
 * Calculate estimated costs for a user's devices
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function calculateUserDevicesCost(req, res) {
    try {
        const userId = req.user.id;
        const { costPerKWh = 0.68 } = req.query;
        
        const userDevices = await prisma.userHomeDevice.findMany({
            where: { userId },
            include: {
                systemDevice: true
            }
        });
        
        let totalCost = 0;
        let totalWattage = 0;
        const devicesCost = userDevices.map(device => {
            const watts = device.chosenWatts || 0;
            const hours = device.systemDevice.deviceWorkAllDay ? 24 : device.userInputWorkTime || 0;
            const cost = calculateDeviceCost(watts, hours, Number(costPerKWh));
            
            totalCost += cost;
            totalWattage += watts;
            
            return {
                id: device.id,
                deviceName: device.systemDevice.name,
                watts,
                hours,
                dailyCost: cost,
                monthlyCost: cost * 30
            };
        });
        
        return formatResponse(res, 200, "Device costs calculated successfully", {
            devices: devicesCost,
            summary: {
                totalDailyCost: totalCost,
                totalMonthlyCost: totalCost * 30,
                totalWattage
            }
        });
    } catch (error) {
        console.error(error);
        return formatResponse(res, 500, "Internal server error", null, false);
    }
}

/**
 * Get recommended devices for a user based on their budget
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function getRecommendedDevices(req, res) {
    try {
        const userId = req.user.id;
        
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        
        if (!user) {
            return formatResponse(res, 404, "User not found", null, false);
        }
        
        const allDevices = await prisma.systemDevice.findMany();
        
        // Filter devices that fit within remaining budget
        const remainingBudget = user.budget - user.minBudget;
        const recommendedDevices = allDevices.filter(device => {
            // Find the lowest wattage option that fits the budget
            const affordableWattOptions = device.wattsOptions.filter(watts => {
                const dailyCost = calculateDeviceCost(watts, device.deviceWorkAllDay ? 24 : 8);
                return dailyCost * 30 <= remainingBudget;
            });
            
            return affordableWattOptions.length > 0;
        });
        
        return formatResponse(res, 200, "Recommended devices retrieved successfully", {
            recommendedDevices,
            budget: {
                total: user.budget,
                used: user.minBudget,
                remaining: remainingBudget
            }
        });
    } catch (error) {
        console.error(error);
        return formatResponse(res, 500, "Internal server error", null, false);
    }
}

export {
    addHomeDeviceToUser,
    getUserHomeDevices,
    getUserHomeDeviceById,
    updateUserHomeDevice,
    deleteUserHomeDevice,
    calculateUserDevicesCost,
    getRecommendedDevices
};