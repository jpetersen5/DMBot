import React from "react";
import { renderSafeHTML } from "../../utils/safeHTML";

interface CharterNameProps {
  name: string;
}

// TODO: redirect to charter page on click
const CharterName: React.FC<CharterNameProps> = ({ name }) => {
  const onClick = () => {
    console.log("Charter name clicked:", name);
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="charter-name"
      dangerouslySetInnerHTML={renderSafeHTML(name)}
    />
  );
};

export default CharterName;