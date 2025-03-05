import isAuthenticated from "./isAuthenticated.js";

function isAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Forbidden: Admins only." });
    }
    next();
}

export default isAdmin;
