import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { setField, verifyResetOtpAction } from "../features/auth/authActions";

export default function VerifyForgotOTP() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { form, loading, error } = useSelector((state) => state.auth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.otp.trim()) return alert("OTP is required");
    try {
      await dispatch(verifyResetOtpAction(form.email, form.otp));
      alert("OTP verified! You can reset your password now.");
      navigate("/reset-password");
    } catch (err) {
      alert(err);
    }
  };

  return (
    <div className="auth-container">
      <h2>Verify OTP</h2>
      <form onSubmit={handleSubmit}>
        <InputField
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => dispatch(setField("email", e.target.value))}
        />
        <InputField
          type="text"
          placeholder="Enter OTP"
          value={form.otp}
          onChange={(e) => dispatch(setField("otp", e.target.value))}
        />
        <Button label={loading ? "Verifying..." : "Verify OTP"} type="submit" />
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
