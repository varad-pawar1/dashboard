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

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

// Connect MongoDB
connectDB();

// ======= Middlewares =======

// ✅ Allow frontend cookies + requests
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// ✅ Parse JSON and cookies
app.use(express.json());
app.use(cookieParser());

// ✅ Express session (for passport OAuth)
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET, // better to keep SESSION_SECRET separate
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// ✅ Initialize Passport
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

// ======= Start Server =======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
