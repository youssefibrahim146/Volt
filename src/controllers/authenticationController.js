import { Router } from "express";
const router = Router();
import { PrismaClient } from "@prisma/client";
import { hashPassword, comparePassword, generateToken, verifyToken } from "../utils/bcrypt.js";
const prisma = new PrismaClient();

async function registerUser(req, res) {
    const { userName, email, password, budget = 0, totalVoltage = 0, minBudget = 0 } = req.body;
    if (!userName || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
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
}

async function loginUser(req, res) {
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
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = generateToken(user);
    res.status(200).json({ user, token });
}

async function getUser(req, res) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await prisma.user.findUnique({
        where: {
            id: req.user.id,
        },
    });
    res.status(200).json(user);
}

async function updateUser(req, res) {
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
}

async function deleteUser(req, res) {
    await prisma.user.delete({
        where: {
            id: req.user.id,
        },
    });
    res.status(204).json();
}
