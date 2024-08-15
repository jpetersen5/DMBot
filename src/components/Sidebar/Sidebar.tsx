import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Sidebar.scss";

import HomeIcon from "../../assets//home-icon.svg";
import ProfileIcon from "../../assets/profile-icon.svg";
import SongsIcon from "../../assets/songs-icon.svg";

interface NavItem {
  path: string;
  name: string;
  icon: string;
}

const staticNavItems: NavItem[] = [
  { path: "/", name: "Home", icon: HomeIcon },
  { path: "/songs", name: "Songs", icon: SongsIcon },
];

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const profileNavItem: NavItem = {
    path: user ? `/user/${user.id}` : "/login",
    name: "Profile",
    icon: ProfileIcon,
  };

  const navItems = user ? [...staticNavItems, profileNavItem] : staticNavItems;

  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      <button className="toggle-btn" onClick={toggleSidebar}>
        {isOpen ? "←" : "→"}
      </button>
      <nav className="nav-menu">
        <ul>
          {navItems.map((item) => (
            <Link to={item.path} key={item.path}>
              <li>
                  <span className="icon">
                    <img src={item.icon} alt={item.name} />
                  </span>
                  {isOpen && <span className="nav-text">{item.name}</span>}
              </li>
            </Link>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;