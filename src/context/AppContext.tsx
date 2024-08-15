import React, { ReactNode } from "react";
import AuthProvider from "./AuthContext";
import CharterProvider from "./CharterContext";

interface AppProviderProps {
  children: ReactNode;
}

const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <AuthProvider>
      <CharterProvider>
        {children}
      </CharterProvider>
    </AuthProvider>
  );
};

export default AppProvider;