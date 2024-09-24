import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../../App";
import { UserAvatar } from "../UserList/UserList";
import "./UserGrid.scss";
import Tooltip from "../../utils/Tooltip/Tooltip";
import { User } from "../../utils/user";

const UserGrid: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/all-users`)
      .then(response => response.json())
      .then(data => setUsers(data))
      .catch(error => console.error("Error fetching users:", error));
  }, []);

  return (
    <div className="user-grid">
      <h2>{`Authenticated Users (${users.length})`}</h2>
      <div className="user-grid-list">
        {users.map(user => (
          <Tooltip key={user.id} text={user.username}>
            <Link to={`/user/${user.id}`} className="user-grid-avatar">
              <UserAvatar user={user} />
            </Link>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

export default UserGrid;