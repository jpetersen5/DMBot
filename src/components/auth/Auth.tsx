import React, { useState, useEffect } from "react";
import { API_URL } from "../../App";

interface User {
  id: string;
  username: string;
  avatar: string;
}

const Auth: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      console.log("Checking authentication...");
      const token = localStorage.getItem('auth_token');
      console.log("Token from localStorage:", token ? "exists" : "not found");
      if (token) {
        try {
          console.log("Fetching user data...");
          const response = await fetch(`${API_URL}/api/user`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          console.log("API response status:", response.status);
          if (response.ok) {
            const userData: User = await response.json();
            console.log("User data received:", userData);
            setUser(userData);
          } else {
            console.error('Invalid token:', response.statusText);
            const errorData = await response.json();
            console.error('Error details:', errorData);
            localStorage.removeItem('auth_token');
          }
        } catch (error) {
          console.error('Error checking auth:', error);
          localStorage.removeItem('auth_token');
        }
      } else {
        console.log("No token found in localStorage");
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    console.log("User state updated:", user);
  }, [user]);

  const handleLogin = () => {
    console.log("Initiating login process...");
    window.location.href = `${API_URL}/api/auth/login`;
  };

  const handleLogout = () => {
    console.log("Logging out...");
    localStorage.removeItem('auth_token');
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
          <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt="User Avatar" />
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