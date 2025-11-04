import { useEffect, useState, useRef } from "react";
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
import store from "../features/app/store";
import Chatbot from "./Chatbot";

let socket;

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, admins, groups, loading, usersWithConversations } = useSelector(
    (state) => state.admin
  );

  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const pendingSelectedId = useRef(null); // Track conversation ID that should be selected after refetch

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

    //Update last message instantly when server notifies (legacy private)
    socket.on("updateLastMessage", ({ otherUserId, lastMessage }) => {
      setLastMessages((prev) => ({
        ...prev,
        [otherUserId]: lastMessage || null,
      }));
    });

    // Conversation-based updates
    socket.on("updateConvLastMessage", ({ conversationId, lastMessage }) => {
      setLastMessages((prev) => ({
        ...prev,
        [conversationId]: lastMessage || null,
      }));
    });
    socket.on("updateConvUnread", ({ conversationId, delta }) => {
      setUnreadCounts((prev) => ({
        ...prev,
        [conversationId]: Math.max(
          (prev[conversationId] || 0) + (delta || 0),
          0
        ),
      }));
    });
    socket.on("setConvUnread", ({ conversationId, count }) => {
      setUnreadCounts((prev) => ({ ...prev, [conversationId]: count }));
    });
    socket.on("resetConvUnread", ({ conversationId }) => {
      setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }));
    });

    // Listen for new group creation (broadcasted to all participants)
    socket.on("newGroupCreated", async (group) => {
      // Refetch conversations to ensure consistency
      try {
        await dispatch(fetchDashboardData());
      } catch (error) {
        console.error(
          "Error refetching conversations after group creation:",
          error
        );
      }
      // Initialize unread and last message for new group
      setUnreadCounts((prev) => ({ ...prev, [group._id]: 0 }));
      setLastMessages((prev) => ({
        ...prev,
        [group._id]: prev[group._id] || null,
      }));
    });

    // Listen for new private conversation creation (broadcasted to both participants)
    socket.on("newConversationCreated", async (conversation) => {
      // Refetch conversations to ensure consistency
      try {
        await dispatch(fetchDashboardData());
      } catch (error) {
        console.error(
          "Error refetching conversations after conversation creation:",
          error
        );
      }
      // Initialize unread and last message for new conversation
      setUnreadCounts((prev) => ({ ...prev, [conversation._id]: 0 }));
      setLastMessages((prev) => ({
        ...prev,
        [conversation._id]: prev[conversation._id] || null,
      }));
    });

    return () => socket.disconnect();
  }, [user, dispatch]);

  useEffect(() => {
    dispatch(fetchDashboardData()).catch(() => navigate("/login"));
  }, [dispatch, navigate]);

  // Sync selectedAdmin when conversations are refetched and we have a pending selection
  useEffect(() => {
    if (pendingSelectedId.current) {
      const state = store.getState();
      const {
        groups: updatedGroups,
        usersWithConversations: updatedConversations,
      } = state.admin;

      // Try to find in groups first
      const foundInGroups = updatedGroups?.find(
        (g) => String(g._id) === String(pendingSelectedId.current)
      );
      if (foundInGroups) {
        setSelectedAdmin(foundInGroups);
        pendingSelectedId.current = null;
        return;
      }

      // Then try conversations
      const foundInConversations = updatedConversations?.find(
        (c) => String(c._id) === String(pendingSelectedId.current)
      );
      if (foundInConversations) {
        setSelectedAdmin(foundInConversations);
        pendingSelectedId.current = null;
      }
    }
  }, [groups, usersWithConversations]);

  const handleSelectAdmin = (chat) => {
    setSelectedAdmin(chat);
    setUnreadCounts((prev) => ({ ...prev, [chat._id]: 0 }));
    // Prefer conversation-based mark as read
    socket.emit("markAsReadByConversation", {
      userId: user._id,
      conversationId: chat._id,
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
  const handleGroupCreated = async (group) => {
    try {
      // Set pending selection to restore after refetch
      pendingSelectedId.current = group._id;

      // Refetch all conversations from API to ensure consistency
      await dispatch(fetchDashboardData());

      setIsCreatingGroup(false);

      // Initialize unread and last message
      setUnreadCounts((prev) => ({ ...prev, [group._id]: 0 }));
      setLastMessages((prev) => ({
        ...prev,
        [group._id]: prev[group._id] || null,
      }));

      // The useEffect will handle setting selectedAdmin when groups update
    } catch (error) {
      console.error(
        "Error refetching conversations after group creation:",
        error
      );
      // Fallback: use the group from response
      pendingSelectedId.current = null;
      setSelectedAdmin(group);
      setIsCreatingGroup(false);
      setUnreadCounts((prev) => ({ ...prev, [group._id]: 0 }));
      setLastMessages((prev) => ({
        ...prev,
        [group._id]: prev[group._id] || null,
      }));
    }
  };
  const handleConversationStarted = async (conversationLike) => {
    try {
      // Set pending selection to restore after refetch
      pendingSelectedId.current = conversationLike._id;

      // Refetch all conversations from API to ensure consistency
      await dispatch(fetchDashboardData());

      // Initialize counters to avoid flicker
      setUnreadCounts((prev) => ({ ...prev, [conversationLike._id]: 0 }));
      setLastMessages((prev) => ({
        ...prev,
        [conversationLike._id]: prev[conversationLike._id] || null,
      }));

      // The useEffect will handle setting selectedAdmin when conversations update
    } catch (error) {
      console.error(
        "Error refetching conversations after starting conversation:",
        error
      );
      // Fallback: use the conversation from response
      pendingSelectedId.current = null;
      setSelectedAdmin(conversationLike);
      setUnreadCounts((prev) => ({ ...prev, [conversationLike._id]: 0 }));
      setLastMessages((prev) => ({
        ...prev,
        [conversationLike._id]: prev[conversationLike._id] || null,
      }));
    }
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

  // Sort conversations by latest message time (socket -> API fallback -> updatedAt)
  const getTime = (c) => {
    const lm = lastMessages?.[c._id];
    return (
      (lm && (lm.timestamp || lm.createdAt)) ||
      (c.lastMessage && c.lastMessage.createdAt) ||
      c.updatedAt ||
      0
    );
  };
  const sortedConversations = (usersWithConversations || [])
    .slice()
    .sort((a, b) => new Date(getTime(b)) - new Date(getTime(a)));

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
        usersWithConversations={sortedConversations}
        onConversationStarted={handleConversationStarted}
      />

      {isCreatingGroup ? (
        <NewGroup
          admins={admins}
          onClose={handleCloseGroupCreator}
          socket={socket}
          user={user}
          onGroupCreated={handleGroupCreated}
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
      <Chatbot />
    </div>
  );
}
