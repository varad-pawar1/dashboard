import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import routerAdmin from "./routes/adminRoutes.js";
import cookieParser from "cookie-parser";
import fs from "fs";

import passport from "passport";
import session from "express-session";
import http from "http";
import { Server } from "socket.io";
import Chat from "./models/Chat.js"; // Chat model

dotenv.config();
const app = express();
connectDB();

// ======= Middlewares =======
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ======= Logger (Optional but useful) =======
// app.use((req, res, next) => {
//   const log = `${new Date().toISOString()} | ${req.ip} | ${req.method} | ${
//     req.path
//   }\n`;
//   fs.appendFile("log.txt", log, (err) => {
//     if (err) console.error("Error writing log:", err);
//   });
//   next();
// });

// ======= Routes =======
app.get("/", (req, res) => res.json({ message: "Server is running ✅" }));

app.use("/auth", authRoutes);
app.use("/admin", routerAdmin);

// ======= HTTP + Socket.IO =======
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on("sendMessage", async (data, callback) => {
    try {
      const { sender, receiver, message } = data;
      const newMessage = await Chat.create({ sender, receiver, message });

      const roomId1 = `${sender}-${receiver}`;
      const roomId2 = `${receiver}-${sender}`;

      io.to(roomId1).emit("receiveMessage", newMessage);
      io.to(roomId2).emit("receiveMessage", newMessage);

      callback(newMessage); // return saved message to sender
    } catch (err) {
      console.error("Error saving chat:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// ======= Start server =======
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
