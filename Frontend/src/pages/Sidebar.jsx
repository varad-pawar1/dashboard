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
}) {
  const [showPopup, setShowPopup] = useState(false);

  const togglePopup = () => setShowPopup((prev) => !prev);
  const closePopup = () => setShowPopup(false);

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
                return (
                  <div
                    key={chat._id}
                    className={`chat-user-item ${
                      selectedChat?._id === chat._id ? "active" : ""
                    }`}
                    onClick={() => onSelectChat(chat)}
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
        <div className="conversation-chats"></div>
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
