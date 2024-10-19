import React, { ReactNode } from "react";
import "./Tooltip.scss";

interface TooltipProps {
  children: ReactNode;
  text?: string;
  content?: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

const Tooltip: React.FC<TooltipProps> = ({ children, text, content, position = "top" }) => {
  return (
    <div className={`tooltip-container ${position}`}>
      {children}
      <div className="tooltip-content-container">
        {text && <span className="tooltip">{text}</span>}
        {content && <div className="tooltip-content">{content}</div>}
      </div>
    </div>
  );
};

export default Tooltip;