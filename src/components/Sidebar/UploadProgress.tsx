import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { API_URL } from "../../App";

import "./UploadProgress.scss";

const UploadProgress: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

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
      setTimeout(() => setIsVisible(false), 3000);
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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setPosition({ x: e.clientX, y: e.clientY });
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      ref={dragRef}
      className={`upload-progress ${isUploading ? "" : "hidden"}`}
      style={{
        left: position.x !== -1 ? `${position.x}px` : "auto",
        top: position.y !== -1 ? `${position.y}px` : "auto",
        right: position.x !== -1 ? "auto" : "20px",
        bottom: position.y !== -1 ? "auto" : "20px",
      }}
    >
      <div className="drag-handle" onMouseDown={handleMouseDown}>
        <h3>Upload Progress</h3>
      </div>
      <p>{message}</p>
      <progress value={progress} max="100" />
      <button className="close-button" onClick={handleClose}>×</button>
    </div>
  );
};

export default UploadProgress;