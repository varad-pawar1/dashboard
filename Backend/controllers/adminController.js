import User from "../models/User.js";
import dotenv from "dotenv";
import { sendResetLinkEmail } from "../utils/mailer.js";
import Chat from "../models/Chat.js";

import jwt from "jsonwebtoken";
dotenv.config();

export const getMe = async (req, res) => {
  try {
    // Get the currently logged-in user (excluding password)
    const adminLogin = await User.findById(req.user.id).select("-password");

    // Get all users excluding the logged-in user
    const allAdmins = await User.find({ _id: { $ne: req.user.id } }).select(
      "-password"
    );

    res.json({
      adminLogin,
      allAdmins,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const chatUser = async (req, res) => {
  const { userId, adminId } = req.params;
  try {
    const chats = await Chat.find({
      $or: [
        { sender: userId, receiver: adminId },
        { sender: adminId, receiver: userId },
      ],
    }).sort({ timestamp: 1 });

    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Send reset link
export const sendResetLink = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Create JWT token with user id and expiration
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_RESET_SECRET,
      { expiresIn: "10m" }
    );

    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendResetLinkEmail(user.email, resetUrl);

    res.json({ message: "Reset link sent to your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.resetToken || user.resetToken !== token)
      return res.status(400).json({ message: "Invalid token" });

    if (user.resetTokenExpiry < new Date())
      return res.status(400).json({ message: "Token has expired" });

    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(400).json({ message: "Token has expired" });
    }
    res.status(400).json({ message: "Invalid token" });
  }
};
