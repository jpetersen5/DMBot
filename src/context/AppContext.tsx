import React, { ReactNode } from "react";
import AuthProvider from "./AuthContext";
import CharterProvider from "./CharterContext";
import SongCacheProvider from "./SongContext";

interface AppProviderProps {
  children: ReactNode;
}

const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <AuthProvider>
      <SongCacheProvider>
        <CharterProvider>
          {children}
        </CharterProvider>
      </SongCacheProvider>
    </AuthProvider>
  );
};

export default AppProvider;