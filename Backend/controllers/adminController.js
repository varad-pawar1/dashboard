import User from "../models/User.js";
import dotenv from "dotenv";
import { sendResetLinkEmail } from "../utils/mailer.js";
import Conversation from "../models/Conversation.js";
import path from "path";

import jwt from "jsonwebtoken";
dotenv.config();

// Get logged-in admin and all other admins
export const getMe = async (req, res) => {
  try {
    const adminLogin = await User.findById(req.user.id).select("-password");
    const allAdmins = await User.find({ _id: { $ne: req.user.id } }).select(
      "-password"
    );

    res.json({ adminLogin, allAdmins });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch conversation messages between user and admin
export const chatUser = async (req, res) => {
  const { userId, adminId } = req.params;
  try {
    const conversation = await Conversation.findOne({
      participants: { $all: [userId, adminId] },
    }).populate("messages.sender", "name email");

    if (!conversation) return res.json([]);
    res.json(conversation.messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const saveMessage = async ({ sender, receiver, message }) => {
  try {
    // Sort IDs to ensure one conversation per pair
    const participants = [sender, receiver].sort();

    // Try to find existing conversation
    let conversation = await Conversation.findOne({ participants });

    if (!conversation) {
      // If no conversation exists, create one
      conversation = new Conversation({
        participants,
        messages: [{ sender, message }],
      });
    } else {
      // Add new message to existing conversation
      conversation.messages.push({ sender, message });
    }

    conversation.updatedAt = new Date(); // update timestamp
    await conversation.save();

    // Return the newly added message
    return conversation.messages[conversation.messages.length - 1];
  } catch (err) {
    console.error("saveMessage Error:", err);
    throw err;
  }
};

// Update a message inside a conversation
export const updateMessage = async (req, res) => {
  const { id } = req.params; // message ID
  const { message } = req.body;

  try {
    // 1️⃣ Find conversation that contains this message
    const conversation = await Conversation.findOne({ "messages._id": id });
    if (!conversation)
      return res.status(404).json({ message: "Message not found" });

    // 2️⃣ Find the message in the conversation
    const msgIndex = conversation.messages.findIndex(
      (m) => m._id.toString() === id
    );
    if (msgIndex === -1)
      return res.status(404).json({ message: "Message not found" });

    // 3️⃣ Update message text & timestamp
    conversation.messages[msgIndex].message = message;
    conversation.messages[msgIndex].timestamp = new Date();

    // 4️⃣ Save conversation
    await conversation.save();

    // 5️⃣ Return updated message
    res.json(conversation.messages[msgIndex]);
  } catch (err) {
    console.error("UpdateMessage Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a message inside a conversation
export const deleteMessage = async (req, res) => {
  const { id } = req.params; // message ID

  try {
    // 1️⃣ Find conversation containing this message
    const conversation = await Conversation.findOne({ "messages._id": id });
    if (!conversation)
      return res.status(404).json({ message: "Message not found" });

    // 2️⃣ Filter out the message
    conversation.messages = conversation.messages.filter(
      (m) => m._id.toString() !== id
    );

    // 3️⃣ Save conversation
    await conversation.save();

    // 4️⃣ Return success
    res.json({ message: "Message deleted", id });
  } catch (err) {
    console.error("DeleteMessage Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// detect file type by extension
const detectFileType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
  if ([".mp4", ".mov", ".avi", ".mkv"].includes(ext)) return "video";
  if ([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt"].includes(ext))
    return "document";
  return "other";
};

// 📤 Upload file/image/video message to Cloudinary
export const uploadFileMessage = async (req, res) => {
  try {
    const { sender, receiver } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // Cloudinary gives URL directly in file.path
    const fileUrl = file.path;
    const fileType = detectFileType(file.originalname);

    const participants = [sender, receiver].sort();

    let conversation = await Conversation.findOne({ participants });

    // Message only for file upload (no text message)
    const newMessage = {
      sender,
      message: "", // keep empty so schema remains valid
      fileUrl,
      fileType,
      timestamp: new Date(),
    };

    if (!conversation) {
      conversation = new Conversation({
        participants,
        messages: [newMessage],
      });
    } else {
      conversation.messages.push(newMessage);
      conversation.updatedAt = new Date();
    }

    await conversation.save();

    const savedMsg = conversation.messages[conversation.messages.length - 1];
    res.status(200).json(savedMsg);
  } catch (error) {
    console.error("uploadFileMessage Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Send reset link
export const sendResetLink = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Create JWT token with user id and expiration
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_RESET_SECRET,
      { expiresIn: "10m" }
    );

    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendResetLinkEmail(user.email, resetUrl);

    res.json({ message: "Reset link sent to your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.resetToken || user.resetToken !== token)
      return res.status(400).json({ message: "Invalid token" });

    if (user.resetTokenExpiry < new Date())
      return res.status(400).json({ message: "Token has expired" });

    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(400).json({ message: "Token has expired" });
    }
    res.status(400).json({ message: "Invalid token" });
  }
};
