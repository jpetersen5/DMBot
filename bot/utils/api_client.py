import aiohttp
import json
import asyncio
from typing import Dict, List, Any, Optional, Union
import time

class DMBotAPI:
    """API client for interacting with the DMBot backend"""
    
    def __init__(self, base_url: str, session: Optional[aiohttp.ClientSession] = None):
        """Initialize the API client
        
        Args:
            base_url: Base URL for the API
            session: Optional aiohttp ClientSession
        """
        self.base_url = base_url
        self.session = session
        self.cache = {}
        self.cache_ttl = {}
        self.default_ttl = 300  # 5 minutes cache by default
    
    async def ensure_session(self):
        """Ensure that a session exists"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
    
    async def close(self):
        """Close the session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    def _get_cache_key(self, endpoint: str, params: Dict = None) -> str:
        """Generate a cache key from endpoint and params"""
        if params:
            param_str = json.dumps(params, sort_keys=True)
            return f"{endpoint}:{param_str}"
        return endpoint
    
    def _is_cache_valid(self, key: str) -> bool:
        """Check if a cache entry is still valid"""
        if key not in self.cache_ttl:
            return False
        return time.time() < self.cache_ttl[key]
    
    def _set_cache(self, key: str, data: Any, ttl: int = None):
        """Set cache data with TTL"""
        self.cache[key] = data
        self.cache_ttl[key] = time.time() + (ttl or self.default_ttl)
    
    def _clear_cache(self, key_prefix: str = None):
        """Clear cache entries, optionally by prefix"""
        if key_prefix:
            keys_to_delete = [k for k in self.cache.keys() if k.startswith(key_prefix)]
            for key in keys_to_delete:
                self.cache.pop(key, None)
                self.cache_ttl.pop(key, None)
        else:
            self.cache.clear()
            self.cache_ttl.clear()
    
    async def request(self, method: str, endpoint: str, params: Dict = None, 
                     data: Dict = None, headers: Dict = None, use_cache: bool = True,
                     cache_ttl: int = None) -> Any:
        """Make a request to the API
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (without base URL)
            params: Query parameters
            data: Request body for POST/PUT
            headers: HTTP headers
            use_cache: Whether to use cached results
            cache_ttl: Custom TTL for cache
            
        Returns:
            Response data (usually JSON)
        """
        await self.ensure_session()
        
        # Check cache for GET requests
        if method.upper() == "GET" and use_cache:
            cache_key = self._get_cache_key(endpoint, params)
            if self._is_cache_valid(cache_key):
                return self.cache[cache_key]
        
        # Prepare full URL and headers
        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        headers = headers or {}
        
        try:
            async with self.session.request(
                method=method,
                url=url,
                params=params,
                json=data,
                headers=headers
            ) as response:
                if response.status >= 400:
                    error_text = await response.text()
                    raise Exception(f"API error: {response.status} - {error_text}")
                
                result = await response.json()
                
                # Cache successful GET requests
                if method.upper() == "GET" and use_cache:
                    cache_key = self._get_cache_key(endpoint, params)
                    self._set_cache(cache_key, result, cache_ttl)
                
                return result
        except aiohttp.ClientError as e:
            raise Exception(f"Request error: {str(e)}")
    
    # Song-related methods
    async def search_songs(self, query: str) -> List[Dict[str, Any]]:
        """Search for songs by name"""
        try:
            # First try to get all songs (should be cached after first call)
            songs = await self.request("GET", "api/songs", use_cache=True)
            
            # Filter songs by the query (case-insensitive partial match)
            query_terms = query.lower().split()
            matching_songs = []
            
            for song in songs:
                song_parts = [
                    song.get("name", "").lower(),
                    song.get("artist", "").lower(),
                    song.get("album", "").lower(),
                    song.get("playlist", "").lower() if song.get("playlist") else ""
                ]
                
                # Check if all query terms appear in at least one song part
                if all(any(term in part for part in song_parts) for term in query_terms):
                    matching_songs.append(song)
            
            # Sort by relevance and popularity
            original_query = query.lower()
            matching_songs.sort(key=lambda s: (
                0 if s.get("name", "").lower() == original_query else 1,
                0 if s.get("artist", "").lower() == original_query else 2,
                0 if s.get("album", "").lower() == original_query else 3,
                -(s.get("scores_count", 0) or 0)
            ))
            
            return matching_songs
        except Exception as e:
            print(f"Error searching songs: {e}")
            return []
    
    async def get_song_details(self, song_id: str) -> Optional[Dict[str, Any]]:
        """Get details for a specific song"""
        try:
            # Try to get the song from the songs endpoint cache first
            cache_key = self._get_cache_key("api/songs", None)
            if self._is_cache_valid(cache_key) and cache_key in self.cache:
                songs = self.cache[cache_key]
                for song in songs:
                    if str(song.get("id")) == str(song_id):
                        return song
            
            # If not found in cache, make a direct request
            return await self.request("GET", f"api/songs/{song_id}", use_cache=True)
        except Exception as e:
            print(f"Error getting song details: {e}")
            return None
    
    async def get_songs_by_ids(self, song_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Get multiple songs by their IDs"""
        if not song_ids:
            return {}
            
        try:
            songs = await self.request(
                "POST", 
                "api/songs-by-ids", 
                data={"ids": song_ids},
                use_cache=True
            )
            
            # Index by song ID for easy lookup
            return {str(song.get("id")): song for song in songs}
        except Exception as e:
            print(f"Error getting songs by IDs: {e}")
            return {}
    
    async def get_popular_songs(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get list of popular songs"""
        try:
            songs = await self.request("GET", "api/songs", use_cache=True)
            
            # Sort by number of scores (popularity)
            popular_songs = sorted(
                songs, 
                key=lambda s: -(s.get("scores_count", 0) or 0)
            )
            
            return popular_songs[:limit]
        except Exception as e:
            print(f"Error getting popular songs: {e}")
            return []
    
    async def get_recent_songs(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recently played songs"""
        try:
            scores = await self.request("GET", "api/scores", 
                                       params={"limit": 100, "sort": "recent"},
                                       use_cache=True)
            
            # Extract unique song_ids from scores
            song_ids = []
            song_id_set = set()
            
            for score in scores:
                song_id = score.get("song_id")
                if song_id and song_id not in song_id_set:
                    song_ids.append(song_id)
                    song_id_set.add(song_id)
                    if len(song_ids) >= limit:
                        break
            
            # Get song details for the extracted song_ids
            if song_ids:
                recent_songs = await self.get_songs_by_ids(song_ids)
                return list(recent_songs.values())
            
            return []
        except Exception as e:
            print(f"Error getting recent songs: {e}")
            return []
    
    # Leaderboard-related methods
    async def get_leaderboard(self, song_id: str) -> List[Dict[str, Any]]:
        """Get leaderboard for a specific song"""
        try:
            data = await self.request("GET", f"api/leaderboard/{song_id}", use_cache=True)
            return data.get("leaderboard", [])
        except Exception as e:
            print(f"Error getting leaderboard: {e}")
            return []
    
    # User-related methods
    async def get_user_by_discord_id(self, discord_id: str) -> Optional[Dict[str, Any]]:
        """Get user by Discord ID"""
        try:
            user = await self.request("GET", f"api/users/discord/{discord_id}", use_cache=True)
            return user
        except Exception as e:
            print(f"Error getting user by Discord ID: {e}")
            return None
    
    async def get_user_scores(self, user_id: str, sort_by: str = "recent") -> List[Dict[str, Any]]:
        """Get a user's scores
        
        Args:
            user_id: User ID to get scores for
            sort_by: How to sort the scores ('recent', 'top', 'fc')
            
        Returns:
            List of score objects
        """
        try:
            params = {"sort": sort_by} if sort_by else None
            data = await self.request("GET", f"api/user/{user_id}/scores", params=params, use_cache=True)
            return data.get("scores", [])
        except Exception as e:
            print(f"Error getting user scores: {e}")
            return []
    
    async def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get detailed statistics for a user"""
        try:
            stats = await self.request("GET", f"api/user/{user_id}/stats", use_cache=True)
            return stats
        except Exception as e:
            print(f"Error getting user stats: {e}")
            return {}
    
    # Ranking-related methods
    async def get_global_rankings(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Get global user rankings"""
        try:
            params = {"limit": limit, "offset": offset}
            # TODO: Implement /api/rankings endpoint
            rankings = await self.request("GET", "api/rankings", params=params, use_cache=True)
            return rankings
        except Exception as e:
            print(f"Error getting global rankings: {e}")
            return []
    
    async def get_nearby_rankings(self, user_id: str, range: int = 5) -> List[Dict[str, Any]]:
        """Get rankings around a specific user"""
        try:
            params = {"range": range}
            # TODO: Implement /api/rankings/{user_id} endpoint
            rankings = await self.request("GET", f"api/rankings/{user_id}", params=params, use_cache=True)
            return rankings
        except Exception as e:
            print(f"Error getting nearby rankings: {e}")
            return []
    
    async def get_ranking_changes(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent ranking changes"""
        try:
            params = {"limit": limit}
            # TODO: Implement /api/rankings/recent-changes endpoint
            changes = await self.request("GET", "api/rankings/recent-changes", params=params, use_cache=True)
            return changes
        except Exception as e:
            print(f"Error getting ranking changes: {e}")
            return []
    
    # Charter-related methods
    async def search_charters(self, query: str) -> List[Dict[str, Any]]:
        """Search for charters"""
        try:
            params = {"query": query}
            # TODO: Implement /api/charters/search endpoint
            charters = await self.request("GET", "api/charters/search", params=params, use_cache=True)
            return charters
        except Exception as e:
            print(f"Error searching charters: {e}")
            return []
    
    async def get_charter_details(self, charter_id: str) -> Dict[str, Any]:
        """Get details for a specific charter"""
        try:
            # TODO: Implement /api/charters/{charter_id} endpoint
            charter = await self.request("GET", f"api/charters/{charter_id}", use_cache=True)
            return charter
        except Exception as e:
            print(f"Error getting charter details: {e}")
            return {}
    
    async def register_charter(self, user_id: str, details: Dict[str, Any]) -> Dict[str, Any]:
        """Register a new charter (requires approval)"""
        try:
            # TODO: Implement /api/charters/register endpoint
            result = await self.request("POST", "api/charters/register", data={
                "user_id": user_id,
                "details": details
            }, use_cache=False)
            return result
        except Exception as e:
            print(f"Error registering charter: {e}")
            return {"success": False, "error": str(e)} 