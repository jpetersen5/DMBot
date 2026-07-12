import React from "react";
import { Nav } from "react-bootstrap";
import { Table, Column } from "../Table";
import { Song } from "../../utils/song";
import "./RelatedSongs.scss";

const skeletonColumns: Column<Song>[] = [
  { key: "track", header: "#", className: "track column-number", sortable: false },
  { key: "name", header: "Name", className: "name", sortable: false },
  { key: "song_length", header: "Length", className: "song-length column-number", sortable: false },
];

const RelatedSongsSkeleton: React.FC = () => (
  <div className="related-songs">
    <h5>Related Songs</h5>
    <div className="related-songs-topbar">
      <Nav variant="tabs" activeKey="album">
        <Nav.Item>
          <Nav.Link eventKey="album">Album</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="artist">Artist</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="genre">Genre</Nav.Link>
        </Nav.Item>
      </Nav>
    </div>

    <Table
      data={[]}
      columns={skeletonColumns}
      keyExtractor={() => ""}
      loading
      loadingVariant="skeleton"
    />
  </div>
);

export default RelatedSongsSkeleton;
