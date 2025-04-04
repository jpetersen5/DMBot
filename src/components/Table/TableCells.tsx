import React from "react";
import Tooltip from "../../utils/Tooltip/Tooltip";
import CharterName from "../SongList/CharterName";
import { renderSafeHTML, processColorTags } from "../../utils/safeHTML";
import { formatExactTime, formatTimeDifference } from "../../utils/song";
import fcIcon from "../../assets/crown.png";

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
}) => {
  if (content == null) {
    return <td className={className}>{"N/A"}</td>;
  }

  let cellContent;
  let cellClassName = className;
  const contentStr = content.toString();

  switch (type) {
    case "number":
      cellContent = Number(content).toLocaleString();
      break;

    case "percent":
      cellContent = contentStr + "%";
      break;

    case "fc":
      cellContent = <img src={fcIcon} alt="FC" className="fc-crown" />;
      break;

    case "timestamp":
      cellContent = (
        <Tooltip text={formatExactTime(contentStr)}>
          {formatTimeDifference(contentStr)}
        </Tooltip>
      );
      break;

    case "charter":
      cellContent = <CharterName names={contentStr} />;
      break;

    case "score-difference":
      if (contentStr.startsWith("-")) {
        cellClassName = `${className} score-difference-negative`;
      } else if (contentStr.startsWith("+")) {
        cellClassName = `${className} score-difference-positive`;
      }
      cellContent = contentStr;
      break;

    case "html":
      const processedContent = typeof content === "string"
        ? processColorTags(content)
        : String(content);
      cellContent = <span dangerouslySetInnerHTML={renderSafeHTML(processedContent)} />;
      break;

    case "text":
    default:
      cellContent = contentStr;
      break;
  }

  return <td className={cellClassName}>{cellContent}</td>;
};

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

export const cellRenderers = {
  text: (content: any, className?: string) => (
    <SpecialCell content={content} className={className} type="text" />
  ),
  number: (content: any, className?: string) => (
    <SpecialCell content={content} className={className} type="number" />
  ),
  percent: (content: any, className?: string) => (
    <SpecialCell content={content} className={className} type="percent" />
  ),
  fc: (content: any, className?: string) => (
    <SpecialCell content={content} className={className} type="fc" />
  ),
  timestamp: (content: any, className?: string) => (
    <SpecialCell content={content} className={className} type="timestamp" />
  ),
  charter: (content: any, className?: string) => (
    <SpecialCell content={content} className={className} type="charter" />
  ),
  html: (content: any, className?: string) => (
    <SpecialCell content={content} className={className} type="html" />
  ),
  scoreDifference: (content: any, className?: string) => (
    <SpecialCell content={content} className={className} type="score-difference" />
  ),
}; 