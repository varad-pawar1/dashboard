import React, { useState } from "react";
import APIADMIN from "../api/admin";
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
  onConversationStarted,
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

      {/* Popup section */}
      {showPopup && (
        <div className="popup">
          <div className="popup-header">
            <h2>Create</h2>
            <i
              className="fa-solid fa-xmark close-icon"
              onClick={closePopup}
              style={{ cursor: "pointer", fontSize: "20px" }}
            ></i>
          </div>

          <button
            className="new-group-btn"
            onClick={() => {
              handleGroupClick();
              closePopup();
            }}
          >
            <i className="fa-solid fa-plus"></i> New Group
          </button>

          <div className="sidebar-chats">
            {loading ? (
              <p>Loading chats...</p>
            ) : chats.length > 0 ? (
              chats.map((chat) => {
                const isGroup = chat.isGroup;
                const handleClick = async () => {
                  try {
                    if (isGroup) {
                      onSelectChat(chat);
                      closePopup();
                      return;
                    }
                    // Create or fetch private conversation by other user id
                    const res = await APIADMIN.get(`/conversation/${chat._id}`);
                    const conversation = res.data.conversation;
                    if (conversation?._id) {
                      const convLike = {
                        ...conversation,
                        name: chat.name,
                        isGroup: false,
                      };
                      onConversationStarted?.(convLike);
                      onSelectChat(convLike);
                      closePopup();
                    }
                  } catch (e) {
                    console.error("Failed to start conversation:", e);
                  }
                };
                return (
                  <div
                    key={chat._id}
                    className={`chat-user-item ${
                      selectedChat?._id === chat._id ? "active" : ""
                    }`}
                    onClick={handleClick}
                  >
                    <div className="chat-user-avatar">
                      {isGroup
                        ? chat.groupName.charAt(0).toUpperCase()
                        : chat.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="chat-user-info">
                      <p className="chat-user-name">
                        {isGroup ? chat.groupName : chat.name}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p>No chats found</p>
            )}
          </div>
        </div>
      )}

      <div className="conversation">
        <div className="conversation-header">
          <p className="chath">Conversations</p>
        </div>

        <div className="conversation-chats">
          {loading ? (
            <p>Loading chats...</p>
          ) : usersWithConversations && usersWithConversations.length > 0 ? (
            usersWithConversations.map((chat) => {
              const isGroup = chat.isGroup;
              const lastMsg =
                lastMessages[String(chat._id)] ||
                (chat.lastMessage
                  ? {
                      text: chat.lastMessage.fileUrl
                        ? chat.lastMessage.fileType === "image"
                          ? "📷 Image"
                          : chat.lastMessage.fileType === "video"
                          ? "🎥 Video"
                          : "📎 File"
                        : chat.lastMessage.message,
                      timestamp: chat.lastMessage.createdAt,
                    }
                  : null);
              let lastText = lastMsg ? lastMsg.text || "" : "";
              if (lastText.length > 25)
                lastText = lastText.substring(0, 25) + "...";
              const unread = Number(
                (unreadCounts || {})[String(chat._id)] || 0
              );

              return (
                <div
                  key={chat._id}
                  className={`chat-user-item ${
                    selectedChat?._id === chat._id ? "active" : ""
                  }`}
                  onClick={() => onSelectChat(chat)}
                >
                  <div className="chat-user-avatar">
                    {isGroup ? chat.groupName.charAt(0).toUpperCase() : "V"}
                  </div>

                  <div className="chat-user-info">
                    <p className="chat-user-name">
                      {isGroup ? chat.groupName : chat.name}
                    </p>
                    <span className="chat-user-last">{lastText}</span>
                  </div>
                  {unread > 0 && (
                    <div className="unread-badge">
                      {unread > 99 ? "99+" : unread}
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
