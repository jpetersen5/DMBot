import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUploadProgress } from "../../hooks/useUploadProgress";
import Draggable from "../../utils/Draggable";

import "./UploadProgress.scss";
import closeIcon from "../../assets/close.svg";

const UploadProgress: React.FC = () => {
  const { isProcessing, message, progress, completed, userId, resetUploadState } = useUploadProgress();
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const location = useLocation();
  const navigate = useNavigate();

  const isOnProfilePage = userId && location.pathname.includes(`/user/${userId}`);

  useEffect(() => {
    if (completed && isOnProfilePage) {
      window.dispatchEvent(new CustomEvent("scoresNeedRefresh"));
    }
  }, [completed, isOnProfilePage]);

  const handleClose = () => {
    setIsVisible(false);
    if (completed) {
      resetUploadState();
    }
  };

  const handleGoToProfile = () => {
    if (userId) {
      navigate(`/user/${userId}/scores`);
      handleClose();
    }
  };

  if (!isVisible || !isProcessing) {
    return null;
  }

  return (
    <Draggable>
      <div className="upload-progress">
        <div className="drag-handle">
          <h3>Upload Progress</h3>
        </div>
        <p>{message}</p>
        <progress value={progress} max="100" />
        
        {completed && !isOnProfilePage && (
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