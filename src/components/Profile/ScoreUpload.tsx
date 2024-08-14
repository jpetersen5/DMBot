import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "../../App";
import "./ScoreUpload.scss";

const ScoreUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>("scoredata.bin can be found at %APPDATA%\\..\\LocalLow\\srylain Inc_\\Clone Hero");
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(API_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      console.log("Connected to server");
      setIsConnected(true);
      setMessage("Connected to server");
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setIsConnected(false);
      setMessage("Connection error. Retrying...");
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      setIsConnected(false);
      setMessage("Disconnected from server. Retrying...");
    });

    newSocket.on("score_processing_progress", (data) => {
      setProgress(data.progress);
      setMessage(`Processing song ${data.processed} of ${data.total}`);
    });

    newSocket.on("score_processing_complete", (data) => {
      setMessage(data.message);
      setIsUploading(false);
      setProgress(100);
    });

    newSocket.on("score_processing_error", (data) => {
      setMessage(data.message);
      setIsUploading(false);
      setProgress(0);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file");
      return;
    }

    setIsUploading(true);
    setProgress(0);
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
        setMessage(`Processing started. Total songs: ${result.total_songs}`);
        setFile(null);
      } else {
        setMessage(result.error || "An error occurred while processing the file");
        setIsUploading(false);
      }
    } catch (error) {
      setMessage("An error occurred while uploading the file");
      setIsUploading(false);
    }
  };

  const checkProcessingStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/processing_status`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        }
      });
      const result = await response.json();
      if (result.status === "completed") {
        setMessage("Score processing completed");
        setIsUploading(false);
        setProgress(100);
      } else if (result.status === "in_progress") {
        setProgress(result.progress);
        setMessage(`Processing song ${result.processed} of ${result.total}`);
        setTimeout(checkProcessingStatus, 5000); // 5 seconds
      }
    } catch (error) {
      console.error("Error checking processing status:", error);
    }
  };

  return (
    <div className="score-upload">
      <h2>Upload Score Data</h2>
      <input type="file" onChange={handleFileChange} accept=".bin" disabled={isUploading} />
      <button onClick={handleUpload} disabled={!file || isUploading || !isConnected}>
        {isUploading ? 'Processing...' : 'Upload'}
      </button>
      {message && <p>{message}</p>}
      {isUploading && <progress value={progress} max="100" />}
      {isUploading && !isConnected && (
        <button onClick={checkProcessingStatus}>Check Status</button>
      )}
    </div>
  );
};

export default ScoreUpload;