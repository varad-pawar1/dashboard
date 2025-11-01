import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import APIADMIN from "../api/admin";

let socket;

export default function ChatPanel({ user, admin, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [menuVisibleId, setMenuVisibleId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sending, setSending] = useState(false);

  // NEW: Online status and typing indicators
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const typingTimeoutRef = useRef(null);

  const scrollRef = useRef();
  const inputRef = useRef();
  const fileInputRef = useRef();
  const imageVideoInputRef = useRef();

  // Compute display name for the conversation header
  const chatTitle = admin
    ? admin.isGroup
      ? admin.groupName
      : admin.participants
      ? (
          admin.participants.find((p) => String(p._id) !== String(user._id)) ||
          {}
        )?.name ||
        admin.name ||
        "Chat"
      : admin.name || "Chat"
    : "Chat";

  // Get other participant (for 1-on-1 chat)
  const otherParticipant = admin?.isGroup
    ? null
    : admin.participants?.find((p) => String(p._id) !== String(user._id));

  // Check if other user is online
  const isOtherUserOnline = otherParticipant
    ? onlineUsers.includes(String(otherParticipant._id))
    : false;

  // 🔌 SOCKET INIT
  useEffect(() => {
    setInputValue("");
    socket = io(`${import.meta.env.VITE_BACKEND_URL}`);

    // Join user room first
    socket.emit("joinUser", user._id);

    // Then join conversation room
    socket.emit("joinRoom", { conversationId: admin._id });

    // NEW: Listen for online users
    socket.on("onlineUsers", (users) => {
      setOnlineUsers(users);
    });

    // NEW: Listen for user online/offline status
    socket.on("userOnline", ({ userId, status }) => {
      if (status === "online") {
        setOnlineUsers((prev) => [...new Set([...prev, userId])]);
      } else {
        setOnlineUsers((prev) => prev.filter((id) => id !== userId));
      }
    });

    // NEW: Listen for typing indicators
    socket.on(
      "userTyping",
      ({ conversationId, userId, userName, isTyping }) => {
        if (conversationId === admin._id && userId !== user._id) {
          setTypingUsers((prev) => {
            const newMap = new Map(prev);
            if (isTyping) {
              newMap.set(userId, userName || "Someone");
            } else {
              newMap.delete(userId);
            }
            return newMap;
          });
        }
      }
    );

    // Fetch chat history
    APIADMIN.get(`/chats/${admin._id}`)
      .then((res) => {
        const normalized = res.data.map((msg) => ({
          ...msg,
          sender: msg.sender?._id || msg.sender,
          timestamp: msg.createdAt || msg.timestamp,
        }));

        setMessages(normalized);

        socket.emit("markAsReadByConversation", {
          userId: user._id,
          conversationId: admin._id,
        });
      })
      .catch((err) => {
        console.error("Error fetching chat history:", err);
      });

    inputRef.current?.focus();

    socket.on("receiveMessage", (msg) => {
      const normalizedMsg = {
        ...msg,
        sender: msg.sender?._id || msg.sender,
        timestamp: msg.createdAt || msg.timestamp,
      };
      setMessages((prev) =>
        prev.some((m) => String(m._id) === String(normalizedMsg._id))
          ? prev
          : [...prev, normalizedMsg]
      );

      if (normalizedMsg.sender !== user._id) {
        socket.emit("markAsReadByConversation", {
          userId: user._id,
          conversationId: admin._id,
        });
      }
    });

    socket.on("updateMessage", (updatedMsg) => {
      const normalized = {
        ...updatedMsg,
        sender: updatedMsg.sender?._id || updatedMsg.sender,
        timestamp: updatedMsg.createdAt || updatedMsg.timestamp,
      };
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(normalized._id) ? normalized : m
        )
      );
      if (editingMessageId === normalized._id) {
        setEditingMessageId(null);
        setInputValue("");
      }
      setMenuVisibleId(null);
    });

    socket.on("deleteMessage", (msgId) => {
      setMessages((prev) =>
        prev.filter((m) => String(m._id) !== String(msgId))
      );
      if (editingMessageId === msgId) {
        setEditingMessageId(null);
        setInputValue("");
      }
      setMenuVisibleId(null);
    });

    return () => {
      socket.off("receiveMessage");
      socket.off("updateMessage");
      socket.off("deleteMessage");
      socket.off("onlineUsers");
      socket.off("userOnline");
      socket.off("userTyping");
      socket.disconnect();
    };
  }, [user._id, admin._id]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isEditing = Boolean(editingMessageId);

  // NEW: Handle typing with indicator
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    // Don't send typing indicator if editing
    if (isEditing) return;

    // Emit typing event
    socket.emit("typing", {
      conversationId: admin._id,
      userId: user._id,
      userName: user.name,
    });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", {
        conversationId: admin._id,
        userId: user._id,
      });
    }, 2000);
  };

  // SEND MESSAGE
  const handleSend = async () => {
    if (!inputValue.trim()) return;

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit("stopTyping", {
      conversationId: admin._id,
      userId: user._id,
    });

    if (editingMessageId) {
      try {
        const res = await APIADMIN.put(`/chats/${editingMessageId}`, {
          message: inputValue,
        });
        const updatedMsg = res.data;
        socket.emit("updateMessageByConversation", {
          ...updatedMsg,
          sender: user._id,
          conversationId: admin._id,
        });
        setEditingMessageId(null);
        setInputValue("");
      } catch (err) {
        console.error(err);
      }
    } else {
      const msgObj = {
        conversationId: admin._id,
        sender: user._id,
        message: inputValue,
      };
      socket.emit("sendMessageByConversation", msgObj);
      setInputValue("");
    }
  };

  // Delete message
  const handleDelete = async (msgId) => {
    try {
      await APIADMIN.delete(`/chats/${msgId}`);
      socket.emit("notifyDeleteByConversation", {
        _id: msgId,
        conversationId: admin._id,
      });
      setMessages((prev) =>
        prev.filter((m) => String(m._id) !== String(msgId))
      );
      if (editingMessageId === msgId) {
        setEditingMessageId(null);
        setInputValue("");
      }
      setMenuVisibleId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit message
  const handleEdit = (msg) => {
    setMenuVisibleId(null);
    setEditingMessageId(msg._id);
    setInputValue(msg.message);
    inputRef.current?.focus();
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setInputValue("");
    setMenuVisibleId(null);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleClickOutside = () => setMenuVisibleId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleMessageClick = (e, msg) => {
    e.stopPropagation();
    if (String(msg.sender) !== String(user._id) || isEditing) return;
    setMenuVisibleId((prev) => (prev === msg._id ? null : msg._id));
  };

  const showFileDialog = () => {
    const fileOptions = document.querySelector(".file-options");
    if (fileOptions) {
      fileOptions.style.display =
        fileOptions.style.display === "block" ? "none" : "block";
    }
  };

  const handleFileSend = async () => {
    if (!selectedFile) return;
    setSending(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("sender", user._id);
      formData.append("conversationId", admin._id);

      const res = await APIADMIN.post("/chats/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const uploadedMessage = res.data;

      const normalizedUploadedMsg = {
        ...uploadedMessage,
        sender:
          uploadedMessage.sender?._id || uploadedMessage.sender || user._id,
        receiver: admin._id,
        timestamp: uploadedMessage.createdAt || uploadedMessage.timestamp,
        _skipSave: true,
      };

      socket.emit("sendMessageByConversation", {
        ...normalizedUploadedMsg,
        conversationId: admin._id,
      });

      setPreview(null);
      setSelectedFile(null);
      setInputValue("");

      if (fileInputRef.current) fileInputRef.current.value = "";
      if (imageVideoInputRef.current) imageVideoInputRef.current.value = "";
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("Failed to send file. Please try again.");
    } finally {
      setSending(false);
      showFileDialog();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File size exceeds 10MB. Please select a smaller file.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setSelectedFile(null);
    setInputValue("");

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageVideoInputRef.current) imageVideoInputRef.current.value = "";
  };

  // NEW: Get typing users display text
  const getTypingText = () => {
    const typingUserNames = Array.from(typingUsers.values());
    if (typingUserNames.length === 0) return "";
    if (typingUserNames.length === 1)
      return `${typingUserNames[0]} is typing...`;
    if (typingUserNames.length === 2)
      return `${typingUserNames[0]} and ${typingUserNames[1]} are typing...`;
    return `${typingUserNames.length} people are typing...`;
  };

  // UI RENDER
  return (
    <div className="chat-panel-backdrop">
      <div className="chat-panel" onClick={(e) => e.stopPropagation()}>
        <div className="chat-header">
          <div className="chat-header-info">
            {/* NEW: Online status indicator */}
            {!admin.isGroup && (
              <span
                className={`status-indicator ${
                  isOtherUserOnline ? "online" : "offline"
                }`}
              ></span>
            )}
            <div className="chat-header-text">
              <span className="chat-title">{chatTitle}</span>
              {/* NEW: Online/Offline text */}
              {!admin.isGroup && (
                <span className="status-text">
                  {isOtherUserOnline ? "Online" : "Offline"}
                </span>
              )}
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-circle-xmark"></i>
          </button>
        </div>

        {/* Chat Messages */}
        <div className="chat-messages">
          {messages.map((msg, index) => {
            const isSentByUser = String(msg.sender) === String(user._id);
            const isEditingThis =
              editingMessageId && String(editingMessageId) === String(msg._id);

            return (
              <div
                key={msg._id || index}
                className={`chat-message ${
                  isSentByUser ? "sent" : "received"
                } ${isEditingThis ? "editing" : ""}`}
                ref={index === messages.length - 1 ? scrollRef : null}
                onClick={(e) => handleMessageClick(e, msg)}
              >
                {msg.fileUrl ? (
                  msg.fileType === "image" ? (
                    <img
                      src={msg.fileUrl}
                      alt="upload"
                      className="chat-image"
                    />
                  ) : msg.fileType === "video" ? (
                    <video src={msg.fileUrl} controls className="chat-video" />
                  ) : msg.fileType === "document" ||
                    msg.fileType === "other" ? (
                    <a
                      href={msg.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="file-link"
                    >
                      <i className="fa-solid fa-file"></i>
                      <span>{msg.fileName || "Download File"}</span>
                    </a>
                  ) : null
                ) : (
                  <span>{msg.message}</span>
                )}

                {isSentByUser && menuVisibleId === msg._id && !isEditing && (
                  <div
                    className="message-menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button onClick={() => handleDelete(msg._id)}>
                      Delete
                    </button>
                    {!msg.fileUrl && (
                      <button onClick={() => handleEdit(msg)}>Edit</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* NEW: Typing Indicator */}
        {typingUsers.size > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-text">{getTypingText()}</span>
          </div>
        )}

        {/* File Preview Box */}
        {preview && (
          <div className="preview-box">
            {selectedFile?.type.startsWith("image/") ? (
              <img src={preview} alt="preview" width="120" />
            ) : selectedFile?.type.startsWith("video/") ? (
              <video src={preview} controls width="150" />
            ) : (
              <p>{selectedFile.name}</p>
            )}
            <button className="close-btn" onClick={handleCancelPreview}>
              <i className="fa-solid fa-circle-xmark"></i>
            </button>
            <button className="create-btn" onClick={handleFileSend}>
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        )}

        {/* Chat Input Section */}
        <div className="chat-input">
          <div className="attach-icon">
            <i
              className="fa-solid fa-paperclip fa-rotate-180"
              onClick={showFileDialog}
            ></i>
            <div style={{ display: "none" }} className="file-options">
              <ul>
                <li
                  onClick={() => {
                    imageVideoInputRef.current.click();
                    showFileDialog();
                  }}
                >
                  <i className="fa-solid fa-image"></i>
                  <i className="fa-solid fa-video"></i>
                  <p>Image/Video</p>
                </li>

                <li
                  onClick={() => {
                    fileInputRef.current.click();
                    showFileDialog();
                  }}
                >
                  <i className="fa-solid fa-file"></i>
                  <p>File</p>
                </li>
              </ul>
            </div>
          </div>

          <input
            type="file"
            ref={imageVideoInputRef}
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.ppt,.pptx"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          <input
            ref={inputRef}
            type="text"
            placeholder={
              isEditing ? "Edit your message..." : "Type a message..."
            }
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />

          {isEditing ? (
            <>
              <button onClick={handleSend}>Update</button>
              <button onClick={cancelEdit}>Cancel</button>
            </>
          ) : (
            <button onClick={() => handleSend()}>Send</button>
          )}
        </div>
      </div>
    </div>
  );
}
