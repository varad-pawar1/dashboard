import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import InputField from "../components/InputField";
import Button from "../components/Button";
import {
  loginUser,
  setField,
  googleLoginAction,
} from "../features/auth/authActions";

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { form, loading, error } = useSelector((state) => state.auth);

  // Initialize Google Sign-In
  useEffect(() => {
    // Load Google Sign-In script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });

      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-button"),
        {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
        }
      );
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Handle Google Sign-In Response
  const handleGoogleResponse = async (response) => {
    try {
      await dispatch(googleLoginAction(response.credential));
      navigate("/dashboard");
    } catch (err) {
      alert(err);
    }
  };

  // Handle Login Submit
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await dispatch(loginUser(form));
      navigate("/dashboard");
    } catch (err) {
      alert(err);
    }
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>

      <form onSubmit={handleLogin}>
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
          label={loading ? "Loading..." : "Login"}
          type="submit"
          variant="Button"
        />

        {error && <p className="error-text">{error}</p>}
      </form>

      <p style={{ textAlign: "left" }}>
        Forgot Password? <Link to="/forgot-password">Click here</Link>
      </p>

      <div className="social-login">
        <div id="google-signin-button"></div>
      </div>

      <p>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
