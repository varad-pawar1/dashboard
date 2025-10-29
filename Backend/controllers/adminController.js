import User from "../models/User.js";
import dotenv from "dotenv";
import { sendResetLinkEmail } from "../utils/mailer.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
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
    });

    if (!conversation) return res.json([]);

    // Fetch messages for this conversation
    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .populate("sender", "name email")
      .populate("readBy", "name email");

    res.json(messages);
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
      });
      await conversation.save();
    }

    // Create new message in Message collection
    const newMessage = new Message({
      conversationId: conversation._id,
      sender,
      message,
      readBy: [],
    });

    await newMessage.save();

    // Update conversation's lastMessage and updatedAt
    conversation.lastMessage = newMessage._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    // Populate sender before returning
    await newMessage.populate("sender", "name email");

    // Return the newly added message
    return newMessage;
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
    // Find and update the message
    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      { message },
      { new: true }
    )
      .populate("sender", "name email")
      .populate("readBy", "name email");

    if (!updatedMessage)
      return res.status(404).json({ message: "Message not found" });

    // Update conversation's updatedAt
    await Conversation.findByIdAndUpdate(updatedMessage.conversationId, {
      updatedAt: new Date(),
    });

    // Return updated message
    res.json(updatedMessage);
  } catch (err) {
    console.error("UpdateMessage Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a message inside a conversation
export const deleteMessage = async (req, res) => {
  const { id } = req.params; // message ID

  try {
    // Find the message to get conversationId
    const messageToDelete = await Message.findById(id);
    if (!messageToDelete)
      return res.status(404).json({ message: "Message not found" });

    const conversationId = messageToDelete.conversationId;

    // Delete the message
    await Message.findByIdAndDelete(id);

    // Update conversation's updatedAt and lastMessage if needed
    const conversation = await Conversation.findById(conversationId);
    if (conversation && conversation.lastMessage?.toString() === id) {
      // Get the new last message
      const lastMessage = await Message.findOne({ conversationId })
        .sort({ createdAt: -1 })
        .select("_id");
      conversation.lastMessage = lastMessage ? lastMessage._id : null;
    }
    conversation.updatedAt = new Date();
    await conversation.save();

    // Return success
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

    if (!conversation) {
      conversation = new Conversation({
        participants,
      });
      await conversation.save();
    }

    // Create new message in Message collection
    const newMessage = new Message({
      conversationId: conversation._id,
      sender,
      message: "", // empty string for file-only messages
      fileUrl,
      fileType,
      readBy: [],
    });

    await newMessage.save();

    // Update conversation's lastMessage and updatedAt
    conversation.lastMessage = newMessage._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    // Populate sender before returning
    await newMessage.populate("sender", "name email");

    res.status(200).json(newMessage);
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
