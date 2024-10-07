import React, { ReactNode } from "react";
import "./Tooltip.scss";

interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: "top" | "bottom" | "left" | "right";
}

const Tooltip: React.FC<TooltipProps> = ({ children, text, position = "top" }) => {
  return (
    <div className={`tooltip-container ${position}`}>
      {children}
      <span className="tooltip">{text}</span>
    </div>
  );
};

export default Tooltip;