import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Group chat fields (preserved for future use)
    isGroup: { type: Boolean, default: false },

    // For private chat, participants = 2 users
    // For group chat, participants can be many
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],

    // Group chat fields (preserved for future use)
    groupName: { type: String },
    groupAvatar: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // last message info (for sidebar previews) - preserved for future use
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // typing indicators, last activity timestamps etc.
    lastActive: { type: Date, default: Date.now },

    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

export default mongoose.model("Conversation", conversationSchema);
