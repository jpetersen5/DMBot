import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../../App";
import { Search } from "../SongList/TableControls";
import LoadingSpinner from "../Loading/LoadingSpinner";
import UserCompareModal from "./UserCompareModal";
import { User, getUserImageSrc, getFallbackImage } from "../../utils/user";
import { useAuth } from "../../context/AuthContext";
import "./UserList.scss";

import Ribbon from "../../assets/Ribbon.png";
import Ribbon1 from "../../assets/Ribbon1.png";
import Ribbon2 from "../../assets/Ribbon2.png";
import Ribbon3 from "../../assets/Ribbon3.png";
import BronzeRank from "../../assets/BronzeRank.png";
import SilverRank from "../../assets/SilverRank.png";
import GoldRank from "../../assets/GoldRank.png";
import GoldRank1 from "../../assets/GoldRank1.png";
import GoldRank2 from "../../assets/GoldRank2.png";
import GoldRank3 from "../../assets/GoldRank3.png";

export const UserAvatar: React.FC<{ user: User }> = ({ user }) => {
  const getBorder = (rank: number | undefined) => {
    //TODO: Get custom border

    if (!rank) return null;
    if (rank == 1) return GoldRank1;
    if (rank <= 2) return GoldRank2;
    if (rank <= 3) return GoldRank3;
    if (rank <= 10) return GoldRank;
    if (rank <= 25) return SilverRank;
    if (rank <= 50) return BronzeRank;
    return null;
  };

  const getRibbon = (rank: number | undefined) => {
    //TODO: Custom ribbons maybe?

    if (!rank) return null;
    if (rank == 1) return Ribbon1;
    if (rank <= 2) return Ribbon2;
    if (rank <= 3) return Ribbon3;
    if (rank <= 100) return Ribbon;
    return null;
  };

  const border = getBorder(user.stats?.rank);
  const ribbon = getRibbon(user.stats?.rank);

  return (
    <div className="user-avatar-container">
      <img 
        src={getUserImageSrc(user)} 
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = getFallbackImage(user);
        }} 
        alt={user.username}
        className="user-avatar"
      />
        <div className="rank-overlay-container">
          {border && (
            <img 
            src={border} 
            alt={`Rank ${user.stats?.rank}`} 
            className="border-overlay"
          />
          )}
          {ribbon && (
            <img 
            src={ribbon} 
            alt={`Rank ${user.stats?.rank}`} 
            className="ribbon-overlay"
          />
          )}
          <span className="rank-overlay-text">{user.stats?.rank}</span>
        </div>
    </div>
  );
};

const UserList: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("username");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showCompareModal, setShowCompareModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/all-users`);
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    result = result.filter(user => user.username.toLowerCase().includes(search.toLowerCase()));

    if (filter === "has-stats") {
      result = result.filter(user => user.stats && Object.values(user.stats).some(value => value !== 0));
    }

    result.sort((a, b) => {
      if (sortBy === "username") {
        return a.username.localeCompare(b.username);
      } else if (sortBy === "elo") {
        return (a.elo as number) - (b.elo as number);
      } else if (a.stats && b.stats) {
        const sortByStat = sortBy.replace("stats_", "");
        return (a.stats[sortByStat as keyof typeof a.stats] as number) - (b.stats[sortByStat as keyof typeof b.stats] as number);
      }
      return 0;
    });

    if (sortOrder === "desc") {
      result.reverse();
    }

    return result;
  }, [users, filter, sortBy, sortOrder, search]);

  useEffect(() => {
    if ((sortBy.includes("stats") || sortBy === "elo") && filter === "all") {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      }
      setFilter("has-stats");
    } else if (filter === "has-stats" && sortBy === "username") {
      if (sortOrder === "desc") {
        setSortOrder("asc");
      }
      setFilter("all");
    }
  }, [sortBy, sortOrder, filter, search]);

  return (
    <div className="user-list">
      <h1>User List</h1>
      <div className="user-list-controls">
        <div className="sort-controls">
          <label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="username">Username</option>
              <option value="elo">Rank</option>
              <option value="stats_total_score">Total Score</option>
              <option value="stats_total_scores">Number of Scores</option>
              <option value="stats_total_fcs">Total FCs</option>
              <option value="stats_avg_percent">Average Percent</option>
            </select>
          </label>
          <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
            {sortOrder === "asc" ? "▲" : "▼"}
          </button>
        </div>
        <div className="compare-users">
          <button onClick={() => setShowCompareModal(true)}>Compare Users</button>
        </div>
        <Search
          search={search}
          setSearch={setSearch}
          submitSearch={() => {}}
        />
      </div>
      {loading ? (
        <LoadingSpinner message="Loading users..." />
      ) : (
        <div className="user-card-grid-container">
          <div className="user-card-grid">
            {filteredAndSortedUsers.map((user) => (
              <Link
                to={`/user/${user.id}`}
                key={user.id}
                className={`user-card ${user.stats ? "has-stats" : ""} ${user.id === currentUserId ? "current-user" : ""}`}
              >
                <div className="user-info">
                  <UserAvatar user={user} />
                  <h3>{user.username}</h3>
                </div>
                {user.stats && (
                  <div className="user-stats">
                    {user.stats.rank && 
                      <p><b>Rank:</b> {`#${user.stats.rank} (${user.elo})`}</p>
                    }
                    {user.stats && user.stats.total_score ?
                      <>
                        <p><b>Overall Score:</b> {user.stats.total_score?.toLocaleString()}</p>
                        <p><b># of Scores:</b> {user.stats.total_scores?.toLocaleString()}</p>
                        <p><b># of FCs:</b> {user.stats.total_fcs?.toLocaleString()}</p>
                        <p><b>Avg. Percent:</b> {user.stats.avg_percent?.toFixed(2)}%</p>
                      </>
                    :
                      <p>No stats available</p>
                    }
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
      <UserCompareModal
        show={showCompareModal}
        onHide={() => setShowCompareModal(false)}
        users={users}
      />
    </div>
  );
};

export default UserList;