import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRole }) => {
  const user = JSON.parse(localStorage.getItem("user"));

  // Agar user logged in nahi hai, to login (/) par bhej do
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Agar role mismatch hai (jaise Employee /admin kholne ki koshish kare), to redirect kar do
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;