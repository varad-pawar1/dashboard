import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },

  // Password only required if not using OAuth
  password: {
    type: String,
    required: function () {
      return !this.googleId && !this.githubId;
    },
  },

  avatar: { type: String },

  // Track OAuth providers
  googleId: { type: String, default: null },
  githubId: { type: String, default: null },
  providers: [
    { type: String, enum: ["email", "google", "github"], required: true },
  ],
});

// Hash password if changed
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
