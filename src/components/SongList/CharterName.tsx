import React, { memo } from "react";
import { Link } from "react-router-dom";
import { useCharterData } from "../../context/CharterContext";
import { renderSafeHTML } from "../../utils/safeHTML";
import "./CharterName.scss";

interface CharterNameProps {
  names: string;
}

const CharterName: React.FC<CharterNameProps> = memo(({ names }) => {
  const { charterCache } = useCharterData();
  const charters = names.split(",").map(name => name.trim());

  return (
    <div className="charter-name">
      {charters.map((name, i) => {
        const charterData = charterCache[name];
        const separator = i < charters.length - 1 ? ", " : null;

        if (!charterData) {
          return (
            <React.Fragment key={i}>
              <span dangerouslySetInnerHTML={renderSafeHTML(name)} />
              {separator}
            </React.Fragment>
          );
        }

        const charterLink = charterData.userId ? `/user/${charterData.userId}` : `/charter/${charterData.id}`;

        return (
          <React.Fragment key={i}>
            <Link
              to={charterLink}
              onClick={(e) => e.stopPropagation()}
              dangerouslySetInnerHTML={renderSafeHTML(charterData.name)}
            />
            {separator}
          </React.Fragment>
        );
      })}
    </div>
  );
});

export default CharterName;