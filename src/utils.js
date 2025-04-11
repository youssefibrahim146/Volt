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

/**
 * Calculates the cost of running a device based on its power consumption, usage time, and cost per kilowatt-hour.
 *
 * @param {number} watts - The power consumption of the device in watts.
 * @param {number} hours - The number of hours the device is used.
 * @param {number} [costPerKWh=0.68] - The cost per kilowatt-hour. Default is 0.68.
 * @returns {number} The total cost of running the device.
 */
export const calculateDeviceCost = (watts, hours, costPerKWh = 0.68) => {
    const kWh = (watts * hours) / 1000;
    return kWh * costPerKWh;
}

/**
 * Safely parse a number from input, returning default value if parsing fails
 * @param {any} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} Parsed number or default value
 */
export const safeParseNumber = (value, defaultValue = 0) => {
    if (value === null || value === undefined) return defaultValue;
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safely execute a database transaction with proper error handling
 * @param {Function} fn - Async function to execute within transaction
 * @param {PrismaClient} prisma - Prisma client instance
 * @returns {Promise<any>} Result of the transaction
 */
export const safeTransaction = async (fn, prisma) => {
    try {
        return await prisma.$transaction(fn);
    } catch (error) {
        console.error('Transaction error:', error);
        throw error;
    }
}

/**
 * Validate that required parameters are present
 * @param {Object} params - Parameters to validate
 * @param {Array<string>} required - Required parameter names
 * @throws {Error} If any required parameter is missing
 */
export const validateRequiredParams = (params, required) => {
    const missing = required.filter(param => 
        params[param] === undefined || params[param] === null || params[param] === ''
    );
    
    if (missing.length > 0) {
        const error = new Error(`Missing required parameters: ${missing.join(', ')}`);
        error.statusCode = 400;
        error.name = 'ValidationError';
        throw error;
    }
}