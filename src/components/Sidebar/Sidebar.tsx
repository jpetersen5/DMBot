import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./Sidebar.scss";

import HomeIcon from "../../assets//home-icon.svg";
import ProfileIcon from "../../assets/profile-icon.svg";
import SongsIcon from "../../assets/songs-icon.svg";

interface NavItem {
  path: string;
  name: string;
  icon: string;
}

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const [navItems, setNavItems] = useState<NavItem[]>([
    { path: "/", name: "Home", icon: HomeIcon },
    { path: user ? `/user/${user.id}` : "/login", name: "Profile", icon: ProfileIcon },
    { path: "/songs", name: "Songs", icon: SongsIcon },
  ]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    setNavItems([
      { path: "/", name: "Home", icon: HomeIcon },
      { path: user ? `/user/${user.id}` : "/login", name: "Profile", icon: ProfileIcon },
      { path: "/songs", name: "Songs", icon: SongsIcon },
    ]);
  }, [user]);

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