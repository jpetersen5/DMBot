import React, { createContext, useState, useContext, ReactNode } from "react";
import { Song } from "../utils/song";

interface SongCacheItem {
  songs: Song[];
  total: number;
  timestamp: number;
}

interface SongCacheType {
  [key: string]: SongCacheItem;
}

interface SongCacheContextType {
  cache: SongCacheType;
  getCachedResult: (key: string) => SongCacheItem | null;
  setCachedResult: (key: string, result: SongCacheItem) => void;
}

const SongCacheContext = createContext<SongCacheContextType | undefined>(undefined);

const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 min

const SongCacheProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cache, setCache] = useState<SongCacheType>({});

  const getCachedResult = (key: string): SongCacheItem | null => {
    const cachedItem = cache[key];
    if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_EXPIRY_TIME) {
      return cachedItem;
    }
    return null;
  };

  const setCachedResult = (key: string, result: SongCacheItem) => {
    setCache(prevCache => ({
      ...prevCache,
      [key]: { ...result, timestamp: Date.now() }
    }));
    const expiredCacheKeys = Object.keys(cache).filter(cacheKey => Date.now() - cache[cacheKey].timestamp > CACHE_EXPIRY_TIME);
    if (expiredCacheKeys.length > 0) {
      setCache(prevCache => {
        const newCache = { ...prevCache };
        expiredCacheKeys.forEach(key => delete newCache[key]);
        return newCache;
      });
    }
  };

  return (
    <SongCacheContext.Provider value={{ cache, getCachedResult, setCachedResult }}>
      {children}
    </SongCacheContext.Provider>
  );
};

export const useSongCache = () => {
  const context = useContext(SongCacheContext);
  if (context === undefined) {
    throw new Error("useSongCache must be used within a SongCacheProvider");
  }
  return context;
};

export default SongCacheProvider;