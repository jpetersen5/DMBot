import React from "react";
import spinnerGif from "../../assets/spinner.gif";
import "./LoadingSpinner.scss";

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Loading..." }) => {
  return (
    <div className="loading-spinner">
      <img src={spinnerGif} alt="Loading" className="spinner-icon" />
      <p className="loading-message">{message}</p>
    </div>
  );
};

export default LoadingSpinner;