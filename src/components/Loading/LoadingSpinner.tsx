import React, { useState, useEffect } from "react";
import spinnerGif from "../../assets/spinner.gif";
import "./LoadingSpinner.scss";

interface LoadingSpinnerProps {
  message?: string;
  timeout?: number;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Loading...",
  timeout = 10000,
}) => {
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeoutMessage(true);
    }, timeout);

    return () => clearTimeout(timer);
  }, [timeout]);

  return (
    <div className="loading-spinner">
      <img src={spinnerGif} alt="Loading" className="spinner-icon" />
      <p className="loading-message">{message}</p>
      {showTimeoutMessage && (
        <p className="timeout-message">
          We're using free services, so please be patient. It could take up to a minute.
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;