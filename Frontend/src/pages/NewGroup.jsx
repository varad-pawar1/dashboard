import React, { useEffect, useRef, useState } from "react";
import APIADMIN from "../api/admin";
import "../styles/newgroup.css";

export default function NewGroup({ admins = [], onClose, socket, user, onGroupCreated }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef();

  // Autofocus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Toggle selection
  const toggleSelectUser = (id) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  // Handle group creation
  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      alert("Please enter a group name and select at least one member.");
      return;
    }

    setCreating(true);

    try {
      // Send group creation request to backend
      const res = await APIADMIN.post("/create-group", {
        name: groupName,
        members: [user._id, ...selectedUsers],
        createdBy: user._id,
      });

      const createdGroup = res.data.group;

      // Emit event via socket for real-time update
      socket.emit("groupCreated", createdGroup);

      // Call callback to add group to conversation list
      if (onGroupCreated) {
        onGroupCreated(createdGroup);
      } else {
        alert("Group created successfully!");
        onClose();
      }
    } catch (err) {
      console.error("Error creating group:", err);
      alert("Failed to create group. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="newgroup-overlay">
      <div className="newgroup-modal">
        <div className="newgroup-header">
          <h2>Create New Group</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="newgroup-body">
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="group-name-input"
          />

          <div className="user-list">
            {admins.length === 0 ? (
              <p className="no-users">No users available</p>
            ) : (
              admins.map((admin) => (
                <div
                  key={admin._id}
                  className={`user-item ${
                    selectedUsers.includes(admin._id) ? "selected" : ""
                  }`}
                  onClick={() => toggleSelectUser(admin._id)}
                >
                  <div className="avatar">
                    {admin.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="info">
                    <p className="name">{admin.name}</p>
                    <p className="email">{admin.email}</p>
                  </div>
                  {selectedUsers.includes(admin._id) && (
                    <i className="fa-solid fa-check checkmark"></i>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="newgroup-footer">
          <button className="cancel-btn" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button
            className="create-btn"
            onClick={handleCreateGroup}
            disabled={creating}
          >
            {creating ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
}
