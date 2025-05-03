import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUploadProgress } from "../../hooks/useUploadProgress";
import Draggable from "../../utils/Draggable";

import "./UploadProgress.scss";
import closeIcon from "../../assets/close.svg";

const UploadProgress: React.FC = () => {
  const {
    isProcessing,
    isUploading,
    message,
    progress,
    completed,
    userId,
    resetUploadState,
    achievementErrors,
    status,
    clearAllNotifications,
  } = useUploadProgress();

  const [isVisible, setIsVisible] = useState<boolean>(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isUploading || isProcessing || completed) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isUploading, isProcessing, completed]);

  const isOnProfilePage = userId && location.pathname.includes(`/user/${userId}`);

  useEffect(() => {
    if (completed && status !== "error" && isOnProfilePage) {
      window.dispatchEvent(new CustomEvent("scoresNeedRefresh"));
    }
  }, [completed, status, isOnProfilePage]);

  const handleClose = () => {
    if (completed) {
      clearAllNotifications();
      resetUploadState();
    }
    setIsVisible(false);
  };

  const handleGoToProfile = () => {
    if (userId) {
      navigate(`/user/${userId}/scores`);
      handleClose();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Draggable handleSelector=".drag-handle">
      <div className={`upload-progress status-${status}`}>
        <div className="drag-handle">
          <h3>{isUploading ? "Uploading..." : isProcessing ? "Processing..." : "Upload Complete"}</h3>
        </div>
        <p>{message}</p>
        {(isUploading || isProcessing) && <progress value={progress} max="100" />}

        {completed && achievementErrors && achievementErrors.length > 0 && (
          <div className="achievement-errors">
            <h4>Achievement Processing Issues:</h4>
            <ul>
              {achievementErrors.map((err) => (
                <li key={err.id} title={`Error: ${err.error}`}>
                  ⚠️ {err.name} ({err.id})
                </li>
              ))}
            </ul>
          </div>
        )}

        {completed && status !== "error" && !isOnProfilePage && userId && (
          <button className="profile-button" onClick={handleGoToProfile}>
            Go to Profile
          </button>
        )}

        <button className="close-button" onClick={handleClose}>
          <img src={closeIcon} alt="Close" />
        </button>
      </div>
    </Draggable>
  );
};

export default UploadProgress;