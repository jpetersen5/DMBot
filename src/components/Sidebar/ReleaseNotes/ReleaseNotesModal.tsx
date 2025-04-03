import React from "react";
import { Modal } from "react-bootstrap";
import { CURRENT_VERSION } from "../Sidebar";

import "./ReleaseNotesModal.scss";

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReleaseNote {
  version: string;
  date: string;
  notes: string[];
  credit?: string;
}

const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({ isOpen, onClose }) => {
  const releaseNotes: ReleaseNote[] = [
    {
      version: "v1.10.0",
      date: "4/3/2025",
      notes: [
        "Added 840 achievements",
        "- New achievements tab",
        "- Overall achievements (score, FCs)",
        "- Hands, Blend, and Kicks song categories",
        "- Achievement pop-up on upload",
        "- Click on achievements to open song",
        "Improved score uploading",
        "- Auto-refresh on upload",
        "- Redirect button to user page",
        "Added release notes modal",
        "Improved routing",
        "Improved tooltips",
        "Fixed song descriptions clipping in song modal"
      ]
    },
    {
      version: "v1.9.1",
      date: "3/23/2025",
      notes: [
        "User profile update to better display charter info via tabs",
        "Fixed user profile and charter profile to use single page styling",
        "Table fixes:",
        "- No more clipping",
        "- Shows arrows when there's more above / below",
        "Lil website logo updated so it's not the default vite svg"
      ]
    },
    {
      version: "v1.9.0",
      date: "11/27/2024",
      notes: [
        "Mobile styling fixes",
        "Various other style changes:",
        "- Scrollbars look dope now",
        "- Tables are a lot more fluid",
        "- Many things fit better at different window sizes"
      ],
      credit: "Dichotic"
    },
    {
      version: "v1.7.0",
      date: "10/19/2024",
      notes: [
        "Improved song info on leaderboards:",
        "- Album art pulled from spotify",
        "- Better overall design",
        "- Cool difficulty display",
        "Rebuilt how tooltips work",
        "Users are highlighted more prominently on leaderboards",
        "Some jank smoothing"
      ],
      credit: "Dichotic"
    },
    {
      version: "v1.6.5",
      date: "10/14/2024",
      notes: [
        "ELO",
        "Ranks",
        "Stupid dumb stupid looking pfp borders based on rank",
        "lol"
      ]
    },
    {
      version: "v1.6.0",
      date: "9/23/2024",
      notes: [
        "Users display and search table",
        "User comparison (W/L, differences)",
        "Fix state setting in many areas:",
        "- User charter information is now properly reset",
        "- User stats are now properly reset",
        "- Linking to a song now functions as intended",
        "Fix some missing user pfps",
        "Minor styling fixes / additions"
      ]
    },
    {
      version: "v1.5.0",
      date: "9/15/2024",
      notes: [
        "Theme selector with dark mode, compatibility to add new themes in the future"
      ],
      credit: "hababa2"
    },
    {
      version: "v1.4.20.70",
      date: "9/15/2024",
      notes: [
        "Fixed charter update when a song with a new charter is uploaded",
        "- Song list won't break on missing charter",
        "Fixed charter stats not updated yet",
        "Fixed a bug in the song scraper, ~40 song entries re-uploaded",
        "Refactor some bits so that color tags apply more universally"
      ]
    },
    {
      version: "v1.4.20.69",
      date: "9/15/2024",
      notes: [
        "Added sex",
        "Users can now upload and see unknown scores (not in database):",
        "- Click on an unknown score to process songcache filepaths",
        "- Upload song.ini to add unverified songs to the database yourself so the score can be uploaded",
        "- You have to reupload for the score to update",
        "Added some admin controls for myself. thank you me",
        "Fixed various charter page bugs:",
        "- Charters with >500 songs will now properly display their songs",
        "- Fixed clicking a song row on charter page",
        "Apologiez to hababa for ignoring the dark mode feature for so long it will be focused on soon"
      ]
    },
    {
      version: "v1.4.1",
      date: "9/13/2024",
      notes: [
        "Charter stats supports multiple charter names (if you have multiple for some reason)",
        "Charter songs updates when clicking on a new charter"
      ]
    },
    {
      version: "v1.4.0",
      date: "9/12/2024",
      notes: [
        "New charter profile page:",
        "- User profile shows charter stats if user is a charter",
        "- Links to charter profile, displays charter stats and songs",
        "- Click on charter name anywhere to redirect to charter profile",
        "Redirect from homepage button to user / leaderboards for dum dum users",
        "Non windows support for scoredata.bin filepath",
        "Fix user grid that's been offcenter this whole time"
      ]
    },
    {
      version: "v1.3.0",
      date: "9/10/2024",
      notes: [
        "Improve song search:",
        "- Fix filtered search",
        "- Add multi-filter search",
        "- Search button",
        "- \"Scores\" header shows number of leaderboard entries",
        "Fix some songs with missing rankings",
        "Make scoredata.bin location easily copyable",
        "Improve song modal:",
        "- It now opens on profile page if you click on profile page song",
        "- Left and right arrows to song view so you can easily go through results",
        "- Fixed backing through previous viewed songs functionality",
        "Replace 100% + FC with Crown + FC like in the game for better UX",
        "Sort songs by number of high scores"
      ]
    },
    {
      version: "v1.2.1",
      date: "9/6/2024",
      notes: [
        "Fix missing user scores of outdated entries (no playcount, post time)",
        "Fix some broken leaderboard entries (from myself because of failed testing, everyone elses' should be fine)",
        "Fix NaN seconds on leaderboards",
        "Fix upload notification showing up under table headers",
        "Leaderboards migrated to better ranking system:",
        "- Entries with <100% speed won't be displayed at the top of leaderboards",
        "- Fix leaderboard rankings changing based on sorting",
        "Hide broken filters until next fix"
      ]
    },
    {
      version: "v1.2.0",
      date: "9/5/2024",
      notes: [
        "Redesigned user profile page:",
        "- Wider page coverage",
        "- User stats block (total FCs, avg %, overall score, num scores)",
        "- Plays and time posted columns",
        "- Default displays most recently posted scores",
        "Improved song list:",
        "- Default displays most recently updated leaderboards",
        "Improved leaderboard:",
        "- Displays number of plays and date the score was posted"
      ]
    },
    {
      version: "v1.1.0",
      date: "9/5/2024",
      notes: [
        "New homepage design:",
        "- Banner",
        "- More responsive status display",
        "- Request feature, report bug, contribute, discord buttons",
        "Version counter in the sidebar"
      ]
    },
    {
      version: "v1.0.0",
      date: "9/3/2024",
      notes: [
        "DMBot is released!"
      ]
    }
  ];

  const processNotes = (notes: string[]) => {
    const processedNotes: Array<{ main: string; subItems: string[] }> = [];
    let currentItem: { main: string; subItems: string[] } | null = null;

    for (const note of notes) {
      if (note.startsWith("- ")) {
        if (currentItem) {
          currentItem.subItems.push(note.substring(2));
        }
      } else {
        if (currentItem) {
          processedNotes.push(currentItem);
        }
        currentItem = { main: note, subItems: [] };
      }
    }

    if (currentItem) {
      processedNotes.push(currentItem);
    }

    return processedNotes;
  };

  return (
    <Modal show={isOpen} onHide={onClose} centered className="release-notes-modal">
      <Modal.Header closeButton>
        <Modal.Title>Release Notes</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="release-notes-container">
          {releaseNotes.map((note, index) => (
            <div key={index} className="release-note">
              <div className="release-header">
                <h3 className="version">{note.version} {note.version === CURRENT_VERSION ? "(New!)" : ""}</h3>
                <span className="date">{note.date}</span>
                {note.credit && <span className="credit">Credit: {note.credit}</span>}
              </div>
              <ul className="notes-list">
                {processNotes(note.notes).map((item, i) => (
                  <li key={i}>
                    {item.main}
                    {item.subItems.length > 0 && (
                      <ul className="sub-notes-list">
                        {item.subItems.map((subItem, j) => (
                          <li key={j}>{subItem}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default ReleaseNotesModal; 