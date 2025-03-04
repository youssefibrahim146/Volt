import { Router } from "express";
import { registerUser, loginUser, getUser, updateUser, deleteUser } from "../controllers/authenticationController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/user", isAuthenticated,
    getUser);
router.put("/user",
    isAuthenticated,
    updateUser);
router.delete("/user",
    isAuthenticated,
    deleteUser);

export default router;