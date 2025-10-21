import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const user = useSelector((state) => state.auth.user);

  if (!user) {
    // redirect to login if not authenticated
    return <Navigate to="/login" replace />;
  }

  return children;
}
