import React from "react";
import { Modal } from "react-bootstrap";
import { capitalize } from "../../../utils/safeHTML";
import { applyTheme } from "../../../utils/theme";
import "./ThemeModal.scss";

import Icon from "../../Extras/Icon";
import ModalCloseButton from "../../Extras/ModalCloseButton";
import DayIcon from "../../../assets/day.svg?react";
import NightIcon from "../../../assets/night.svg?react";

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  themes: { [key: string]: string };
}

const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, onClose, themes }) => {
  const selectTheme = (theme: string) => {
    applyTheme(theme);
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
      <Modal.Header>
        <Modal.Title>Select Theme</Modal.Title>
        <ModalCloseButton onClick={onClose} />
      </Modal.Header>
      <Modal.Body>
        <ul className="theme-list">
          {Object.entries(themes).map(([key, value]) => (
            <li key={key} onClick={() => selectTheme(value)} className="theme-option">
              {getThemeIcon(value) && (
                <Icon
                  as={getThemeIcon(value)!}
                  title={`${key} theme icon`}
                  className="theme-icon"
                />
              )}
              <span>{capitalize(key)}</span>
            </li>
          ))}
        </ul>
      </Modal.Body>
    </Modal>
  );
};

export default ThemeModal;