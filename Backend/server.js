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
        const key = conv.isGroup
          ? conv._id.toString()
          : (conv.participants.find((p) => p.toString() !== userId) || "").toString();
        if (!key) continue;
        const unreadMsgs = await Message.countDocuments({
          conversationId: conv._id,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        });
        unreadCounts[key] = unreadMsgs;
        if (conv.lastMessage) {
          const lastMsg = await Message.findById(conv.lastMessage)
            .populate("sender", "name email")
            .select("message sender createdAt fileUrl fileType");
          if (lastMsg) {
            lastMessages[key] = {
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

      //  Send both unread counts and last messages to user
      socket.emit("initChatData", { unreadCounts, lastMessages });
    } catch (err) {
      console.error("Error fetching initial chat data:", err);
    }
  });

  //Join chat room (existing)
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    // console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  //Send message (keep your existing logic)

  socket.on("sendMessage", async (data) => {
    try {
      const { sender, receiver, message, _skipSave, fileUrl, fileType } = data;

      let savedMsg;

      // If _skipSave flag exists, it means the message is already saved
      if (_skipSave) {
        savedMsg = data; // Use the data as-is (already from DB)
      } else {
        // Save to database (works for 1:1 and group when receiver is group id)
        savedMsg = await saveMessage({ sender, receiver, message });
      }
      
      // Determine if this is a group message
      const maybeGroup = await Conversation.findById(receiver).select("isGroup participants");
      if (maybeGroup && maybeGroup.isGroup) {
        const roomId = receiver.toString();
        socket.join(roomId);
        io.to(roomId).emit("receiveMessage", savedMsg);
        // Update last message for all participants
        const lastMessageText = savedMsg.fileUrl
          ? savedMsg.fileType === "image"
            ? "📷 Image"
            : savedMsg.fileType === "video"
            ? "🎥 Video"
            : "📎 File"
          : savedMsg.message || message;
        for (const p of maybeGroup.participants) {
          io.to(p.toString()).emit("updateLastMessage", {
            otherUserId: roomId,
            lastMessage: {
              text: lastMessageText,
              sender: savedMsg.sender._id || savedMsg.sender,
              timestamp: savedMsg.createdAt || new Date(),
            },
          });
          if (p.toString() !== sender) {
            io.to(p.toString()).emit("incrementUnread", { sender: roomId });
          }
        }
      } else {
        const roomId = getRoomId(sender, receiver);
        socket.join(roomId);
        io.to(roomId).emit("receiveMessage", savedMsg);
        if (sender !== receiver) {
          io.to(receiver).emit("incrementUnread", { sender });
        }
        const lastMessageText = savedMsg.fileUrl
          ? savedMsg.fileType === "image"
            ? "📷 Image"
            : savedMsg.fileType === "video"
            ? "🎥 Video"
            : "📎 File"
          : savedMsg.message || message;
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
      }

      // For 1:1, also emit last-message updates directly to the two users (group handled above)
      const maybeGroup2 = await Conversation.findById(receiver).select("isGroup");
      if (!(maybeGroup2 && maybeGroup2.isGroup)) {
        const lastMessageText = savedMsg.fileUrl
          ? savedMsg.fileType === "image"
            ? "📷 Image"
            : savedMsg.fileType === "video"
            ? "🎥 Video"
            : "📎 File"
          : savedMsg.message || message;

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
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });

  //Update message
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

      // group or 1:1 room
      const maybeGroup = await Conversation.findById(receiver).select("isGroup");
      const roomId = maybeGroup && maybeGroup.isGroup ? receiver.toString() : getRoomId(sender, receiver);
      io.to(roomId).emit("updateMessage", updatedMessage);

      io.to(sender).emit("updateLastMessage", {
        otherUserId: (maybeGroup && maybeGroup.isGroup) ? receiver : receiver,
        lastMessage: {
          text: message,
          sender,
          timestamp: updatedMessage.createdAt,
        },
      });
      if (!(maybeGroup && maybeGroup.isGroup)) {
        io.to(receiver).emit("updateLastMessage", {
          otherUserId: sender,
          lastMessage: {
            text: message,
            sender,
            timestamp: updatedMessage.createdAt,
          },
        });
      }
    } catch (err) {
      console.error("Error updating message:", err);
    }
  });

  // Enhanced Notify Delete (keeps your delete flow intact)
  socket.on("notifyDelete", async (data) => {
    try {
      const { _id, sender, receiver } = data;
      const maybeGroup = await Conversation.findById(receiver).select("isGroup participants");
      const isGroup = Boolean(maybeGroup && maybeGroup.isGroup);
      const roomId = isGroup ? receiver.toString() : getRoomId(sender, receiver);

      // Find the conversation
      const conversation = isGroup
        ? maybeGroup
        : await Conversation.findOne({ participants: { $all: [sender, receiver] } });

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

      // Also emit to individual users/participants to ensure they receive it
      if (isGroup) {
        for (const p of conversation.participants) {
          io.to(p.toString()).emit("deleteMessage", _id);
        }
      } else {
        io.to(sender).emit("deleteMessage", _id);
        io.to(receiver).emit("deleteMessage", _id);
      }

      // Update conversation's lastMessage if needed
      if (conversation.lastMessage?.toString() === _id) {
        const lastMsg = await Message.findOne({ conversationId })
          .sort({ createdAt: -1 })
          .select("_id");
        conversation.lastMessage = lastMsg ? lastMsg._id : null;
      }
      conversation.updatedAt = new Date();
      await conversation.save();

      // Recalculate unread counts for participants
      const unreadCounts = {};
      for (const participant of conversation.participants) {
        const unreadMsgs = await Message.countDocuments({
          conversationId: conversation._id,
          sender: { $ne: participant.toString() },
          readBy: { $ne: participant.toString() },
        });
        unreadCounts[participant.toString()] = unreadMsgs;
      }

      //Send updated unread count to each participant (keyed by group id for groups)
      for (const participant of conversation.participants) {
        const otherKey = (maybeGroup && maybeGroup.isGroup)
          ? conversation._id.toString()
          : (conversation.participants.find((p) => p.toString() !== participant.toString()) || "").toString();
        if (!otherKey) continue;
        io.to(participant.toString()).emit("updateUnreadCount", {
          otherUserId: otherKey,
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

      // Emit last message update
      if (maybeGroup && maybeGroup.isGroup) {
        for (const p of conversation.participants) {
          io.to(p.toString()).emit("updateLastMessage", {
            otherUserId: conversation._id.toString(),
            lastMessage: lastMessageData,
          });
        }
      } else {
        io.to(sender).emit("updateLastMessage", {
          otherUserId: receiver,
          lastMessage: lastMessageData,
        });
        io.to(receiver).emit("updateLastMessage", {
          otherUserId: sender,
          lastMessage: lastMessageData,
        });
      }
    } catch (err) {
      console.error("notifyDelete error:", err);
    }
  });

  //Mark messages as read (adds unread reset)
  socket.on("markAsRead", async ({ userId, otherUserId, isGroup }) => {
    try {
      const conversation = isGroup
        ? await Conversation.findById(otherUserId)
        : await Conversation.findOne({ participants: { $all: [userId, otherUserId] } });
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
        const roomId = isGroup ? conversation._id.toString() : [userId, otherUserId].sort().join("-");
        io.to(roomId).emit("messagesRead", { readerId: userId });
        io.to(userId).emit("resetUnread", { sender: isGroup ? conversation._id.toString() : otherUserId });
      }
    } catch (err) {
      console.error("markAsRead socket error:", err);
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
