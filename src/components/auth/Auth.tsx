import React, { useState, useEffect } from "react";
import { API_URL } from "../../App";

interface User {
  id: string;
  username: string;
  avatar: string;
}

const Auth: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetch(`${API_URL}/api/user`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Not authenticated');
        })
        .then((data: User) => setUser(data))
        .catch(error => {
          console.error('Error:', error);
          localStorage.removeItem('auth_token');
        });
    }
  }, []);

  const handleLogin = () => {
    window.location.href = `${API_URL}/api/auth/login`;
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <div>
      {user ? (
        <div>
          <h2>Welcome, {user.username}!</h2>
          <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt="User Avatar" />
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <button onClick={handleLogin}>Login with Discord</button>
      )}
    </div>
  );
};

export default Auth;