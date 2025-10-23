import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { signupUser, setField } from "../features/auth/authActions";

export default function Signup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { form, loading, error } = useSelector((state) => state.auth);

  const handleSignup = async (e) => {
    e.preventDefault();

    // Optional: final validation before submit
    if (!form.name || !form.email || !form.password) {
      return alert("Please fill all fields correctly.");
    }

    try {
      await dispatch(signupUser(form));
      alert("Signup successful! Please check your email for OTP.");
      navigate("/verify-otp");
    } catch (err) {
      alert(err);
    }
  };

  return (
    <div
      className="auth-container"
      style={{ maxWidth: "400px", margin: "auto" }}
    >
      <h2>Sign Up</h2>
      <form onSubmit={handleSignup}>
        <InputField
          type="text"
          placeholder="Full Name"
          value={form.name}
          onChange={(val) => dispatch(setField("name", val))}
        />

        <InputField
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(val) => dispatch(setField("email", val))}
        />

        <InputField
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(val) => dispatch(setField("password", val))}
        />

        <Button
          label={loading ? "Loading..." : "Sign Up"}
          type="submit"
          variant="Button"
        />

        {error && (
          <p className="error-text" style={{ color: "red" }}>
            {error}
          </p>
        )}
      </form>

      <p style={{ marginTop: "10px" }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
