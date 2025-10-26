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

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);
app.use("/admin", routerAdmin);

app.get("/", (req, res) => res.json({ message: "Server is running ✅" }));

// HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Join chat room
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // Send message
  socket.on("sendMessage", async (data) => {
    try {
      const { sender, receiver, message } = data;
      const savedMsg = await saveMessage({ sender, receiver, message });

      const roomId = [sender, receiver].sort().join("-");
      io.to(roomId).emit("receiveMessage", savedMsg);
    } catch (err) {
      console.error("Error saving chat:", err);
    }
  });

  // Update message
  socket.on("updateMessage", async (data) => {
    try {
      const { _id, message, sender, receiver } = data;

      // 1️⃣ Find conversation containing this message
      const conversation = await Conversation.findOne({ "messages._id": _id });
      if (!conversation) return;

      // 2️⃣ Update message
      const msgIndex = conversation.messages.findIndex(
        (m) => m._id.toString() === _id
      );
      if (msgIndex === -1) return;

      conversation.messages[msgIndex].message = message;
      conversation.messages[msgIndex].timestamp = new Date();
      await conversation.save();

      // 3️⃣ Broadcast to the room
      const roomId = [sender, receiver].sort().join("-");
      io.to(roomId).emit("updateMessage", conversation.messages[msgIndex]);
    } catch (err) {
      console.error("Error updating message:", err);
    }
  });

  // Delete message
  socket.on("deleteMessage", async (data) => {
    try {
      const { _id, sender, receiver } = data;

      // 1️⃣ Find conversation containing this message
      const conversation = await Conversation.findOne({ "messages._id": _id });
      if (!conversation) return;

      // 2️⃣ Remove message
      conversation.messages = conversation.messages.filter(
        (m) => m._id.toString() !== _id
      );
      await conversation.save();

      // 3️⃣ Broadcast deletion
      const roomId = [sender, receiver].sort().join("-");
      io.to(roomId).emit("deleteMessage", _id);
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
