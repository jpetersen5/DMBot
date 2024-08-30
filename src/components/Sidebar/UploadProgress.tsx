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
      
      const dx = e.clientX - position.x;
      const dy = e.clientY - position.y;
      
      if (dragRef.current) {
        const newLeft = dragRef.current.offsetLeft + dx;
        const newTop = dragRef.current.offsetTop + dy;
        
        dragRef.current.style.left = `${newLeft}px`;
        dragRef.current.style.top = `${newTop}px`;
      }
      
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

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
      className={`upload-progress ${isUploading ? '' : 'hidden'}`}
      onMouseDown={handleMouseDown}
    >
      <div className="drag-handle">
        <h3>Upload Progress</h3>
      </div>
      <p>{message}</p>
      <progress value={progress} max="100" />
      <button className="close-button" onClick={handleClose}>×</button>
    </div>
  );
};

export default UploadProgress;