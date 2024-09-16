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

const themes = {
  light: "light",
  dark: "dark",
}
let theme = themes.dark;

const toCapitalCase = (str: string) => {
  return (
    str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  );
};

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const storedTheme = localStorage.getItem("theme");

  if(storedTheme != null) {
    theme = storedTheme;
  }
  
  document.documentElement.classList.add(`theme-${theme}`);

  const dialog: HTMLDialogElement = document.getElementById("themeDialog") as HTMLDialogElement;
  let themeDialogOpen = dialog?.open;

  const toggleThemeDialog = () => {
    themeDialogOpen = !themeDialogOpen;

    if(themeDialogOpen) {
      dialog?.show();
    } else {
      dialog?.close();
    }
    
    return true;
  }

  const selectTheme = (theme: string) => {
    localStorage.setItem("theme", theme);

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

  const version = "v1.4.20.69";
  const commitDate = import.meta.env.VITE_COMMIT_DATE || "Unknown";

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
            <a onClick={toggleThemeDialog}>
              <li>
                <span className="icon">
                  <img src={ThemesIcon} alt="Themes" />
                  {isOpen && <span className="nav-text">&ensp;Themes</span>}
                </span>
              </li>
            </a>
          </ul>
          <dialog id="themeDialog">
            <ul>
              {Object.keys(themes).map((theme, index) => {
                return (
                  <li key={index} className="themeOption" onClick={() => selectTheme(theme)}>
                    {toCapitalCase(theme)}
                  </li>
                );
              })}
            </ul>
          </dialog>
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