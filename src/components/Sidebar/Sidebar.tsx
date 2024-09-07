import React, { useState } from "react";
import { Link } from "react-router-dom";
import UploadProgress from "./UploadProgress";
import { useAuth } from "../../context/AuthContext";
import Tooltip from "../../utils/Tooltip/Tooltip";
import "./Sidebar.scss";

import HomeIcon from "../../assets//home-icon.svg";
import ProfileIcon from "../../assets/profile-icon.svg";
import SongsIcon from "../../assets/songs-icon.svg";
import ThemesIcon from "../../assets/themes-icon.svg";

interface NavItem {
  path: string;
  name: string;
  icon: string;
}

const staticNavItems: NavItem[] = [
  { path: "/", name: "Home", icon: HomeIcon },
  { path: "/songs", name: "Songs", icon: SongsIcon },
];

const themes = ["light", "dark"];

//TODO: store user theme in database or cookies?
const defaultTheme = themes[1];
let theme = defaultTheme;

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const toggleThemeSwitcher = () => {
    theme = theme == themes[0] ? themes[1] : themes[0];
    //theme = e.target.value;

    document.documentElement.className = "";
    document.documentElement.classList.add(`theme-${theme}`);
    return true;
  }

  const profileNavItem: NavItem = {
    path: user ? `/user/${user.id}` : "/login",
    name: "Profile",
    icon: ProfileIcon,
  };

  const navItems = user ? [...staticNavItems, profileNavItem] : staticNavItems;

  const version = "v1.2.0";
  const commitDate = import.meta.env.VITE_COMMIT_DATE || "Unknown";

  document.documentElement.classList.add(`theme-${defaultTheme}`);

  return (
    <>
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
            <a onClick={toggleThemeSwitcher}>
              <li>
                <span className="icon">
                  <img src={ThemesIcon} alt="Themes" />
                  {isOpen && <span className="nav-text">Themes</span>}
                </span>
              </li>
            </a>
          </ul>
        </nav>
        {isOpen && (
          <Tooltip text={`Last updated: ${commitDate}`}>
            <div className="version">{version}</div>
          </Tooltip>
        )}
      </div>
      <UploadProgress />
    </>
  );
};

export default Sidebar;