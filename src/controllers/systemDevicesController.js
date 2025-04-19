import { PrismaClient } from "@prisma/client";
import { formatResponse, getPaginationParams, safeTransaction } from "../utils.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const UPLOAD_DIR = path.join(process.cwd(), "uploads/images");

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure directory exists
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
});

// File filter to only allow image files
const fileFilter = (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedFileTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error("Only image files are allowed!"));
    }
};

// Initialize multer upload
export const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Helper functions
const handleServerError = (res, error, message = "Internal Server Error") => {
    console.error(`Error: ${message}`, error);
    return formatResponse(res, 500, message, null, false);
};

const cleanupFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (error) {
            console.error("Error deleting file:", error);
        }
    }
};

const parseWattsOptions = (wattsOptions) => {
    try {
        if (Array.isArray(wattsOptions)) {
            return wattsOptions.map(w => parseInt(w)).filter(w => !isNaN(w));
        } else if (wattsOptions) {
            const parsed = parseInt(wattsOptions);
            return !isNaN(parsed) ? [parsed] : [];
        }
        return [];
    } catch (error) {
        console.error("Error parsing wattsOptions:", error);
        return [];
    }
};

const getBooleanValue = (value) => {
    return value === true || value === "true";
};

async function getSystemDevices(req, res) {
    try {
        const { page, limit, skip } = getPaginationParams(req.query);
        
        const result = await safeTransaction(async (prisma) => {
            const [devices, totalCount] = await Promise.all([
                prisma.systemDevice.findMany({
                    skip,
                    take: limit,
                    orderBy: { id: 'desc' }
                }),
                prisma.systemDevice.count()
            ]);
            
            return { devices, totalCount };
        }, prisma);
        
        const totalPages = Math.ceil(result.totalCount / limit);
        
        return formatResponse(res, 200, "System devices retrieved successfully", {
            devices: result.devices,
            pagination: {
                page,
                limit,
                totalCount: result.totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        return handleServerError(res, error, "Error fetching system devices");
    }
}

async function getSystemDeviceById(req, res) {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(parseInt(id))) {
            return formatResponse(res, 400, "Invalid device ID", null, false);
        }
        
        const device = await safeTransaction(async (prisma) => {
            return await prisma.systemDevice.findUnique({
                where: { id: parseInt(id) },
                include: {
                    userHomeDevices: true,
                    userHomeDevice: true
                }
            });
        }, prisma);
        
        if (!device) {
            return formatResponse(res, 404, "System device not found", null, false);
        }
        
        return formatResponse(res, 200, "System device retrieved successfully", device);
    } catch (error) {
        return handleServerError(res, error, "Error fetching system device");
    }
}

async function createSystemDevice(req, res) {
    try {
        const { name, wattsOptions, deviceWorkAllDay } = req.body;
        
        // Validate required fields
        const missingFields = [];
        if (!name) missingFields.push('name');
        if (!wattsOptions) missingFields.push('wattsOptions');
        
        if (missingFields.length > 0) {
            if (req.file) {
                cleanupFile(req.file.path);
            }
            return formatResponse(
                res, 
                400, 
                `Missing required fields: ${missingFields.join(', ')}`, 
                null, 
                false
            );
        }
        
        const newDevice = await safeTransaction(async (prisma) => {
            // Check for duplicate device
            const existingDevice = await prisma.systemDevice.findFirst({
                where: { name }
            });
            
            if (existingDevice) {
                throw new Error("System device with this name already exists");
            }
            
            // Process image if uploaded
            let imgPath = null;
            if (req.file) {
                imgPath = `/uploads/images/${path.basename(req.file.path)}`;
            }
            
            // Parse watts options
            const wattsArray = parseWattsOptions(wattsOptions);
            
            // Create the device
            return await prisma.systemDevice.create({
                data: {
                    name,
                    img: imgPath,
                    wattsOptions: wattsArray,
                    deviceWorkAllDay: getBooleanValue(deviceWorkAllDay)
                }
            });
        }, prisma);
        
        return formatResponse(res, 201, "System device created successfully", newDevice);
    } catch (error) {
        if (req.file) {
            cleanupFile(req.file.path);
        }
        
        if (error.message === "System device with this name already exists") {
            return formatResponse(res, 400, error.message, null, false);
        }
        
        return handleServerError(res, error, "Error creating system device");
    }
}

async function updateSystemDevice(req, res) {
    try {
        const { id } = req.params;
        const { name, wattsOptions, deviceWorkAllDay } = req.body;
        
        if (!id || isNaN(parseInt(id))) {
            if (req.file) {
                cleanupFile(req.file.path);
            }
            return formatResponse(res, 400, "Invalid device ID", null, false);
        }
        
        const updatedDevice = await safeTransaction(async (prisma) => {
            const existingDevice = await prisma.systemDevice.findUnique({
                where: { id: parseInt(id) }
            });
            
            if (!existingDevice) {
                throw new Error("System device not found");
            }
            
            // Prepare the update data
            const updateData = {};
            
            if (name) updateData.name = name;
            
            if (wattsOptions) {
                updateData.wattsOptions = parseWattsOptions(wattsOptions);
            }
            
            if (deviceWorkAllDay !== undefined) {
                updateData.deviceWorkAllDay = getBooleanValue(deviceWorkAllDay);
            }

            // Handle image update
            if (req.file) {
                // Delete old image if it exists
                if (existingDevice.img && existingDevice.img.startsWith('/uploads/')) {
                    try {
                        const oldImagePath = path.join(process.cwd(), existingDevice.img);
                        cleanupFile(oldImagePath);
                    } catch (error) {
                        console.error("Error deleting old image:", error);
                    }
                }
                
                // Generate the new image URL
                updateData.img = `/uploads/images/${path.basename(req.file.path)}`;
            }
            
            // Update the device
            return await prisma.systemDevice.update({
                where: { id: parseInt(id) },
                data: updateData
            });
        }, prisma);
        
        return formatResponse(res, 200, "System device updated successfully", updatedDevice);
    } catch (error) {
        if (req.file) {
            cleanupFile(req.file.path);
        }
        
        if (error.message === "System device not found") {
            return formatResponse(res, 404, error.message, null, false);
        }
        
        return handleServerError(res, error, "Error updating system device");
    }
}

async function deleteSystemDevice(req, res) {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(parseInt(id))) {
            return formatResponse(res, 400, "Invalid device ID", null, false);
        }
        
        await safeTransaction(async (prisma) => {
            const existingDevice = await prisma.systemDevice.findUnique({
                where: { id: parseInt(id) }
            });
            
            if (!existingDevice) {
                throw new Error("System device not found");
            }
            
            // Check for linked devices
            const linkedDevicesCount = await prisma.userHomeDevice.count({
                where: { systemDeviceId: parseInt(id) }
            });
            
            if (linkedDevicesCount > 0) {
                throw new Error("Cannot delete device as it is linked to user home devices");
            }
            
            // Delete the image file if it exists
            if (existingDevice.img && existingDevice.img.startsWith('/uploads/')) {
                const imagePath = path.join(process.cwd(), existingDevice.img);
                cleanupFile(imagePath);
            }
            
            // Delete the device
            await prisma.systemDevice.delete({
                where: { id: parseInt(id) }
            });
        }, prisma);
        
        return formatResponse(res, 200, "System device deleted successfully");
    } catch (error) {
        if (error.message === "System device not found") {
            return formatResponse(res, 404, error.message, null, false);
        }
        if (error.message === "Cannot delete device as it is linked to user home devices") {
            return formatResponse(res, 409, error.message, null, false);
        }
        
        return handleServerError(res, error, "Error deleting system device");
    }
}

