import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { setField, verifyResetOtpAction } from "../features/auth/authActions";

export default function VerifyForgotOTP() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { form, loading, error, successMessage } = useSelector(
    (state) => state.auth
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await dispatch(verifyResetOtpAction(form.email, form.otp));
      alert("OTP verified successfully! You can now reset your password.");
      navigate("/reset-password");
    } catch (err) {
      alert(err.message || "OTP verification failed");
    }
  };

  return (
    <div className="auth-container">
      <h2>Verify OTP</h2>
      <form onSubmit={handleSubmit}>
        <InputField
          type="email"
          placeholder="Enter your email"
          value={form.email}
          onChange={(e) => dispatch(setField("email", e))}
        />

        <InputField
          type="text"
          placeholder="Enter 6-digit OTP"
          value={form.otp}
          onChange={(e) => dispatch(setField("otp", e))}
        />

        <Button label={loading ? "Verifying..." : "Verify OTP"} type="submit" />

        {error && <p className="error-text">{error}</p>}
        {successMessage && <p className="success-text">{successMessage}</p>}
      </form>
    </div>
  );
}
