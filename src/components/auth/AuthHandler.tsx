import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.slice(1));
    const token = hashParams.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      navigate('/');
    }
  }, [location, navigate]);

  return <div>Processing authentication...</div>;
};

export default AuthHandler;