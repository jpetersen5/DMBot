import React from "react";
import Auth from "../Auth/Auth";
import LoadingSpinner from "../Loading/LoadingSpinner";
import { getUserImage } from "../../utils/user";
import { useAuth } from "../../hooks/useAuth";
import "./ProfilePage.scss";

const ProfilePage: React.FC = () => {
  const { user, loading } = useAuth();

  if (!user) {
    return (
      <div className="profile-page">
        <h1>User Profile</h1>
        <p>Please log in to view your profile.</p>
        <Auth onlyButtons />
      </div>
    );
  }

  return (
    <div className="profile-page">
      {loading && <LoadingSpinner message="Loading user profile..." />}
      {!loading && (<>
        <h1>User Profile</h1>
        <div className="profile-info">
          <img src={getUserImage(user)} alt={user.username} className="profile-avatar" />
          <div className="profile-details">
            <p><strong>Username:</strong> {user.username}</p>
            <p><strong>Discord ID:</strong> {user.id}</p>
          </div>
        </div>
        <div className="profile-scores">
          <h2>Recent Scores</h2>
          <p>Score data will be displayed here in the future.</p>
        </div>
      </>)}
    </div>
  );
};

export default ProfilePage;