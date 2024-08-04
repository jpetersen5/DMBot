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
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const response = await fetch(`${API_URL}/api/user`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const userData: User = await response.json();
            setUser(userData);
          } else {
            // Token is invalid or expired
            console.error('Invalid token:', response.statusText);
            localStorage.removeItem('auth_token');
          }
        } catch (error) {
          console.error('Error checking auth:', error);
          localStorage.removeItem('auth_token');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = () => {
    window.location.href = `${API_URL}/api/auth/login`;
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

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