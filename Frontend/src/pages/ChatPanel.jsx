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

  const scrollRef = useRef();
  const inputRef = useRef();
  const fileInputRef = useRef();
  const imageVideoInputRef = useRef();
  const roomId = [user._id, admin._id].sort().join("-");

  // 🔌 SOCKET INIT
  useEffect(() => {
    setInputValue("");
    socket = io(`${import.meta.env.VITE_BACKEND_URL}`);
    socket.emit("joinRoom", roomId);
    // Fetch chat history
    APIADMIN.get(`/chats/${admin._id}`)
      .then((res) => {
        const normalized = res.data.map((msg) => ({
          ...msg,
          sender: msg.sender?._id || msg.sender,
          // Ensure timestamp compatibility (use createdAt if timestamp doesn't exist)
          timestamp: msg.createdAt || msg.timestamp,
        }));
        setMessages(normalized);
        socket.emit("markAsRead", {
          userId: user._id,
          otherUserId: admin._id,
        });
      })
      .catch(console.error);

    inputRef.current?.focus();

    socket.on("receiveMessage", (msg) => {
      const normalizedMsg = {
        ...msg,
        sender: msg.sender?._id || msg.sender,
        // Ensure timestamp compatibility (use createdAt if timestamp doesn't exist)
        timestamp: msg.createdAt || msg.timestamp,
      };
      setMessages((prev) =>
        prev.some((m) => String(m._id) === String(normalizedMsg._id))
          ? prev
          : [...prev, normalizedMsg]
      );

      if (normalizedMsg.sender !== user._id) {
        socket.emit("markAsRead", {
          userId: user._id,
          otherUserId: admin._id,
        });
      }
    });

    socket.on("updateMessage", (updatedMsg) => {
      const normalized = {
        ...updatedMsg,
        sender: updatedMsg.sender?._id || updatedMsg.sender,
        // Ensure timestamp compatibility (use createdAt if timestamp doesn't exist)
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
      socket.disconnect();
    };
  }, [user._id, admin._id]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isEditing = Boolean(editingMessageId);

  // SEND MESSAGE
  const handleSend = async () => {
    if (!inputValue.trim()) return;

    if (editingMessageId) {
      try {
        const res = await APIADMIN.put(`/chats/${editingMessageId}`, {
          message: inputValue,
        });
        const updatedMsg = res.data;
        socket.emit("updateMessage", {
          ...updatedMsg,
          sender: user._id,
          receiver: admin._id,
        });
        setEditingMessageId(null);
        setInputValue("");
      } catch (err) {
        console.error(err);
      }
    } else {
      const msgObj = {
        sender: user._id,
        receiver: admin._id,
        message: inputValue,
      };
      socket.emit("sendMessage", msgObj);
      setInputValue("");
    }
  };

  // Delete message
  const handleDelete = async (msgId) => {
    try {
      await APIADMIN.delete(`/chats/${msgId}`);
      socket.emit("notifyDelete", {
        _id: msgId,
        sender: user._id,
        receiver: admin._id,
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

  //  Show file dialog options
  const showFileDialog = () => {
    const fileOptions = document.querySelector(".file-options");
    if (fileOptions) {
      fileOptions.style.display =
        fileOptions.style.display === "block" ? "none" : "block";
    }
  };

  // Handle file uploads without creating duplicate messages
  const handleFileSend = async () => {
    if (!selectedFile) return;

    try {
      // Create FormData to send file
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("sender", user._id);
      formData.append("receiver", admin._id);

      // Upload file to backend
      const res = await APIADMIN.post("/chats/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Get the uploaded message data from response
      const uploadedMessage = res.data;

      // The backend already saved it, we just notify the room
      const roomId = [user._id, admin._id].sort().join("-");

      // Normalize uploaded message for socket emission
      const normalizedUploadedMsg = {
        ...uploadedMessage,
        sender:
          uploadedMessage.sender?._id || uploadedMessage.sender || user._id,
        receiver: admin._id,
        // Ensure timestamp compatibility
        timestamp: uploadedMessage.createdAt || uploadedMessage.timestamp,
        _skipSave: true, // Flag to prevent duplicate save
      };

      // Notify the room about the new file message
      socket.emit("sendMessage", normalizedUploadedMsg);

      // Clear preview and reset states
      setPreview(null);
      setSelectedFile(null);
      setInputValue("");

      // Reset file inputs
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (imageVideoInputRef.current) imageVideoInputRef.current.value = "";
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("Failed to send file. Please try again.");
    }
  };

  // Update the handleFileSelect to also handle validation
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Optional: Add file size validation (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert("File size exceeds 10MB. Please select a smaller file.");
      e.target.value = ""; // Reset input
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  // Cancel preview and clear all states
  const handleCancelPreview = () => {
    setPreview(null);
    setSelectedFile(null);
    setInputValue("");

    // Reset file inputs
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageVideoInputRef.current) imageVideoInputRef.current.value = "";
  };

  // UI RENDER
  return (
    <div className="chat-panel-backdrop">
      <div className="chat-panel" onClick={(e) => e.stopPropagation()}>
        <div className="chat-header">
          <span>{admin.name}</span>
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
                  // Fixed: Check fileType without slash
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
                    {/* Only show Edit for text messages, not files */}
                    {!msg.fileUrl && (
                      <button onClick={() => handleEdit(msg)}>Edit</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

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
            <button className="send-btn" onClick={handleFileSend}>
              Send
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

          {/* Inputs */}
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
            onChange={(e) => setInputValue(e.target.value)}
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
