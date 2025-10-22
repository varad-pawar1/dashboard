import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { verifyOtp, setField } from "../features/auth/authActions";

export default function VerificationOtp() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { form, loading, error } = useSelector((state) => state.auth);

  const validateForm = () => {
    const newErrors = {};
    if (!form.email.trim()) newErrors.email = "Email is required";
    if (!form.otp.trim()) newErrors.otp = "OTP is required";
    else if (!/^\d{6}$/.test(form.otp)) newErrors.otp = "OTP must be 6 digits";
    return newErrors;
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length)
      return alert(Object.values(errors).join("\n"));

    try {
      await dispatch(verifyOtp(form));
      alert("Email verified successfully!");
      navigate("/login");
    } catch (err) {
      alert(err);
    }
  };

  return (
    <div className="auth-container">
      <h2>Verify OTP</h2>
      <form onSubmit={handleVerifyOtp}>
        <div>
          <InputField
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => dispatch(setField("email", e.target.value))}
          />
        </div>
        <div>
          <InputField
            type="text"
            placeholder="Enter OTP"
            value={form.otp || ""}
            onChange={(e) => dispatch(setField("otp", e.target.value))}
          />
        </div>
        <Button label={loading ? "Verifying..." : "Verify OTP"} type="submit" />
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
