import React, { memo } from "react";
import { useCharterData } from "../../hooks/useCharterData";
import { renderSafeHTML } from "../../utils/safeHTML";
import "./CharterName.scss";

interface CharterNameProps {
  names: string;
}

// TODO: redirect to charter page on click
const CharterName: React.FC<CharterNameProps> = memo(({ names }) => {
  const charters = names.split(",").map(name => name.trim());
  console.log("charter cache", charters);
  const { charterCache, isLoading } = useCharterData();

  const onClick = (name: string) => {
    console.log("Charter name clicked:", name);
  };

  return (
    <div className="charter-name">
      {charters.map((name, i) => (
        <React.Fragment key={i}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(name);
            }}
            dangerouslySetInnerHTML={renderSafeHTML(isLoading ? name : (charterCache[name] || name))}
          />
          {i < charters.length - 1 && ", "}
        </React.Fragment>
      ))}
    </div>
  );
});

export default CharterName;