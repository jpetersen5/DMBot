import React, { useEffect, useState } from "react";
import "./KofiWidget.scss";

import Icon from "./Extras/Icon";
import closeIcon from "../assets/close.svg?react";

interface KofiWidgetProps {
  isSidebarOpen: boolean;
}

const KofiWidget: React.FC<KofiWidgetProps> = ({ isSidebarOpen }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isMinimized, setIsMinimized] = useState(
    localStorage.getItem("kofiMinimized") === "true"
  );

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isMobile && !isSidebarOpen) {
    return null;
  }

  const handleKofiClick = () => {
    window.open("https://ko-fi.com/P5P213HKAK", "_blank");
  };

  const toggleMinimize = () => {
    localStorage.setItem("kofiMinimized", (!isMinimized).toString());
    setIsMinimized(!isMinimized);
  };

  return (
    <div
      className={`kofi-widget ${isMinimized && "minimized"} ${isSidebarOpen && "sidebar-open"}`}
    >
      {!isMobile && (
        <button className="minimize-button" onClick={toggleMinimize}>
          <Icon as={closeIcon} title="X" />
        </button>
      )}
      <button onClick={handleKofiClick} className="kofi-button">
        <span className="hammer-emoji">🔨</span>
        Support Development
      </button>
    </div>
  );
};

export default KofiWidget;