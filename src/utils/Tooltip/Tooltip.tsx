import React, { ReactNode, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./Tooltip.scss";

interface TooltipProps {
  children: ReactNode;
  text?: string;
  content?: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

const Tooltip: React.FC<TooltipProps> = ({ children, text, content, position = "top" }) => {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (containerRef.current && tooltipRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;

      switch (position) {
        case "top":
          top = containerRect.top - tooltipRect.height - 10;
          left = containerRect.left + (containerRect.width - tooltipRect.width) / 2;
          break;
        case "bottom":
          top = containerRect.bottom + 10;
          left = containerRect.left + (containerRect.width - tooltipRect.width) / 2;
          break;
        case "left":
          top = containerRect.top + (containerRect.height - tooltipRect.height) / 2;
          left = containerRect.left - tooltipRect.width - 10;
          break;
        case "right":
          top = containerRect.top + (containerRect.height - tooltipRect.height) / 2;
          left = containerRect.right + 10;
          break;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      if (left < 10) left = 10;
      if (left + tooltipRect.width > viewportWidth - 10) {
        left = viewportWidth - tooltipRect.width - 10;
      }
      
      if (top < 10) top = 10;
      if (top + tooltipRect.height > viewportHeight - 10) {
        top = viewportHeight - tooltipRect.height - 10;
      }

      setTooltipPosition({ top, left });
    }
  };

  const handleMouseEnter = () => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      updatePosition();
      const timer = setTimeout(updatePosition, 10);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Create portal for tooltip to avoid parent transform issues
  const tooltipPortal = isVisible && createPortal(
    <div
      className={`tooltip-content-container ${position}`}
      ref={tooltipRef}
      style={{ 
        top: `${tooltipPosition.top}px`, 
        left: `${tooltipPosition.left}px`,
        opacity: isVisible ? 1 : 0,
        visibility: isVisible ? 'visible' : 'hidden',
        zIndex: 10000
      }}
    >
      <div className="tooltip-content">{text || content || ""}</div>
    </div>,
    document.body
  );

  return (
    <div
      className={`tooltip-container ${position}`}
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {tooltipPortal}
    </div>
  );
};

export default Tooltip;