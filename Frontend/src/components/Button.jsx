import "../styles/component.css";
const Button = ({
  label,
  type = "button",
  onClick,
  variant = "primary",
  disabled = false,
  style = {},
}) => {
  return (
    <button
      type={type}
      className={`btn ${variant}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {label}
    </button>
  );
};

export default Button;
