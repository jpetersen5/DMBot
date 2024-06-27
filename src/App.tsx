import React from "react";
import Home from "./components/homepage"
import "./App.css"

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const App: React.FC = () => {
  return (
    <div className="App">
      <Home />
    </div>
  );
};

export default App
