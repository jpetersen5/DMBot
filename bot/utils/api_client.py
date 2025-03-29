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
        pass
    
    async def get_song_details(self, song_id: str) -> Dict[str, Any]:
        """Get details for a specific song"""
        pass
    
    async def get_popular_songs(self) -> List[Dict[str, Any]]:
        """Get list of popular songs"""
        pass
    
    async def get_recent_songs(self) -> List[Dict[str, Any]]:
        """Get recently played songs"""
        pass
    
    # Leaderboard-related methods
    async def get_leaderboard(self, song_id: str) -> List[Dict[str, Any]]:
        """Get leaderboard for a specific song"""
        pass
    
    # User-related methods
    async def get_user_by_discord_id(self, discord_id: str) -> Optional[Dict[str, Any]]:
        """Get user by Discord ID"""
        pass
    
    async def get_user_scores(self, user_id: str) -> List[Dict[str, Any]]:
        """Get a user's scores"""
        pass
    
    async def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get detailed statistics for a user"""
        pass
    
    # Ranking-related methods
    async def get_global_rankings(self) -> List[Dict[str, Any]]:
        """Get global user rankings"""
        pass
    
    async def get_nearby_rankings(self, user_id: str) -> List[Dict[str, Any]]:
        """Get rankings around a specific user"""
        pass
    
    async def get_ranking_changes(self) -> List[Dict[str, Any]]:
        """Get recent ranking changes"""
        pass
    
    # Charter-related methods
    async def search_charters(self, query: str) -> List[Dict[str, Any]]:
        """Search for charters"""
        pass
    
    async def get_charter_details(self, charter_id: str) -> Dict[str, Any]:
        """Get details for a specific charter"""
        pass
    
    async def register_charter(self, user_id: str, details: Dict[str, Any]) -> Dict[str, Any]:
        """Register a new charter (requires approval)"""
        pass 