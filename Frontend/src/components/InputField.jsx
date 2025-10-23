import { useState } from "react";

export default function InputField({
  type,
  placeholder,
  value,
  onChange,
  error: externalError,
}) {
  const [internalError, setInternalError] = useState("");

  // Validation logic for internal validation (optional)
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
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(value))
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

  // Show external error first if provided
  const displayError = externalError || internalError;

  return (
    <div style={{ marginBottom: "10px" }}>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        required
        style={{
          width: "100%",
          borderColor: displayError ? "red" : value ? "green" : "#ccc",
          borderWidth: "1px",
          padding: "5px",
          borderRadius: "4px",
        }}
      />
      {displayError && (
        <p style={{ color: "red", margin: "5px 0 0" }}>{displayError}</p>
      )}
    </div>
  );
}
