import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../App";

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code) {
      fetch(`${API_URL}/api/auth/callback?code=${code}`)
        .then(response => response.json())
        .then(data => {
          console.log("Logged in:", data);
          navigate("/");
        })
        .catch(error => {
          console.error("Login error:", error);
          navigate("/");
        });
    }
  }, [navigate]);

  return <div>Logging in...</div>;
};

export default AuthCallback;