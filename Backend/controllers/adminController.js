import User from "../models/User.js";
import dotenv from "dotenv";
import { sendResetLinkEmail } from "../utils/mailer.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import path from "path";
import axios from "axios";
import jwt from "jsonwebtoken";

dotenv.config();

export const getMe = async (req, res) => {
  try {
    // Logged-in user info
    const adminLogin = await User.findById(req.user.id).select("-password");

    // All users except the logged-in one
    const allAdmins = await User.find({ _id: { $ne: req.user.id } }).select(
      "-password"
    );

    // Fetch all conversations (both private & group) where user is a participant
    const conversations = await Conversation.find({
      participants: { $in: [req.user.id] },
    })
      .populate("participants", "name email avatar")
      .populate("createdBy", "name email")
      .populate("admins", "name email")
      .populate("lastMessage")
      .sort({ updatedAt: -1 }); // latest chats first

    // Optionally filter or map data before sending (if you want minimal info)
    const usersWithConversations = conversations.map((conv) => ({
      _id: conv._id,
      isGroup: conv.isGroup,
      groupName: conv.groupName || null,
      groupAvatar: conv.groupAvatar || null,
      participants: conv.participants,
      createdBy: conv.createdBy || null,
      admins: conv.admins || [],
      lastMessage: conv.lastMessage || null,
      updatedAt: conv.updatedAt,
      lastActive: conv.lastActive,
    }));

    // Find all group chats where the logged-in user is a participant
    const groups = await Conversation.find({
      isGroup: true,
      participants: req.user.id,
    })
      .populate("participants", "-password")
      .populate("createdBy", "name email")
      .populate("admins", "name email");

    // Send combined response
    res.json({
      adminLogin,
      allAdmins,
      usersWithConversations,
      groups,
    });
  } catch (err) {
    console.error("Error in getMe:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const chatUser = async (req, res) => {
  const { conversationId } = req.params;
  try {
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate("sender", "name email")
      .populate("readBy", "name email");

    if (!messages.length) {
      return res.status(200).json([]);
    }

    res.status(200).json(messages);
  } catch (err) {
    console.error("Error fetching chat messages:", err);
    res.status(500).json({ message: "Failed to fetch chat history" });
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
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Update lastMessage if the deleted message was the last one
    if (conversation.lastMessage?.toString() === id) {
      // Get the new last message
      const lastMessage = await Message.findOne({ conversationId })
        .sort({ createdAt: -1 })
        .select("_id");
      conversation.lastMessage = lastMessage ? lastMessage._id : null;
    }
    conversation.updatedAt = new Date();
    await conversation.save();

    // Return success (socket handler will handle live updates)
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

// Upload file/image/video message to Cloudinary
export const uploadFileMessage = async (req, res) => {
  try {
    const { sender, receiver, conversationId } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // Cloudinary gives URL directly in file.path
    const fileUrl = file.path;
    const fileType = detectFileType(file.originalname);

    let targetConversationId;
    if (conversationId) {
      const conv = await Conversation.findById(conversationId);
      if (!conv)
        return res.status(404).json({ message: "Conversation not found" });
      targetConversationId = conv._id;
    } else {
      const participants = [sender, receiver].sort();
      let conversation = await Conversation.findOne({ participants });
      if (!conversation) {
        conversation = new Conversation({ participants });
        await conversation.save();
      }
      targetConversationId = conversation._id;
    }

    // Create new message in Message collection
    const newMessage = new Message({
      conversationId: targetConversationId,
      sender,
      message: "", // empty string for file-only messages
      fileUrl,
      fileType,
      readBy: [],
    });

    await newMessage.save();

    // Update conversation's lastMessage and updatedAt
    await Conversation.findByIdAndUpdate(targetConversationId, {
      lastMessage: newMessage._id,
      updatedAt: new Date(),
    });

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

export const createGroup = async (req, res) => {
  try {
    const { name, members, createdBy } = req.body;
    const io = req.app.locals.io;

    if (!name || !members || members.length < 2) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid group data" });
    }

    // Create new group conversation
    const group = await Conversation.create({
      isGroup: true,
      groupName: name,
      participants: members,
      groupAvatar: "", // Can be set later
      createdBy,
      admins: [createdBy],
    });

    await group.populate("participants", "name email avatar");
    await group.populate("createdBy", "name email");
    await group.populate("admins", "name email");

    // Broadcast group creation to all participants in real-time
    if (io) {
      for (const participant of group.participants) {
        const pid = participant._id?.toString() || participant.toString();
        io.to(pid).emit("newGroupCreated", group);
        // console.log(`Broadcasting newGroupCreated to participant: ${pid}`);
      }
    }

    res.status(201).json({ success: true, group });
  } catch (error) {
    console.error("Group creation error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create group", error });
  }
};

export const getOrCreateConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherId } = req.params;
    const io = req.app.locals.io;
    if (!otherId) return res.status(400).json({ message: "otherId required" });

    const participants = [userId, otherId].sort();
    let isNew = false;
    let conversation = await Conversation.findOne({
      participants,
      isGroup: false,
    });
    if (!conversation) {
      conversation = await Conversation.create({
        participants,
        isGroup: false,
      });
      isNew = true;
    }
    await conversation.populate("participants", "name email avatar");

    // Broadcast conversation creation/found to both participants in real-time
    if (io && (isNew || !conversation.lastMessage)) {
      for (const participant of conversation.participants) {
        const pid = participant._id?.toString() || participant.toString();
        io.to(pid).emit("newConversationCreated", conversation);
      }
    }

    res.json({ conversation });
  } catch (err) {
    console.error("getOrCreateConversation error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// export const chatbot = async (req, res) => {
//   const { message } = req.body;
//   if (!message) {
//     return res.status(400).json({ error: "Message is required" });
//   }

//   try {
//     const response = await axios.post(
//       "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
//       {
//         contents: [
//           {
//             parts: [{ text: message }],
//           },
//         ],
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "x-goog-api-key": process.env.GEMINI_API_KEY,
//         },
//       }
//     );

//     const aiReply =
//       response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
//       "No response from AI.";

//     res.json({ userMessage: message, aiReply });
//   } catch (error) {
//     console.error("Gemini API Error:", error.response?.data || error.message);
//     res.status(500).json({ error: "Failed to get AI response" });
//   }
// };

// export const chatbot = async (req, res) => {
//   try {
//     const { message } = req.body;
//     if (!message) {
//       return res.status(400).json({ error: "Message is required" });
//     }
//   } catch (error) {}
// };
