import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import LoadingSpinner from "../Loading/LoadingSpinner";
import ScoreUpload from "./Scores/ScoreUpload";
import UserScores from "./Scores/UserScores";
import ProfileStats from "./ProfileStats";
import CharterStats from "./Charter/CharterStats";
import CharterSongs from "./Charter/CharterSongs";
import UserAchievements from "./Achievements/UserAchievements";
import { UserAvatar } from "../UserList/UserList";
import { Charter } from "../../utils/charter";
import { renderSafeHTML } from "../../utils/safeHTML";
import { User } from "../../utils/user";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../App";
import "./ProfilePage.scss";

type TabType = "scores" | "charter-stats" | "charter-songs" | "achievements";

const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, loading: authLoading } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [charters, setCharters] = useState<Charter[]>([]);
  const [selectedCharterId, setSelectedCharterId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("scores");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.includes("/scores")) {
      setActiveTab("scores");
    }
    else if (location.pathname.includes("/achievements")) {
      setActiveTab("achievements");
    }
    else if (location.pathname.includes("/charter-stats")) {
      setActiveTab("charter-stats");
    }
    else if (location.pathname.includes("/charter-songs")) {
      setActiveTab("charter-songs");
    }
    else if (location.pathname.includes("/user/") && location.pathname.split("/").length > 3 && !location.pathname.includes("/charter-songs/")) {
      setActiveTab("scores");
    }
  }, [location.pathname]);

  const handleTabChange = (tab: TabType) => {
    if (location.pathname.includes("/charter-songs/")) {
      navigate(`/user/${userId}`);
    }
    setActiveTab(tab);
    navigate(`/user/${userId}/${tab}`);
  };

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
            setProfileUser(null);
            console.error("Error fetching user:", userResponse.statusText);
          }

          if (charterResponse.ok) {
            const charterData: Charter[] = await charterResponse.json();
            setCharters(charterData);
            if (charterData.length > 0) {
              setSelectedCharterId(charterData[0].id);
            }
          } else {
            setCharters([]);
            setSelectedCharterId(null);
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

  const handleCompareClick = () => {
    navigate("/songs", { state: {
      leftUser: currentUser,
      rightUser: profileUser
    } });
  };

  const isOwnProfile = currentUser && currentUser.id === profileUser?.id;
  const selectedCharter = charters.find(charter => charter.id.toString() === selectedCharterId?.toString());

  return (
    <div className="profile-page">
      <h1>User Profile: {profileUser?.username}</h1>
      <div className="profile-content-wrapper">
        {loading && <LoadingSpinner />}
        {!profileUser && !loading && <p>User not found.</p>}
        {profileUser && !loading &&
          <>
            <div className="profile-header">
              <div className="profile-info">
                <UserAvatar user={profileUser} />
                <div className="profile-details">
                  <p><strong>Username:</strong> {profileUser.username}</p>
                  <p><strong>Discord ID:</strong> {profileUser.id}</p>
                  {charters.length > 0 && (
                    <p className="charter-info">
                      <strong>Charter Name{charters.length > 1 ? "s" : ""}:</strong>
                      {charters.length > 1 ? (
                        <select
                          value={selectedCharterId || ""}
                          onChange={(e) => setSelectedCharterId(e.target.value)}
                          className="charter-select"
                        >
                          {charters.map((charter) => (
                            <option className="charter-option" key={charter.id} value={charter.id}>
                              {charter.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span dangerouslySetInnerHTML={renderSafeHTML(charters[0].colorized_name || charters[0].name)} />
                      )}
                    </p>
                  )}
                  {!isOwnProfile && (
                    <button className="compare-button" onClick={() => handleCompareClick()}>
                      Compare Scores
                    </button>
                  )}
                </div>
              </div>
              <ProfileStats
                userStats={profileUser.stats}
                elo={profileUser.elo}
                eloHistory={profileUser.elo_history}
              />
            </div>
            
            <div className="profile-content">
              {/* Tab navigation */}
              <div className="profile-tabs">
                <button 
                  className={`tab-button ${activeTab === "scores" ? "active" : ""}`}
                  onClick={() => handleTabChange("scores")}
                >
                  User Scores
                </button>
                
                <button 
                  className={`tab-button ${activeTab === "achievements" ? "active" : ""}`}
                  onClick={() => handleTabChange("achievements")}
                >
                  Achievements
                </button>
                
                {selectedCharter && (
                  <>
                    <button 
                      className={`tab-button ${activeTab === "charter-stats" ? "active" : ""}`}
                      onClick={() => handleTabChange("charter-stats")}
                    >
                      Charter Stats
                    </button>
                    
                    <button 
                      className={`tab-button ${activeTab === "charter-songs" ? "active" : ""}`}
                      onClick={() => handleTabChange("charter-songs")}
                    >
                      Charter Songs
                    </button>
                  </>
                )}
              </div>
              
              {/* Tab content */}
              <div className="tab-content">
                {activeTab === "scores" && (
                  <div className="profile-scores">
                    <UserScores userId={profileUser.id} />
                  </div>
                )}
                
                {activeTab === "achievements" && (
                  <div className="profile-achievements">
                    <UserAchievements userId={profileUser.id} />
                  </div>
                )}
                
                {activeTab === "charter-stats" && selectedCharter && (
                  <CharterStats stats={selectedCharter.charter_stats} />
                )}
                
                {activeTab === "charter-songs" && selectedCharterId && (
                  <CharterSongs charterId={selectedCharterId} charterSongIds={selectedCharter?.charter_songs || []} />
                )}
              </div>
            </div>
            
            {isOwnProfile && activeTab === "scores" && <ScoreUpload />}
          </>
        }
      </div>
    </div>
  );
};

export default ProfilePage;