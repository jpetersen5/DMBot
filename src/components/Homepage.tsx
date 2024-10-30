import React, { useState, useEffect } from "react";
import { API_URL } from "../App";
import LoadingSpinner from "./Loading/LoadingSpinner";
import Auth from "./Auth/Auth";
import Credits from "./Extras/Credits";
import Tooltip from "../utils/Tooltip/Tooltip";

import FeatureIcon from "../assets/feature-icon.svg";
import BugIcon from "../assets/bug-icon.svg";
import ContributeIcon from "../assets/contribute-icon.svg";
import DiscordIcon from "../assets/discord-icon.svg";
import CreditsIcon from "../assets/credits-icon.svg";
import BannerImage1 from "../assets/dmbotbanner1.png";
import BannerImage2 from "../assets/dmbotbanner2.png";

import "./Homepage.scss";

const Homepage: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<string | null>(null);
  const [showCredits, setShowCredits] = useState<boolean>(false);

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

  const toggleShowCredits = () => {
    setShowCredits(prev => !prev);
  };

  return (
    <div className="homepage">
      <div className="banner-container">
        <img src={BannerImage1} alt="DMBot Banner Pt 1" className="banner-image" />
        <img src={BannerImage2} alt="DMBot Banner Pt 2" className="banner-image" />
      </div>
      <ActionButtons toggleShowCredits={toggleShowCredits} showCredits={showCredits} />
      {showCredits ? <Credits /> : <Auth />}
      <div className="status-container">
        <Status label="Backend" value={backendStatus} />
        <Status label="Database" value={dbStatus} />
      </div>
    </div>
  );
};


interface ActionButtonsProps {
  toggleShowCredits: () => void;
  showCredits: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ toggleShowCredits, showCredits }) => {
  return (
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
      <Tooltip text="Credits">
        <button onClick={toggleShowCredits} className={`icon-button ${showCredits ? "selected" : ""}`} >
          <img src={CreditsIcon} alt="Credits" />
        </button>
      </Tooltip>
    </div>
  );
};

interface StatusProps {
  label: string;
  value: string | null;
}

const Status: React.FC<StatusProps> = ({ label, value }) => {
  return (
    <div className="status">
      <span className="status-label">{label}:</span>
      {value === null ? (
        <LoadingSpinner message={""} timeout={0} />
      ) : (
        <span className={`status-value ${value.toLowerCase().includes("error") ? "error" : "success"}`}>
          {value}
        </span>
      )}
    </div>
  );
}

export default Homepage;
