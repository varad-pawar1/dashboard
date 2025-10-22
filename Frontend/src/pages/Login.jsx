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

  const validateForm = () => {
    const newErrors = {};
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Enter a valid email";
    if (!form.password.trim()) newErrors.password = "Password is required";
    else if (form.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    return newErrors;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length)
      return alert(Object.values(errors).join("\n"));
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
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => dispatch(setField("password", e.target.value))}
          />
        </div>
        <Button
          label={loading ? "Loading..." : "Login"}
          type="submit"
          variant="Button"
        />
        {error && <p className="error-text">{error}</p>}
      </form>
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
