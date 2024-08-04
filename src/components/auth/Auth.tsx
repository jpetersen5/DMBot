import React, { useState, useEffect } from "react";
import { API_URL } from "../../App";
import { User, getUserImage } from "../../utils/user";
import './Auth.scss';

const Auth: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        try {
          const response = await fetch(`${API_URL}/api/user`, {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          if (response.ok) {
            const userData: User = await response.json();
            setUser(userData);
          } else {
            console.error("Invalid token:", response.statusText);
            const errorData = await response.json();
            console.error("Error details:", errorData);
            localStorage.removeItem("auth_token");
          }
        } catch (error) {
          console.error("Error checking auth:", error);
          localStorage.removeItem("auth_token");
        }
      } else {
        console.log("No token found in localStorage");
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = () => {
    window.location.href = `${API_URL}/api/auth/login`;
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
  };

  if (loading) {
    return <div className="auth-loading">Loading...</div>;
  }

  console.log(user);

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
          <button className="auth-button logout-button" onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <div className="auth-login">
          <button className="auth-button login-button" onClick={handleLogin}>Login with Discord</button>
        </div>
      )}
    </div>
  );
};

export default Auth;