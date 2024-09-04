import React, { useState, useEffect } from "react";
import { API_URL } from "../App";
import LoadingSpinner from "./Loading/LoadingSpinner";
import Auth from "./Auth/Auth";
import UserGrid from "./UserGrid/UserGrid";
import Tooltip from "../utils/Tooltip/Tooltip";

import FeatureIcon from "../assets/feature-icon.svg";
import BugIcon from "../assets/bug-icon.svg";
import ContributeIcon from "../assets/contribute-icon.svg";
import DiscordIcon from "../assets/discord-icon.svg";

import "./Homepage.scss";

const Homepage: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/hello`)
      .then(response => response.json())
      .then(data => setBackendStatus(data.message))
      .catch(error => {
        console.error("Error:", error);
        setBackendStatus("Error connecting to backend");
      });

    fetch(`${API_URL}/api/db-status`)
      .then(response => response.json())
      .then(data => setDbStatus(data.message))
      .catch(error => {
        console.error("Error:", error);
        setDbStatus("Error checking database status");
      });
  }, []);

  return (
    <div className="homepage">
      <h1>DMBot Webapp and Leaderboards</h1>
      <p className="subtitle">Give us a minute, we're under construction.</p>
      <div className="action-buttons">
        <Tooltip text="Request a new feature">
          <a href="https://forms.gle/ceJxzyYEwbDLn6TGA" target="_blank" rel="noopener noreferrer" className="icon-button">
            <img src={FeatureIcon} alt="Request feature" />
          </a>
        </Tooltip>
        <Tooltip text="Report a bug">
          <a href="https://github.com/jpetersen5/DMBot/issues" target="_blank" rel="noopener noreferrer" className="icon-button">
            <img src={BugIcon} alt="Report bug" />
          </a>
        </Tooltip>
        <Tooltip text="Contribute to the project">
          <a href="https://github.com/jpetersen5/DMBot" target="_blank" rel="noopener noreferrer" className="icon-button">
            <img src={ContributeIcon} alt="Contribute" />
          </a>
        </Tooltip>
        <Tooltip text="Join the Drummer's Monthly Discord">
          <a href="https://discord.gg/Eh8RgrzYbb" target="_blank" rel="noopener noreferrer" className="icon-button">
            <img src={DiscordIcon} alt="Discord" />
          </a>
        </Tooltip>
      </div>
      <div className="status">
        <p>Backend status:</p>
        {backendStatus === null ? (
          <LoadingSpinner timeout={0} />
        ) : (
          <p>{backendStatus}</p>
        )}
      </div>
      <div className="status">
        <p>Database status:</p>
        {dbStatus === null ? (
          <LoadingSpinner timeout={0} />
        ) : (
          <p>{dbStatus}</p>
        )}
      </div>
      <Auth />
      <UserGrid />
    </div>
  );
};

export default Homepage;
