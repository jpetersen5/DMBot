import discord
from discord.ext import commands
import asyncio
from typing import List, Dict, Any
from bot.utils.api_client import DMBotAPI
from bot.utils.ui import PaginatedView, SongSelector

class Songs(commands.Cog):
    """Commands for searching and displaying song information"""
    
    def __init__(self, bot):
        self.bot = bot
        # Try to get API URL from bot's config
        try:
            self.api_url = bot.api_url
            self.api = DMBotAPI(self.api_url)
        except AttributeError:
            # Default to localhost if not configured
            self.api_url = "http://localhost:5000"
            self.api = DMBotAPI(self.api_url)
    
    def cog_unload(self):
        """Clean up when cog is unloaded"""
        asyncio.create_task(self.api.close())
    
    @commands.command(name="search", help="Search for songs")
    async def search(self, ctx, *, query: str):
        """Search for songs by name, artist, charter, etc.
        
        Args:
            ctx: Command context
            query: Search query
        """
        # TODO: Implementation
        await ctx.send(f"🔍 Searching for songs matching '{query}'...")
    
    @commands.command(name="popular", aliases=["topsongs"], help="Show most played songs")
    async def popular(self, ctx):
        """Show the most popular/played songs
        
        Args:
            ctx: Command context
        """
        # TODO: Implementation
        await ctx.send("🎵 Fetching most popular songs...")
    
    @commands.command(name="recent", help="Show recently played songs")
    async def recent(self, ctx):
        """Show recently played songs across all users
        
        Args:
            ctx: Command context
        """
        # TODO: Implementation
        await ctx.send("🎵 Fetching recently played songs...")
    
    def format_song_list_embed(self, songs: List[Dict[str, Any]], title: str, description: str = None) -> discord.Embed:
        """Format a list of songs into a Discord embed
        
        Args:
            songs: List of song data
            title: Embed title
            description: Optional embed description
            
        Returns:
            discord.Embed: Formatted embed
        """
        embed = discord.Embed(
            title=title,
            description=description or "Song list",
            color=discord.Color.green()
        )
        
        # TODO: Implementation
        
        return embed
    
    def format_song_details_embed(self, song: Dict[str, Any]) -> discord.Embed:
        """Format detailed song information into a Discord embed
        
        Args:
            song: Song data
            
        Returns:
            discord.Embed: Formatted embed
        """
        embed = discord.Embed(
            title=song.get("name", "Unknown Song"),
            description=f"Artist: {song.get('artist', 'Unknown')}",
            color=discord.Color.green()
        )
        
        # TODO: Implementation
        
        return embed

async def setup(bot):
    await bot.add_cog(Songs(bot)) 