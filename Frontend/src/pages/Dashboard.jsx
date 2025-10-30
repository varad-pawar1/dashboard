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
import NewGroup from "./NewGroup";

let socket;

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, admins, groups, loading } = useSelector((state) => state.admin);

  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  useEffect(() => {
    if (!user?._id) return;

    socket = io(import.meta.env.VITE_BACKEND_URL, { withCredentials: true });

    socket.on("connect", () => {
      console.log("Connected:", socket.id);
      socket.emit("joinUser", user._id);
    });

    //Receive initial unread + last message data
    socket.on("initChatData", ({ unreadCounts, lastMessages }) => {
      setUnreadCounts(unreadCounts || {});
      setLastMessages(lastMessages || {});
    });

    //Increment unread count for sender
    socket.on("incrementUnread", ({ sender }) => {
      setUnreadCounts((prev) => ({
        ...prev,
        [sender]: (prev[sender] || 0) + 1,
      }));
    });
    socket.on("decrementUnreadCount", (sender) => {
      console.log("decrementUnreadCount received:");
      setUnreadCounts((prev) => ({
        ...prev,
        [sender]: Math.max((prev[sender] || 0) - 1, 0),
      }));
    });

    // Recalculated unread count after deletion
    socket.on("updateUnreadCount", ({ otherUserId, count }) => {
      setUnreadCounts((prev) => ({
        ...prev,
        [otherUserId]: count,
      }));
    });

    //Reset unread on read
    socket.on("messagesRead", ({ readerId }) => {
      setUnreadCounts((prev) => ({ ...prev, [readerId]: 0 }));
    });

    //Reset on explicit reset
    socket.on("resetUnread", ({ sender }) => {
      setUnreadCounts((prev) => ({ ...prev, [sender]: 0 }));
    });

    //Update last message instantly when server notifies
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

  const handleSelectAdmin = (chat) => {
    setSelectedAdmin(chat);
    setUnreadCounts((prev) => ({ ...prev, [chat._id]: 0 }));

    socket.emit("markAsRead", {
      userId: user._id,
      otherUserId: chat._id,
      isGroup: chat.isGroup,
    });
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
  const handleGroupClick = () => {
    setIsCreatingGroup(true);
    setSelectedAdmin(null);
  };
  const handleCloseGroupCreator = () => {
    setIsCreatingGroup(false);
  };
  // Combine groups and admins into one array
  const combinedChats = [
    ...admins.map((a) => ({ ...a, isGroup: false })),
    ...groups.map((g) => ({ ...g, isGroup: true })),
  ];

  // Sort by last message timestamp (newest first)
  const sortedChats = combinedChats.sort((a, b) => {
    const timeA =
      lastMessages[a._id]?.timestamp || lastMessages[a._id]?.createdAt || 0;
    const timeB =
      lastMessages[b._id]?.timestamp || lastMessages[b._id]?.createdAt || 0;
    return new Date(timeB) - new Date(timeA);
  });

  return (
    <div className="chat-app-container">
      <Sidebar
        chats={sortedChats}
        loading={loading}
        onSelectChat={handleSelectAdmin}
        selectedChat={selectedAdmin}
        user={user}
        onLogout={handleLogout}
        onSendResetLink={handleSendResetLink}
        unreadCounts={unreadCounts}
        lastMessages={lastMessages}
        handleGroupClick={handleGroupClick}
      />

      {isCreatingGroup ? (
        <NewGroup
          admins={admins}
          onClose={handleCloseGroupCreator}
          socket={socket}
          user={user}
        />
      ) : selectedAdmin ? (
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
