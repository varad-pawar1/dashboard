import { Router } from "express";
import {
  registerUser,
  loginUser,
  googleAuth,
  googleAuthCallback,
  githubAuth,
  githubAuthCallback,
  logOut,
} from "../controllers/authController.js";

const router = Router();

// Register & Login
router.post("/signup", registerUser);
router.post("/login", loginUser);
router.post("/logout", logOut);
// Google OAuth
router.get("/google", googleAuth);
router.get("/google/callback", googleAuthCallback);

// Github OAuth
router.get("/github", githubAuth);
router.get("/github/callback", githubAuthCallback);

export default router;
