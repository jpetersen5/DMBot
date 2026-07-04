import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const AuthHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.slice(1));
    const token = hashParams.get("token");
    if (token) {
      localStorage.setItem("auth_token", token);
      window.history.replaceState(null, "", location.pathname);
      if (user) {
        localStorage.setItem("user_id", user.id);
        navigate(`/user/${user.id}`);
      } else {
        navigate("/");
      }
    } else {
      navigate("/");
    }
  }, [location, navigate, user]);

  return <div>Processing authentication...</div>;
};

export default AuthHandler;
