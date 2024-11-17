import * as fs from "fs";
import * as path from "path";
import { scanChartFolder, ScannedChart } from "scan-chart";

interface ScannedChartExtra extends ScannedChart {
    playlistPath?: string;
}

const logging = console;

function cleanUpSongsData(songs: ScannedChartExtra[]): { cleanedSongs: ScannedChartExtra[], deletedSongs: ScannedChartExtra[] } {
    const md5Groups: { [key: string]: ScannedChartExtra[] } = {};
    const cleanedSongs: ScannedChartExtra[] = [];
    const deletedSongs: ScannedChartExtra[] = [];

    // Group songs by MD5
    for (const song of songs) {
        if (!md5Groups[song.md5]) {
            md5Groups[song.md5] = [];
        }
        md5Groups[song.md5].push(song);
    }

    // Process each MD5 group
    for (const group of Object.values(md5Groups)) {
        if (group.length === 1) {
            cleanedSongs.push(group[0]);
        } else {
            // Find the song with the longest name
            const longestNameSong = group.reduce((prev, current) => 
                (prev.name?.length || 0) > (current.name?.length || 0) ? prev : current
            );
            cleanedSongs.push(longestNameSong);
            
            // Log deletions
            for (const song of group) {
                if (song !== longestNameSong) {
                    deletedSongs.push(song);
                }
            }
        }
    }

    logging.info(`Cleaned up ${deletedSongs.length} duplicate songs`);
    return { cleanedSongs, deletedSongs };
}

function splitCharters(charterString: string): string[] {
    const charDelimiters = [",", "/", "&"];
    const multicharDelimiters = [" - ", " + ", " and "];

    const result: string[] = [];
    let current: string[] = [];
    let i = 0;

    while (i < charterString.length) {
        if (multicharDelimiters.some(delim => charterString.startsWith(delim, i))) {
            if (current.length) {
                result.push(current.join("").trim());
                current = [];
            }
            i += multicharDelimiters.find(delim => charterString.startsWith(delim, i))!.length;
        } else if (charDelimiters.includes(charterString[i])) {
            if (current.length) {
                result.push(current.join("").trim());
                current = [];
            }
            i++;
        } else {
            current.push(charterString[i]);
            i++;
        }
    }

    if (current.length) {
        result.push(current.join("").trim());
    }

    return result.filter(charter => charter.trim() !== "");
}

function mapSongPaths(basePath: string): string[] {
    const songPaths: string[] = [];
    let processedFolders = 0;
    const maxPathLength = process.stdout.columns - 40;

    const walkSync = (dir: string) => {
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
            } else if (file.toLowerCase() === "song.ini") {
                songPaths.push(path.dirname(filePath).toLowerCase().replace(/\//g, "\\"));
            }
        }
    };
    walkSync(basePath);
    process.stdout.write("\n");
    logging.info(`Found ${songPaths.length} song paths`);
    return songPaths;
}

function isValidMd5(hash: string): boolean {
    return /^[a-fA-F0-9]{32}$/.test(hash);
}

function findMd5ForPath(fileContent: Buffer, path: string): string | null {
    const pathBytes = Buffer.from(path.toLowerCase());
    let start = 0;
    let md5Hash: string | null = null;

    while (true) {
        const index = fileContent.indexOf(pathBytes, start);
        if (index === -1) break;

        const nextPathStart = fileContent.indexOf(Buffer.from("e:\\songs"), index + pathBytes.length);
        const endIndex = nextPathStart === -1 ? fileContent.length : nextPathStart;

        const dataChunk = fileContent.subarray(index + pathBytes.length, endIndex);

        if (dataChunk.length >= 36) {
            let md5Hex: string;
            if (dataChunk[dataChunk.length - 18] === 0 || dataChunk[dataChunk.length - 18] === 107) {
                md5Hex = dataChunk.subarray(-17, -1).toString("hex");
            } else {
                md5Hex = dataChunk.subarray(-18, -2).toString("hex");
            }

            if (isValidMd5(md5Hex)) {
                md5Hash = md5Hex;
                break;
            }
        }

        start = index + pathBytes.length;
    }

    if (!md5Hash) {
        logging.warn(`No valid MD5 hash found for path: ${path}`);
    }

    return md5Hash;
}

async function processSongs(basePath: string, binaryFilePath: string, outputFile: string): Promise<void> {
    const songPaths = mapSongPaths(basePath);
    const songs: ScannedChartExtra[] = [];
    let processedSongs = 0;
    const totalSongs = songPaths.length;
    const maxPathLength = process.stdout.columns - 40;
    const binaryFileContent = fs.readFileSync(binaryFilePath);

    for (const path of songPaths) {
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
            const scannedChart = scanChartFolder(files);
            const playlistPath = path
                .replace("e:\\songs\\", "")
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
            const md5 = findMd5ForPath(binaryFileContent, path);
            if (md5) {
                scannedChartExtra.md5 = md5;
                songs.push(scannedChartExtra);
            } else {
                logging.error(`Failed to find MD5 for path: ${path}`);
            }
        } catch (error) {
            logging.error(`Error processing path: ${path}`, error);
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

const basePath = "E:\\Songs";
const binaryFilePath = "C:\\Users\\jason\\AppData\\LocalLow\\srylain Inc_\\Clone Hero\\songcache.bin";
const outputFile = "data\\songs_with_md5.json";

processSongs(basePath, binaryFilePath, outputFile).catch(error => {
    console.error("Error processing songs:", error);
});