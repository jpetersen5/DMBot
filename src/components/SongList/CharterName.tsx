import React, { useState, useEffect } from "react";
import { API_URL } from "../../App";
import { renderSafeHTML } from "../../utils/safeHTML";
import "./CharterName.scss";

interface CharterNameProps {
  names: string;
}

interface CharterData {
  [key: string]: string;
}

// TODO: redirect to charter page on click
const CharterName: React.FC<CharterNameProps> = ({ names }) => {
  const [charterData, setCharterData] = useState<CharterData>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCharterData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/charter-colors?names=${encodeURIComponent(names)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch charter data');
        }
        const data = await response.json();
        setCharterData(data);
      } catch (err) {
        console.error('Error fetching charter data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCharterData();
  }, [names]);

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
            dangerouslySetInnerHTML={renderSafeHTML(isLoading ? name : (charterData[name.trim()] || name))}
          />
          {i < charters.length - 1 && ", "}
        </p>
      ))}
    </div>
  );
};

export default CharterName;