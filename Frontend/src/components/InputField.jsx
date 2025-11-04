import { useState } from "react";

export default function InputField({
  type,
  placeholder,
  value,
  onChange,
  error: externalError,
}) {
  const [internalError, setInternalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const validate = (type, value) => {
    switch (type) {
      case "text":
        if (!value.trim()) return "This field is required";
        if (value.trim().length < 3) return "Minimum 3 characters required";
        return "";
      case "email":
        if (!value.trim()) return "Email is required";
        if (!/\S+@\S+\.\S+/.test(value)) return "Enter a valid email";
        return "";
      case "password":
        if (!value) return "Password is required";
        if (value.length < 8) return "Password must be at least 8 characters";
        if (!/[A-Z]/.test(value))
          return "Include at least one uppercase letter";
        if (!/[!@#$%^&*(),.?\":{}|<>]/.test(value))
          return "Include at least one special character";
        if (/\s/.test(value)) return "Password cannot contain spaces";
        return "";
      default:
        return "";
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setInternalError(validate(type, val));
  };

  const displayError = externalError || internalError;

  return (
    <div className="input-container">
      <input
        type={type === "password" && showPassword ? "text" : type}
        className={`input-field ${
          displayError ? "error-border" : value ? "success-border" : ""
        }`}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        required
      />

      {type === "password" && (
        <span
          className="toggle-password"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <i className="fa-solid fa-eye-slash"></i>
          ) : (
            <i className="fa-solid fa-eye"></i>
          )}
        </span>
      )}

      {displayError && <p className="error-text">{displayError}</p>}
    </div>
  );
}
