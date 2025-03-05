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

/**
 * Standardized API response formatter
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Response message
 * @param {Object|Array|null} data - Response data
 * @param {Boolean} success - Whether the request was successful
 * @returns {Object} Formatted response
 */
export const formatResponse = (res, statusCode, message, data = null, success = true) => {
    return res.status(statusCode).json({
        status: success ? 'success' : 'error',
        message,
        data
    });
}

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Express request query object
 * @returns {Object} Pagination parameters
 */
export const getPaginationParams = (query) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;
    
    return {
        page,
        limit,
        skip
    };
}
