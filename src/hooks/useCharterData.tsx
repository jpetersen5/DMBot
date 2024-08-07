import { useCallback, useState } from "react";
import { API_URL } from "../App";

export const charterCache: { [key: string]: string } = {};

export const useCharterData = () => {
  const [isLoading, setIsLoading] = useState(false);

  const fetchCharterData = useCallback(async (names: string[]) => {
    const uncachedNames = names.filter(name => !charterCache[name]);
    
    if (uncachedNames.length === 0) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/charter-colors?names=${encodeURIComponent(uncachedNames.join(','))}`);
      if (!response.ok) {
        throw new Error('Failed to fetch charter data');
      }
      const data = await response.json();
      Object.entries(data).forEach(([name, colorizedName]) => {
        charterCache[name] = colorizedName as string;
      });
    } catch (err) {
      Object.entries(uncachedNames).forEach(([name]) => {
        charterCache[name] = name;
      }); // fallback to original name
      console.error('Error fetching charter data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetchCharterData, isLoading };
};