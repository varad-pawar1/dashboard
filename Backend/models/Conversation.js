import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    readBy: { type: Boolean, default: false },
  },
  { _id: true }
); // each message gets its own _id automatically

const conversationSchema = new mongoose.Schema({
  participants: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ],
  messages: [messageSchema],
  updatedAt: { type: Date, default: Date.now },
});

// Add an index for efficient queries
conversationSchema.index({ participants: 1 });

export default mongoose.model("Conversation", conversationSchema);
