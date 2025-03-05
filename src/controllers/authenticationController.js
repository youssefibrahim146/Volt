import { PrismaClient } from "@prisma/client";
import { hashPassword, comparePassword, generateToken, verifyToken } from "../utils.js";
const prisma = new PrismaClient();

/**
 * Registers a new user.
 * Validates required fields, hashes the password, creates the user using Prisma, and generates a JWT token.
 * @param {object} req Express request object.
 * @param {object} res Express response object.
 */
async function registerUser(req, res) {
    try {
        const { userName, email, password, budget = 0, totalVoltage = 0, minBudget = 0 } = req.body;
        console.log("registerUser");
        console.log(req.body);
        if (!userName || !email || !password) {
            return res.status(400).json({ message: "All fields are required email, password, userName" });
        }
        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                userName,
                email,
                password: hashedPassword,
                budget,
                totalVoltage,
                minBudget
            },
        });
        const token = generateToken(user);
        res.status(201).json({ user, token });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
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
            return res.status(400).json({ message: "All fields are required" });
        }
        const user = await prisma.user.findUnique({
            where: {
                email,
            },
        });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const isPasswordMatch = await comparePassword(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const token = generateToken(user);
        res.status(200).json({ user, token });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
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
            return res.status(401).json({ message: "Unauthorized" });
        }
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
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
        const { userName, email, password, budget, totalVoltage, minBudget } = req.body;
        const updateData = {
            ...(userName && { userName }),
            ...(email && { email }),
            ...(password && { password: await hashPassword(password) }),
            ...(budget !== undefined && { budget }),
            ...(totalVoltage !== undefined && { totalVoltage }),
            ...(minBudget !== undefined && { minBudget })
        };
        const user = await prisma.user.update({
            where: {
                id: req.user.id,
            },
            data: updateData
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
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
        res.status(204).json();
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function createAdmin(req, res) {
    try {
        if (!req.body.email || !req.body.password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        const hashedPassword = await hashPassword(req.body.password);
        const existingAdmin = await prisma.admin.findUnique({
            where: { email: req.body.email }
        });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin already exists" });
        }
        const user = await prisma.admin.create({
            data: {
                email: req.body.email,
                password: hashedPassword
            }
        });
        return res.status(201).json({ message: "Admin created" });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function loginAdmin(req, res) {
    try {
        if (!req.body.email || !req.body.password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        const admin = await prisma.admin.findUnique({
            where: { email: req.body.email }
        });
        if (!admin) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const isPasswordMatch = await comparePassword(req.body.password, admin.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const token = generateToken(admin);
        res.status(200).json({ token });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
}


export { registerUser, loginUser, getUser, updateUser, deleteUser  , createAdmin , loginAdmin};