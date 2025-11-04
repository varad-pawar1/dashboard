import { Router } from "express";
import {
  registerUser,
  loginUser,
  logOut,
  userVerifyotp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  googleLogin,
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

// Google OAuth (Token verification)
router.post("/google", googleLogin);

export default router;
