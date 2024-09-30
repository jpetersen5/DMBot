import React, { useState, useEffect } from "react";
import { useUploadProgress } from "../../../hooks/useUploadProgress";
import Tooltip from "../../../utils/Tooltip/Tooltip";
import { API_URL } from "../../../App";
import "./ScoreUpload.scss";

import CopyIcon from "../../../assets/copy.svg";

const ScoreUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const { isUploading, isProcessing, message, startUpload, finishUpload } = useUploadProgress();
  const [selectedOS, setSelectedOS] = useState<string>("");

  const filepaths = {
    windows: "%USERPROFILE%\\AppData\\LocalLow\\srylain Inc_\\Clone Hero",
    mac: "~/Library/Application Support/com.srylain.CloneHero",
    linux: "~/.config/unity3d/srylain Inc_/Clone Hero",
    android: "Internal Storage > Android > Data > com.srylain.CloneHero"
  };

  useEffect(() => {
    const detectOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (userAgent.indexOf("win") > -1) return "windows";
      if (userAgent.indexOf("mac") > -1) return "mac";
      if (userAgent.indexOf("linux") > -1) return "linux";
      if (userAgent.indexOf("android") > -1) return "android";
      return "windows";
    };

    const os = detectOS();
    setSelectedOS(os);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      finishUpload(false, "Please select a file");
      return;
    }

    startUpload();
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/api/upload_scoredata`, {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        }
      });

      const result = await response.json();

      if (response.ok) {
        finishUpload(true, `Upload complete. Processing started. Total songs: ${result.total_songs}`);
        setFile(null);
      } else {
        finishUpload(false, result.error || "An error occurred while processing the file");
      }
    } catch (error) {
      finishUpload(false, "An error occurred while uploading the file");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(filepaths[selectedOS as keyof typeof filepaths]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="score-upload">
      <h2>Upload Score Data</h2>
      <input
        type="file"
        onChange={handleFileChange}
        accept=".bin"
        disabled={isUploading || isProcessing}
      />
      <button
        onClick={handleUpload}
        disabled={!file || isUploading || isProcessing}
      >
        {isUploading ? "Uploading..." : isProcessing ? "Processing..." : "Upload"}
      </button>
      {message && <p>{message}</p>}
      <div className="filepath-section">
        Locate the scoredata.bin file at
        <img src={CopyIcon} alt="Copy" className="copy-icon" />
        <Tooltip text={copied ? "Copied to clipboard!" : "Copy to clipboard"}>
          <span className="filepath-text" onClick={handleCopy}>
            {filepaths[selectedOS as keyof typeof filepaths]}
          </span>
        </Tooltip>
      </div>
      <div className="os-selection">
        <p>
          Not your OS? Select:
          {Object.keys(filepaths).map((os) => (
            <button
              key={os}
              onClick={() => setSelectedOS(os)}
              className={selectedOS === os ? "active" : ""}
            >
              {os.charAt(0).toUpperCase() + os.slice(1)}
            </button>
          ))}
        </p>
      </div>
    </div>
  );
};

export default ScoreUpload;