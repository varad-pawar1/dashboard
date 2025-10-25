import express from "express";
import { protect } from "../middleware/protect.js";
import {
  getMe,
  chatUser,
  resetPassword,
  sendResetLink,
} from "../controllers/adminController.js";

const router = express.Router();

// Admin routes
router.get("/me", protect, getMe);
router.post("/send-reset-link", protect, sendResetLink);
router.post("/reset-password/:token", resetPassword);

// Chat history
router.get("/chats/:userId/:adminId", protect, chatUser);

export default router;
