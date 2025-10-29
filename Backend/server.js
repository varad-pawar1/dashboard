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

      conversations.forEach((conv) => {
        const otherUser = conv.participants.find(
          (p) => p.toString() !== userId
        );

        //Count unread messages
        const unreadMsgs = conv.messages.filter(
          (m) => m.sender.toString() !== userId && !m.readBy
        );
        unreadCounts[otherUser] = unreadMsgs.length;

        //Get last message (if any)
        if (conv.messages.length > 0) {
          const lastMsg = conv.messages[conv.messages.length - 1];
          lastMessages[otherUser] = {
            text: lastMsg.message,
            sender: lastMsg.sender,
            timestamp: lastMsg.timestamp,
          };
        }
      });

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
      const lastMessageText = fileUrl
        ? fileType === "image"
          ? "📷 Image"
          : fileType === "video"
          ? "🎥 Video"
          : "📎 File"
        : message;

      // Update sidebar of both users with the new last message
      io.to(sender).emit("updateLastMessage", {
        otherUserId: receiver,
        lastMessage: {
          text: lastMessageText,
          sender,
          timestamp: new Date(),
        },
      });

      io.to(receiver).emit("updateLastMessage", {
        otherUserId: sender,
        lastMessage: {
          text: lastMessageText,
          sender,
          timestamp: new Date(),
        },
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });

  //Update message (unchanged)
  socket.on("updateMessage", async (data) => {
    try {
      const { _id, message, sender, receiver } = data;
      const conversation = await Conversation.findOne({ "messages._id": _id });
      if (!conversation) return;

      const index = conversation.messages.findIndex(
        (m) => m._id.toString() === _id
      );
      if (index === -1) return;

      conversation.messages[index].message = message;
      conversation.messages[index].timestamp = new Date();
      await conversation.save();

      const roomId = getRoomId(sender, receiver);
      io.to(roomId).emit("updateMessage", conversation.messages[index]);

      io.to(sender).emit("updateLastMessage", {
        otherUserId: receiver,
        lastMessage: {
          text: message,
          sender,
          timestamp: new Date(),
        },
      });

      io.to(receiver).emit("updateLastMessage", {
        otherUserId: sender,
        lastMessage: {
          text: message,
          sender,
          timestamp: new Date(),
        },
      });
    } catch (err) {
      console.error("Error updating message:", err);
    }
  });

  // Enhanced Notify Delete (keeps your delete flow intact)
  socket.on("notifyDelete", async (data) => {
    try {
      const { _id, sender, receiver } = data;
      const roomId = getRoomId(sender, receiver);

      // Emit delete event to chat room
      io.to(roomId).emit("deleteMessage", _id);

      // Find the conversation
      const conversation = await Conversation.findOne({
        participants: { $all: [sender, receiver] },
      });

      if (!conversation) return;

      // Find deleted message (to know if it was unread)
      const deletedMsg = conversation.messages.find(
        (m) => m._id.toString() === _id
      );

      // Remove the message
      conversation.messages = conversation.messages.filter(
        (m) => m._id.toString() !== _id
      );
      await conversation.save();

      // 🔁 Recalculate unread counts for both participants
      const unreadCounts = {};
      for (const participant of conversation.participants) {
        const unreadMsgs = conversation.messages.filter(
          (m) => m.sender.toString() !== participant.toString() && !m.readBy
        );
        unreadCounts[participant.toString()] = unreadMsgs.length;
      }

      // 📨 Send updated unread count to each participant
      for (const participant of conversation.participants) {
        const otherUser = conversation.participants.find(
          (p) => p.toString() !== participant.toString()
        );

        io.to(participant.toString()).emit("updateUnreadCount", {
          otherUserId: otherUser.toString(),
          count: unreadCounts[participant.toString()],
        });
      }

      // 📩 Update last message for both users
      const lastMsg =
        conversation.messages.length > 0
          ? conversation.messages[conversation.messages.length - 1]
          : null;

      const lastMessageData = lastMsg
        ? {
            text: lastMsg.message,
            sender: lastMsg.sender,
            timestamp: lastMsg.timestamp,
          }
        : null;

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

  //Mark messages as read (adds unread reset)
  socket.on("markAsRead", async ({ userId, otherUserId }) => {
    try {
      const conversation = await Conversation.findOne({
        participants: { $all: [userId, otherUserId] },
      });
      if (!conversation) return;

      let updated = false;
      conversation.messages.forEach((msg) => {
        if (msg.sender.toString() !== userId && !msg.readBy) {
          msg.readBy = true;
          updated = true;
        }
      });

      if (updated) await conversation.save();

      const roomId = [userId, otherUserId].sort().join("-");
      io.to(roomId).emit("messagesRead", { readerId: userId });

      //Also reset unread count in receiver's sidebar
      io.to(userId).emit("resetUnread", { sender: otherUserId });
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
