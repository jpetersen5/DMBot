import React, { useEffect, memo } from "react";
import { charterCache, useCharterData } from "../../hooks/useCharterData";
import { renderSafeHTML } from "../../utils/safeHTML";
import "./CharterName.scss";

interface CharterNameProps {
  names: string;
}

// TODO: redirect to charter page on click
const CharterName: React.FC<CharterNameProps> = memo(({ names }) => {
  const charters = names.split(',').map(name => name.trim());
  const { fetchCharterData, isLoading } = useCharterData();

  useEffect(() => {
    const uncachedCharters = charters.filter(name => !charterCache[name]);
    if (uncachedCharters.length > 0) {
      fetchCharterData(uncachedCharters);
    }
  }, [charters, fetchCharterData]);

  const onClick = (name: string) => {
    console.log("Charter name clicked:", name);
  };

  return (
    <div className="charter-name">
      {charters.map((name, i) => (
        <p>
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onClick(name);
            }}
            dangerouslySetInnerHTML={renderSafeHTML(isLoading ? name : (charterCache[name] || name))}
          />
          {i < charters.length - 1 && ", "}
        </p>
      ))}
    </div>
  );
});

export default CharterName;