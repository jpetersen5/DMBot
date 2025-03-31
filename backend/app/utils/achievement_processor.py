from typing import List, Dict, Any
import json
import os
import logging
from datetime import datetime, UTC
from pathlib import Path

logger = logging.getLogger(__name__)

PERCENT_THRESHOLDS = [96, 98, 99]  # For levels I, II, III (IV is FC)
SCORE_THRESHOLDS = [2_000_000, 10_000_000, 50_000_000, 200_000_000, 1_000_000_000, 3_000_000_000]
FC_THRESHOLDS = [1, 10, 25, 50, 200, 500, 1000]

class AchievementProcessor:
    """Processes user scores and returns earned achievements"""
    
    def __init__(self):
        self.achievements = []
        self.achievement_songs = self._load_achievement_songs()
        self._initialize_achievements()
        
    def _load_achievement_songs(self):
        """Load achievement song definitions from JSON file"""
        try:
            file_path = Path(__file__).parent.parent / "data" / "achievement_songs.json"
            with open(file_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading achievement songs: {e}")
            return {}
        
    def _initialize_achievements(self):
        """Initialize all possible achievements"""
        self.achievements = []
        
        self._add_general_achievements()
        
        self._add_song_category_achievements("hands")
        self._add_song_category_achievements("blend")
        self._add_song_category_achievements("kicks")
    
    def _add_general_achievements(self):
        """Add general category achievements"""
        
        self.achievements.append({
            "id": "first_score",
            "name": "First Score",
            "description": "Play a song.",
            "rank": 1,
            "category": "general",
            "check_function": self._check_first_score
        })
        
        for i, threshold in enumerate(SCORE_THRESHOLDS):
            rank_names = ["Score Recruit", "Score Semi-Pro", "Score Adept", 
                         "Score Veteran", "Score Master", "Scorer"]
            
            self.achievements.append({
                "id": f"score_rank_{i+1}",
                "name": rank_names[i],
                "description": f"Get {threshold:,} Points in total Score.",
                "rank": 1,
                "category": "general",
                "check_function": self._check_total_score,
                "threshold": threshold
            })
        
        self.achievements.append({
            "id": "first_fc",
            "name": "First FC",
            "description": "Get your first Full Combo.",
            "rank": 1,
            "category": "general",
            "check_function": self._check_first_fc
        })
        
        for i, threshold in enumerate(FC_THRESHOLDS[1:]):
            rank_names = ["FC Recruit", "FC Semi-Pro", "FC Adept", 
                         "FC Veteran", "FC Master", "FCer"]
            
            self.achievements.append({
                "id": f"fc_rank_{i+1}",
                "name": rank_names[i],
                "description": f"Get {threshold} Full Combos.",
                "rank": 1,
                "category": "general",
                "check_function": self._check_total_fcs,
                "threshold": threshold
            })
            
        charter_types = [
            ("onyxite", "Jazz Apprentice", "Onyxite", ["Onyxite"]),
            ("boo", "Prog Apprentice", "Boo", ["Boo"]),
            ("xane60", "Metal Apprentice", "Xane60", ["Xane60"]),
            ("bloodline", "Variety Apprentice", "Bloodline", ["Bloodline"]),
            ("hoph2o", "Punk Apprentice", "Hoph2o", ["Hoph2o"]),
            ("dichotic_rhythmassacre", "Hardcore Apprentice", "Dichotic or Rhythmassacre", ["Dichotic", "Rhythmassacre"]),
            ("tomato_ganonmetroid", "Math Rock Apprentice", "tomato or GanonMetroid", ["tomato", "GanonMetroid"]),
            ("jameos", "???", "Jameos", ["Jameos"]),
        ]

        recharts_charter_refs = [
            "Harmonix",
            "Neversoft",
            "RhythmAuthors",
            "RockGamer",
            "ThatAuthoringGroup",
            "OffbeatEntertainment",
            "TheAuthority",
            "WaveGroup",
            "NoisyPuppet",
            "EaracheRecords",
            "wesjett08",
            "Fairwood Studios",
            "realityofjonah",
            "Alt-StrumProductions",
            "RideTheLights",
            "fauxharmonic",
            "ChartToppers"
        ]

        remix_artists = [
            "Xane60", "SoundHaven", "LethalLasagna", "Luke Holland", "Matt McGuire"
        ]
        
        for achievement_id, name, charter_name, charters in charter_types:
            threshold = 25 if achievement_id != "jameos" else 1
            
            self.achievements.append({
                "id": achievement_id,
                "name": name,
                "description": f"Play {threshold} {charter_name} charts.",
                "rank": 1,
                "category": "general",
                "check_function": self._check_charter_count,
                "charter_refs": charters,
                "threshold": threshold
            })

        self.achievements.append({
            "id": "remix",
            "name": "Remix Apprentice",
            "description": "Play 25 remixes.",
            "rank": 1,
            "category": "general",
            "check_function": self._check_remix_count,
            "remix_artists": remix_artists,
            "threshold": 25
        })
        
        self.achievements.append({
            "id": "recharts",
            "name": "Hurray, Recharts!",
            "description": "Play 25 recharts of songs from official games.",
            "rank": 1,
            "category": "general",
            "check_function": self._check_recharts_count,
            "recharts_charter_refs": recharts_charter_refs,
            "threshold": 25
        })
        
        if "special" in self.achievement_songs:
            if "funny_number" in self.achievement_songs["special"]:
                funny_number = self.achievement_songs["special"]["funny_number"]
                self.achievements.append({
                    "id": "funny_numbers",
                    "name": "The Funny Numbers",
                    "description": funny_number["description"],
                    "rank": 1,
                    "category": "general",
                    "check_function": self._check_funny_number,
                    "score": funny_number.get("score", 69420)
                })
            
            if "discography" in self.achievement_songs["special"]:
                discography = self.achievement_songs["special"]["discography"]
                self.achievements.append({
                    "id": "bladder_of_steel",
                    "name": "Bladder of Steel 2",
                    "description": discography["description"],
                    "rank": 1,
                    "category": "general",
                    "check_function": self._check_discography,
                })
    
    def _add_song_category_achievements(self, category):
        """Add achievements for a specific category from the JSON file"""
        if category not in self.achievement_songs:
            return
        
        category_data = self.achievement_songs[category]
        for level, achievements in category_data.items():
            for achievement_id, achievement_data in achievements.items():
                self._add_tiered_song_achievement(
                    achievement_id=achievement_id,
                    name=achievement_data["name"],
                    base_description=achievement_data["description"],
                    song_md5=achievement_data["md5"],
                    category=category
                )
    
    def _add_tiered_song_achievement(self, achievement_id, name, base_description, song_md5, category):
        """Helper to add a tiered song achievement (I, II, III, IV)"""
        for rank in range(1, 5):
            # For ranks 1-3, use percent thresholds
            # For rank 4, achievement requires FC
            if rank < 4:
                description = base_description.format(f"{PERCENT_THRESHOLDS[rank-1]}%")
            else:
                description = base_description.format("an FC")
            
            self.achievements.append({
                "id": f"{achievement_id}_{rank}",
                "name": name,
                "description": description,
                "rank": rank,
                "category": category,
                "check_function": self._check_song_achievement,
                "song_md5": song_md5,
                "threshold": PERCENT_THRESHOLDS[rank-1] if rank < 4 else 0,
                "requires_fc": rank == 4
            })
    
    def _check_first_score(self, user_data, achievement_def):
        """Check if user has at least one score"""
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
            
        return len(user_data.get("scores", [])) > 0
    
    def _check_total_score(self, user_data, achievement_def):
        """Check if user's total score meets threshold"""
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
            
        total_score = user_data.get("stats", {}).get("total_score", 0)
        return total_score >= achievement_def["threshold"]
    
    def _check_first_fc(self, user_data, achievement_def):
        """Check if user has at least one FC"""
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
            
        scores = user_data.get("scores", [])
        for score in scores:
            if score.get("is_fc", False):
                return True
        return False
    
    def _check_total_fcs(self, user_data, achievement_def):
        """Check if user's FC count meets threshold"""
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
            
        total_fcs = user_data.get("stats", {}).get("total_fcs", 0)
        return total_fcs >= achievement_def["threshold"]
    
    def _check_charter_count(self, user_data, achievement_def):
        """Check if user has played enough charts from specified charters using charter_refs"""
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
            
        charter_refs = achievement_def["charter_refs"]
        threshold = achievement_def["threshold"]
        
        count = 0
        scores = user_data.get("scores", [])
        for score in scores:
            score_charter_refs = score.get("charter_refs", [])
            if any(charter in score_charter_refs for charter in charter_refs):
                count += 1
        
        return count >= threshold
    
    def _check_remix_count(self, user_data, achievement_def):
        """Check if user has played enough remix charts"""
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
            
        remix_artists = achievement_def["remix_artists"]
        threshold = achievement_def["threshold"]
        
        count = 0
        scores = user_data.get("scores", [])
        for score in scores:
            song_name = score.get("song_name", "").lower()
            score_artists = score.get("artists", [])
            for artist in score_artists:
                if any(remix_artist in artist.lower() for remix_artist in remix_artists):
                    count += 1
                    break
        
        return count >= threshold
    
    def _check_recharts_count(self, user_data, achievement_def):
        """Check if user has played enough recharts from official games"""
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
            
        recharts_charter_refs = achievement_def["recharts_charter_refs"]
        threshold = achievement_def["threshold"]
        
        count = 0
        scores = user_data.get("scores", [])
        for score in scores:
            score_charter_refs = score.get("charter_refs", [])
            # if at least one score charter ref is in recharts_charter_refs AND at least one score charter ref is not in recharts_charter_refs
            if any(charter in recharts_charter_refs for charter in score_charter_refs) and not all(charter in recharts_charter_refs for charter in score_charter_refs):
                count += 1
        
        return count >= threshold
    
    def _check_funny_number(self, user_data, achievement_def):
        """Check if user has a score of exactly 69,420"""
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
            
        target_score = achievement_def.get("score", 69420)
        scores = user_data.get("scores", [])
        for score in scores:
            if score.get("score") == target_score:
                return True
        return False
    
    def _check_discography(self, user_data, achievement_def):
        """Check if user has played a discography chart"""
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
            
        scores = user_data.get("scores", [])
        for score in scores:
            song_name = score.get("song_name", "")
            if "Discography" in song_name:
                return True
        
        return False
    
    def _check_song_achievement(self, user_data, achievement_def):
        """Check if user has achieved a specific threshold on a song"""
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
            
        scores = user_data.get("scores", [])
        song_md5s = achievement_def["song_md5"]
        
        if not isinstance(song_md5s, list):
            song_md5s = [song_md5s]
        
        best_score = None
        for score in scores:
            if score.get("identifier") in song_md5s:
                if (best_score is None or 
                    (achievement_def["requires_fc"] and score.get("is_fc", False)) or
                    (not achievement_def["requires_fc"] and score.get("percent", 0) > best_score.get("percent", 0))):
                    best_score = score
        
        if best_score:
            if achievement_def["requires_fc"] and best_score.get("is_fc", False):
                return True
            elif not achievement_def["requires_fc"] and best_score.get("percent", 0) >= achievement_def["threshold"]:
                return True
            
        return False
    
    def process_achievements(self, user_data):
        """
        Process user data and return list of achieved achievements
        
        Args:
            user_data: Dict containing user scores and stats, or a list where the first item is such a dict
            
        Returns:
            List of achievements achieved by the user
        """
        user_achievements = []
        current_time = datetime.now(UTC).isoformat()
        
        if isinstance(user_data, list) and len(user_data) > 0:
            user_data = user_data[0]
        
        for achievement_def in self.achievements:
            check_function = achievement_def["check_function"]
            if check_function(user_data, achievement_def):
                achievement_copy = achievement_def.copy()
                achievement_copy.pop("check_function", None)
                achievement_copy.pop("threshold", None)
                achievement_copy.pop("song_md5", None)
                achievement_copy.pop("requires_fc", None)
                achievement_copy.pop("charter_refs", None)
                achievement_copy.pop("score", None)
                achievement_copy.pop("song_types", None)
                
                achievement_copy["achieved"] = True
                achievement_copy["timestamp"] = user_data.get("last_updated", current_time)
                
                user_achievements.append(achievement_copy)
        
        return user_achievements

achievement_processor = AchievementProcessor() 