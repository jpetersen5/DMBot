import React, { ReactNode, useRef, useState } from "react";
import "./Tooltip.scss";

interface TooltipProps {
  children: ReactNode;
  text?: string;
  content?: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

// TODO: fix tooltip positioning when a parent element has a transform or perspective or filter
// https://aerotwist.com/blog/some-gotchas-that-got-me/
const Tooltip: React.FC<TooltipProps> = ({ children, text, content, position = "top" }) => {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
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

      setTooltipPosition({ top, left });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
  };

  return (
    <div
      className={`tooltip-container ${position}`}
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
    >
      {children}
      <div
        className="tooltip-content-container"
        ref={tooltipRef}
        style={{ top: `${tooltipPosition.top}px`, left: `${tooltipPosition.left}px` }}
      >
        {text && <span className="tooltip">{text}</span>}
        {content && <div className="tooltip-content">{content}</div>}
      </div>
    </div>
  );
};

export default Tooltip;