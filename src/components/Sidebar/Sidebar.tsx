import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import UploadProgress from "./UploadProgress";
import ThemeModal from "./Themes/ThemeModal";
import ReleaseNotesModal from "./ReleaseNotes/ReleaseNotesModal";
import KofiWidget from "../KofiWidget";
import { useAuth } from "../../context/AuthContext";
import Tooltip from "../../utils/Tooltip/Tooltip";
import "./Sidebar.scss";

import HomeIcon from "../../assets//home-icon.svg";
import ProfileIcon from "../../assets/profile-icon.svg";
import SongsIcon from "../../assets/songs-icon.svg";
import ThemesIcon from "../../assets/themes-icon.svg";
import UsersIcon from "../../assets/users-icon.svg";
import ReleaseNotesIcon from "../../assets/release-notes-icon.svg";

interface NavItem {
  path: string;
  name: string;
  icon: string;
}

const themes = {
  dark: "dark",
  light: "light",
};

export const CURRENT_VERSION = "v1.10.0";

const staticNavItems: NavItem[] = [
  { path: "/", name: "Home", icon: HomeIcon },
  { path: "/songs", name: "Songs", icon: SongsIcon },
  { path: "/users", name: "Users", icon: UsersIcon },
];

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isReleaseNotesModalOpen, setIsReleaseNotesModalOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const storedTheme = localStorage.getItem("theme") || "light";
  useEffect(() => {
    document.documentElement.className = "";
    document.documentElement.classList.add(`theme-${storedTheme}`);
  }, [storedTheme]);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem("lastSeenVersion");
    if (!lastSeenVersion || lastSeenVersion !== CURRENT_VERSION) {
      setIsReleaseNotesModalOpen(true);
      localStorage.setItem("lastSeenVersion", CURRENT_VERSION);
    }
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const openThemeModal = () => {
    setIsThemeModalOpen(true);
  };

  const closeThemeModal = () => {
    setIsThemeModalOpen(false);
  };

  const openReleaseNotesModal = () => {
    setIsReleaseNotesModalOpen(true);
  };

  const closeReleaseNotesModal = () => {
    setIsReleaseNotesModalOpen(false);
  };

  const isIconActive = (name: string, path: string): boolean => {
    if (name === "Home") {
      return location.pathname === "/";
    }
    else if (name === "Users") {
      return location.pathname.startsWith("/users") || 
             location.pathname.startsWith("/charter") ||
             location.pathname.startsWith("/user") && !location.pathname.startsWith("/user/" + user?.id); // Exclude user profile page
    }
    else {
      return location.pathname.startsWith(path);
    }
  }

  const profileNavItem: NavItem = {
    path: user ? `/user/${user.id}` : "/login",
    name: "Profile",
    icon: ProfileIcon,
  };

  const navItems = user ? [...staticNavItems, profileNavItem] : staticNavItems;

  const version = CURRENT_VERSION;
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
              <div className={isIconActive(item.name, item.path) ? "active" : ""}>
                <Link to={item.path} key={item.path}>
                  <li>
                      <span className="icon">
                        <img src={item.icon} alt={item.name} />
                      </span>
                      {isOpen && <span className="nav-text">{item.name}</span>}
                  </li>
                </Link>
              </div>
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
              <div className="version-wrapper">
                <div className="version">{version}</div>
                <button onClick={openReleaseNotesModal} className="release-notes-button">
                  <img src={ReleaseNotesIcon} alt="Release Notes" />
                </button>
              </div>
            </Tooltip>
          </div>
        )}
      </div>
      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={closeThemeModal}
        themes={themes}
      />
      <ReleaseNotesModal
        isOpen={isReleaseNotesModalOpen}
        onClose={closeReleaseNotesModal}
      />
    </>
  );
};

export default Sidebar;