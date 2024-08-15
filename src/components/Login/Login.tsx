import React from "react";
import { useAuth } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";
import "./Login.scss";

const Login: React.FC = () => {
  const { user, login } = useAuth();

  if (user) {
    return <Navigate to={`/user/${user.id}`} replace />;
  }

  return (
    <div className="login-page">
      <h1>Login</h1>
      <p>Please log in to access your profile and other features.</p>
      <button className="auth-button login-button" onClick={login}>
        Login with Discord
      </button>
    </div>
  );
};

export default Login;