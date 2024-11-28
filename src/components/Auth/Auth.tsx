import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../App";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { useAuth } from "../../context/AuthContext";
import { UserAvatar } from "../UserList/UserList";
import "./Auth.scss";

interface AuthProps {
  onlyButtons?: boolean;
}

const Auth: React.FC<AuthProps> = ({ onlyButtons = false }) => {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();

  const handleButtonClick = () => {
    if (!user) {
      return;
    }
    else {
      navigate(`/user/${user.id}`);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <LoadingSpinner message="Loading user..." />
      </div>
    );
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
    <div className="auth-container" onClick={handleButtonClick}>
      {user ? (
        <div className="auth-user">
          <h2>Welcome, {user.username}!</h2>
          <UserAvatar user={user} />
          <button className="auth-button logout-button" onClick={logout}>Logout</button>
        </div>
      ) : (
        <div className="auth-login">
          <button className="auth-button login-button" onClick={login}>Login with Discord</button>
        </div>
      )}
    <RedirectButton />
    </div>
  );
};

const RedirectButton: React.FC = () => {
  const [hasScores, setHasScores] = useState<boolean | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetch(`${API_URL}/api/user/${user.id}/has-scores`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        }
      })
        .then(response => response.json())
        .then(data => setHasScores(data.has_scores))
        .catch(error => {
          console.error("Error checking user scores:", error);
          setHasScores(null);
        });
    }
  }, [user]);

  const handleButtonClick = () => {
    if (!user) {
      return;
    }
    if (hasScores) {
      navigate("/songs");
    } else {
      navigate(`/user/${user.id}`);
    }
  };

  if (!user) {
    return (
      <div className="redirection-container"></div>
    );
  }

  return (
    <div className="redirection-container">
      <button onClick={handleButtonClick} className="main-action-button">
        {hasScores === null || hasScores ? (
          "Check leaderboards here!"
        ) : (
          "Upload scores here!"
        )}
      </button>
    </div>
  );
};

export default Auth;
