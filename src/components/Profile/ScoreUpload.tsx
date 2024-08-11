import React, { useState } from "react";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { API_URL } from "../../App";
import "./ScoreUpload.scss";

const ScoreUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setMessage("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file");
      return;
    }

    setIsUploading(true);
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
        setMessage("Score data processed successfully");
        setFile(null);
      } else {
        setMessage(result.error || "An error occurred while processing the file");
      }
    } catch (error) {
      setMessage("An error occurred while uploading the file");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="score-upload">
      <h2>Upload Score Data</h2>
      <div className="file-input-wrapper">
        <input type="file" onChange={handleFileChange} accept=".bin" />
      </div>
      <button onClick={handleUpload} disabled={!file || isUploading}>
        {isUploading && <LoadingSpinner message="Uploading..." timeout={5000} />}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default ScoreUpload;