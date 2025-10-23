import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { setField, sendResetOtp } from "../features/auth/authActions";

export default function ForgotPassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { form, loading, error, successMessage } = useSelector(
    (state) => state.auth
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) return alert("Email is required");
    try {
      await dispatch(sendResetOtp(form.email));
      alert("OTP sent! Check your email.");
      navigate("/verify-reset-otp");
    } catch (err) {
      alert(err);
    }
  };

  return (
    <div className="auth-container">
      <h2>Forgot Password</h2>
      <form onSubmit={handleSubmit}>
        <InputField
          type="email"
          placeholder="Enter your email"
          value={form.email}
          onChange={(e) => dispatch(setField("email", e.target.value))}
        />
        <Button label={loading ? "Sending..." : "Send OTP"} type="submit" />
        {error && <p className="error-text">{error}</p>}
        {successMessage && <p className="success-text">{successMessage}</p>}
      </form>
    </div>
  );
}
