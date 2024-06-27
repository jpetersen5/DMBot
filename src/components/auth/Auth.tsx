import React, { useState, useEffect } from "react";
import { API_URL } from "../../App";

interface User {
  id: string;
  username: string;
  avatar: string;
}

const Auth: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    console.log('Token from localStorage:', token);
    if (token) {
      fetch(`${API_URL}/api/user`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(response => {
          console.log('API response status:', response.status);
          if (response.ok) {
            return response.json();
          }
          throw new Error('Not authenticated');
        })
        .then((data: User) => {
          console.log('User data received:', data);
          setUser(data);
        })
        .catch(error => {
          console.error('Error fetching user data:', error);
          setError(error.message);
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
    setError(null);
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
        <div>
          <button onClick={handleLogin}>Login with Discord</button>
          {error && <p>Error: {error}</p>}
        </div>
      )}
    </div>
  );
};

export default Auth;