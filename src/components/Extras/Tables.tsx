import CharterName from "../SongList/CharterName";
import Tooltip from "../../utils/Tooltip/Tooltip";
import { renderSafeHTML, processColorTags } from "../../utils/safeHTML";
import { formatExactTime, formatTimeDifference } from "../../utils/song";
import fcIcon from "../../assets/crown.png";

interface TableHeaderProps {
  onClick: () => void;
  className?: string;
  content: string;
  sort: boolean;
  sortOrder: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ onClick, className, content, sort, sortOrder }) => (
  <th onClick={onClick} className={className}>
    <div className="header-content">
      <span className="header-text">{content}</span>
      {sort && <span className="sort-arrow">{sortOrder === "asc" ? "▲" : "▼"}</span>}
    </div>
  </th>
);

interface SimpleTableHeaderProps {
  className?: string;
  content: string;
}

export const SimpleTableHeader: React.FC<SimpleTableHeaderProps> = ({ className, content }) => (
  <th className={className}>
    <div className="header-content">
      <span className="header-text">{content}</span>
    </div>
  </th>
);


interface SongTableCellProps {
  className?: string;
  content: string | null | undefined;
  special?: "charter" | "last_update" | "fc_percent" | "percent" | "score_difference";
}

export const SongTableCell: React.FC<SongTableCellProps> = ({ className, content, special }) => {
  if (content == null) {
    return <td className={className}>{""}</td>;
  }

  let cellContent;
  let cellClassName = className;

  switch (special) {
    case "percent":
      cellContent = content + "%";
      break;
    case "fc_percent":
      cellContent = <img src={fcIcon} alt="FC" className="fc-crown" />;
      break;
    case "last_update":
      cellContent = (
        <Tooltip text={formatExactTime(content)}>
          {formatTimeDifference(content)}
        </Tooltip>
      );
      break;
    case "charter":
      cellContent = <CharterName names={content} />;
      break;
    case "score_difference":
      if (content.startsWith("-")) {
        cellClassName = `${className} score-difference-negative`;
      } else if (content.startsWith("+")) {
        cellClassName = `${className} score-difference-positive`;
      }
      cellContent = content;
      break;
    default:
      const processedContent = typeof content === "string"
        ? processColorTags(content)
        : String(content);
      cellContent = <span dangerouslySetInnerHTML={renderSafeHTML(processedContent)} />;
      break;
  }

  return <td className={cellClassName}>{cellContent}</td>;
};

// export const SongTableCell: React.FC<SongTableCellProps> = ({ content, special }) => {
//   if (content == null) {
//     return <td>{"N/A"}</td>;
//   }
//   switch (special) {
//     case "percent":
//       return <td>{content + "%"}</td>;
//     case "fc_percent":
//       return <td>
//         <img src={fcIcon} alt="FC" className="fc-crown" />
//       </td>;
//     case "last_update":
//       return <td>
//         <Tooltip text={formatExactTime(content)}>
//           {formatTimeDifference(content)}
//         </Tooltip>
//       </td>;
//     case "charter":
//       return <td><CharterName names={content} /></td>;
//     case "score_difference":
//       if (content.startsWith("-")) {
//         return <td className="score-difference-negative">{content}</td>;
//       } else if (content.startsWith("+")) {
//         return <td className="score-difference-positive">{content}</td>;
//       } else {
//         return <td>{content}</td>;
//       }
//   }

//   const processedContent = typeof content === "string"
//     ? processColorTags(content)
//     : String(content);

//   return <td dangerouslySetInnerHTML={renderSafeHTML(processedContent)} />;
// };
