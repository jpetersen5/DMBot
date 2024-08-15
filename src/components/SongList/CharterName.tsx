import React, { memo } from "react";
import { renderSafeHTML } from "../../utils/safeHTML";
import "./CharterName.scss";

interface CharterNameProps {
  names: string;
  charterCache: { [key: string]: string };
}

// TODO: redirect to charter page on click
const CharterName: React.FC<CharterNameProps> = memo(({ names, charterCache }) => {
  const charters = names.split(",").map(name => name.trim());

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
            dangerouslySetInnerHTML={renderSafeHTML(charterCache[name] || name)}
          />
          {i < charters.length - 1 && ", "}
        </React.Fragment>
      ))}
    </div>
  );
});

export default CharterName;