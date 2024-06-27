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
    fetch(`${API_URL}/api/user`)
      .then(response => response.json())
      .then(data => setUser(data))
      .catch(error => console.error("Error:", error));
  }, []);

  const handleLogin = () => {
    window.location.href = `${API_URL}/api/auth/login`;
  };

  return (
    <div>
      {user ? (
        <div>
          <h2>Welcome, {user.username}!</h2>
          <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt="User Avatar" />
        </div>
      ) : (
        <button onClick={handleLogin}>Login with Discord</button>
      )}
    </div>
  );
};

export default Auth;