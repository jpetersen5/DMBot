import React, { useState, useEffect } from "react";
import { API_URL } from "../App";
import Auth from "./auth/Auth";
import UserGrid from "./UserGrid/UserGrid";

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">DMBot Webapp and Leaderboards</h1>
      <p className="text-xl text-gray-700">Give us a minute, we're under construction.</p>
      <p className="text-xl text-gray-700">Backend status: {backendStatus}</p>
      <p className="text-xl text-gray-700">Database status: {dbStatus}</p>
      <br></br>
      <Auth />
      <UserGrid />
    </div>
  );
};

export default Homepage;