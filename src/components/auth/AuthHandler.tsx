import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hashParams = new URLSearchParams(location.search);
    const token = hashParams.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      navigate('/');
    } else {
      console.log('No token found in URL');
      navigate('/');
    }
  }, [location, navigate]);

  return <div>Processing authentication...</div>;
};

export default AuthHandler;