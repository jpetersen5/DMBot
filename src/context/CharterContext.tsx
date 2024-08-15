import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { API_URL } from "../App";

interface CharterCache {
  [key: string]: string;
}

interface CharterContextType {
  charterCache: CharterCache;
  isLoading: boolean;
}

const CharterContext = createContext<CharterContextType | undefined>(undefined);

const CharterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [charterCache, setCharterCache] = useState<CharterCache>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllCharterColors = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/all-charter-colors`);
        if (!response.ok) {
          throw new Error("Failed to fetch charter colors");
        }
        const data = await response.json();
        setCharterCache(data);
      } catch (error) {
        console.error("Error fetching charter colors:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllCharterColors();
  }, []);

  return (
    <CharterContext.Provider value={{ charterCache, isLoading }}>
      {children}
    </CharterContext.Provider>
  );
};

export const useCharterData = () => {
  const context = useContext(CharterContext);
  if (context === undefined) {
    throw new Error("useCharterData must be used within a CharterProvider");
  }
  return context;
};

export default CharterProvider;