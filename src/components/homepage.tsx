import React, { useState, useEffect } from "react";
import { API_URL } from "../App";

const Home: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState("Not functional");

  useEffect(() => {
    fetch(`${API_URL}/api/hello`, {
      credentials: 'include',
    })
      .then(response => response.json())
      .then(data => setBackendStatus(data.message))
      .catch(error => console.error('Error:', error));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">DMBot Webapp and Leaderboards</h1>
      <p className="text-xl text-gray-700">Give us a minute, we're under construction.</p>
      <p className="text-xl text-gray-700">Backend status: {backendStatus}</p>
    </div>
  );
};

export default Home;