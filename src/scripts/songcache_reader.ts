import * as fs from "fs";
import * as path from "path";
import { scanChartFolder, ScannedChart } from "scan-chart";

const logging = console;

function cleanUpSongsData(songs: ScannedChart[]): { cleanedSongs: ScannedChart[], deletedSongs: ScannedChart[] } {
    const md5Groups: { [key: string]: ScannedChart[] } = {};
    const cleanedSongs: ScannedChart[] = [];
    const deletedSongs: ScannedChart[] = [];

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

async function processSongs(basePath: string, outputFile: string): Promise<void> {
    const songPaths = mapSongPaths(basePath);
    const songs: ScannedChart[] = [];
    let processedSongs = 0;
    const totalSongs = songPaths.length;
    const maxPathLength = process.stdout.columns - 40;

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
            scannedChart.albumArt = null;
            const scannedChartIssues = scannedChart.notesData?.chartIssues;
            if (scannedChartIssues) {
                scannedChartIssues.forEach(issue => {
                    if (issue.instrument !== "drums" && issue.instrument !== null) {
                        scannedChartIssues.splice(scannedChartIssues.indexOf(issue), 1);
                    }
                });
                if (scannedChart.notesData?.chartIssues) {
                    scannedChart.notesData.chartIssues = scannedChartIssues;
                }
            }
            songs.push(scannedChart);
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

const basePath = "C:\\Users\\jason\\Documents\\Clone Hero\\Songs";
const outputFile = "data\\songs_with_md5.json";

processSongs(basePath, outputFile).catch(error => {
    console.error("Error processing songs:", error);
});