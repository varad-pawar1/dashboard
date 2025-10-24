import Button from "../components/Button";
import "../styles/dashboard.css";

export function Navbar({ user, onLogout, onSendResetLink }) {
  return (
    <div className="navbar">
      <div className="navbar-title">Admin Panel</div>
      <div className="navbar-right">
        {user && (
          <div className="navbar-user">
            <span className="navbar-user-name">{user.name}</span>
            <span className="navbar-user-email">{user.email}</span>
          </div>
        )}
        <Button label="Logout" onClick={onLogout} />
        <Button label="SetPassword" onClick={onSendResetLink} />
      </div>
    </div>
  );
}
