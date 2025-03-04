import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}
export const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
}
export const generateToken = (user) => {
    return jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
}
export const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
}
