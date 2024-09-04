import React, { ReactNode } from "react";
import "./Tooltip.scss";

interface TooltipProps {
  children: ReactNode;
  text: string;
}

const Tooltip: React.FC<TooltipProps> = ({ children, text }) => {
  return (
    <div className="tooltip-container">
      {children}
      <span className="tooltip">{text}</span>
    </div>
  );
};

export default Tooltip;