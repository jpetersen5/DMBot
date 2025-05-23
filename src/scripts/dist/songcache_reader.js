"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const scan_chart_1 = require("scan-chart");
const logging = console;
function cleanUpSongsData(songs) {
    const md5Groups = {};
    const cleanedSongs = [];
    const deletedSongs = [];
    const playlistPathMap = {};
    // Group songs by MD5
    for (const song of songs) {
        if (!md5Groups[song.md5]) {
            md5Groups[song.md5] = [];
            playlistPathMap[song.md5] = new Set();
        }
        md5Groups[song.md5].push(song);
        // Store the playlist path if it exists
        if (song.playlistPath) {
            playlistPathMap[song.md5].add(song.playlistPath);
        }
    }
    // Process each MD5 group
    for (const md5 in md5Groups) {
        const group = md5Groups[md5];
        if (group.length === 1) {
            cleanedSongs.push(group[0]);
        }
        else {
            // Sort songs by name length (descending)
            const sortedSongs = [...group].sort((a, b) => ((b.name?.length || 0) - (a.name?.length || 0)));
            // Keep track of songs we've decided to keep
            const songsToKeep = new Set();
            // For each song, check if it's a distinct song or a variant of one we've seen
            for (let i = 0; i < sortedSongs.length; i++) {
                const currentSong = sortedSongs[i];
                let isDuplicate = false;
                // Check against songs we've already decided to keep
                for (const keptSong of songsToKeep) {
                    // If one name is a substring of the other, consider it a duplicate
                    const currentName = (currentSong.name || "").toLowerCase();
                    const keptName = (keptSong.name || "").toLowerCase();
                    // Don't consider it a duplicate if they're exactly the same name
                    // This handles the case where two songs with identical names might be different songs
                    if (currentName !== keptName &&
                        (currentName.includes(keptName) || keptName.includes(currentName))) {
                        isDuplicate = true;
                        deletedSongs.push(currentSong);
                        break;
                    }
                }
                if (!isDuplicate) {
                    songsToKeep.add(currentSong);
                    cleanedSongs.push(currentSong);
                }
            }
            logging.info(`Found ${songsToKeep.size} distinct songs in group of ${group.length} with same MD5`);
        }
    }
    // After identifying all the songs to keep, combine all playlist paths for each MD5
    for (const song of cleanedSongs) {
        if (playlistPathMap[song.md5] && playlistPathMap[song.md5].size > 0) {
            song.playlistPath = Array.from(playlistPathMap[song.md5]).join(",");
        }
    }
    logging.info(`Cleaned up ${deletedSongs.length} duplicate songs`);
    return { cleanedSongs, deletedSongs };
}
function splitCharters(charterString) {
    const charDelimiters = [",", "/", "&"];
    const multicharDelimiters = [" - ", " + ", " and "];
    const result = [];
    let current = [];
    let i = 0;
    while (i < charterString.length) {
        if (multicharDelimiters.some(delim => charterString.startsWith(delim, i))) {
            if (current.length) {
                result.push(current.join("").trim());
                current = [];
            }
            i += multicharDelimiters.find(delim => charterString.startsWith(delim, i)).length;
        }
        else if (charDelimiters.includes(charterString[i])) {
            if (current.length) {
                result.push(current.join("").trim());
                current = [];
            }
            i++;
        }
        else {
            current.push(charterString[i]);
            i++;
        }
    }
    if (current.length) {
        result.push(current.join("").trim());
    }
    return result.filter(charter => charter.trim() !== "");
}
function mapSongPaths(basePath) {
    const songPaths = [];
    let processedFolders = 0;
    const maxPathLength = process.stdout.columns - 40;
    const walkSync = (dir) => {
        const files = fs.readdirSync(dir);
        processedFolders++;
        let displayDir = dir;
        if (dir.length > maxPathLength) {
            displayDir = "..." + dir.slice(-maxPathLength);
        }
        process.stdout.write(`\rWalking through folder ${processedFolders}: ${displayDir}`);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                walkSync(filePath);
            }
            else if (file.toLowerCase() === "song.ini") {
                songPaths.push(path.dirname(filePath).toLowerCase().replace(/\//g, "\\"));
            }
        }
    };
    walkSync(basePath);
    process.stdout.write("\n");
    logging.info(`Found ${songPaths.length} song paths`);
    return songPaths;
}
function isValidMd5(hash) {
    return /^[a-fA-F0-9]{32}$/.test(hash);
}
// findMd5ForPath with optional skipMd5 parameter to avoid specific MD5
function findMd5ForPath(fileContent, path, skipMd5s = new Set()) {
    const pathBytes = Buffer.from(path.toLowerCase());
    let start = 0;
    let md5Hash = null;
    while (true) {
        const index = fileContent.indexOf(pathBytes, start);
        if (index === -1)
            break;
        const nextPathStart = fileContent.indexOf(Buffer.from("d:\\songs"), index + pathBytes.length);
        const endIndex = nextPathStart === -1 ? fileContent.length : nextPathStart;
        const dataChunk = fileContent.subarray(index + pathBytes.length, endIndex);
        if (dataChunk.length >= 36) {
            let md5Hex;
            if (dataChunk[dataChunk.length - 18] === 0 || dataChunk[dataChunk.length - 18] === 107) {
                md5Hex = dataChunk.subarray(-17, -1).toString("hex");
            }
            else {
                md5Hex = dataChunk.subarray(-18, -2).toString("hex");
            }
            if (isValidMd5(md5Hex) && !skipMd5s.has(md5Hex)) {
                md5Hash = md5Hex;
                break;
            }
        }
        start = index + pathBytes.length;
    }
    if (!md5Hash) {
        logging.warn(`No valid MD5 hash found for path: ${path}${skipMd5s.size > 0 ? ' (skipped ' + skipMd5s.size + ' existing MD5s)' : ''}`);
    }
    return md5Hash;
}
async function processSongs(basePath, binaryFilePath, outputFile) {
    const songPaths = mapSongPaths(basePath);
    const songs = [];
    const maxPathLength = process.stdout.columns - 40;
    const binaryFileContent = fs.readFileSync(binaryFilePath);
    const assignedMd5s = new Map(); // Map from path to MD5
    // Group song paths by parent directory
    const songPathsByParent = {};
    for (const path of songPaths) {
        const parentDir = path.split("\\").slice(0, -1).join("\\");
        if (!songPathsByParent[parentDir]) {
            songPathsByParent[parentDir] = [];
        }
        songPathsByParent[parentDir].push(path);
    }
    // Process songs by directory, sorting paths by length (longest first)
    let processedSongs = 0;
    const totalSongs = songPaths.length;
    for (const parentDir of Object.keys(songPathsByParent)) {
        // Sort paths by length (longest first) to process more specific paths first
        const sortedPaths = songPathsByParent[parentDir].sort((a, b) => b.length - a.length);
        const dirMd5s = new Set(); // Track MD5s used in this directory
        for (const path of sortedPaths) {
            processedSongs++;
            let displayDir = path;
            if (path.length > maxPathLength) {
                displayDir = "..." + path.slice(-maxPathLength);
            }
            process.stdout.write(`\rProcessing song ${processedSongs} of ${totalSongs}: ${displayDir}`);
            try {
                const files = fs.readdirSync(path).map(file => ({
                    fileName: file,
                    data: fs.readFileSync(path + "/" + file)
                }));
                const scannedChart = (0, scan_chart_1.scanChartFolder)(files);
                const playlistPath = path
                    .replace("d:\\songs\\", "")
                    .replace("downloaded songs\\", "")
                    .replace("rclone songs\\sync charts\\", "");
                const scannedChartExtra = { ...scannedChart, playlistPath: playlistPath };
                scannedChartExtra.albumArt = null;
                if (scannedChartExtra.notesData) {
                    scannedChartExtra.notesData.chartIssues = [];
                }
                if (scannedChartExtra.charter) {
                    scannedChartExtra.charter = splitCharters(scannedChartExtra.charter).join(",");
                }
                // Find MD5, skipping any that are already used in this directory
                // This prevents incorrect assignment when similar paths exist
                const md5 = findMd5ForPath(binaryFileContent, path, dirMd5s);
                if (md5) {
                    assignedMd5s.set(path, md5);
                    dirMd5s.add(md5); // Mark this MD5 as used in this directory
                    scannedChartExtra.md5 = md5;
                    songs.push(scannedChartExtra);
                }
                else {
                    logging.error(`Failed to find MD5 for path: ${path}`);
                }
            }
            catch (error) {
                logging.error(`Error processing path: ${path}`, error);
            }
        }
    }
    process.stdout.write("\n");
    const { cleanedSongs, deletedSongs } = cleanUpSongsData(songs);
    fs.writeFileSync(outputFile, JSON.stringify(cleanedSongs, null, 2));
    logging.info(`Processed data saved to ${outputFile}.`);
    const deletedLogFile = outputFile.replace(".json", "_deleted_log.json");
    fs.writeFileSync(deletedLogFile, JSON.stringify(deletedSongs, null, 2));
    logging.info(`Deleted songs log saved to ${deletedLogFile}.`);
}
const basePath = "D:\\Songs";
const binaryFilePath = "C:\\Users\\jason\\AppData\\LocalLow\\srylain Inc_\\Clone Hero\\songcache.bin";
const outputFile = "data\\songs_with_md5.json";
processSongs(basePath, binaryFilePath, outputFile).catch(error => {
    console.error("Error processing songs:", error);
});
