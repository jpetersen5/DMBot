import React from "react";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { getUserImage } from "../../utils/user";
import "./Auth.scss";

interface AuthProps {
  onlyButtons?: boolean;
}

const Auth: React.FC<AuthProps> = ({ onlyButtons = false }) => {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Loading user..." />;
  }

  if (onlyButtons) {
    return (
      <div className="auth-container">
        {user ? (
          <button className="auth-button logout-button" onClick={logout}>Logout</button>
        ) : (
          <button className="auth-button login-button" onClick={login}>Login with Discord</button>
        )}
      </div>
    );
  }

  return (
    <div className="auth-container">
      {user ? (
        <div className="auth-user">
          <h2>Welcome, {user.username}!</h2>
          <img 
            src={getUserImage(user)} 
            alt={user.username}
            className="user-avatar"
          />
          <button className="auth-button logout-button" onClick={logout}>Logout</button>
        </div>
      ) : (
        <div className="auth-login">
          <button className="auth-button login-button" onClick={login}>Login with Discord</button>
        </div>
      )}
    </div>
  );
};

export default Auth;
