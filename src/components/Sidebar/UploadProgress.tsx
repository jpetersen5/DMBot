import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Draggable from "../../utils/Draggable";
import { API_URL } from "../../App";

import "./UploadProgress.scss";

const UploadProgress: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);

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
      setIsVisible(true);
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

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Draggable>
      <div className={`upload-progress ${isUploading ? "" : "hidden"}`}>
        <div className="drag-handle">
          <h3>Upload Progress</h3>
        </div>
        <p>{message}</p>
        <progress value={progress} max="100" />
        <button className="close-button" onClick={handleClose}>×</button>
      </div>
    </Draggable>
  );
};

export default UploadProgress;