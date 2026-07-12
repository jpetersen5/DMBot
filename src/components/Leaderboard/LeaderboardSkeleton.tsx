import React from "react";
import { Table, Column } from "../Table";
import "./Leaderboard.scss";

interface LeaderboardEntry {
  user_id: string;
}

const skeletonColumns: Column<LeaderboardEntry>[] = [
  { key: "rank", header: "#", className: "rank column-number", sortable: false },
  { key: "username", header: "Player", className: "username", sortable: false },
  { key: "score", header: "Score", className: "score column-number", sortable: false },
  { key: "percent", header: "Percent", className: "percent column-percent", sortable: false },
  { key: "speed", header: "Speed", className: "speed column-percent", sortable: false },
  { key: "play_count", header: "Plays", className: "play-count column-number", sortable: false },
  { key: "posted", header: "Posted", className: "posted", sortable: false },
];

const LeaderboardSkeleton: React.FC = () => (
  <div className="leaderboard">
    <Table
      data={[]}
      columns={skeletonColumns}
      keyExtractor={() => ""}
      loading
      loadingVariant="skeleton"
    />
  </div>
);

export default LeaderboardSkeleton;
