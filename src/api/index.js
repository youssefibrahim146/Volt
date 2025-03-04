import { Router } from "express";
import { registerUser, loginUser, getUser, updateUser, deleteUser } from "../controllers/authenticationController.js";
const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/user", getUser);
router.put("/user", updateUser);
router.delete("/user", deleteUser);

export default router;