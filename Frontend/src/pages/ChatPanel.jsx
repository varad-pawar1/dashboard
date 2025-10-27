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
  const inputRef = useRef();

  const roomId = [user._id, admin._id].sort().join("-");

  useEffect(() => {
    socket = io(`${import.meta.env.VITE_BACKEND_URL}`);
    socket.emit("joinRoom", roomId);

    // Fetch chat history
    APIADMIN.get(`/chats/${user._id}/${admin._id}`)
      .then((res) => {
        const normalized = res.data.map((msg) => ({
          ...msg,
          sender: msg.sender?._id || msg.sender,
        }));
        setMessages(normalized);

        // Once loaded, mark all as read
        socket.emit("markAsRead", {
          userId: user._id,
          otherUserId: admin._id,
        });
      })
      .catch(console.error);

    // Focus input on mount
    inputRef.current?.focus();

    // Socket listeners
    socket.on("receiveMessage", (msg) => {
      const normalizedMsg = { ...msg, sender: msg.sender?._id || msg.sender };
      setMessages((prev) =>
        prev.some((m) => String(m._id) === String(normalizedMsg._id))
          ? prev
          : [...prev, normalizedMsg]
      );

      // Auto mark as read if chat is open
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user._id, admin._id]);

  //Auto-scroll

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isEditing = Boolean(editingMessageId);

  //Send or Update Message

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    if (isEditing) {
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
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(updatedMsg._id)
              ? {
                  ...updatedMsg,
                  sender: updatedMsg.sender?._id || updatedMsg.sender,
                }
              : m
          )
        );
        setEditingMessageId(null);
        setInputValue("");
        setMenuVisibleId(null);
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

  //Delete Message

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

  //Edit Message

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

  //Menu Handling

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

  //Render

  return (
    <div className="chat-panel-backdrop">
      <div className="chat-panel" onClick={(e) => e.stopPropagation()}>
        <div className="chat-header">
          <span>{admin.name}</span>
          <button className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-circle-xmark"></i>
          </button>
        </div>

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
                <span>{msg.message}</span>

                {isSentByUser && menuVisibleId === msg._id && !isEditing && (
                  <div
                    className="message-menu"
                    onClick={(e) => e.stopPropagation()}
                  >
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

        <div className="chat-input">
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
            <button onClick={handleSend}>Send</button>
          )}
        </div>
      </div>
    </div>
  );
}
