import React from "react";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Homepage from "./components/homepage";
import AuthCallback from "./components/auth/AuthCallback";
import "./App.css"

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const App: React.FC = () => {
  return (
    <Router basename="/DMBot">
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </Router>
  );
};

export default App
