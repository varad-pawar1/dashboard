import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { setField, resetPasswordAction } from "../features/auth/authActions";

export default function ResetPassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { form, loading, error } = useSelector((state) => state.auth);
  const [newPassword, setNewPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6)
      return alert("Password must be at least 6 characters");
    try {
      await dispatch(resetPasswordAction(form.email, newPassword));
      alert("Password reset successful! Login now.");
      navigate("/login");
    } catch (err) {
      alert(err);
    }
  };

  return (
    <div className="auth-container">
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit}>
        <InputField
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => dispatch(setField("email", e.target.value))}
        />
        <InputField
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Button
          label={loading ? "Resetting..." : "Reset Password"}
          type="submit"
        />
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
