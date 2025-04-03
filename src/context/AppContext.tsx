import React, { ReactNode } from "react";
import AuthProvider from "./AuthContext";
import CharterProvider from "./CharterContext";
import SongCacheProvider from "./SongContext";
import { AchievementProvider } from "./AchievementContext";

interface AppProviderProps {
  children: ReactNode;
}

const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <AuthProvider>
      <SongCacheProvider>
        <CharterProvider>
          <AchievementProvider>
            {children}
          </AchievementProvider>
        </CharterProvider>
      </SongCacheProvider>
    </AuthProvider>
  );
};

export default AppProvider;