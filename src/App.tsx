import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Homepage from "./components/Homepage";
import ProfilePage from "./components/Profile/ProfilePage";
import AuthHandler from "./components/Auth/AuthHandler";
import AppProvider from "./context/AppContext";
import Login from "./components/Login/Login";
import Sidebar from "./components/Sidebar/Sidebar";
import SongList from "./components/SongList/SongList";
import "./styles.scss";
import "bootstrap/dist/css/bootstrap.min.css";

const isProduction = import.meta.env.PROD;
const isGitHubPages = import.meta.env.VITE_GITHUB_ACTIONS === "true";

export const API_URL = isProduction
  ? "https://dmbot-kb5j.onrender.com"
  : import.meta.env.VITE_API_URL || "http://localhost:5000";

const App: React.FC = () => {
  const basename = isGitHubPages ? "/DMBot" : "/";

  return (
    <AppProvider>
      <Router basename={basename}>
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/user/:userId" element={<ProfilePage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth" element={<AuthHandler />} />
              <Route path="/songs" element={<SongList />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AppProvider>
  );
};

export default App
