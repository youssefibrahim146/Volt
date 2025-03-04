import { verifyToken } from "../utils.js";

/**
 * Middleware to authenticate requests.
 * Extracts the token from the "Authorization" header (formatted as "Bearer <token>"),
 * verifies it, and attaches the decoded information to req.user.
 * @param {object} req Express request object.
 * @param {object} res Express response object.
 * @param {Function} next Callback to pass control to the next middleware.
 */
function isAuthenticated(req, res, next) {
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
    next();
}

export default isAuthenticated;
