import { Router } from "express";
import {
  registerUser,
  loginUser,
  getUser,
  updateUser,
  deleteUser,
  createAdmin,
  loginAdmin,
  updateUserBudget,
} from "../controllers/authenticationController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import isAdmin from "../middlewares/isAdmin.js";
import errorHandler from "../middlewares/errorHandler.js";
import {
  getSystemDevices,
  getSystemDeviceById,
  createSystemDevice,
  updateSystemDevice,
  deleteSystemDevice,
  upload,
} from "../controllers/systemDevicesController.js";
import {
  addHomeDeviceToUser,
  getUserHomeDevices,
  getUserHomeDeviceById,
  updateUserHomeDevice,
  deleteUserHomeDevice,
  calculateUserDevicesCost,
  getRecommendedDevices,
} from "../controllers/userHomeDeviceController.js";

import {
  getAIDeviceRecommendations,
  getDeviceSpecificTips,
} from "../controllers/aiRecommendationController.js";
const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/user", isAuthenticated, getUser);
router.put("/user", isAuthenticated, updateUser);
router.delete("/user", isAuthenticated, deleteUser);
router.put("/users/budget", isAuthenticated, updateUserBudget);

router.get("/admin", isAuthenticated, isAdmin, (req, res) => {
  res.status(200).json({ message: "Welcome Admin" });
});

router.post("/admin/register", createAdmin);
router.post("/admin/login", loginAdmin);

router.get("/system-devices", getSystemDevices);
router.get("/system-devices/:id", getSystemDeviceById);
router.post(
  "/system-devices",
  isAuthenticated,
  isAdmin,
  upload.single("img"),
  createSystemDevice
);
router.put(
  "/system-devices/:id",
  isAuthenticated,
  isAdmin,
  upload.single("img"),
  updateSystemDevice
);
router.delete(
  "/system-devices/:id",
  isAuthenticated,
  isAdmin,
  deleteSystemDevice
);

router.post(
  "/home-devices/:homeDeviceId",
  isAuthenticated,
  addHomeDeviceToUser
);
router.get("/home-devices", isAuthenticated, getUserHomeDevices);
router.get("/home-devices/:id", isAuthenticated, getUserHomeDeviceById);
router.put("/home-devices/:id", isAuthenticated, updateUserHomeDevice);
router.delete("/home-devices/:id", isAuthenticated, deleteUserHomeDevice);
router.get(
  "/home-devices/calculate-cost",
  isAuthenticated,
  calculateUserDevicesCost
);
router.get(
  "/home-devices/recommendations",
  isAuthenticated,
  getRecommendedDevices
);
router.get("/ai/recommendations", isAuthenticated, getAIDeviceRecommendations);
router.get("/ai/tips/:deviceId", isAuthenticated, getDeviceSpecificTips);

router.use(errorHandler);

export default router;
