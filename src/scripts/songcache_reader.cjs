"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var scan_chart_1 = require("scan-chart");
var logging = console;
function cleanUpSongsData(songs) {
    var md5Groups = {};
    var cleanedSongs = [];
    var deletedSongs = [];
    // Group songs by MD5
    for (var _i = 0, songs_1 = songs; _i < songs_1.length; _i++) {
        var song = songs_1[_i];
        if (!md5Groups[song.md5]) {
            md5Groups[song.md5] = [];
        }
        md5Groups[song.md5].push(song);
    }
    // Process each MD5 group
    for (var _a = 0, _b = Object.values(md5Groups); _a < _b.length; _a++) {
        var group = _b[_a];
        if (group.length === 1) {
            cleanedSongs.push(group[0]);
        }
        else {
            // Find the song with the longest name
            var longestNameSong = group.reduce(function (prev, current) { var _a, _b; return (((_a = prev.name) === null || _a === void 0 ? void 0 : _a.length) || 0) > (((_b = current.name) === null || _b === void 0 ? void 0 : _b.length) || 0) ? prev : current; });
            cleanedSongs.push(longestNameSong);
            // Log deletions
            for (var _c = 0, group_1 = group; _c < group_1.length; _c++) {
                var song = group_1[_c];
                if (song !== longestNameSong) {
                    deletedSongs.push(song);
                }
            }
        }
    }
    logging.info("Cleaned up ".concat(deletedSongs.length, " duplicate songs"));
    return { cleanedSongs: cleanedSongs, deletedSongs: deletedSongs };
}
function splitCharters(charterString) {
    var charDelimiters = [",", "/", "&"];
    var multicharDelimiters = [" - ", " + ", " and "];
    var result = [];
    var current = [];
    var i = 0;
    while (i < charterString.length) {
        if (multicharDelimiters.some(function (delim) { return charterString.startsWith(delim, i); })) {
            if (current.length) {
                result.push(current.join("").trim());
                current = [];
            }
            i += multicharDelimiters.find(function (delim) { return charterString.startsWith(delim, i); }).length;
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
    return result.filter(function (charter) { return charter.trim() !== ""; });
}
function mapSongPaths(basePath) {
    var songPaths = [];
    var processedFolders = 0;
    var maxPathLength = process.stdout.columns - 40;
    var walkSync = function (dir) {
        var files = fs.readdirSync(dir);
        processedFolders++;
        var displayDir = dir;
        if (dir.length > maxPathLength) {
            displayDir = "..." + dir.slice(-maxPathLength);
        }
        process.stdout.write("\rWalking through folder ".concat(processedFolders, ": ").concat(displayDir));
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var file = files_1[_i];
            var filePath = path.join(dir, file);
            var stat = fs.statSync(filePath);
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
    logging.info("Found ".concat(songPaths.length, " song paths"));
    return songPaths;
}
function isValidMd5(hash) {
    return /^[a-fA-F0-9]{32}$/.test(hash);
}
function findMd5ForPath(fileContent, path) {
    var pathBytes = Buffer.from(path.toLowerCase());
    var start = 0;
    var md5Hash = null;
    while (true) {
        var index = fileContent.indexOf(pathBytes, start);
        if (index === -1)
            break;
        var nextPathStart = fileContent.indexOf(Buffer.from("e:\\songs"), index + pathBytes.length);
        var endIndex = nextPathStart === -1 ? fileContent.length : nextPathStart;
        var dataChunk = fileContent.subarray(index + pathBytes.length, endIndex);
        if (dataChunk.length >= 36) {
            var md5Hex = void 0;
            if (dataChunk[dataChunk.length - 18] === 0 || dataChunk[dataChunk.length - 18] === 107) {
                md5Hex = dataChunk.subarray(-17, -1).toString("hex");
            }
            else {
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
        logging.warn("No valid MD5 hash found for path: ".concat(path));
    }
    return md5Hash;
}
function processSongs(basePath, binaryFilePath, outputFile) {
    return __awaiter(this, void 0, void 0, function () {
        var songPaths, songs, processedSongs, totalSongs, maxPathLength, binaryFileContent, _loop_1, _i, songPaths_1, path_1, _a, cleanedSongs, deletedSongs, deletedLogFile;
        return __generator(this, function (_b) {
            songPaths = mapSongPaths(basePath);
            songs = [];
            processedSongs = 0;
            totalSongs = songPaths.length;
            maxPathLength = process.stdout.columns - 40;
            binaryFileContent = fs.readFileSync(binaryFilePath);
            _loop_1 = function (path_1) {
                processedSongs++;
                var displayDir = path_1;
                if (path_1.length > maxPathLength) {
                    displayDir = "..." + path_1.slice(-maxPathLength);
                }
                process.stdout.write("\rProcessing song ".concat(processedSongs, " of ").concat(totalSongs, ": ").concat(displayDir));
                try {
                    var files = fs.readdirSync(path_1).map(function (file) { return ({
                        fileName: file,
                        data: fs.readFileSync(path_1 + "/" + file)
                    }); });
                    var scannedChart = (0, scan_chart_1.scanChartFolder)(files);
                    var playlistPath = path_1
                        .replace("e:\\songs\\", "")
                        .replace("downloaded songs\\", "")
                        .replace("rclone songs\\sync charts\\", "");
                    var scannedChartExtra = __assign(__assign({}, scannedChart), { playlistPath: playlistPath });
                    scannedChartExtra.albumArt = null;
                    if (scannedChartExtra.notesData) {
                        scannedChartExtra.notesData.chartIssues = [];
                    }
                    if (scannedChartExtra.charter) {
                        scannedChartExtra.charter = splitCharters(scannedChartExtra.charter).join(",");
                    }
                    var md5 = findMd5ForPath(binaryFileContent, path_1);
                    if (md5) {
                        scannedChartExtra.md5 = md5;
                        songs.push(scannedChartExtra);
                    }
                    else {
                        logging.error("Failed to find MD5 for path: ".concat(path_1));
                    }
                }
                catch (error) {
                    logging.error("Error processing path: ".concat(path_1), error);
                }
            };
            for (_i = 0, songPaths_1 = songPaths; _i < songPaths_1.length; _i++) {
                path_1 = songPaths_1[_i];
                _loop_1(path_1);
            }
            process.stdout.write("\n");
            _a = cleanUpSongsData(songs), cleanedSongs = _a.cleanedSongs, deletedSongs = _a.deletedSongs;
            fs.writeFileSync(outputFile, JSON.stringify(cleanedSongs, null, 2));
            logging.info("Processed data saved to ".concat(outputFile, "."));
            deletedLogFile = outputFile.replace(".json", "_deleted_log.json");
            fs.writeFileSync(deletedLogFile, JSON.stringify(deletedSongs, null, 2));
            logging.info("Deleted songs log saved to ".concat(deletedLogFile, "."));
            return [2 /*return*/];
        });
    });
}
var basePath = "E:\\Songs";
var binaryFilePath = "C:\\Users\\jason\\AppData\\LocalLow\\srylain Inc_\\Clone Hero\\songcache.bin";
var outputFile = "data\\songs_with_md5.json";
processSongs(basePath, binaryFilePath, outputFile).catch(function (error) {
    console.error("Error processing songs:", error);
});
