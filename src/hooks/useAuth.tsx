import { useState, useEffect } from "react";
import { User } from "../utils/user";
import { API_URL } from "../App";

export const useAuth = () => {
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
            localStorage.removeItem("auth_token");
          }
        } catch (error) {
          console.error("Error checking auth:", error);
          localStorage.removeItem("auth_token");
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = () => {
    window.location.href = `${API_URL}/api/auth/login`;
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
  };

  return { user, loading, login, logout };
};