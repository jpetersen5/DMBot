import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { API_URL } from "../App";

interface UploadProgressState {
  isUploading: boolean;
  isProcessing: boolean;
  message: string;
  progress: number;
}

export const useUploadProgress = () => {
  const [state, setState] = useState<UploadProgressState>({
    isUploading: false,
    isProcessing: false,
    message: "",
    progress: 0,
  });

  useEffect(() => {
    const newSocket = io(API_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      const userId = localStorage.getItem("user_id");
      if (userId) {
        newSocket.emit("join", userId);
      }
    });

    newSocket.on("score_processing_start", () => {
      setState(prev => ({
        ...prev,
        isProcessing: true,
        message: "Processing started",
      }));
    });

    newSocket.on("score_processing_fetching_songs", (data) => {
      setState(prev => ({ ...prev, message: data.message }));
    });

    newSocket.on("score_processing_progress", (data) => {
      setState(prev => ({
        ...prev,
        progress: data.progress,
        message: `Processing song ${data.processed} of ${data.total}`,
      }));
    });

    newSocket.on("score_processing_uploading", (data) => {
      setState(prev => ({ ...prev, message: data.message }));
    });

    newSocket.on("score_processing_updating_progress", (data) => {
      setState(prev => ({
        ...prev,
        progress: data.progress,
        message: data.message,
      }));
    });

    newSocket.on("score_processing_complete", (data) => {
      setState(prev => ({
        ...prev,
        progress: 100,
        message: data.message + ". Refresh user profile to see new scores!",
      }));
    });

    newSocket.on("score_processing_error", (data) => {
      setState(prev => ({
        ...prev,
        progress: 0,
        message: data.message,
      }));
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const startUpload = () => {
    setState(prev => ({ ...prev, isUploading: true }));
  };

  const finishUpload = (message: string) => {
    setState(prev => ({
      ...prev,
      isUploading: false,
      message,
    }));
  };

  return {
    ...state,
    startUpload,
    finishUpload,
  };
};