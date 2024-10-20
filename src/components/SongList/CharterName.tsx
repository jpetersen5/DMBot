import React, { memo } from "react";
import { Link } from "react-router-dom";
import { useCharterData } from "../../context/CharterContext";
import { renderSafeHTML } from "../../utils/safeHTML";
import "./CharterName.scss";

interface CharterNameProps {
  names: string;
  displayBadges?: boolean;
}

// TODO: redirect to charter page on click
const CharterName: React.FC<CharterNameProps> = memo(({ names, displayBadges = false }) => {
  const { charterCache } = useCharterData();
  const charters = names.split(",").map(name => name.trim());

  return (
    <div className={`charter-name ${displayBadges ? "display-badges" : ""}`}>
      {charters.map((name, i) => {
        const charterData = charterCache[name];
        if (!charterData) return <span key={i} dangerouslySetInnerHTML={renderSafeHTML(name)} />;
        const charterLink = charterData.userId ? `/user/${charterData.userId}` : `/charter/${charterData.id}`;

        return (
          <React.Fragment key={i}>
            <Link
              to={charterLink}
              onClick={(e) => e.stopPropagation()}
              dangerouslySetInnerHTML={renderSafeHTML(charterData.name)}
            />
            {i < charters.length - 1 && ", "}
          </React.Fragment>
        );
      })}
    </div>
  );
});

export default CharterName;