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
          admins.map((admin) => (
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
                <p>{admin.name}</p>
                <span>{admin.email}</span>
              </div>
            </div>
          ))
        ) : (
          <p>No admins found</p>
        )}
      </div>

      <div className="sidebar-footer">
        {loading ? (
          <p>Loading admin...</p>
        ) : user ? (
          <div className="sidebar-header">
            <div className="userInfo">
              <div className="img">
                {user?.avatar ? (
                  <img src={user.avatar} alt="User Avatar" />
                ) : (
                  <i
                    className="fa-solid fa-user"
                    style={{ color: "#74C0FC", fontSize: "24px" }}
                  ></i>
                )}
              </div>
              <div>
                <strong>{user?.name}</strong>
                <p>{user?.email}</p>
              </div>
            </div>
            <div className="sidebarb">
              <Button label="Logout" onClick={onLogout} variant={"logout"} />
              {/* <Button
              label="Set Password"
              onClick={onSendResetLink}
              variant={"SP"}
            /> */}
            </div>
          </div>
        ) : (
          <p>No admins found</p>
        )}
      </div>
    </div>
  );
}
