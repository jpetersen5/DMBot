import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const AuthHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const hashParams = new URLSearchParams(location.search);
    const token = hashParams.get("token");
    if (token) {
      localStorage.setItem("auth_token", token);
      if (user) {
        navigate(`/profile/${user.id}`);
      } else {
        navigate("/");
      }
    } else {
      console.log("No token found in URL");
      navigate("/");
    }
  }, [location, navigate, user]);

  return <div>Processing authentication...</div>;
};

export default AuthHandler;
