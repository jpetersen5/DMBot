import React, { useState, useEffect } from "react";
import { API_URL } from "../App";
import Auth from "./auth/Auth";
import UserGrid from "./UserGrid/UserGrid";
import './Homepage.scss';

const Homepage: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState("Not functional");
  const [dbStatus, setDbStatus] = useState("Unknown");

  useEffect(() => {
    fetch(`${API_URL}/api/hello`)
      .then(response => response.json())
      .then(data => setBackendStatus(data.message))
      .catch(error => {
        console.error('Error:', error);
        setBackendStatus("Error connecting to backend");
      });

    fetch(`${API_URL}/api/db-status`)
      .then(response => response.json())
      .then(data => setDbStatus(data.message))
      .catch(error => {
        console.error('Error:', error);
        setDbStatus("Error checking database status");
      });
  }, []);

  return (
    <div className="homepage">
      <h1>DMBot Webapp and Leaderboards</h1>
      <p className="subtitle">Give us a minute, we're under construction.</p>
      <p className="status">Backend status: {backendStatus}</p>
      <p className="status">Database status: {dbStatus}</p>
      <Auth />
      <UserGrid />
    </div>
  );
};

export default Homepage;