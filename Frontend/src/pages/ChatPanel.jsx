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
    // Focus the input when the component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
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
      const normalized = {
        ...updatedMsg,
        sender: updatedMsg.sender?._id || updatedMsg.sender,
      };
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(normalized._id) ? normalized : m
        )
      );
      // If the message we were editing was updated by someone else, clear edit state
      if (
        editingMessageId &&
        String(editingMessageId) === String(normalized._id)
      ) {
        setEditingMessageId(null);
        setInputValue("");
      }

      // always hide any open menu for the updated message
      setMenuVisibleId(null);
    });

    socket.on("deleteMessage", (msgId) => {
      setMessages((prev) =>
        prev.filter((m) => String(m._id) !== String(msgId))
      );
      // If the deleted message was being edited, clear edit state
      if (editingMessageId && String(editingMessageId) === String(msgId)) {
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
  }, [user._id, admin._id]); // keep dependency minimal

  // Scroll to latest
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Utility flag: are we currently editing any message?
  const isEditing = Boolean(editingMessageId);

  // Send or Update
  const handleSend = async () => {
    if (!inputValue.trim()) return;

    if (isEditing) {
      try {
        const res = await APIADMIN.put(`/chats/${editingMessageId}`, {
          message: inputValue,
        });
        const updatedMsg = res.data;
        // notify server/other clients
        socket.emit("updateMessage", {
          ...updatedMsg,
          sender: user._id,
          receiver: admin._id,
        });

        // update local state optimistically (server will also emit updateMessage)
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

        // Clear editing state and any open menu
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

  // Delete
  const handleDelete = async (msgId) => {
    try {
      // 1) delete on server via REST
      await APIADMIN.delete(`/chats/${msgId}`);

      // 2) notify other clients via socket so server will broadcast to the room
      // Use a simple 'notifyDelete' event (server will broadcast to room without re-deleting)
      socket.emit("notifyDelete", {
        _id: msgId,
        sender: user._id,
        receiver: admin._id,
      });

      // 3) update local UI immediately (optimistic)
      setMessages((prev) =>
        prev.filter((m) => String(m._id) !== String(msgId))
      );

      // ensure we clear UI state
      if (editingMessageId && String(editingMessageId) === String(msgId)) {
        setEditingMessageId(null);
        setInputValue("");
      }
      setMenuVisibleId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit
  const handleEdit = (msg) => {
    setMenuVisibleId(null);
    setEditingMessageId(msg._id);
    setInputValue(msg.message);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  const cancelEdit = () => {
    setEditingMessageId(null);
    setInputValue("");
    setMenuVisibleId(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Close menu on outside click (but don't close editor)
  useEffect(() => {
    const handleClickOutside = () => {
      // Only clear menu, don't cancel an active edit
      setMenuVisibleId(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Click handler on message: open menu only if it's the user's message and we're NOT editing
  const handleMessageClick = (e, msg) => {
    e.stopPropagation();
    const isSentByUser = String(msg.sender) === String(user._id);
    if (!isSentByUser) return;
    if (isEditing) return; // do not open any menu while editing
    setMenuVisibleId((prev) => (prev === msg._id ? null : msg._id));
  };

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
            const isThisEditing =
              editingMessageId && String(editingMessageId) === String(msg._id);

            return (
              <div
                key={msg._id || index}
                className={`chat-message ${
                  isSentByUser ? "sent" : "received"
                } ${isThisEditing ? "editing" : ""}`}
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

        {/* Input */}
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
