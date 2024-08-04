import React, { useState, useEffect } from "react";
import { Image } from "react-bootstrap";
import { API_URL } from "../../App";
import { User, getUserImage } from "../../utils/user";

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
    return <div>Loading...</div>;
  }

  console.log(user);

  return (
    <div>
      {user ? (
        <div>
          <h2>Welcome, {user.username}!</h2>
          <Image 
            src={getUserImage(user)} 
            roundedCircle 
            className="user-avatar"
          />
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <div>
          <button onClick={handleLogin}>Login with Discord</button>
        </div>
      )}
    </div>
  );
};

export default Auth;