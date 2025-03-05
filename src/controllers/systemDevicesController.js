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
                    id: 'desc'
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

async function getSystemDeviceById(req, res) {
    try {
        const { id } = req.params;
        
        const device = await prisma.systemDevice.findUnique({
            where: { id: parseInt(id) },
            include: {
                userHomeDevices: true,
                userHomeDevice: true
            }
        });
        
        if (!device) {
            return formatResponse(res, 404, "System device not found", null, false);
        }
        
        return formatResponse(res, 200, "System device retrieved successfully", device);
    } catch (error) {
        console.error("Error fetching system device:", error);
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

async function createSystemDevice(req, res) {
    try {
        const { id, name, img, VoltagesAvailable, deviceWorkAllDay } = req.body;
        
        if (!id || !name || !img || !VoltagesAvailable) {
            return formatResponse(res, 400, "Missing required fields", null, false);
        }
        
        const existingDevice = await prisma.systemDevice.findUnique({
            where: { id: parseInt(id) }
        });
        
        if (existingDevice) {
            return formatResponse(res, 409, "Device with this ID already exists", null, false);
        }
        
        const newDevice = await prisma.systemDevice.create({
            data: {
                id: parseInt(id),
                name,
                img,
                VoltagesAvailable: Array.isArray(VoltagesAvailable) ? VoltagesAvailable : [VoltagesAvailable],
                deviceWorkAllDay: deviceWorkAllDay === true || deviceWorkAllDay === "true"
            }
        });
        
        return formatResponse(res, 201, "System device created successfully", newDevice);
    } catch (error) {
        console.error("Error creating system device:", error);
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

async function updateSystemDevice(req, res) {
    try {
        const { id } = req.params;
        const { name, img, VoltagesAvailable, deviceWorkAllDay } = req.body;
        
        const existingDevice = await prisma.systemDevice.findUnique({
            where: { id: parseInt(id) }
        });
        
        if (!existingDevice) {
            return formatResponse(res, 404, "System device not found", null, false);
        }
        
        const updatedDevice = await prisma.systemDevice.update({
            where: { id: parseInt(id) },
            data: {
                ...(name && { name }),
                ...(img && { img }),
                ...(VoltagesAvailable && { 
                    VoltagesAvailable: Array.isArray(VoltagesAvailable) 
                        ? VoltagesAvailable 
                        : [VoltagesAvailable] 
                }),
                ...(deviceWorkAllDay !== undefined && { 
                    deviceWorkAllDay: deviceWorkAllDay === true || deviceWorkAllDay === "true" 
                })
            }
        });
        
        return formatResponse(res, 200, "System device updated successfully", updatedDevice);
    } catch (error) {
        console.error("Error updating system device:", error);
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

async function deleteSystemDevice(req, res) {
    try {
        const { id } = req.params;
        
        const existingDevice = await prisma.systemDevice.findUnique({
            where: { id: parseInt(id) }
        });
        
        if (!existingDevice) {
            return formatResponse(res, 404, "System device not found", null, false);
        }
        
        const linkedDevices = await prisma.userHomeDevice.findMany({
            where: { systemDeviceId: parseInt(id) }
        });
        
        if (linkedDevices.length > 0) {
            return formatResponse(
                res, 
                400, 
                "Cannot delete device as it is linked to user home devices", 
                null, 
                false
            );
        }
        
        await prisma.systemDevice.delete({
            where: { id: parseInt(id) }
        });
        
        return formatResponse(res, 200, "System device deleted successfully");
    } catch (error) {
        console.error("Error deleting system device:", error);
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

export { 
    getSystemDevices, 
    getSystemDeviceById, 
    createSystemDevice, 
    updateSystemDevice, 
    deleteSystemDevice 
};
