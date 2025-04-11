import { PrismaClient } from "@prisma/client";
import { formatResponse, getPaginationParams, calculateDeviceCost, safeParseNumber, safeTransaction, validateRequiredParams } from "../utils.js";
const prisma = new PrismaClient();

/**
 * Add a home device to a user
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
async function addHomeDeviceToUser(req, res, next) {
    try {
        const { homeDeviceId } = req.params;
        const userId = req.user.id;
        const { chosenWatts, userInputWorkTime } = req.body;
        
        // Validate required parameters
        validateRequiredParams({ homeDeviceId, chosenWatts }, ['homeDeviceId', 'chosenWatts']);
        
        const deviceId = safeParseNumber(homeDeviceId);
        const watts = safeParseNumber(chosenWatts);
        
        if (deviceId <= 0 || watts <= 0) {
            const error = new Error("Invalid homeDeviceId or chosenWatts");
            error.statusCode = 400;
            throw error;
        }
        
        const systemDevice = await prisma.systemDevice.findUnique({
            where: { id: deviceId },
        });
        
        if (!systemDevice) {
            const error = new Error("Device not found");
            error.statusCode = 404;
            throw error;
        }
        
        if (!systemDevice.wattsOptions.includes(watts)) {
            const error = new Error("Invalid wattage choice");
            error.statusCode = 400;
            throw error;
        }
        
        const actualWorkTime = systemDevice.deviceWorkAllDay ? 24 : safeParseNumber(userInputWorkTime, 0);
        
        const result = await safeTransaction(async () => {
            const userHomeDevice = await prisma.userHomeDevice.create({
                data: {
                    userId,
                    systemDeviceId: deviceId,
                    chosenWatts: watts,
                    userInputWorkTime: actualWorkTime
                },
            });
            
            if (systemDevice.deviceWorkAllDay) {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        minBudget: { increment: calculateDeviceCost(watts, 24) },
                        totalWattage: { increment: watts }
                    }
                });
            }
            
            return userHomeDevice;
        }, prisma);
        
        return formatResponse(res, 201, "Home device added to user", result);
    } catch (error) {
        next(error);
    }
}

/**
 * Get all home devices for a user
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
async function getUserHomeDevices(req, res, next) {
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
        next(error);
    }
}

/**
 * Get a specific user home device by ID
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
async function getUserHomeDeviceById(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const deviceId = safeParseNumber(id);
        
        if (deviceId <= 0) {
            const error = new Error("Invalid device ID");
            error.statusCode = 400;
            throw error;
        }
        
        const device = await prisma.userHomeDevice.findFirst({
            where: { 
                id: deviceId,
                userId
            },
            include: {
                systemDevice: true
            }
        });
        
        if (!device) {
            const error = new Error("Device not found");
            error.statusCode = 404;
            throw error;
        }
        
        return formatResponse(res, 200, "User home device retrieved successfully", device);
    } catch (error) {
        next(error);
    }
}

/**
 * Update a user home device
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
async function updateUserHomeDevice(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { chosenWatts, userInputWorkTime } = req.body;
        const deviceId = safeParseNumber(id);
        
        if (deviceId <= 0) {
            const error = new Error("Invalid device ID");
            error.statusCode = 400;
            throw error;
        }
        
        // First check if the device exists and belongs to the user
        const existingDevice = await prisma.userHomeDevice.findFirst({
            where: {
                id: deviceId,
                userId
            },
            include: {
                systemDevice: true
            }
        });
        
        if (!existingDevice) {
            const error = new Error("Device not found");
            error.statusCode = 404;
            throw error;
        }
        
        const watts = chosenWatts !== undefined ? safeParseNumber(chosenWatts) : undefined;
        
        if (watts !== undefined && !existingDevice.systemDevice.wattsOptions.includes(watts)) {
            const error = new Error("Invalid wattage choice");
            error.statusCode = 400;
            throw error;
        }
        
        const updateData = {};
        
        if (watts !== undefined) {
            updateData.chosenWatts = watts;
        }
        
        // Only allow updating work time if the device doesn't work all day
        if (!existingDevice.systemDevice.deviceWorkAllDay && userInputWorkTime !== undefined) {
            updateData.userInputWorkTime = safeParseNumber(userInputWorkTime);
        }
        
        // Use transaction to ensure data consistency
        const result = await safeTransaction(async () => {
            const updatedDevice = await prisma.userHomeDevice.update({
                where: { id: deviceId },
                data: updateData,
                include: {
                    systemDevice: true
                }
            });
            
            if (existingDevice.systemDevice.deviceWorkAllDay && 
                watts !== undefined && 
                existingDevice.chosenWatts !== watts) {
                
                const wattsDifference = watts - existingDevice.chosenWatts;
                const costDifference = calculateDeviceCost(watts, 24) - 
                                      calculateDeviceCost(existingDevice.chosenWatts, 24);
                
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        minBudget: { increment: costDifference },
                        totalWattage: { increment: wattsDifference }
                    }
                });
            }
            
            return updatedDevice;
        }, prisma);
        
        return formatResponse(res, 200, "User home device updated successfully", result);
    } catch (error) {
        next(error);
    }
}

/**
 * Delete a user home device
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
async function deleteUserHomeDevice(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const deviceId = safeParseNumber(id);
        
        if (deviceId <= 0) {
            const error = new Error("Invalid device ID");
            error.statusCode = 400;
            throw error;
        }
        
        const existingDevice = await prisma.userHomeDevice.findFirst({
            where: {
                id: deviceId,
                userId
            },
            include: {
                systemDevice: true
            }
        });
        
        if (!existingDevice) {
            const error = new Error("Device not found");
            error.statusCode = 404;
            throw error;
        }
        
        // Use transaction to ensure data consistency
        await safeTransaction(async () => {
            await prisma.userHomeDevice.delete({
                where: { id: deviceId }
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
        }, prisma);
        
        return formatResponse(res, 200, "User home device deleted successfully");
    } catch (error) {
        next(error);
    }
}

/**
 * Calculate estimated costs for a user's devices
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
async function calculateUserDevicesCost(req, res, next) {
    try {
        const userId = req.user.id;
        const costPerKWh = safeParseNumber(req.query.costPerKWh, 0.68);
        
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
            const cost = calculateDeviceCost(watts, hours, costPerKWh);
            
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
        next(error);
    }
}

/**
 * Get recommended devices for a user based on their budget
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
async function getRecommendedDevices(req, res, next) {
    try {
        const userId = req.user.id;
        
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        
        if (!user) {
            const error = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }
        
        const allDevices = await prisma.systemDevice.findMany();
        
        // Filter devices that fit within remaining budget
        const remainingBudget = safeParseNumber(user.budget, 0) - safeParseNumber(user.minBudget, 0);
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
        next(error);
    }
}

/**
 * Search user home devices by device name and other filters
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
async function searchUserHomeDevices(req, res, next) {
    try {
        const userId = req.user.id;
        const { page, limit, skip } = getPaginationParams(req.query);
        const { deviceName, minWatts, maxWatts } = req.query;
        
        // Build filter conditions
        let whereCondition = { userId };
        
        // Create a complex query to filter based on system device properties
        if (deviceName) {
            whereCondition.systemDevice = {
                name: {
                    contains: deviceName,
                    mode: 'insensitive'
                }
            };
        }
        
        // First get all user's devices to filter by watts
        let userDevices = await prisma.userHomeDevice.findMany({
            where: whereCondition,
            include: {
                systemDevice: true
            }
        });
        
        // Filter by watts range if specified
        if (minWatts || maxWatts) {
            userDevices = userDevices.filter(device => {
                const watts = device.chosenWatts;
                if (minWatts && maxWatts) {
                    return watts >= parseInt(minWatts) && watts <= parseInt(maxWatts);
                } else if (minWatts) {
                    return watts >= parseInt(minWatts);
                } else if (maxWatts) {
                    return watts <= parseInt(maxWatts);
                }
                return true;
            });
        }
        
        // Apply pagination manually
        const totalCount = userDevices.length;
        const totalPages = Math.ceil(totalCount / limit);
        const paginatedDevices = userDevices.slice(skip, skip + limit);
        
        return formatResponse(res, 200, "Search results retrieved successfully", {
            devices: paginatedDevices,
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
        next(error);
    }
}

export {
    addHomeDeviceToUser,
    getUserHomeDevices,
    getUserHomeDeviceById,
    updateUserHomeDevice,
    deleteUserHomeDevice,
    calculateUserDevicesCost,
    getRecommendedDevices,
    searchUserHomeDevices
};