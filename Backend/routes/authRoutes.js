import { Router } from "express";
import {
  registerUser,
  loginUser,
  googleAuth,
  googleAuthCallback,
  githubAuth,
  githubAuthCallback,
  logOut,
  userVerifyotp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from "../controllers/authController.js";

const router = Router();

// Register & Login
router.post("/signup", registerUser);
router.post("/login", loginUser);
router.post("/verify-otp", userVerifyotp);
router.post("/logout", logOut);

// Forgot Password Flow
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// Google OAuth
router.get("/google", googleAuth);
router.get("/google/callback", googleAuthCallback);

// Github OAuth
router.get("/github", githubAuth);
router.get("/github/callback", githubAuthCallback);

export default router;
