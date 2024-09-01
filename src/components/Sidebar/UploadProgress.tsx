import React, { useState } from "react";
import { useUploadProgress } from "../../hooks/useUploadProgress";
import Draggable from "../../utils/Draggable";

import "./UploadProgress.scss";

const UploadProgress: React.FC = () => {
  const { isProcessing, message, progress } = useUploadProgress();
  const [isVisible, setIsVisible] = useState<boolean>(true);

  const handleClose = () => {
    setIsVisible(false);
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
        <button className="close-button" onClick={handleClose}>×</button>
      </div>
    </Draggable>
  );
};

export default UploadProgress;