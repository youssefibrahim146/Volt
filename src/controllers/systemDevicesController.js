import { PrismaClient } from "@prisma/client";
import { formatResponse, getPaginationParams } from "../utils.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(process.cwd(), "uploads/images");
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
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
        const { name, VoltagesAvailable, deviceWorkAllDay } = req.body;
        
        const missingFields = [];
        if (!name) missingFields.push('name');
        if (!req.file) missingFields.push('image file');
        if (!VoltagesAvailable) missingFields.push('VoltagesAvailable');
        
        if (missingFields.length > 0) {
            // If there's an uploaded file but other fields are missing, delete the file
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return formatResponse(
                res, 
                400, 
                `Missing required fields: ${missingFields.join(', ')}`, 
                null, 
                false
            );
        }
        
        // Using findFirst instead of findUnique since name is not a unique field in the schema
        const existingDevice = await prisma.systemDevice.findFirst({
            where: { name }
        });
        if (existingDevice) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return formatResponse(res, 400, "System device already exists", null, false);
        }
        
        // Generate the image URL
        const imgPath = `/uploads/images/${path.basename(req.file.path)}`;
        
        const newDevice = await prisma.systemDevice.create({
            data: {
                name,
                img: imgPath,
                VoltagesAvailable: Array.isArray(VoltagesAvailable) ? VoltagesAvailable : [parseInt(VoltagesAvailable)],
                deviceWorkAllDay: deviceWorkAllDay === true || deviceWorkAllDay === "true"
            }
        });
        
        return formatResponse(res, 201, "System device created successfully", newDevice);
    } catch (error) {
        console.error("Error creating system device:", error);
        // If an error occurred and a file was uploaded, delete it
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

async function updateSystemDevice(req, res) {
    try {
        const { id } = req.params;
        const { name, VoltagesAvailable, deviceWorkAllDay } = req.body;
        
        const existingDevice = await prisma.systemDevice.findUnique({
            where: { id: parseInt(id) }
        });
        
        if (!existingDevice) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return formatResponse(res, 404, "System device not found", null, false);
        }
        
        // Prepare the update data
        const updateData = {
            ...(name && { name }),
            ...(VoltagesAvailable && { 
                VoltagesAvailable: Array.isArray(VoltagesAvailable) 
                    ? VoltagesAvailable.map(v => parseInt(v))
                    : [parseInt(VoltagesAvailable)] 
            }),
            ...(deviceWorkAllDay !== undefined && { 
                deviceWorkAllDay: deviceWorkAllDay === true || deviceWorkAllDay === "true" 
            })
        };

        // If there's a new image file, update the img field and delete the old file
        if (req.file) {
            // Delete old image if it exists and is not a URL
            if (existingDevice.img && existingDevice.img.startsWith('/uploads/')) {
                try {
                    const oldImagePath = path.join(process.cwd(), existingDevice.img);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                } catch (error) {
                    console.error("Error deleting old image:", error);
                }
            }
            
            // Generate the new image URL
            const imgPath = `/uploads/images/${path.basename(req.file.path)}`;
            updateData.img = imgPath;
        }
        
        const updatedDevice = await prisma.systemDevice.update({
            where: { id: parseInt(id) },
            data: updateData
        });
        
        return formatResponse(res, 200, "System device updated successfully", updatedDevice);
    } catch (error) {
        console.error("Error updating system device:", error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
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
        
        // Delete the image file if it exists and is not a URL
        if (existingDevice.img && existingDevice.img.startsWith('/uploads/')) {
            try {
                const imagePath = path.join(process.cwd(), existingDevice.img);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            } catch (error) {
                console.error("Error deleting image:", error);
            }
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
