import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../features/auth/authActions";
import {
  fetchDashboardData,
  sendResetLink,
} from "../features/auth/adminActions";
import { Sidebar } from "./Sidebar";
import ChatPanel from "./ChatPanel";
import "../styles/dashboard.css";
import { io } from "socket.io-client";

let socket;

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, admins, loading } = useSelector((state) => state.admin);

  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});

  useEffect(() => {
    if (!user?._id) return;

    socket = io(import.meta.env.VITE_BACKEND_URL, { withCredentials: true });

    socket.on("connect", () => {
      console.log("Connected:", socket.id);
      socket.emit("joinUser", user._id);
    });

    // 🔹 Receive initial unread + last message data
    socket.on("initChatData", ({ unreadCounts, lastMessages }) => {
      setUnreadCounts(unreadCounts || {});
      setLastMessages(lastMessages || {});
    });

    // 🔹 Increment unread count for sender
    socket.on("incrementUnread", ({ sender }) => {
      setUnreadCounts((prev) => ({
        ...prev,
        [sender]: (prev[sender] || 0) + 1,
      }));
    });

    // 🔹 Reset unread on read
    socket.on("messagesRead", ({ readerId }) => {
      setUnreadCounts((prev) => ({ ...prev, [readerId]: 0 }));
    });

    // 🔹 Reset on explicit reset
    socket.on("resetUnread", ({ sender }) => {
      setUnreadCounts((prev) => ({ ...prev, [sender]: 0 }));
    });

    // 🔹 Update last message instantly when server notifies
    socket.on("updateLastMessage", ({ otherUserId, lastMessage }) => {
      setLastMessages((prev) => ({
        ...prev,
        [otherUserId]: lastMessage || null,
      }));
    });

    return () => socket.disconnect();
  }, [user]);

  useEffect(() => {
    dispatch(fetchDashboardData()).catch(() => navigate("/login"));
  }, [dispatch, navigate]);

  const handleSelectAdmin = (admin) => {
    setSelectedAdmin(admin);
    setUnreadCounts((prev) => ({ ...prev, [admin._id]: 0 }));
    socket.emit("markAsRead", { userId: user._id, otherUserId: admin._id });
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const handleSendResetLink = async () => {
    if (!user?.email) return;
    try {
      await dispatch(sendResetLink(user.email));
    } catch (err) {
      console.error(err.message || err);
    }
  };

  return (
    <div className="chat-app-container">
      <Sidebar
        admins={admins}
        loading={loading}
        onSelectAdmin={handleSelectAdmin}
        selectedAdmin={selectedAdmin}
        user={user}
        onLogout={handleLogout}
        onSendResetLink={handleSendResetLink}
        unreadCounts={unreadCounts}
        lastMessages={lastMessages}
      />

      {selectedAdmin ? (
        <ChatPanel
          user={user}
          admin={selectedAdmin}
          socket={socket}
          onClose={() => setSelectedAdmin(null)}
        />
      ) : (
        <div className="chat-empty">
          <p>Select a chat to start messaging</p>
        </div>
      )}
    </div>
  );
}
