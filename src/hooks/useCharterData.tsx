import { useEffect, useState } from "react";
import { API_URL } from "../App";

interface CharterCache {
  [key: string]: string;
}

export const useCharterData = () => {
  const [charterCache, setCharterCache] = useState<CharterCache>({});
  const [isLoading, setIsLoading] = useState(false);

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

  return { charterCache, isLoading };
};