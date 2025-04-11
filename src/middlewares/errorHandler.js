import { formatResponse } from "../utils.js";
import { Prisma } from "@prisma/client";

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export default function errorHandler(err, req, res, next) {
  console.error(err.stack || err);

  // Handle Prisma-specific errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle unique constraint violations
    if (err.code === 'P2002') {
      return formatResponse(res, 409, `A record with this ${err.meta?.target || 'field'} already exists`, null, false);
    }
    
    // Handle not found errors
    if (err.code === 'P2001' || err.code === 'P2025') {
      return formatResponse(res, 404, "Resource not found", null, false);
    }
    
    // Handle other Prisma errors
    return formatResponse(res, 400, "Database error", null, false);
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return formatResponse(res, 400, err.message, null, false);
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return formatResponse(res, 401, "Invalid or expired token", null, false);
  }
  
  // Handle server errors with appropriate message but don't expose details
  return formatResponse(
    res, 
    err.statusCode || 500, 
    err.message || "Internal server error", 
    null,
    false
  );
} 