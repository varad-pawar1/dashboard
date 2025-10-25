import "../styles/dashboard.css";
import React, { useState } from "react";
import ChatPanel from "./ChatPanel";

export function MainBodyDash({ admins, loading, user }) {
  const [chatAdmin, setChatAdmin] = useState(null);

  return (
    <div className="mainbody-container">
      <div className="admin-list-container">
        <h2 className="mainbody-title">Admins</h2>
        {loading ? (
          <p className="message message-success">Loading admins...</p>
        ) : admins?.length > 0 ? (
          <div className="admin-list">
            {admins.map((admin) => (
              <div key={admin._id} className="admin-item">
                <div className="admin-avatar">
                  {admin.name.charAt(0).toUpperCase()}
                </div>
                <div className="admin-info">
                  <p className="admin-name">{admin.name}</p>
                  <p className="admin-email">{admin.email}</p>
                </div>
                <button
                  className="chat-button"
                  onClick={() => setChatAdmin(admin)}
                >
                  Chat
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="message message-error">No admins found</p>
        )}
      </div>

      {chatAdmin && (
        <ChatPanel
          user={user}
          admin={chatAdmin}
          onClose={() => setChatAdmin(null)}
        />
      )}
    </div>
  );
}
