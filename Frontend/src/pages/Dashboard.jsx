import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { logout } from "../features/auth/authActions";
import { fetchUser, sendResetLink } from "../features/auth/adminActions";

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user, loading, successMessage, error } = useSelector(
    (state) => state.admin
  );
  const [sendingLink, setSendingLink] = useState(false);

  // Fetch logged-in user on mount
  useEffect(() => {
    dispatch(fetchUser()).catch(() => navigate("/login"));
  }, [dispatch, navigate]);

  const handleSendResetLink = async () => {
    if (!user?.email) return;
    setSendingLink(true);
    try {
      await dispatch(sendResetLink(user.email));
    } catch (err) {
      console.error(err.message);
    } finally {
      setSendingLink(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <div className="auth-container">
      {loading ? (
        <p>Loading user data...</p>
      ) : user ? (
        <>
          <h2>Welcome, {user.name} 🎉</h2>
          <p>Email: {user.email}</p>

          <div style={{ marginTop: "20px" }}>
            <Button label="Logout" onClick={handleLogout} variant="Button" />
            <Button
              label={sendingLink ? "Sending..." : "Send Reset Link"}
              onClick={handleSendResetLink}
              variant="Button"
              disabled={sendingLink}
            />
          </div>

          {successMessage && <p className="success">{successMessage}</p>}
          {error && <p className="error">{error}</p>}
        </>
      ) : (
        <p>No user data available. Please login again.</p>
      )}
    </div>
  );
}
