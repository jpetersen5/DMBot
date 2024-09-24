import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../../App";
import { Search } from "../SongList/TableControls";
import { User, getUserImageSrc, getFallbackImage } from "../../utils/user";
import LoadingSpinner from "../Loading/LoadingSpinner";
import "./UserList.scss";

export const UserAvatar: React.FC<{ user: User }> = ({ user }) => {
  return (
    <img 
      src={getUserImageSrc(user)} 
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = getFallbackImage(user);
      }} 
      alt={user.username}
      className="user-avatar"
    />
  );
};

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("username");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/users?search=${search}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    fetchUsers();
  };

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    if (filter === "has-stats") {
      result = result.filter(user => user.stats && Object.values(user.stats).some(value => value !== 0));
    }

    result.sort((a, b) => {
      if (sortBy === "username") {
        return a.username.localeCompare(b.username);
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
  }, [users, filter, sortBy, sortOrder]);

  useEffect(() => {
    if (sortBy.includes("stats") && filter === "all") {
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
  }, [sortBy]);

  return (
    <div className="user-list">
      <h1>User List</h1>
      <div className="user-list-controls">
        <div className="controls-left">
          <div className="sort-controls">
            <label>
              Sort by:
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="username">Username</option>
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
        </div>
        <Search
          search={search}
          setSearch={setSearch}
          submitSearch={handleSearchSubmit}
        />
      </div>
      {loading ? (
        <LoadingSpinner message="Loading users..." />
      ) : (
        <>
          <div className="user-card-grid">
            {filteredAndSortedUsers.map((user) => (
              <Link
                to={`/user/${user.id}`}
                key={user.id}
                className={`user-card ${user.stats ? "has-stats" : ""}`}
              >
                <div className="user-info">
                  <UserAvatar user={user} />
                  <h3>{user.username}</h3>
                </div>
                {user.stats && (
                  <div className="user-stats">
                    <p><b>Overall Score:</b> {user.stats.total_score.toLocaleString()}</p>
                    <p><b># of Scores:</b> {user.stats.total_scores.toLocaleString()}</p>
                    <p><b># of FCs:</b> {user.stats.total_fcs.toLocaleString()}</p>
                    <p><b>Avg. Percent:</b> {user.stats.avg_percent.toFixed(2)}%</p>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default UserList;