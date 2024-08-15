import { useEffect, useState } from "react";
import { API_URL } from "../App";

interface Charter {
  name: string;
  colorized_name: string;
}

export const useCharterData = () => {
  const [charterCache, setCharterCache] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAllCharterData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/all-charter-colors`);
        if (!response.ok) {
          throw new Error("Failed to fetch charter data");
        }
        const data: Charter[] = await response.json();
        const newCache = data.reduce((acc, charter) => {
          acc[charter.name] = charter.colorized_name;
          return acc;
        }, {} as { [key: string]: string });
        setCharterCache(newCache);
      } catch (err) {
        console.error("Error fetching charter data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllCharterData();
  }, []);

  return { charterCache, isLoading };
};