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
  createGroup,
  getOrCreateConversation,
} from "../controllers/adminController.js";
import { upload } from "../middleware/upload.js";
import { chatbot } from "../config/openai.js";
import { getSystemPrompt } from "../config/systemprompt.js";
import { createCourseWithAI } from "../controllers/CreatingAI.js";
const router = express.Router();

// Admin routes
router.get("/me", protect, getMe);
router.post("/send-reset-link", protect, sendResetLink);
router.post("/reset-password/:token", resetPassword);
router.post("/create-group", protect, createGroup);
// Chat history
router.get("/chats/:conversationId", protect, chatUser);
router.get("/conversation/:otherId", protect, getOrCreateConversation);
router.put("/chats/:id", protect, updateMessage);
router.delete("/chats/:id", protect, deleteMessage);

router.post("/chats/upload", upload.single("file"), uploadFileMessage);

router.post("/chatbot", chatbot);
router.post("/systemprompt", getSystemPrompt);

router.post("/CreatingAI", protect, createCourseWithAI);
export default router;
