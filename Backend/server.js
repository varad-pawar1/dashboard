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

app.get("/", (req, res) => res.json({ message: "Server is running ✅" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
});

// Helper to get deterministic room ID
const getRoomId = (user1, user2) => [user1, user2].sort().join("-");

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Join room
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // Send new message
  socket.on("sendMessage", async (data) => {
    try {
      const { sender, receiver, message } = data;
      const savedMsg = await saveMessage({ sender, receiver, message });
      const roomId = getRoomId(sender, receiver);
      io.to(roomId).emit("receiveMessage", savedMsg);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });

  // Update message
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
    } catch (err) {
      console.error("Error updating message:", err);
    }
  });

  // Delete message (existing handler) -- keep if you still want to support socket-initiated deletes
  socket.on("deleteMessage", async (data) => {
    try {
      const { _id, sender, receiver } = data;
      const conversation = await Conversation.findOne({ "messages._id": _id });
      if (!conversation) return;

      conversation.messages = conversation.messages.filter(
        (m) => m._id.toString() !== _id
      );
      await conversation.save();

      const roomId = getRoomId(sender, receiver);
      io.to(roomId).emit("deleteMessage", _id); // broadcast deletion
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  });

  // NEW: notifyDelete — when frontend already removed message (via REST), just broadcast to room
  socket.on("notifyDelete", (data) => {
    try {
      const { _id, sender, receiver } = data;
      const roomId = getRoomId(sender, receiver);
      // Broadcast the deleted message id to all sockets in the room
      io.to(roomId).emit("deleteMessage", _id);
    } catch (err) {
      console.error("notifyDelete error:", err);
    }
  });

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
    } catch (err) {
      console.error("markAsRead socket error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
