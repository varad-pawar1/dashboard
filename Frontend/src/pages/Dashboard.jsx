import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { fetchUser, logout } from "../features/auth/authActions";

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading, error } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchUser()).catch(() => {
      navigate("/login");
    });
  }, [dispatch, navigate]);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  if (loading) return <div className="auth-container">Loading user...</div>;

  return (
    <div className="auth-container">
      {user ? (
        <>
          <h2 className="">Welcome, {user.name} 🎉</h2>
          <p className="">Email: {user.email}</p>

          <Button label={"Logout"} onClick={handleLogout} variant="Button" />
        </>
      ) : (
        <p className="">No user data available.</p>
      )}
    </div>
  );
}
