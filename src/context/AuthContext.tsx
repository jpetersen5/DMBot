import React, { useState, useEffect, useContext, createContext } from "react";
import { User } from "../utils/user";
import { API_URL } from "../App";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
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
            localStorage.setItem("user_id", userData.id);
            setUser(userData);
          } else {
            console.error("Invalid token:", response.statusText);
            localStorage.removeItem("auth_token");
            localStorage.removeItem("user_id");
          }
        } catch (error) {
          console.error("Error checking auth:", error);
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user_id");
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
    localStorage.removeItem("user_id");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthProvider;