import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { setField, resetPasswordAction } from "../features/auth/adminActions";
import { useState } from "react";

export default function LGResetPassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useParams();
  const { form, loading, error, successMessage } = useSelector(
    (state) => state.admin
  );

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!form.newPassword?.trim())
      newErrors.newPassword = "New password is required";
    else if (form.newPassword.length < 6)
      newErrors.newPassword = "Password must be at least 6 characters";

    if (!form.confirmPassword?.trim())
      newErrors.confirmPassword = "Confirm password is required";
    else if (form.confirmPassword !== form.newPassword)
      newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await dispatch(resetPasswordAction(token, form.newPassword));
      alert("Password reset successful! You can now login.");
      navigate("/login");
    } catch (err) {
      alert(err.message || "Something went wrong");
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
          onChange={(e) => dispatch(setField("newPassword", e))}
          error={errors.newPassword}
        />
        <InputField
          type="password"
          placeholder="Confirm Password"
          value={form.confirmPassword}
          onChange={(e) => dispatch(setField("confirmPassword", e))}
          error={errors.confirmPassword}
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
