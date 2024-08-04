import React from "react";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Homepage from "./components/homepage";
import AuthHandler from "./components/auth/AuthHandler";
import "./styles.scss";

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const App: React.FC = () => {
  return (
    <Router basename="/DMBot">
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/auth" element={<AuthHandler />} />
      </Routes>
    </Router>
  );
};

export default App
