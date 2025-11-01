import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import routerAdmin from "./routes/adminRoutes.js";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
// import { saveMessage } from "./controllers/adminController.js";
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

  // New: send message by conversationId
  socket.on("sendMessageByConversation", async (data) => {
    try {
      const { conversationId, sender, message, _skipSave, fileUrl, fileType } =
        data;
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

      await Conversation.findByIdAndUpdate(conversationId, {
        updatedAt: new Date(),
      });
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

  // New: delete by conversationId
  socket.on("notifyDeleteByConversation", async (data) => {
    try {
      const { conversationId, _id } = data;
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      const deletedMsg = await Message.findById(_id);
      if (
        deletedMsg &&
        deletedMsg.conversationId.toString() === conversationId.toString()
      ) {
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
        io.to(`conv-${conversationId}`).emit("messagesRead", {
          readerId: userId,
        });
        io.to(userId).emit("resetConvUnread", {
          conversationId: conversationId.toString(),
        });
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
