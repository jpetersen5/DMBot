import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { API_URL } from "../App";
import { Achievement } from "../utils/achievement";

interface UploadProgressState {
  isUploading: boolean;
  isProcessing: boolean;
  message: string;
  progress: number;
  completed: boolean;
  userId: string | null;
  newAchievements: Achievement[];
}

export const useUploadProgress = () => {
  const [state, setState] = useState<UploadProgressState>({
    isUploading: false,
    isProcessing: false,
    message: "",
    progress: 0,
    completed: false,
    userId: localStorage.getItem("user_id"),
    newAchievements: [],
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
        setState(prev => ({ ...prev, userId }));
      }
    });

    newSocket.on("score_processing_start", () => {
      setState(prev => ({
        ...prev,
        isProcessing: true,
        completed: false,
        message: "Processing started",
        newAchievements: [],
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

    newSocket.on("score_processing_processing_achievements", (data) => {
      setState(prev => ({ ...prev, message: data.message }));
    });

    newSocket.on("new_achievement", (data) => {
      setState(prev => ({
        ...prev,
        newAchievements: [...prev.newAchievements, data.achievement],
      }));
    });

    newSocket.on("score_processing_complete", (data) => {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        isUploading: false,
        progress: 100,
        completed: true,
        message: data.message,
      }));
    });

    newSocket.on("score_processing_error", (data) => {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        isUploading: false,
        progress: 0,
        message: data.message,
      }));
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const startUpload = () => {
    setState(prev => ({ 
      ...prev, 
      isUploading: true,
      completed: false,
      newAchievements: [],
    }));
  };

  const finishUpload = (message: string) => {
    setState(prev => ({
      ...prev,
      isUploading: false,
      message,
    }));
  };

  const resetUploadState = () => {
    setState(prev => ({
      ...prev,
      isProcessing: false,
      isUploading: false,
      completed: false,
      message: "",
      progress: 0,
    }));
  };

  const clearAchievement = (achievementId: string) => {
    setState(prev => ({
      ...prev,
      newAchievements: prev.newAchievements.filter(a => a.id !== achievementId),
    }));
  };

  return {
    ...state,
    startUpload,
    finishUpload,
    resetUploadState,
    clearAchievement,
  };
};