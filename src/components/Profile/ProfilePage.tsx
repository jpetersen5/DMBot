import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import LoadingSpinner from "../Loading/LoadingSpinner";
import ScoreUpload from "./ScoreUpload";
import UserScores from "./UserScores";
import ProfileStats from "./ProfileStats";
import { getUserImage, User } from "../../utils/user";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../App";
import "./ProfilePage.scss";

const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, loading: authLoading } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId && currentUser) {
        navigate(`/user/${currentUser.id}`);
        return;
      }

      if (userId) {
        try {
          const response = await fetch(`${API_URL}/api/user/${userId}`);
          if (response.ok) {
            const userData: User = await response.json();
            setProfileUser(userData);
          } else {
            console.error("Error fetching user:", response.statusText);
          }
        } catch (error) {
          console.error("Error fetching user:", error);
        }
      }
      setLoading(false);
    };

    if (!authLoading) {
      fetchUser();
    }
  }, [userId, currentUser, authLoading, navigate]);

  const isOwnProfile = currentUser && currentUser.id === profileUser?.id;

  return (
    <div className="profile-page">
      <h1>User Profile</h1>
      {loading && <LoadingSpinner />}
      {!profileUser && !loading && <p>User not found.</p>}
      {profileUser && !loading &&
        <>
          <div className="profile-header">
            <div className="profile-info">
              <img
                src={getUserImage(profileUser)}
                alt={profileUser.username}
                className="profile-avatar"
              />
              <div className="profile-details">
                <p><strong>Username:</strong> {profileUser.username}</p>
                <p><strong>Discord ID:</strong> {profileUser.id}</p>
              </div>
            </div>
            <ProfileStats userId={profileUser.id} />
          </div>
          <div className="profile-scores">
            <UserScores userId={profileUser.id} />
          </div>
          {isOwnProfile ? (
            <ScoreUpload />
          ) : (
            <div className="profile-actions">
              <button disabled>Add Friend</button>
            </div>
          )}
        </>
      }
    </div>
  );
};

export default ProfilePage;