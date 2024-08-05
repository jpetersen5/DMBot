import React from "react";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Homepage from "./components/Homepage";
import AuthHandler from "./components/auth/AuthHandler";
import Sidebar from "./components/Sidebar/Sidebar";
import "./styles.scss";

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const App: React.FC = () => {
  return (
    <Router basename="/DMBot">
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/auth" element={<AuthHandler />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App
