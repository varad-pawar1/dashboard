import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { setField, resetPasswordAction } from "../features/auth/adminActions";

export default function LGResetPassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useParams();

  const { form, loading, error, successMessage } = useSelector(
    (state) => state.admin
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { newPassword, confirmPassword } = form;

    if (newPassword.length < 6)
      return alert("Password must be at least 6 characters");
    if (newPassword !== confirmPassword) return alert("Passwords do not match");

    try {
      await dispatch(resetPasswordAction(token, newPassword));
      alert("Password reset successful! You can now login.");
      navigate("/login");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit}>
        <InputField
          type="password"
          placeholder="New Password"
          value={form.newPassword}
          onChange={(e) => dispatch(setField("newPassword", e.target.value))}
        />
        <InputField
          type="password"
          placeholder="Confirm Password"
          value={form.confirmPassword}
          onChange={(e) =>
            dispatch(setField("confirmPassword", e.target.value))
          }
        />
        <Button
          label={loading ? "Resetting..." : "Reset Password"}
          type="submit"
        />
        {error && <p className="error-text">{error}</p>}
        {successMessage && <p className="success-text">{successMessage}</p>}
      </form>
    </div>
  );
}
