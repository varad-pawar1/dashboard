import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { signupUser, setField } from "../features/auth/authActions";

export default function Signup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { form, loading, error } = useSelector((state) => state.auth);

  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = "Full name is required";
    else if (form.name.trim().length < 3)
      newErrors.name = "Name must be at least 3 characters long";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Enter a valid email";
    if (!form.password.trim()) newErrors.password = "Password is required";
    else if (form.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    return newErrors;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length)
      return alert(Object.values(errors).join("\n"));
    try {
      await dispatch(signupUser(form));
      alert("Signup successful!");
      navigate("/login");
    } catch (err) {
      alert(err);
    }
  };

  return (
    <div className="auth-container">
      <h2>Sign Up</h2>
      <form onSubmit={handleSignup}>
        <div>
          <InputField
            type="text"
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => dispatch(setField("name", e.target.value))}
          />
        </div>
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
          label={loading ? "Loading..." : "Sign Up"}
          type="submit"
          variant="Button"
        />
        {error && <p className="error-text">{error}</p>}
      </form>
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
