import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import LoadingSpinner from "../Loading/LoadingSpinner";
import ScoreUpload from "./ScoreUpload";
import UserScores from "./UserScores";
import ProfileStats from "./ProfileStats";
import CharterStats from "./CharterStats";
import { Charter } from "../../utils/charter";
import { renderSafeHTML } from "../../utils/safeHTML";
import { getUserImage, User } from "../../utils/user";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../App";
import "./ProfilePage.scss";

const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, loading: authLoading } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [charter, setCharter] = useState<Charter | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId && currentUser) {
        navigate(`/user/${currentUser.id}`);
        return;
      }

      if (userId) {
        try {
          const [userResponse, charterResponse] = await Promise.all([
            fetch(`${API_URL}/api/user/${userId}`),
            fetch(`${API_URL}/api/user/${userId}/charter`)
          ]);

          if (userResponse.ok) {
            const userData: User = await userResponse.json();
            setProfileUser(userData);
          } else {
            console.error("Error fetching user:", userResponse.statusText);
          }

          if (charterResponse.ok) {
            const charterData: Charter = await charterResponse.json();
            setCharter(charterData);
          } else {
            console.error("Error checking if user is charter:", charterResponse.statusText);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
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
                {charter && (
                  <p>
                    <strong>Charter Name:</strong>
                    <span
                      dangerouslySetInnerHTML={renderSafeHTML(charter.colorized_name || charter.name)}
                    />
                  </p>
                )}
              </div>
            </div>
            <ProfileStats userId={profileUser.id} />
          </div>
          {charter && <CharterStats stats={charter.charter_stats} />}
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