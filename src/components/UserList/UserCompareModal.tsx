import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../App";
import Tooltip from "../../utils/Tooltip/Tooltip";
import { User, getUserImageSrc, getFallbackImage } from "../../utils/user";
import { useAuth } from "../../context/AuthContext";
import "./UserCompareModal.scss";

import SwapIcon from "../../assets/swap.svg";
import VS from "../../assets/vs.png";

interface ComparisonResults {
  common_songs: string[];
  wins: number;
  losses: number;
  ties: number;
  fc_diff: number;
  total_score_diff: number;
  avg_percent_diff: number;
}

interface UserCompareModalProps {
  show: boolean;
  onHide: () => void;
  users: User[];
}

const UserCompareModal: React.FC<UserCompareModalProps> = ({ show, onHide, users }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [leftUser, setLeftUser] = useState<User | null>(null);
  const [rightUser, setRightUser] = useState<User | null>(null);
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [leftDropdownOpen, setLeftDropdownOpen] = useState(true);
  const [rightDropdownOpen, setRightDropdownOpen] = useState(true);

  const [comparisonResults, setComparisonResults] = useState<ComparisonResults | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const swapUsers = () => {
    const tempLeftUser = leftUser;
    const tempLeftDropdownOpen = leftDropdownOpen;
    const tempLeftSearch = leftSearch;
    setLeftUser(rightUser);
    setRightUser(tempLeftUser);
    setLeftDropdownOpen(rightDropdownOpen);
    setRightDropdownOpen(tempLeftDropdownOpen);
    setLeftSearch(rightSearch);
    setRightSearch(tempLeftSearch);
  };

  useEffect(() => {
    if (currentUser) {
      const user = users.find(user => user.id === currentUser.id);
      if (user) {
        setLeftDropdownOpen(false);
        setLeftUser(user);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (leftUser && rightUser) {
      fetchComparisonResults();
    }
  }, [leftUser, rightUser]);

  const fetchComparisonResults = async () => {
    if (!leftUser || !rightUser) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/users/compare`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify({
          user1_id: leftUser.id,
          user2_id: rightUser.id
        })
      });

      if (response.status === 404 || response.status === 400) {
        setComparisonResults(null);
        const errorMessage = await response.json();
        setComparisonError(errorMessage.error);
        return;
      }

      if (!response.ok) {
        setComparisonResults(null);
        const errorMessage = await response.json();
        setComparisonError(errorMessage.error);
        throw new Error(errorMessage.error);
      }

      const data = await response.json();
      setComparisonError(null);
      setComparisonResults(data);
    } catch (error) {
      console.error("Error fetching comparison results:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCommonSongsClick = () => {
    if (comparisonResults) {
      navigate("/songs", { state: {
        leftUser: leftUser,
        rightUser: rightUser
      } });
      onHide();
    }
  };

  const renderComparisonResults = () => {
    if (!comparisonResults && !comparisonError && !isLoading) {
      return null;
    }

    return (
      <div className="comparison-results">
        <h4>Comparison Results</h4>
        {comparisonError && <p className="error">{comparisonError}</p>}
        {comparisonResults && (
        <>
          <Tooltip content="Click to compare scores!">
            <div className="result-item" onClick={handleCommonSongsClick} style={{ cursor: "pointer" }}>
              <span className="label">Common Songs:</span>
              <span className="value">{comparisonResults.common_songs.length}</span>
            </div>
          </Tooltip>
          <div className="result-item">
            <span className="label">W/L Record:</span>
            <span className={`value ${comparisonResults.wins > comparisonResults.losses ? "winner" : comparisonResults.wins < comparisonResults.losses ? "loser" : "tie"}`}>
              {comparisonResults.wins}/{comparisonResults.losses} (Ties: {comparisonResults.ties})
            </span>
          </div>
          <div className="result-item">
            <span className="label">FC Difference:</span>
            <span className={`value ${comparisonResults.fc_diff > 0 ? "winner" : comparisonResults.fc_diff < 0 ? "loser" : "tie"}`}>
              {comparisonResults.fc_diff}
            </span>
          </div>
          <div className="result-item">
            <span className="label">Total Score Difference:</span>
            <span className={`value ${comparisonResults.total_score_diff > 0 ? "winner" : comparisonResults.total_score_diff < 0 ? "loser" : "tie"}`}>
              {comparisonResults.total_score_diff.toLocaleString()}
            </span>
          </div>
          <div className="result-item">
            <span className="label">Average Percent Difference:</span>
            <span className={`value ${comparisonResults.avg_percent_diff > 0 ? "winner" : comparisonResults.avg_percent_diff < 0 ? "loser" : "tie"}`}>
              {comparisonResults.avg_percent_diff.toFixed(2)}%
            </span>
          </div>
        </>
        )}
      </div>
    );
  };

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
          <div className="vs-container">
            <button className="swap-button" onClick={swapUsers}>
              <img src={SwapIcon} alt="Swap users" className="swap-icon" />
            </button>
            <div className="vs">
              <img src={VS} alt="VS" className="vs-icon" />
            </div>
          </div>
          {renderUserSide("right")}
        </div>
        {isLoading ? (
          <div className="loading">Loading comparison results...</div>
        ) : (
          renderComparisonResults()
        )}
      </Modal.Body>
    </Modal>
  );
};

export default UserCompareModal;