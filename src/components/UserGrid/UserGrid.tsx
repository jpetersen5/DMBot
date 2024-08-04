import React, { useState, useEffect } from "react";
import { Container, Row, Col, Image, OverlayTrigger, Tooltip } from "react-bootstrap";
import { API_URL } from "../../App";
import { User, getUserImage } from "../../utils/user";

const UserGrid: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/users`)
      .then(response => response.json())
      .then(data => setUsers(data))
      .catch(error => console.error("Error fetching users:", error));
  }, []);

  return (
    <Container className="user-grid">
      <h2>Others already here!</h2>
      <Row>
        {users.map(user => (
          <Col key={user.id} xs={6} sm={4} md={3} lg={2} className="mb-3">
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip id={`tooltip-${user.id}`}>{user.username}</Tooltip>}
            >
              <Image 
                src={getUserImage(user)} 
                roundedCircle 
                fluid 
                className="user-avatar"
              />
            </OverlayTrigger>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default UserGrid;