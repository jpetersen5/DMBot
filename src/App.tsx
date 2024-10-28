import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Homepage from "./components/Homepage";
import ProfilePage from "./components/Profile/ProfilePage";
import CharterPage from "./components/Profile/Charter/CharterPage";
import AuthHandler from "./components/Auth/AuthHandler";
import AppProvider from "./context/AppContext";
import Login from "./components/Login/Login";
import Sidebar from "./components/Sidebar/Sidebar";
import SongList from "./components/SongList/SongList";
import UserList from "./components/UserList/UserList";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/styles.scss";

export const API_URL = import.meta.env.VITE_API_URL;

const App: React.FC = () => {
  const basename = "/";

  return (
    <AppProvider>
      <Router basename={basename}>
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/user/:userId" element={<ProfilePage />} />
              <Route path="/user/:userId/:songId" element={<ProfilePage />} />
              <Route path="/charter/:charterId" element={<CharterPage />} />
              <Route path="/charter/:charterId/:songId" element={<CharterPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth" element={<AuthHandler />} />
              <Route path="/songs" element={<SongList />} />
              <Route path="/songs/:songId" element={<SongList />} />
              <Route path="/users" element={<UserList />} />
              {/* <Route path="/settings" element={<SettingsPage />} /> */}
            </Routes>
          </main>
        </div>
      </Router>
    </AppProvider>
  );
};

export default App
