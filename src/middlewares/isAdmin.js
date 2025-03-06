import isAuthenticated from "./isAuthenticated.js";
import { verifyToken } from "../utils.js";
import { PrismaClient } from "@prisma/client";

async function isAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: "Access token missing" });
    }
    
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Invalid token format" });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
    
    req.user = decoded;

    const prisma = new PrismaClient();
    
    // Check if the ID from the token exists in the admin table
    const admin = await prisma.admin.findUnique({
        where: { id: req.user.id }
    });

    if (!admin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
    }

    next();
}

export default isAdmin;
