import React from "react";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Homepage from "./components/Homepage";
import ProfilePage from "./components/Profile/ProfilePage";
import AuthHandler from "./components/Auth/AuthHandler";
import Sidebar from "./components/Sidebar/Sidebar";
import SongList from "./components/SongList/SongList";
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
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/auth" element={<AuthHandler />} />
            <Route path="/songs" element={<SongList />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App
