import React from "react";
import { renderSpecialContent } from "./cellRenderers";

export interface TableCellProps {
  className?: string;
  children: React.ReactNode;
}

export const TableCell: React.FC<TableCellProps> = ({ className, children }) => (
  <td className={className}>{children}</td>
);

export interface SpecialCellProps {
  className?: string;
  content: string | number | null | undefined;
  type?: "charter" | "timestamp" | "fc" | "percent" | "score-difference" | "html" | "text" | "number";
}

export const SpecialCell: React.FC<SpecialCellProps> = ({
  className = "",
  content,
  type = "text"
}) => (
  <td className={className}>{renderSpecialContent(content, type)}</td>
);

export const PercentCell: React.FC<Omit<SpecialCellProps, "type">> = (props) => (
  <SpecialCell {...props} type="percent" />
);

export const NumberCell: React.FC<Omit<SpecialCellProps, "type">> = (props) => (
  <SpecialCell {...props} type="number" />
);

export const TimestampCell: React.FC<Omit<SpecialCellProps, "type">> = (props) => (
  <SpecialCell {...props} type="timestamp" />
);

export const CharterCell: React.FC<Omit<SpecialCellProps, "type">> = (props) => (
  <SpecialCell {...props} type="charter" />
);

export const HTMLCell: React.FC<Omit<SpecialCellProps, "type">> = (props) => (
  <SpecialCell {...props} type="html" />
);

export const FCCell: React.FC<Omit<SpecialCellProps, "type">> = (props) => (
  <SpecialCell {...props} type="fc" />
);

export const ScoreDifferenceCell: React.FC<Omit<SpecialCellProps, "type">> = (props) => (
  <SpecialCell {...props} type="score-difference" />
);
