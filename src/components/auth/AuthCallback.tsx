import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const username = params.get('username');
    const avatar = params.get('avatar');

    if (id && username) {
      localStorage.setItem('user', JSON.stringify({ id, username, avatar }));
      navigate('/');
    } else {
      console.error('Authentication failed');
      navigate('/');
    }
  }, [navigate]);

  return <div>Authenticating...</div>;
};

export default AuthCallback;