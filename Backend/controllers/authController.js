import jwt from "jsonwebtoken";
import User from "../models/User.js";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";

import dotenv from "dotenv";
import { sendOtpEmail, sendWelcomeEmail } from "../utils/mailer.js";
dotenv.config();

// REGISTER USER
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 30 * 60 * 1000);

    const newUser = new User({
      name,
      email,
      password,
      providers: ["email"],
      otp,
      otpExpires,
    });
    await newUser.save();

    await sendOtpEmail(email, otp);
    res.status(201).json({ message: "OTP sent for email verification" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// VERIFY SIGNUP OTP
export const userVerifyotp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.isVerified)
      return res.status(400).json({ message: "User already verified" });

    if (user.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.otpExpires < new Date())
      return res.status(400).json({ message: "OTP expired" });

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    await sendWelcomeEmail(user.email, user.name);

    res.status(200).json({ message: "Email verified successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// LOGIN USER
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (!user.isVerified)
      return res
        .status(403)
        .json({ message: "Please verify your email first." });

    const isValid = await user.comparePassword(password);
    if (!isValid)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// LOGOUT
export const logOut = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// FORGOT PASSWORD (Send OTP)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    user.isResetVerified = false;
    await user.save();

    await sendOtpEmail(email, otp);
    res.status(200).json({ message: "OTP sent for password reset" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// VERIFY RESET OTP
export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.resetOtp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.resetOtpExpires < new Date())
      return res.status(400).json({ message: "OTP expired" });

    user.isResetVerified = true;
    await user.save();

    res.status(200).json({ message: "Password reset OTP verified" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword)
      return res
        .status(400)
        .json({ message: "Email and new password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.isResetVerified)
      return res.status(400).json({ message: "OTP not verified" });

    // Do NOT hash manually, let pre-save hook handle it
    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    user.isResetVerified = false;

    await user.save();

    return res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

//  GOOGLE STRATEGY
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            name: profile.displayName,
            email,
            avatar: profile.photos[0]?.value || "",
            googleId: profile.id,
            providers: ["google"],
          });
        } else {
          // Existing user → add Google if not already added
          if (!user.providers.includes("google")) {
            user.providers.push("google");
            user.googleId = profile.id;
            await user.save();
          }
        }

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

//  GOOGLE LOGIN HANDLERS
export const googleAuth = (req, res, next) => {
  passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next
  );
};

export const googleAuthCallback = (req, res, next) => {
  passport.authenticate("google", { failureRedirect: "/" })(req, res, () => {
    const token = jwt.sign(
      { id: req.user._id, email: req.user.email, name: req.user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  });
};

// ===== Passport GitHub Strategy =====
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/auth/github/callback`,
      scope: ["user:email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            name: profile.displayName || profile.username,
            email,
            avatar: profile.photos[0]?.value || "",
            githubId: profile.id,
            providers: ["github"],
          });
        } else {
          // Existing user → add GitHub if not already added
          if (!user.providers.includes("github")) {
            user.providers.push("github");
            user.githubId = profile.id;
            await user.save();
          }
        }
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// ===== Routes Handlers =====
export const githubAuth = (req, res, next) => {
  passport.authenticate("github")(req, res, next);
};

export const githubAuthCallback = (req, res, next) => {
  passport.authenticate("github", { failureRedirect: "/" })(req, res, () => {
    const token = jwt.sign(
      { id: req.user._id, email: req.user.email, name: req.user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  });
};
