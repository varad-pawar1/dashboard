import React, { useState } from "react";
import Button from "../components/Button";
import "../styles/dashboard.css";

export function Sidebar({
  chats,
  loading,
  onSelectChat,
  selectedChat,
  user,
  onLogout,
  unreadCounts,
  lastMessages,
  handleGroupClick,
  usersWithConversations,
}) {
  const [showPopup, setShowPopup] = useState(false);

  const togglePopup = () => setShowPopup((prev) => !prev);
  const closePopup = () => setShowPopup(false);
  console.log("usersWithConversations in Sidebar:", usersWithConversations);
  return (
    <div className="sidebar">
      <div className="sidebar-heading">
        <p className="chath">Chat</p>
        <i
          className="fa-regular fa-pen-to-square"
          onClick={togglePopup}
          style={{ cursor: "pointer" }}
        ></i>
      </div>

      <div className="conversation">
        <div className="conversation-header">
          <p className="chath">Conversations</p>
        </div>

        <div className="conversation-chats">
          {loading ? (
            <p>Loading chats...</p>
          ) : usersWithConversations && usersWithConversations.length > 0 ? (
            usersWithConversations.map((conv) => {
              const isGroup = conv.isGroup;
              // Determine the other user for private chats
              const otherUser = !isGroup
                ? Array.isArray(conv.participants)
                  ? conv.participants.find(
                      (p) => String(p?._id || p) !== String(user._id)
                    )
                  : null
                : null;

              const otherUserId = isGroup
                ? String(conv._id)
                : String(otherUser?._id || otherUser || "");
              const displayName = isGroup
                ? conv.groupName
                : otherUser?.name || "Unknown User";

              const lastKey = isGroup ? String(conv._id) : otherUserId;
              const lastMsg = lastMessages[lastKey];
              // Fallback to conversation.lastMessage if socket not ready
              const fallbackLast = conv.lastMessage
                ? {
                    text: conv.lastMessage.fileUrl
                      ? conv.lastMessage.fileType === "image"
                        ? "📷 Image"
                        : conv.lastMessage.fileType === "video"
                        ? "🎥 Video"
                        : "📎 File"
                      : conv.lastMessage.message,
                    timestamp: conv.lastMessage.createdAt,
                  }
                : null;
              const effectiveLast = lastMsg || fallbackLast;
              let lastText = effectiveLast ? effectiveLast.text || "" : "";
              if (lastText.length > 25)
                lastText = lastText.substring(0, 25) + "...";

              const isActive = selectedChat?.conversationId === conv._id;

              return (
                <div
                  key={conv._id}
                  className={`chat-user-item ${isActive ? "active" : ""}`}
                  onClick={() =>
                    onSelectChat({
                      conversationId: conv._id,
                      isGroup,
                      otherUserId: isGroup ? null : otherUserId,
                      name: displayName,
                    })
                  }
                >
                  <div className="chat-user-avatar">
                    {isGroup
                      ? (conv.groupName || "G").charAt(0).toUpperCase()
                      : (displayName || "U").charAt(0).toUpperCase()}
                  </div>

                  <div className="chat-user-info">
                    <p className="chat-user-name">{displayName}</p>
                    <span className="chat-user-last">{lastText}</span>
                  </div>
                  {Number(unreadCounts[lastKey] || 0) > 0 && (
                    <div className="unread-badge">
                      {Number(unreadCounts[lastKey]) > 99
                        ? "99+"
                        : Number(unreadCounts[lastKey])}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p>No conversations yet</p>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-header">
            <div className="userInfo">
              <div className="img">
                {user?.avatar ? (
                  <img src={user.avatar} alt="User Avatar" />
                ) : (
                  <i
                    className="fa-solid fa-user"
                    style={{ color: "#74C0FC", fontSize: "24px" }}
                  />
                )}
              </div>
              <div>
                <strong>{user?.name}</strong>
                <p>{user?.email}</p>
              </div>
            </div>

            <div className="sidebarb">
              <Button label="Logout" onClick={onLogout} variant={"logout"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
