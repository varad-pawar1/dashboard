import React from "react";
import Button from "../components/Button";
import "../styles/dashboard.css";
export function Sidebar({
  admins,
  loading,
  onSelectAdmin,
  selectedAdmin,
  user,
  onLogout,
  onSendResetLink,
  unreadCounts,
  lastMessages,
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-heading">
        <p className="chath">Chat</p>
      </div>

      <div className="sidebar-chats">
        {loading ? (
          <p>Loading admins...</p>
        ) : admins.length > 0 ? (
          admins.map((admin) => {
            const lastMsg = lastMessages[admin._id];
            let lastText = lastMsg ? lastMsg.text : "";

            if (lastText.length > 20) {
              lastText = lastText.substring(0, 20) + "...";
            }

            return (
              <div
                key={admin._id}
                className={`chat-user-item ${
                  selectedAdmin?._id === admin._id ? "active" : ""
                }`}
                onClick={() => onSelectAdmin(admin)}
              >
                <div className="chat-user-avatar">
                  {admin.name.charAt(0).toUpperCase()}
                </div>

                <div className="chat-user-info">
                  <p className="chat-user-name">{admin.name}</p>
                  <p style={{ fontSize: "12px" }}>{admin.email}</p>
                  <span className="chat-user-last">{lastText}</span>
                </div>

                {/* Unread badge */}
                {unreadCounts[admin._id] > 0 && (
                  <div className="unread-badge">
                    {unreadCounts[admin._id] > 99
                      ? "99+"
                      : unreadCounts[admin._id]}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p>No admins found</p>
        )}
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
