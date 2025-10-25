import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import APIADMIN from "../api/admin";

let socket;

export default function ChatPanel({ user, admin, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef();

  useEffect(() => {
    socket = io(`${import.meta.env.VITE_BACKEND_URL}`);

    const roomId = [user._id, admin._id].sort().join("-");
    socket.emit("joinRoom", roomId);

    // Fetch existing conversation messages
    APIADMIN.get(`/chats/${user._id}/${admin._id}`)
      .then((res) => {
        // Normalize messages: convert sender to string
        const normalized = res.data.map((msg) => ({
          ...msg,
          sender: msg.sender?._id ? msg.sender._id : msg.sender,
        }));
        setMessages(normalized);
      })
      .catch(console.error);

    // Listen for incoming messages
    socket.on("receiveMessage", (msg) => {
      const normalizedMsg = {
        ...msg,
        sender: msg.sender?._id ? msg.sender._id : msg.sender,
      };

      setMessages((prev) => {
        if (prev.some((m) => m._id === normalizedMsg._id)) return prev;
        return [...prev, normalizedMsg];
      });
    });

    return () => socket.disconnect();
  }, [user, admin]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    socket.emit("sendMessage", {
      sender: user._id,
      receiver: admin._id,
      message: newMessage,
    });

    setNewMessage("");
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
            return (
              <div
                key={msg._id || index}
                className={`chat-message ${isSentByUser ? "sent" : "received"}`}
                ref={index === messages.length - 1 ? scrollRef : null}
              >
                {msg.message}
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
