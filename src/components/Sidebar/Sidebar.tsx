import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Sidebar.scss";

import HomeIcon from "../../assets//home-icon.svg";

interface NavItem {
  path: string;
  name: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: "/", name: "Home", icon: <HomeIcon /> },
];

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      <button className="toggle-btn" onClick={toggleSidebar}>
        {isOpen ? "←" : "→"}
      </button>
      <nav className="nav-menu">
        <ul>
          {navItems.map((item) => (
            <li key={item.path}>
              <Link to={item.path}>
                <span className="icon">{item.icon}</span>
                <span className="nav-text">{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;