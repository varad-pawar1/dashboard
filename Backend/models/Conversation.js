import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String, default: "" },
    fileUrl: { type: String, default: undefined }, // <--- new
    fileType: { type: String, default: undefined }, // <--- new
    timestamp: { type: Date, default: Date.now },
    readBy: { type: Boolean, default: false },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    messages: [messageSchema],
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

export default mongoose.model("Conversation", conversationSchema);
