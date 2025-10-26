import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import APIADMIN from "../api/admin";

let socket;

export default function ChatPanel({ user, admin, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [menuVisibleId, setMenuVisibleId] = useState(null);
  const scrollRef = useRef();

  const roomId = [user._id, admin._id].sort().join("-");

  // Socket & Chat History
  useEffect(() => {
    socket = io(`${import.meta.env.VITE_BACKEND_URL}`);
    socket.emit("joinRoom", roomId);

    APIADMIN.get(`/chats/${user._id}/${admin._id}`)
      .then((res) => {
        const normalized = res.data.map((msg) => ({
          ...msg,
          sender: msg.sender?._id || msg.sender,
        }));
        setMessages(normalized);
      })
      .catch(console.error);

    // Socket Listeners

    socket.on("receiveMessage", (msg) => {
      const normalizedMsg = { ...msg, sender: msg.sender?._id || msg.sender };
      setMessages((prev) =>
        prev.some((m) => String(m._id) === String(normalizedMsg._id))
          ? prev
          : [...prev, normalizedMsg]
      );
    });

    socket.on("updateMessage", (updatedMsg) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(updatedMsg._id) ? updatedMsg : m
        )
      );
    });

    socket.on("deleteMessage", (msgId) => {
      setMessages((prev) =>
        prev.filter((m) => String(m._id) !== String(msgId))
      );
    });

    return () => socket.disconnect();
  }, [user._id, admin._id]);

  // Scroll to latest
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send or Update
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

  // Delete
  const handleDelete = async (msgId) => {
    try {
      await APIADMIN.delete(`/chats/${msgId}`);
      socket.emit("deleteMessage", {
        _id: msgId,
        sender: user._id,
        receiver: admin._id,
      });
      setMessages((prev) =>
        prev.filter((m) => String(m._id) !== String(msgId))
      );
      setMenuVisibleId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit
  const handleEdit = (msg) => {
    setEditingMessageId(msg._id);
    setInputValue(msg.message);
    setMenuVisibleId(null);
  };
  const cancelEdit = () => {
    setEditingMessageId(null);
    setInputValue("");
  };

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setMenuVisibleId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="chat-panel-backdrop">
      <div className="chat-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="chat-header">
          <span>{admin.name}</span>
          <button className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-circle-xmark"></i>
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg, index) => {
            const isSentByUser = String(msg.sender) === String(user._id);
            return (
              <div
                key={msg._id || index}
                className={`chat-message ${isSentByUser ? "sent" : "received"}`}
                ref={index === messages.length - 1 ? scrollRef : null}
                onClick={() => isSentByUser && setMenuVisibleId(msg._id)}
              >
                <span>{msg.message}</span>
                {isSentByUser && menuVisibleId === msg._id && (
                  <div className="message-menu">
                    <button onClick={() => handleDelete(msg._id)}>
                      Delete
                    </button>
                    <button onClick={() => handleEdit(msg)}>Edit</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="chat-input">
          <input
            type="text"
            placeholder={
              editingMessageId ? "Edit your message..." : "Type a message..."
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          {editingMessageId ? (
            <>
              <button onClick={handleSend}>Update</button>
              <button onClick={cancelEdit}>Cancel</button>
            </>
          ) : (
            <button onClick={handleSend}>Send</button>
          )}
        </div>
      </div>
    </div>
  );
}
