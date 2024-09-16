import React from "react";
import { Modal } from "react-bootstrap";
import "./ThemeModal.scss";

import DayIcon from "../../../assets/day.svg";
import NightIcon from "../../../assets/night.svg";

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  themes: { [key: string]: string };
}

const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, onClose, themes }) => {
  const selectTheme = (theme: string) => {
    localStorage.setItem("theme", theme);
    document.documentElement.className = "";
    document.documentElement.classList.add(`theme-${theme}`);
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case "light":
        return DayIcon;
      case "dark":
        return NightIcon;
      default:
        return null;
    }
  };

  return (
    <Modal show={isOpen} onHide={onClose} centered className="theme-modal">
      <Modal.Header closeButton>
        <Modal.Title>Select Theme</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ul className="theme-list">
          {Object.entries(themes).map(([key, value]) => (
            <li key={key} onClick={() => selectTheme(value)} className="theme-option">
              {getThemeIcon(value) && (
                <img 
                  src={getThemeIcon(value) || ""} 
                  alt={`${key} theme icon`} 
                  className="theme-icon"
                />
              )}
              <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
            </li>
          ))}
        </ul>
      </Modal.Body>
    </Modal>
  );
};

export default ThemeModal;