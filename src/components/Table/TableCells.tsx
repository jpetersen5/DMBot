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

function renderSpecialContent(
  content: SpecialCellProps["content"],
  type: SpecialCellProps["type"] = "text"
): React.ReactNode {
  if (content == null) {
    return "N/A";
  }

  const contentStr = content.toString();

  switch (type) {
    case "number":
      return Number(content).toLocaleString();

    case "percent":
      return contentStr + "%";

    case "fc":
      return <img src={fcIcon} alt="FC" className="fc-crown" />;

    case "timestamp":
      return (
        <Tooltip text={formatExactTime(contentStr)}>
          {formatTimeDifference(contentStr)}
        </Tooltip>
      );

    case "charter":
      return <CharterName names={contentStr} />;

    case "score-difference": {
      const diffClass = contentStr.startsWith("-")
        ? "score-difference-negative"
        : contentStr.startsWith("+")
          ? "score-difference-positive"
          : "";
      return diffClass ? <span className={diffClass}>{contentStr}</span> : contentStr;
    }

    case "html": {
      const processedContent = typeof content === "string"
        ? processColorTags(content)
        : String(content);
      return <span dangerouslySetInnerHTML={renderSafeHTML(processedContent)} />;
    }

    case "text":
    default:
      return contentStr;
  }
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

// eslint-disable-next-line react-refresh/only-export-components
export const cellRenderers = {
  text: (content: SpecialCellProps["content"]) => renderSpecialContent(content, "text"),
  number: (content: SpecialCellProps["content"]) => renderSpecialContent(content, "number"),
  percent: (content: SpecialCellProps["content"]) => renderSpecialContent(content, "percent"),
  fc: (content: SpecialCellProps["content"]) => renderSpecialContent(content, "fc"),
  timestamp: (content: SpecialCellProps["content"]) => renderSpecialContent(content, "timestamp"),
  charter: (content: SpecialCellProps["content"]) => renderSpecialContent(content, "charter"),
  html: (content: SpecialCellProps["content"]) => renderSpecialContent(content, "html"),
  scoreDifference: (content: SpecialCellProps["content"]) => renderSpecialContent(content, "score-difference"),
};
