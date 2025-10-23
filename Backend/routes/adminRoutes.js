import express from "express";
import { protect } from "../middleware/protect.js";
import {
  getMe,
  resetPassword,
  sendResetLink,
} from "../controllers/adminController.js";

const routerAdmin = express.Router();

routerAdmin.get("/me", protect, getMe);
routerAdmin.post("/send-reset-link", protect, sendResetLink);
routerAdmin.post("/reset-password/:token", resetPassword);

export default routerAdmin;
