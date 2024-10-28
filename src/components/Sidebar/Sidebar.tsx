import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import UploadProgress from "./UploadProgress";
import ThemeModal from "./Themes/ThemeModal";
import KofiWidget from "../KofiWidget";
import { useAuth } from "../../context/AuthContext";
import Tooltip from "../../utils/Tooltip/Tooltip";
import "./Sidebar.scss";

import HomeIcon from "../../assets//home-icon.svg";
import ProfileIcon from "../../assets/profile-icon.svg";
import SongsIcon from "../../assets/songs-icon.svg";
import ThemesIcon from "../../assets/themes-icon.svg";
import UsersIcon from "../../assets/users-icon.svg";

interface NavItem {
  path: string;
  name: string;
  icon: string;
}

const themes = {
  dark: "dark",
  light: "light",
};

const staticNavItems: NavItem[] = [
  { path: "/", name: "Home", icon: HomeIcon },
  { path: "/songs", name: "Songs", icon: SongsIcon },
  { path: "/users", name: "Users", icon: UsersIcon },
];

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const { user } = useAuth();

  const storedTheme = localStorage.getItem("theme") || "light";
  useEffect(() => {
    document.documentElement.className = "";
    document.documentElement.classList.add(`theme-${storedTheme}`);
  }, [storedTheme]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const openThemeModal = () => {
    setIsThemeModalOpen(true);
  };

  const closeThemeModal = () => {
    setIsThemeModalOpen(false);
  };

  const profileNavItem: NavItem = {
    path: user ? `/user/${user.id}` : "/login",
    name: "Profile",
    icon: ProfileIcon,
  };

  const navItems = user ? [...staticNavItems, profileNavItem] : staticNavItems;

  const version = "v1.8.1";
  const commitDate = import.meta.env.VITE_COMMIT_DATE || "Unknown";

  return (
    <>
      <UploadProgress />
      <KofiWidget isSidebarOpen={isOpen} />
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
            <a onClick={openThemeModal}>
              <li>
                <span className="icon">
                  <img src={ThemesIcon} alt="Themes" />
                  {isOpen && <span className="nav-text">&ensp;Themes</span>}
                </span>
              </li>
            </a>
          </ul>
        </nav>
        {isOpen && (
          <div className="version-container">
            <Tooltip text={`Last updated: ${commitDate}`}>
              <div className="version">{version}</div>
            </Tooltip>
          </div>
        )}
      </div>
      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={closeThemeModal}
        themes={themes}
      />
    </>
  );
};

export default Sidebar;