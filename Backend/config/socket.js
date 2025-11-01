import { Server } from "socket.io";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: process.env.FRONTEND_URL, credentials: true },
  });

  io.on("connection", (socket) => {
    // console.log("Client connected:", socket.id);

    socket.on("joinUser", async (userId) => {
      socket.userId = userId;
      socket.join(userId);

      try {
        const conversations = await Conversation.find({ participants: userId });

        const unreadCounts = {};
        const lastMessages = {};

        for (const conv of conversations) {
          const unreadMsgs = await Message.countDocuments({
            conversationId: conv._id,
            sender: { $ne: userId },
            readBy: { $ne: userId },
          });
          unreadCounts[conv._id.toString()] = unreadMsgs;

          if (conv.lastMessage) {
            const lastMsg = await Message.findById(conv.lastMessage)
              .populate("sender", "name email")
              .select("message sender createdAt fileUrl fileType");
            if (lastMsg) {
              lastMessages[conv._id.toString()] = {
                text: lastMsg.fileUrl
                  ? lastMsg.fileType === "image"
                    ? "📷 Image"
                    : lastMsg.fileType === "video"
                    ? "🎥 Video"
                    : "📎 File"
                  : lastMsg.message,
                sender: lastMsg.sender._id || lastMsg.sender,
                timestamp: lastMsg.createdAt,
              };
            }
          }
        }

        socket.emit("initChatData", { unreadCounts, lastMessages });
      } catch (err) {
        console.error("Error fetching initial chat data:", err);
      }
    });

    socket.on("joinRoom", (payload) => {
      if (!payload) return;
      if (typeof payload === "string") {
        socket.join(payload);
        return;
      }
      const { conversationId } = payload;
      if (conversationId) {
        socket.join(`conv-${conversationId}`);
      }
    });

    socket.on("sendMessageByConversation", async (data) => {
      try {
        const {
          conversationId,
          sender,
          message,
          _skipSave,
          fileUrl,
          fileType,
        } = data;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        let savedMsg;
        if (_skipSave) {
          savedMsg = data;
        } else {
          savedMsg = await new Message({
            conversationId,
            sender,
            message,
            fileUrl: fileUrl || undefined,
            fileType: fileUrl ? fileType : undefined,
            readBy: [],
          }).save();
        }

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: savedMsg._id,
          updatedAt: new Date(),
        });

        io.to(`conv-${conversationId}`).emit("receiveMessage", savedMsg);

        for (const participant of conversation.participants) {
          const pid = participant.toString();
          if (pid === String(sender)) continue;
          io.to(pid).emit("updateConvUnread", {
            conversationId: conversationId.toString(),
            delta: 1,
          });
        }

        const lastMessageText = savedMsg.fileUrl
          ? savedMsg.fileType === "image"
            ? "📷 Image"
            : savedMsg.fileType === "video"
            ? "🎥 Video"
            : "📎 File"
          : savedMsg.message || message;

        for (const participant of conversation.participants) {
          io.to(participant.toString()).emit("updateConvLastMessage", {
            conversationId: conversationId.toString(),
            lastMessage: {
              text: lastMessageText,
              sender,
              timestamp: savedMsg.createdAt || new Date(),
            },
          });
        }
      } catch (err) {
        console.error("sendMessageByConversation error:", err);
      }
    });

    socket.on("updateMessageByConversation", async (data) => {
      try {
        const { conversationId, _id, message } = data;
        const updatedMessage = await Message.findByIdAndUpdate(
          _id,
          { message },
          { new: true }
        ).populate("sender", "name email");
        if (!updatedMessage) return;

        await Conversation.findByIdAndUpdate(conversationId, {
          updatedAt: new Date(),
        });
        io.to(`conv-${conversationId}`).emit("updateMessage", updatedMessage);

        const conv = await Conversation.findById(conversationId);
        if (!conv) return;
        for (const participant of conv.participants) {
          io.to(participant.toString()).emit("updateConvLastMessage", {
            conversationId: conversationId.toString(),
            lastMessage: {
              text: message,
              sender: updatedMessage.sender._id || updatedMessage.sender,
              timestamp: updatedMessage.createdAt,
            },
          });
        }
      } catch (err) {
        console.error("updateMessageByConversation error:", err);
      }
    });

    socket.on("notifyDeleteByConversation", async (data) => {
      try {
        const { conversationId, _id } = data;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const deletedMsg = await Message.findById(_id);
        if (
          deletedMsg &&
          deletedMsg.conversationId.toString() === conversationId.toString()
        ) {
          await Message.findByIdAndDelete(_id);
        }

        io.to(`conv-${conversationId}`).emit("deleteMessage", _id);

        if (conversation.lastMessage?.toString() === String(_id)) {
          const lastMsg = await Message.findOne({ conversationId })
            .sort({ createdAt: -1 })
            .select("_id");
          conversation.lastMessage = lastMsg ? lastMsg._id : null;
        }
        conversation.updatedAt = new Date();
        await conversation.save();

        for (const participant of conversation.participants) {
          const pid = participant.toString();
          const unreadMsgs = await Message.countDocuments({
            conversationId: conversation._id,
            sender: { $ne: pid },
            readBy: { $ne: pid },
          });
          io.to(pid).emit("setConvUnread", {
            conversationId: conversationId.toString(),
            count: unreadMsgs,
          });
        }

        const lastMsg = await Message.findOne({ conversationId })
          .sort({ createdAt: -1 })
          .populate("sender", "name email")
          .select("message sender createdAt fileUrl fileType");

        const lastMessageData = lastMsg
          ? {
              text: lastMsg.fileUrl
                ? lastMsg.fileType === "image"
                  ? "📷 Image"
                  : lastMsg.fileType === "video"
                  ? "🎥 Video"
                  : "📎 File"
                : lastMsg.message,
              sender: lastMsg.sender._id || lastMsg.sender,
              timestamp: lastMsg.createdAt,
            }
          : null;

        for (const participant of conversation.participants) {
          io.to(participant.toString()).emit("updateConvLastMessage", {
            conversationId: conversationId.toString(),
            lastMessage: lastMessageData,
          });
        }
      } catch (err) {
        console.error("notifyDeleteByConversation error:", err);
      }
    });

    socket.on(
      "markAsReadByConversation",
      async ({ userId, conversationId }) => {
        try {
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) return;

          const result = await Message.updateMany(
            {
              conversationId: conversation._id,
              sender: { $ne: userId },
              readBy: { $ne: userId },
            },
            { $addToSet: { readBy: userId } }
          );

          if (result.modifiedCount > 0) {
            io.to(`conv-${conversationId}`).emit("messagesRead", {
              readerId: userId,
            });
            io.to(userId).emit("resetConvUnread", {
              conversationId: conversationId.toString(),
            });
          }
        } catch (err) {
          console.error("markAsReadByConversation error:", err);
        }
      }
    );

    socket.on("groupCreated", async (groupData) => {
      try {
        const conversation = await Conversation.findById(groupData._id)
          .populate("participants", "name email avatar")
          .populate("createdBy", "name email")
          .populate("admins", "name email");

        if (!conversation || !conversation.isGroup) return;

        for (const participant of conversation.participants) {
          const pid = participant._id?.toString() || participant.toString();
          io.to(pid).emit("newGroupCreated", conversation);
        }
      } catch (err) {
        console.error("Error broadcasting group creation:", err);
      }
    });

    socket.on("disconnect", () => {
      // console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
