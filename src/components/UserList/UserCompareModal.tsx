import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { User, getUserImageSrc, getFallbackImage } from "../../utils/user";
import { useAuth } from "../../context/AuthContext";
import "./UserCompareModal.scss";

interface UserCompareModalProps {
  show: boolean;
  onHide: () => void;
  users: User[];
}

const UserCompareModal: React.FC<UserCompareModalProps> = ({ show, onHide, users }) => {
  const { user: currentUser } = useAuth();
  const [leftUser, setLeftUser] = useState<User | null>(null);
  const [rightUser, setRightUser] = useState<User | null>(null);
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [leftDropdownOpen, setLeftDropdownOpen] = useState(false);
  const [rightDropdownOpen, setRightDropdownOpen] = useState(true);

  const filteredLeftUsers = users.filter(user => 
    user.username.toLowerCase().includes(leftSearch.toLowerCase())
  );

  const filteredRightUsers = users.filter(user => 
    user.username.toLowerCase().includes(rightSearch.toLowerCase())
  );

  const openDropdown = (side: "left" | "right") => {
    if (side === "left") {
      setLeftSearch("");
      setLeftDropdownOpen(!leftDropdownOpen);
    } else {
      setRightSearch("");
      setRightDropdownOpen(!rightDropdownOpen);
    }
  };

  useEffect(() => {
    if (currentUser) {
      const user = users.find(user => user.id === currentUser.id);
      if (user) {
        setLeftUser(user);
      }
    }
  }, [currentUser]);

  const renderUserStats = (user: User, side: "left" | "right") => {
    if (!user.stats) return null;

    const stats = [
      { label: "Overall Score", value: user.stats.total_score.toLocaleString() },
      { label: "# of Scores", value: user.stats.total_scores.toLocaleString() },
      { label: "# of FCs", value: user.stats.total_fcs.toLocaleString() },
      { label: "Avg. Percent", value: user.stats.avg_percent.toFixed(2) + "%" },
    ];

    return (
      <div className={`user-stats ${side}`}>
        {stats.map((stat, index) => (
          <div key={index} className="stat-row">
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderUserSide = (side: "left" | "right") => {
    const user = side === "left" ? leftUser : rightUser;
    const setUser = side === "left" ? setLeftUser : setRightUser;
    const filteredUsers = side === "left" ? filteredLeftUsers : filteredRightUsers;
    const search = side === "left" ? leftSearch : rightSearch;
    const setSearch = side === "left" ? setLeftSearch : setRightSearch;
    const dropdownOpen = side === "left" ? leftDropdownOpen : rightDropdownOpen;

    return (
      <div className={`user-compare-side ${side}`}>
        {user ? (
          <div className="selected-user">
            <img 
              src={getUserImageSrc(user)} 
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = getFallbackImage(user);
              }}
              alt={user.username}
              className="user-avatar"
            />
            <h3 onClick={() => openDropdown(side)} className="user-name">
              {user.username}
            </h3>
            {!dropdownOpen && renderUserStats(user, side)}
          </div>
        ) : (
          <div className="selected-user">
            <h3 onClick={() => openDropdown(side)} className="user-name">
              Select a user
            </h3>
          </div>
        )}
        {dropdownOpen && (
          <div className="user-select">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="user-dropdown">
              {filteredUsers.map(user => (
                <div key={user.id} className="user-option" onClick={() => {
                  setUser(user);
                  openDropdown(side);
                }}>
                  <img 
                    src={getUserImageSrc(user)} 
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getFallbackImage(user);
                    }}
                    alt={user.username}
                    className="user-avatar-small"
                  />
                  <span>{user.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="user-compare-modal">
      <Modal.Header closeButton>
        <Modal.Title>Compare Users</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="user-compare-container">
          {renderUserSide("left")}
          <div className="vs">VS</div>
          {renderUserSide("right")}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default UserCompareModal;