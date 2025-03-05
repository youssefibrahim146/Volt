import { Router } from "express";
import { registerUser, loginUser, getUser, updateUser, deleteUser, createAdmin, loginAdmin } from "../controllers/authenticationController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import isAdmin from "../middlewares/isAdmin.js";
import {
    getSystemDevices,
    getSystemDeviceById,
    createSystemDevice,
    updateSystemDevice,
    deleteSystemDevice
} from "../controllers/systemDevicesController.js";
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

router.get("/system-devices", getSystemDevices);
router.get("/system-devices/:id", getSystemDeviceById);
router.post("/system-devices" , isAdmin, createSystemDevice);
router.put("/system-devices/:id" , isAdmin, updateSystemDevice);
router.delete("/system-devices/:id" , isAdmin, deleteSystemDevice);


export default router;