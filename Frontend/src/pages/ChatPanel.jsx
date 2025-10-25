import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import APIADMIN from "../api/admin";

let socket;

export default function ChatPanel({ user, admin, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef();

  // Initialize Socket.IO and fetch chat history
  useEffect(() => {
    socket = io(`${import.meta.env.VITE_BACKEND_URL}`);

    const roomId = `${user._id}-${admin._id}`;
    socket.emit("joinRoom", roomId);

    // Fetch existing chat history
    APIADMIN.get(`/chats/${user._id}/${admin._id}`)
      .then((res) => setMessages(res.data))
      .catch(console.error);

    // Listen for incoming messages
    socket.on("receiveMessage", (msg) => {
      if (
        (msg.sender === user._id && msg.receiver === admin._id) ||
        (msg.sender === admin._id && msg.receiver === user._id)
      ) {
        setMessages((prev) => {
          // prevent duplicate message
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user, admin]);

  // Scroll to last message
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSend = () => {
    if (!newMessage.trim()) return;

    const msgData = {
      sender: user._id,
      receiver: admin._id,
      message: newMessage,
    };

    // Emit message to server
    socket.emit("sendMessage", msgData);

    setNewMessage(""); // clear input
  };

  return (
    <div className="chat-panel-backdrop">
      <div className="chat-panel">
        <div className="chat-header">
          <span>{admin.name}</span>
          <button className="close-btn" onClick={onClose}>
            <i class="fa-solid fa-circle-xmark"></i>
          </button>
        </div>

        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div
              key={msg._id ? `${msg._id}-${index}` : index} // unique key
              className={`chat-message ${
                msg.sender === user._id ? "sent" : "received"
              }`}
              ref={index === messages.length - 1 ? scrollRef : null}
            >
              {msg.message}
            </div>
          ))}
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