/**
 * Search system devices by name and other parameters
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function searchSystemDevices(req, res) {
    try {
        const { page, limit, skip } = getPaginationParams(req.query);
        const { name, minWatts, maxWatts, deviceWorkAllDay } = req.query;
        
        const result = await safeTransaction(async (prisma) => {
            // Build filter conditions
            const filterConditions = {};
            
            if (name) {
                filterConditions.name = {
                    contains: name,
                    mode: 'insensitive'
                };
            }
            
            // Handle watts range filtering
            if (minWatts || maxWatts) {
                filterConditions.wattsOptions = {
                    hasSome: []
                };
                
                // Get all devices to filter by watts range (since wattsOptions is an array)
                const allDevices = await prisma.systemDevice.findMany();
                
                // Filter devices by wattsOptions
                const filteredIds = allDevices
                    .filter(device => {
                        const hasValidWatts = device.wattsOptions.some(watts => {
                            if (minWatts && maxWatts) {
                                return watts >= parseInt(minWatts) && watts <= parseInt(maxWatts);
                            } else if (minWatts) {
                                return watts >= parseInt(minWatts);
                            } else if (maxWatts) {
                                return watts <= parseInt(maxWatts);
                            }
                            return true;
                        });
                        return hasValidWatts;
                    })
                    .map(device => device.id);
                
                // Update filter to include only these IDs
                if (filteredIds.length > 0) {
                    filterConditions.id = { in: filteredIds };
                } else {
                    return { devices: [], totalCount: 0 };
                }
                
                // Remove the wattsOptions condition as we've applied it manually
                delete filterConditions.wattsOptions;
            }
            
            // Handle deviceWorkAllDay filtering
            if (deviceWorkAllDay !== undefined) {
                filterConditions.deviceWorkAllDay = getBooleanValue(deviceWorkAllDay);
            }
            
            const [devices, totalCount] = await Promise.all([
                prisma.systemDevice.findMany({
                    where: filterConditions,
                    skip,
                    take: limit,
                    orderBy: { id: 'desc' }
                }),
                prisma.systemDevice.count({ where: filterConditions })
            ]);
            
            return { devices, totalCount };
        }, prisma);
        
        const totalPages = Math.ceil(result.totalCount / limit);
        
        return formatResponse(res, 200, "Search results retrieved successfully", {
            devices: result.devices,
            pagination: {
                page,
                limit,
                totalCount: result.totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        return handleServerError(res, error, "Error searching system devices");
    }
}

export { 
    getSystemDevices, 
    getSystemDeviceById, 
    createSystemDevice, 
    updateSystemDevice, 
    deleteSystemDevice,
    searchSystemDevices
};
