import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
  },
  avatar: { type: String },
  googleId: { type: String, default: null },
  providers: [{ type: String, enum: ["email", "google"], required: true }],
  // --- For email verification ---
  isVerified: { type: Boolean, default: false },
  otp: { type: String }, // verification OTP
  otpExpires: { type: Date },

  // --- For password reset ---
  resetOtp: { type: String },
  resetOtpExpires: { type: Date },
  isResetVerified: { type: Boolean, default: false },

  // --- For Reset Password ---
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
