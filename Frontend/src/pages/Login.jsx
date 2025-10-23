import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { loginUser, setField } from "../features/auth/authActions";

export default function Login() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { form, loading, error } = useSelector((state) => state.auth);

  // Handle Login Submit
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await dispatch(loginUser(form));
      navigate("/dashboard");
    } catch (err) {
      if (err.includes("Google"))
        window.location.href = `${BACKEND_URL}/auth/google`;
      else if (err.includes("GitHub"))
        window.location.href = `${BACKEND_URL}/auth/github`;
      else alert(err);
    }
  };

  // Handle OAuth logins
  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/auth/google`;
  };

  const handleGithubLogin = () => {
    window.location.href = `${BACKEND_URL}/auth/github`;
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

      <div className="social-icon">
        <Button
          onClick={handleGoogleLogin}
          variant="google-btn"
          label={<i className="fa-brands fa-google"></i>}
        />
        <Button
          onClick={handleGithubLogin}
          variant="github-btn"
          label={<i className="fa-brands fa-github"></i>}
        />
      </div>

      <p>
        Don’t have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
