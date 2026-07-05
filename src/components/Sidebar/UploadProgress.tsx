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

  const [dismissed, setDismissed] = useState<boolean>(false);
  const [prevFlags, setPrevFlags] = useState({ isUploading, isProcessing, completed });
  const location = useLocation();
  const navigate = useNavigate();

  if (
    prevFlags.isUploading !== isUploading ||
    prevFlags.isProcessing !== isProcessing ||
    prevFlags.completed !== completed
  ) {
    setPrevFlags({ isUploading, isProcessing, completed });
    setDismissed(false);
  }

  const isVisible = (isUploading || isProcessing || completed) && !dismissed;

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
    setDismissed(true);
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