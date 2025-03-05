import { Router } from "express";
import { registerUser, loginUser, getUser, updateUser, deleteUser ,createAdmin ,loginAdmin  } from "../controllers/authenticationController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import isAdmin from "../middlewares/isAdmin.js";
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

router.get("/admin", isAuthenticated, isAdmin, (req, res) => {
    res.status(200).json({ message: "Welcome Admin" });
}
);

router.post("/admin/register", createAdmin);
router.post("/admin/login", loginAdmin);



export default router;