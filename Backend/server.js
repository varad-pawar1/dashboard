import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import routerAdmin from "./routes/adminRoutes.js";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import { saveMessage } from "./controllers/adminController.js";
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";

dotenv.config();
const app = express();
connectDB();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);
app.use("/admin", routerAdmin);

app.get("/", (req, res) => res.json({ message: "Server is running " }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
});

// Helper to get deterministic room ID
const getRoomId = (user1, user2) => [user1, user2].sort().join("-");

io.on("connection", (socket) => {
  // console.log(" Client connected:", socket.id);

  socket.on("joinUser", async (userId) => {
    socket.userId = userId;
    socket.join(userId);

    try {
      const conversations = await Conversation.find({ participants: userId });

      const unreadCounts = {};
      const lastMessages = {};

      for (const conv of conversations) {
        const unreadMsgs = await Message.countDocuments({
          conversationId: conv._id,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        });
        unreadCounts[conv._id.toString()] = unreadMsgs;

        if (conv.lastMessage) {
          const lastMsg = await Message.findById(conv.lastMessage)
            .populate("sender", "name email")
            .select("message sender createdAt fileUrl fileType");
          if (lastMsg) {
            lastMessages[conv._id.toString()] = {
              text: lastMsg.fileUrl
                ? lastMsg.fileType === "image"
                  ? "📷 Image"
                  : lastMsg.fileType === "video"
                  ? "🎥 Video"
                  : "📎 File"
                : lastMsg.message,
              sender: lastMsg.sender._id || lastMsg.sender,
              timestamp: lastMsg.createdAt,
            };
          }
        }
      }

      //  Send both unread counts and last messages to user (keyed by conversationId)
      socket.emit("initChatData", { unreadCounts, lastMessages });
    } catch (err) {
      console.error("Error fetching initial chat data:", err);
    }
  });

  // Join chat room by conversation or legacy room id
  socket.on("joinRoom", (payload) => {
    if (!payload) return;
    if (typeof payload === "string") {
      socket.join(payload);
      return;
    }
    const { conversationId } = payload;
    if (conversationId) {
      socket.join(`conv-${conversationId}`);
    }
  });

  // Legacy private send by user ids (kept for compatibility)
  socket.on("sendMessage", async (data) => {
    try {
      const { sender, receiver, message, _skipSave, fileUrl, fileType } = data;

      let savedMsg;

      // If _skipSave flag exists, it means the message is already saved
      // Just broadcast it without saving again
      if (_skipSave) {
        savedMsg = data; // Use the data as-is (already from DB)
      } else {
        // Normal text message flow - save to database
        savedMsg = await saveMessage({ sender, receiver, message });
      }

      const roomId = getRoomId(sender, receiver);

      // Make sure both sender & receiver are in the same room
      socket.join(roomId);

      // Send message to BOTH users in that room
      io.to(roomId).emit("receiveMessage", savedMsg);

      // Increase unread count for receiver only
      if (sender !== receiver) {
        io.to(receiver).emit("incrementUnread", { sender });
      }

      // Determine last message text for sidebar
      const lastMessageText = savedMsg.fileUrl
        ? savedMsg.fileType === "image"
          ? "📷 Image"
          : savedMsg.fileType === "video"
          ? "🎥 Video"
          : "📎 File"
        : savedMsg.message || message;

      // Update sidebar of both users with the new last message
      io.to(sender).emit("updateLastMessage", {
        otherUserId: receiver,
        lastMessage: {
          text: lastMessageText,
          sender,
          timestamp: savedMsg.createdAt || new Date(),
        },
      });

      io.to(receiver).emit("updateLastMessage", {
        otherUserId: sender,
        lastMessage: {
          text: lastMessageText,
          sender,
          timestamp: savedMsg.createdAt || new Date(),
        },
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });

  // New: send message by conversationId
  socket.on("sendMessageByConversation", async (data) => {
    try {
      const { conversationId, sender, message, _skipSave, fileUrl, fileType } = data;
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      let savedMsg;
      if (_skipSave) {
        savedMsg = data;
      } else {
        savedMsg = await new Message({
          conversationId,
          sender,
          message,
          fileUrl: fileUrl || undefined,
          fileType: fileUrl ? fileType : undefined,
          readBy: [],
        }).save();
      }

      // Update last message pointer
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: savedMsg._id,
        updatedAt: new Date(),
      });

      // Emit to conversation room
      io.to(`conv-${conversationId}`).emit("receiveMessage", savedMsg);

      // Unread increment for all except sender
      for (const participant of conversation.participants) {
        const pid = participant.toString();
        if (pid === String(sender)) continue;
        io.to(pid).emit("updateConvUnread", {
          conversationId: conversationId.toString(),
          delta: 1,
        });
      }

      // Last message preview
      const lastMessageText = savedMsg.fileUrl
        ? savedMsg.fileType === "image"
          ? "📷 Image"
          : savedMsg.fileType === "video"
          ? "🎥 Video"
          : "📎 File"
        : savedMsg.message || message;

      for (const participant of conversation.participants) {
        io.to(participant.toString()).emit("updateConvLastMessage", {
          conversationId: conversationId.toString(),
          lastMessage: {
            text: lastMessageText,
            sender,
            timestamp: savedMsg.createdAt || new Date(),
          },
        });
      }
    } catch (err) {
      console.error("sendMessageByConversation error:", err);
    }
  });

  // Legacy private update by user ids
  socket.on("updateMessage", async (data) => {
    try {
      const { _id, message, sender, receiver } = data;

      const updatedMessage = await Message.findByIdAndUpdate(
        _id,
        { message },
        { new: true }
      ).populate("sender", "name email");

      if (!updatedMessage) return;

      // Update conversation's updatedAt
      await Conversation.findByIdAndUpdate(updatedMessage.conversationId, {
        updatedAt: new Date(),
      });

      const roomId = getRoomId(sender, receiver);
      io.to(roomId).emit("updateMessage", updatedMessage);

      io.to(sender).emit("updateLastMessage", {
        otherUserId: receiver,
        lastMessage: {
          text: message,
          sender,
          timestamp: updatedMessage.createdAt,
        },
      });

      io.to(receiver).emit("updateLastMessage", {
        otherUserId: sender,
        lastMessage: {
          text: message,
          sender,
          timestamp: updatedMessage.createdAt,
        },
      });
    } catch (err) {
      console.error("Error updating message:", err);
    }
  });

  // New: update message by conversationId
  socket.on("updateMessageByConversation", async (data) => {
    try {
      const { conversationId, _id, message } = data;
      const updatedMessage = await Message.findByIdAndUpdate(
        _id,
        { message },
        { new: true }
      ).populate("sender", "name email");
      if (!updatedMessage) return;

      await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
      io.to(`conv-${conversationId}`).emit("updateMessage", updatedMessage);

      const conv = await Conversation.findById(conversationId);
      if (!conv) return;
      for (const participant of conv.participants) {
        io.to(participant.toString()).emit("updateConvLastMessage", {
          conversationId: conversationId.toString(),
          lastMessage: {
            text: message,
            sender: updatedMessage.sender._id || updatedMessage.sender,
            timestamp: updatedMessage.createdAt,
          },
        });
      }
    } catch (err) {
      console.error("updateMessageByConversation error:", err);
    }
  });

  // Legacy private delete by user ids
  socket.on("notifyDelete", async (data) => {
    try {
      const { _id, sender, receiver } = data;
      const roomId = getRoomId(sender, receiver);

      // Find the conversation first (message might already be deleted from API call)
      const conversation = await Conversation.findOne({
        participants: { $all: [sender, receiver] },
      });

      if (!conversation) {
        console.error("Conversation not found for delete notification");
        return;
      }

      const conversationId = conversation._id;

      // Check if message still exists (might be deleted by API already)
      const deletedMsg = await Message.findById(_id);

      // If message exists, delete it (might not exist if already deleted by API)
      if (
        deletedMsg &&
        deletedMsg.conversationId.toString() === conversationId.toString()
      ) {
        await Message.findByIdAndDelete(_id);
      }

      // Always emit delete event to chat room (for UI update)
      io.to(roomId).emit("deleteMessage", _id);

      // Also emit to individual users to ensure they receive it
      io.to(sender).emit("deleteMessage", _id);
      io.to(receiver).emit("deleteMessage", _id);

      // Update conversation's lastMessage if needed
      if (conversation.lastMessage?.toString() === _id) {
        const lastMsg = await Message.findOne({ conversationId })
          .sort({ createdAt: -1 })
          .select("_id");
        conversation.lastMessage = lastMsg ? lastMsg._id : null;
      }
      conversation.updatedAt = new Date();
      await conversation.save();

      // Recalculate unread counts for both participants
      const unreadCounts = {};
      for (const participant of conversation.participants) {
        const unreadMsgs = await Message.countDocuments({
          conversationId: conversation._id,
          sender: { $ne: participant.toString() },
          readBy: { $ne: participant.toString() },
        });
        unreadCounts[participant.toString()] = unreadMsgs;
      }

      //Send updated unread count to each participant
      for (const participant of conversation.participants) {
        const otherUser = conversation.participants.find(
          (p) => p.toString() !== participant.toString()
        );

        io.to(participant.toString()).emit("updateUnreadCount", {
          otherUserId: otherUser.toString(),
          count: unreadCounts[participant.toString()],
        });
      }

      // Update last message for both users (always update, even if not changed)
      const lastMsg = await Message.findOne({ conversationId })
        .sort({ createdAt: -1 })
        .populate("sender", "name email")
        .select("message sender createdAt fileUrl fileType");

      const lastMessageData = lastMsg
        ? {
            text: lastMsg.fileUrl
              ? lastMsg.fileType === "image"
                ? "📷 Image"
                : lastMsg.fileType === "video"
                ? "🎥 Video"
                : "📎 File"
              : lastMsg.message,
            sender: lastMsg.sender._id || lastMsg.sender,
            timestamp: lastMsg.createdAt,
          }
        : null;

      // Emit to both users to update their sidebars
      io.to(sender).emit("updateLastMessage", {
        otherUserId: receiver,
        lastMessage: lastMessageData,
      });

      io.to(receiver).emit("updateLastMessage", {
        otherUserId: sender,
        lastMessage: lastMessageData,
      });
    } catch (err) {
      console.error("notifyDelete error:", err);
    }
  });

  // New: delete by conversationId
  socket.on("notifyDeleteByConversation", async (data) => {
    try {
      const { conversationId, _id } = data;
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      const deletedMsg = await Message.findById(_id);
      if (deletedMsg && deletedMsg.conversationId.toString() === conversationId.toString()) {
        await Message.findByIdAndDelete(_id);
      }

      io.to(`conv-${conversationId}`).emit("deleteMessage", _id);

      // Update lastMessage if needed
      if (conversation.lastMessage?.toString() === String(_id)) {
        const lastMsg = await Message.findOne({ conversationId })
          .sort({ createdAt: -1 })
          .select("_id");
        conversation.lastMessage = lastMsg ? lastMsg._id : null;
      }
      conversation.updatedAt = new Date();
      await conversation.save();

      // Recalculate unread counts for participants
      for (const participant of conversation.participants) {
        const pid = participant.toString();
        const unreadMsgs = await Message.countDocuments({
          conversationId: conversation._id,
          sender: { $ne: pid },
          readBy: { $ne: pid },
        });
        io.to(pid).emit("setConvUnread", {
          conversationId: conversationId.toString(),
          count: unreadMsgs,
        });
      }

      // Update last message preview for all
      const lastMsg = await Message.findOne({ conversationId })
        .sort({ createdAt: -1 })
        .populate("sender", "name email")
        .select("message sender createdAt fileUrl fileType");

      const lastMessageData = lastMsg
        ? {
            text: lastMsg.fileUrl
              ? lastMsg.fileType === "image"
                ? "📷 Image"
                : lastMsg.fileType === "video"
                ? "🎥 Video"
                : "📎 File"
              : lastMsg.message,
            sender: lastMsg.sender._id || lastMsg.sender,
            timestamp: lastMsg.createdAt,
          }
        : null;

      for (const participant of conversation.participants) {
        io.to(participant.toString()).emit("updateConvLastMessage", {
          conversationId: conversationId.toString(),
          lastMessage: lastMessageData,
        });
      }
    } catch (err) {
      console.error("notifyDeleteByConversation error:", err);
    }
  });

  // Legacy private mark as read by user ids
  socket.on("markAsRead", async ({ userId, otherUserId }) => {
    try {
      const conversation = await Conversation.findOne({
        participants: { $all: [userId, otherUserId] },
      });
      if (!conversation) return;

      // Update all unread messages: add userId to readBy array if not already present
      const result = await Message.updateMany(
        {
          conversationId: conversation._id,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        {
          $addToSet: { readBy: userId },
        }
      );

      if (result.modifiedCount > 0) {
        const roomId = [userId, otherUserId].sort().join("-");
        io.to(roomId).emit("messagesRead", { readerId: userId });

        //Also reset unread count in receiver's sidebar
        io.to(userId).emit("resetUnread", { sender: otherUserId });
      }
    } catch (err) {
      console.error("markAsRead socket error:", err);
    }
  });

  // New: mark messages as read by conversationId
  socket.on("markAsReadByConversation", async ({ userId, conversationId }) => {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      const result = await Message.updateMany(
        {
          conversationId: conversation._id,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        { $addToSet: { readBy: userId } }
      );

      if (result.modifiedCount > 0) {
        io.to(`conv-${conversationId}`).emit("messagesRead", { readerId: userId });
        io.to(userId).emit("resetConvUnread", { conversationId: conversationId.toString() });
      }
    } catch (err) {
      console.error("markAsReadByConversation error:", err);
    }
  });

  socket.on("disconnect", () => {
    // console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
