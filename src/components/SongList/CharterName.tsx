import React from "react";
import { renderSafeHTML } from "../../utils/safeHTML";

interface CharterNameProps {
  names: string;
}

// TODO: redirect to charter page on click
const CharterName: React.FC<CharterNameProps> = ({ names }) => {
  const charters = names.split(',');

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
            dangerouslySetInnerHTML={renderSafeHTML(name)}
          />
          {i < charters.length - 1 && ", "}
        </p>
      ))}
    </div>
  );
};

export default CharterName;