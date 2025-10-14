import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "../App";
import { Achievement } from "../utils/achievement";

interface AchievementError {
  id: string;
  name: string;
  error: string;
}

interface UploadProgressState {
  isUploading: boolean;
  isProcessing: boolean;
  message: string;
  progress: number;
  completed: boolean;
  userId: string | null;
  newAchievements: Achievement[];
  achievementErrors: AchievementError[];
  status: string;
}

export const useUploadProgress = () => {
  const [state, setState] = useState<UploadProgressState>({
    isUploading: false,
    isProcessing: false,
    message: "",
    progress: 0,
    completed: false,
    userId: null,
    newAchievements: [],
    achievementErrors: [],
    status: "idle",
  });
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const currentUserId = localStorage.getItem("user_id");
    setState(prev => ({ ...prev, userId: currentUserId }));

    const checkInitialStatus = async () => {
      if (currentUserId) {
        try {
          const response = await fetch(`${API_URL}/api/processing_status`, {
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
            }
          });
          if (response.ok) {
            const statusData = await response.json();
            if (statusData.status === "in_progress" || statusData.status === "pending") {
               setState(prev => ({
                 ...prev,
                 isProcessing: true,
                 status: statusData.status,
                 progress: statusData.progress || 0,
                 message: `Resuming previous processing state... (${Math.round(statusData.progress || 0)}%)`
               }));
            }
          }
        } catch (error) {
          console.error("Failed to fetch initial processing status", error);
        }
      }
    };
    checkInitialStatus();

    const newSocket = io(API_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      const userId = localStorage.getItem("user_id");
      if (userId) {
        console.log("Emitting join for user:", userId);
        newSocket.emit("join", userId);
      } else {
        console.log("No user ID found to join room.");
      }
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    return () => {
      console.log("Disconnecting socket");
      newSocket.disconnect();
      setSocket(null);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.off("score_processing_start");
    socket.off("score_processing_fetching_songs");
    socket.off("score_processing_progress");
    socket.off("score_processing_uploading");
    socket.off("score_processing_updating_progress");
    socket.off("score_processing_processing_achievements");
    socket.off("new_achievement");
    socket.off("score_processing_achievement_errors");
    socket.off("score_processing_complete");
    socket.off("score_processing_error");

    socket.on("score_processing_start", () => {
      setState(prev => ({
        ...prev,
        isProcessing: true,
        completed: false,
        message: "Processing started...",
        progress: 0,
        newAchievements: [],
        achievementErrors: [],
        status: "in_progress",
      }));
    });

    socket.on("score_processing_fetching_songs", (data) => {
      setState(prev => ({ ...prev, message: data.message }));
    });

    socket.on("score_processing_progress", (data) => {
      setState(prev => ({
        ...prev,
        progress: data.progress,
        message: `Processing song ${data.processed} of ${data.total}`,
      }));
    });

    socket.on("score_processing_uploading", (data) => {
      setState(prev => ({ ...prev, message: data.message }));
    });

    socket.on("score_processing_updating_progress", (data) => {
      setState(prev => ({
        ...prev,
        message: data.message,
      }));
    });

    socket.on("score_processing_processing_achievements", (data) => {
      setState(prev => ({ ...prev, progress: 95, message: data.message }));
    });

    socket.on("new_achievement", (data) => {
      setState(prev => ({
        ...prev,
        newAchievements: [...prev.newAchievements, data.achievement],
      }));
    });

    socket.on("score_processing_achievement_errors", (data) => {
      console.log("Received achievement errors:", data.errors);
      setState(prev => ({
        ...prev,
        achievementErrors: data.errors || [],
      }));
    });

    socket.on("score_processing_complete", (data) => {
      console.log("Processing complete:", data);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        isUploading: false,
        progress: 100,
        completed: true,
        message: data.message,
        status: data.status || "completed",
        achievementErrors: data.errors || prev.achievementErrors || [],
      }));
    });

    socket.on("score_processing_error", (data) => {
      console.error("Processing error:", data);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        isUploading: false,
        progress: 0,
        message: `Error: ${data.message}`,
        status: "error",
        completed: true,
      }));
    });

  }, [socket]);

  const startUpload = useCallback(() => {
    setState(prev => ({
      ...prev,
      isUploading: true,
      isProcessing: false,
      completed: false,
      message: "Starting upload...",
      progress: 0,
      newAchievements: [],
      achievementErrors: [],
      status: "uploading",
    }));
  }, []);

  const finishUpload = useCallback((uploadMessage: string, uploadStatus: "success" | "error" = "success") => {
    setState(prev => ({
      ...prev,
      isUploading: false,
      message: uploadMessage,
      status: uploadStatus === "success" ? "waiting_for_processing" : "error",
    }));
    if (uploadStatus === "error") {
      setState(prev => ({ ...prev, completed: true }));
    }
  }, []);

  const resetUploadState = useCallback(() => {
    setState(prev => ({
      ...prev,
      isProcessing: false,
      isUploading: false,
      completed: false,
      message: "",
      progress: 0,
      status: "idle",
    }));
  }, []);

  const clearAchievement = useCallback((achievementId: string) => {
    setState(prev => ({
      ...prev,
      newAchievements: prev.newAchievements.filter(a => a.id !== achievementId),
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
     setState(prev => ({
       ...prev,
       newAchievements: [],
       achievementErrors: [],
     }));
  }, []);

  return {
    ...state,
    startUpload,
    finishUpload,
    resetUploadState,
    clearAchievement,
    clearAllNotifications,
  };
};