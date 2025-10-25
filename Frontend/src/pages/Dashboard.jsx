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

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, admins, loading, error, successMessage } = useSelector(
    (state) => state.admin
  );
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  useEffect(() => {
    dispatch(fetchDashboardData()).catch(() => navigate("/login"));
  }, [dispatch, navigate]);

  const handleSendResetLink = async () => {
    if (!user?.email) return;

    try {
      await dispatch(sendResetLink(user.email));
    } catch (err) {
      console.error(err.message || err);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <div className="chat-app-container">
      <Sidebar
        admins={admins}
        loading={loading}
        onSelectAdmin={setSelectedAdmin}
        selectedAdmin={selectedAdmin}
        user={user}
        onLogout={handleLogout}
        onSendResetLink={handleSendResetLink}
      />

      {selectedAdmin ? (
        <ChatPanel
          user={user}
          admin={selectedAdmin}
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
