import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { API_URL } from "../../App";

import "./UploadProgress.scss";

const UploadProgress: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      const userId = localStorage.getItem("user_id");
      if (userId) {
        socket.emit("join", userId);
      }
    });

    socket.on("score_processing_progress", (data) => {
      setProgress(data.progress);
      setMessage(`Processing song ${data.processed} of ${data.total}`);
      setIsUploading(true);
    });

    socket.on("score_processing_uploading", (data) => {
      setMessage(data.message);
    });

    socket.on("score_processing_complete", (data) => {
      setMessage(data.message);
      setIsUploading(false);
      setProgress(100);
    });

    socket.on("score_processing_error", (data) => {
      setMessage(data.message);
      setIsUploading(false);
      setProgress(0);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (!isUploading) {
    return null;
  }

  return (
    <div className={`upload-progress ${isUploading ? "" : "hidden"}`}>
      <h3>Upload Progress</h3>
      <p>{message}</p>
      <progress value={progress} max="100" />
    </div>
  );
};

export default UploadProgress;