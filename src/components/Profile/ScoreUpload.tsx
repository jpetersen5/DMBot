import React, { useEffect, useState } from "react";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { io, Socket } from "socket.io-client";
import { API_URL } from "../../App";
import "./ScoreUpload.scss";

const ScoreUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>("scoredata.bin can be found at %APPDATA%\\..\\LocalLow\\srylain Inc_\\Clone Hero");
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [socket, setSocket] = useState<Socket | null>(null);

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

  useEffect(() => {
    const newSocket = io(API_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setMessage('Connected to server');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setMessage('Connection error. Retrying...');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      setMessage('Disconnected from server. Retrying...');
    });

    newSocket.on('score_processing_progress', (data) => {
      setProgress(data.progress);
      setMessage(`Processing song ${data.processed} of ${data.total}`);
    });

    newSocket.on('score_processing_complete', (data) => {
      setMessage(data.message);
      setIsUploading(false);
      setProgress(100);
    });

    newSocket.on('score_processing_error', (data) => {
      setMessage(data.message);
      setIsUploading(false);
      setProgress(0);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <div className="score-upload">
      <h2>Upload Score Data</h2>
      <div className="file-input-wrapper">
        <input type="file" onChange={handleFileChange} accept=".bin" />
      </div>
      <button onClick={handleUpload} disabled={!file || isUploading || !socket?.connected}>
        {isUploading ? <LoadingSpinner message="" timeout={0} /> : "Upload"}
      </button>
      {message && <p>{message}</p>}
      {isUploading && <progress value={progress} max="100" />}
    </div>
  );
};

export default ScoreUpload;