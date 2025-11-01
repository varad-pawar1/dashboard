import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import routerAdmin from "./routes/adminRoutes.js";
import cookieParser from "cookie-parser";
import http from "http";
import { initSocket } from "./config/socket.js";

dotenv.config();
const app = express();
connectDB();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/admin", routerAdmin);

app.get("/", (req, res) => res.json({ message: "Server is running" }));

const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// Attach io to app for use in controllers
app.locals.io = io;

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
