import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Tooltip, OverlayTrigger } from "react-bootstrap";
import { API_URL } from "../../App";
import "./UserGrid.scss";
import { getUserImage } from "../../utils/user";

interface User {
  id: string;
  username: string;
  avatar: string;
}

const UserGrid: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/users`)
      .then(response => response.json())
      .then(data => setUsers(data))
      .catch(error => console.error("Error fetching users:", error));
  }, []);

  return (
    <div className="user-grid">
      <h2>Authenticated Users</h2>
      <div className="user-list">
        {users.map(user => (
          <OverlayTrigger
            key={user.id}
            placement="top"
            overlay={<Tooltip id={`tooltip-${user.id}`}>{user.username}</Tooltip>}
          >
            <Link to={`/user/${user.id}`} className="user-grid-avatar">
              <img 
                src={getUserImage(user)} 
                alt={user.username}
                width="32"
                height="32"
              />
            </Link>
          </OverlayTrigger>
        ))}
      </div>
    </div>
  );
};

export default UserGrid;