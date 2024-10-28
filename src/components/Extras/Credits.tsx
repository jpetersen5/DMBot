import React from "react";
import Tooltip from "../../utils/Tooltip/Tooltip";
import "./Credits.scss";

interface Contributor {
  name: string;
  role: string;
  avatarUrl: string;
  profileUrl: string;
}

const contributors: Contributor[] = [
  {
    name: "Satan",
    role: "Creator / Lead Dev",
    avatarUrl: "https://cdn.discordapp.com/avatars/186331412641742850/b672f0bd01e0d76b5bb5bd4a3707f5c2.png",
    profileUrl: "https://github.com/jpetersen5",
  },
  {
    name: "Hababa2",
    role: "Dark Mode, Mobile Support (WIP)",
    avatarUrl: "https://cdn.discordapp.com/avatars/325387888072196097/f76044af9bf88495a294ff66e9851f92.png",
    profileUrl: "https://github.com/zachqpeterson",
  },
  {
    name: "Dichotic",
    role: "Spotify Integration, Song Info, Domain Hosting",
    avatarUrl: "https://cdn.discordapp.com/avatars/225072566400712704/0653bfe218ab1ba5791a7326d69091e4.png",
    profileUrl: "https://github.com/noahbaxter",
  },
];

const Credits: React.FC = () => {
  return (
    <div className="credits">
      <h2>Contributors</h2>
      <div className="contributors-list">
        {contributors.map((contributor, index) => (
          <Tooltip text={contributor.role} key={index}>
            <a
              key={index}
              href={contributor.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="contributor"
            >
              <img src={contributor.avatarUrl} alt={contributor.name} className="avatar" />
              <div className="info">
                <h3>{contributor.name}</h3>
              </div>
            </a>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

export default Credits;