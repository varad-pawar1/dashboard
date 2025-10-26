import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import APIADMIN from "../api/admin";

let socket;

export default function ChatPanel({ user, admin, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [menuVisibleId, setMenuVisibleId] = useState(null); // For menu
  const scrollRef = useRef();

  useEffect(() => {
    socket = io(`${import.meta.env.VITE_BACKEND_URL}`);
    const roomId = [user._id, admin._id].sort().join("-");
    socket.emit("joinRoom", roomId);

    // Fetch previous messages
    APIADMIN.get(`/chats/${user._id}/${admin._id}`)
      .then((res) => {
        const normalized = res.data.map((msg) => ({
          ...msg,
          sender: msg.sender?._id || msg.sender,
        }));
        setMessages(normalized);
      })
      .catch(console.error);

    socket.on("receiveMessage", (msg) => {
      const normalizedMsg = { ...msg, sender: msg.sender?._id || msg.sender };
      setMessages((prev) =>
        prev.some((m) => m._id === normalizedMsg._id)
          ? prev
          : [...prev, normalizedMsg]
      );
    });

    socket.on("deleteMessage", (msgId) => {
      setMessages((prev) => prev.filter((m) => m._id !== msgId));
    });

    socket.on("updateMessage", (updatedMsg) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m))
      );
    });

    return () => socket.disconnect();
  }, [user, admin]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    const msgObj = {
      sender: user._id,
      receiver: admin._id,
      message: newMessage,
    };

    socket.emit("sendMessage", msgObj);
    setMessages((prev) => [...prev, { ...msgObj, _id: Date.now().toString() }]);
    setNewMessage("");
  };

  const handleDelete = (msgId) => {
    APIADMIN.delete(`/chats/${msgId}`)
      .then(() => {
        socket.emit("deleteMessage", msgId);
        setMessages((prev) => prev.filter((m) => m._id !== msgId));
      })
      .catch(console.error);
  };

  const handleEdit = (msg) => {
    setEditingMessageId(msg._id);
    setEditingText(msg.message);
    setMenuVisibleId(null); // hide menu
  };

  const handleUpdate = () => {
    APIADMIN.put(`/chats/${editingMessageId}`, { message: editingText })
      .then((res) => {
        const updatedMsg = res.data;
        socket.emit("updateMessage", updatedMsg);
        setMessages((prev) =>
          prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m))
        );
        setEditingMessageId(null);
        setEditingText("");
      })
      .catch(console.error);
  };

  return (
    <div className="chat-panel-backdrop">
      <div className="chat-panel">
        <div className="chat-header">
          <span>{admin.name}</span>
          <button className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-circle-xmark"></i>
          </button>
        </div>

        <div className="chat-messages">
          {messages.map((msg, index) => {
            const isSentByUser = String(msg.sender) === String(user._id);
            const isEditing = editingMessageId === msg._id;

            return (
              <div
                key={msg._id || index}
                className={`chat-message ${isSentByUser ? "sent" : "received"}`}
                ref={index === messages.length - 1 ? scrollRef : null}
                onClick={() =>
                  isSentByUser
                    ? setMenuVisibleId(msg._id)
                    : setMenuVisibleId(null)
                }
              >
                {isEditing ? (
                  <div className="edit-container">
                    <input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                    />
                    <button onClick={handleUpdate}>Update</button>
                    <button onClick={() => setEditingMessageId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span>{msg.message}</span>
                    {isSentByUser && menuVisibleId === msg._id && (
                      <div className="message-menu">
                        <button onClick={() => handleEdit(msg)}>Edit</button>
                        <button onClick={() => handleDelete(msg._id)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="chat-input">
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
}
