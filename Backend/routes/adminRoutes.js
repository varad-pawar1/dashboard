import express from "express";
import { protect } from "../middleware/protect.js";
import {
  getMe,
  chatUser,
  resetPassword,
  sendResetLink,
  updateMessage,
  deleteMessage,
  uploadFileMessage,
} from "../controllers/adminController.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Admin routes
router.get("/me", protect, getMe);
router.post("/send-reset-link", protect, sendResetLink);
router.post("/reset-password/:token", resetPassword);

// Chat history
router.get("/chats/:userId/:adminId", protect, chatUser);
router.put("/chats/:id", protect, updateMessage);
router.delete("/chats/:id", protect, deleteMessage);

router.post("/chats/upload", upload.single("file"), uploadFileMessage);

export default router;
