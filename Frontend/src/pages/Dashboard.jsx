import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../features/auth/authActions";
import {
  fetchDashboardData,
  sendResetLink,
} from "../features/auth/adminActions";
import { Navbar } from "./Navbar";
import { MainBodyDash } from "./MainBodyDash";
import "../styles/dashboard.css";

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, admins, loading, error, successMessage } = useSelector(
    (state) => state.admin
  );

  useEffect(() => {
    dispatch(fetchDashboardData()).catch(() => navigate("/login"));
  }, [dispatch, navigate]);

  const handleSendResetLink = async () => {
    if (!user?.email) return;
    sendResetLink(true);

    try {
      await dispatch(sendResetLink(user.email));
    } catch (err) {
      console.error(err.message || err);
    } finally {
      sendResetLink(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <div className="dashboard-container">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onSendResetLink={handleSendResetLink}
      />

      {error && <p className="message message-error">{error}</p>}
      {successMessage && (
        <p className="message message-success">{successMessage}</p>
      )}

      <MainBodyDash admins={admins} loading={loading} />
    </div>
  );
}
