import { PrismaClient } from "@prisma/client";
import { hashPassword, comparePassword, generateToken, verifyToken, formatResponse } from "../utils.js";
const prisma = new PrismaClient();

/**
 * Registers a new user.
 * Validates required fields, hashes the password, creates the user using Prisma, and generates a JWT token.
 * @param {object} req Express request object.
 * @param {object} res Express response object.
 */
async function registerUser(req, res) {
    try {
        const { userName, email, password, budget = 0, totalWattage = 0, minBudget = 0 } = req.body;
        console.log("registerUser");
        console.log(req.body);
        
        if (!userName || !email || !password) {
            return formatResponse(res, 400, "All fields are required email, password, userName", null, false);
        }
        
        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                userName,
                email,
                password: hashedPassword,
                budget,
                totalWattage,
                minBudget
            },
        });
        
        const token = generateToken(user);
        return formatResponse(res, 201, "User registered successfully", { user, token });
    } catch (error) {
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

/**
 * Logs in an existing user.
 * Validates credentials, verifies password using Prisma query, and returns a JWT token on success.
 * @param {object} req Express request object.
 * @param {object} res Express response object.
 */
async function loginUser(req, res) {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return formatResponse(res, 400, "All fields are required", null, false);
        }
        
        const user = await prisma.user.findUnique({
            where: {
                email,
            },
        });
        
        if (!user) {
            return formatResponse(res, 401, "Invalid credentials", null, false);
        }
        
        const isPasswordMatch = await comparePassword(password, user.password);
        
        if (!isPasswordMatch) {
            return formatResponse(res, 401, "Invalid credentials", null, false);
        }
        
        const token = generateToken(user);
        return formatResponse(res, 200, "Login successful", { user, token });
    } catch (error) {
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

/**
 * Retrieves details of the authenticated user.
 * @param {object} req Express request object (should include user from token verification).
 * @param {object} res Express response object.
 */
async function getUser(req, res) {
    try {
        if (!req.user) {
            return formatResponse(res, 401, "Unauthorized", null, false);
        }
        
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
        });
        
        return formatResponse(res, 200, "User details retrieved successfully", user);
    } catch (error) {
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

/**
 * Updates the authenticated user's details.
 * Only updates fields provided in the request body, and securely hashes the password if updated.
 * @param {object} req Express request object.
 * @param {object} res Express response object.
 */
async function updateUser(req, res) {
    try {
        const { userName, email, password, budget, totalWattage, minBudget } = req.body;
        
        const updateData = {
            ...(userName && { userName }),
            ...(email && { email }),
            ...(password && { password: await hashPassword(password) }),
            ...(budget !== undefined && { budget }),
            ...(totalWattage !== undefined && { totalWattage }),
            ...(minBudget !== undefined && { minBudget })
        };
        
        const user = await prisma.user.update({
            where: {
                id: req.user.id,
            },
            data: updateData
        });
        
        return formatResponse(res, 200, "User updated successfully", user);
    } catch (error) {
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

/**
 * Deletes the authenticated user.
 * @param {object} req Express request object.
 * @param {object} res Express response object.
 */
async function deleteUser(req, res) {
    try {
        await prisma.user.delete({
            where: {
                id: req.user.id,
            },
        });
        
        return formatResponse(res, 204, "User deleted successfully");
    } catch (error) {
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

async function createAdmin(req, res) {
    try {
        if (!req.body.email || !req.body.password) {
            return formatResponse(res, 400, "All fields are required", null, false);
        }
        
        const hashedPassword = await hashPassword(req.body.password);
        
        const existingAdmin = await prisma.admin.findUnique({
            where: { email: req.body.email }
        });
        
        if (existingAdmin) {
            return formatResponse(res, 400, "Admin already exists", null, false);
        }
        
        const user = await prisma.admin.create({
            data: {
                email: req.body.email,
                password: hashedPassword
            }
        });
        
        return formatResponse(res, 201, "Admin created successfully", user);
    } catch (error) {
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

async function loginAdmin(req, res) {
    try {
        if (!req.body.email || !req.body.password) {
            return formatResponse(res, 400, "All fields are required", null, false);
        }
        
        const admin = await prisma.admin.findUnique({
            where: { email: req.body.email }
        });
        
        if (!admin) {
            return formatResponse(res, 401, "Invalid credentials", null, false);
        }
        
        const isPasswordMatch = await comparePassword(req.body.password, admin.password);
        
        if (!isPasswordMatch) {
            return formatResponse(res, 401, "Invalid credentials", null, false);
        }
        
        const token = generateToken(admin);
        return formatResponse(res, 200, "Admin login successful", { token });
    } catch (error) {
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

/**
 * Updates only the budget of the authenticated user.
 * @param {object} req Express request object.
 * @param {object} res Express response object.
 */
async function updateUserBudget(req, res) {
    try {
        const { budget } = req.body;
        
        if (budget === undefined) {
            return formatResponse(res, 400, "Budget is required", null, false);
        }
        
        const user = await prisma.user.update({
            where: {
                id: req.user.id,
            },
            data: { budget }
        });
        
        return formatResponse(res, 200, "Budget updated successfully", user);
    } catch (error) {
        return formatResponse(res, 500, "Internal Server Error", null, false);
    }
}

export { registerUser, loginUser, getUser, updateUser, deleteUser, createAdmin, loginAdmin, updateUserBudget };