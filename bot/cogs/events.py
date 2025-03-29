import discord
from discord.ext import commands
import asyncio
from typing import List, Dict, Any, Optional
from bot.utils.api_client import DMBotAPI
from bot.utils.ui import PaginatedView, ConfirmationView

class Events(commands.Cog):
    """Commands for community events and competitions"""
    
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
    
    @commands.command(name="tourney", aliases=["tournament", "competition"], help="Show current/upcoming community tournaments")
    async def tournament(self, ctx):
        """Show information about current and upcoming tournaments
        
        Args:
            ctx: Command context
        """
        # TODO: Implementation
        await ctx.send("🏆 Fetching tournament information...")
    
    @commands.command(name="sotw", aliases=["week"], help="Show/vote for Songs of the Week")
    async def song_of_the_week(self, ctx):
        """Show the current Songs of the Week and allow voting
        
        Args:
            ctx: Command context
        """
        # TODO: Implementation
        await ctx.send("🎵 Fetching Songs of the Week...")
    
    @commands.command(name="challenge", help="Create a score challenge")
    async def challenge(self, ctx, member: Optional[discord.Member] = None):
        """Create a score challenge for a specific song
        
        Args:
            ctx: Command context
            member: Optional member to challenge (if none, open to all)
        """
        target = f"@{member.display_name}" if member else "anyone"
        
        # TODO: Implementation
        await ctx.send(f"⚔️ Setting up a challenge against {target}...")
    
    @commands.command(name="join", help="Join an event")
    async def join_event(self, ctx, *, event_name: str):
        """Join a community event
        
        Args:
            ctx: Command context
            event_name: Name of the event to join
        """
        # TODO: Implementation
        await ctx.send(f"✅ Registering you for event: {event_name}...")
    
    @commands.command(name="leave", help="Leave an event")
    async def leave_event(self, ctx, *, event_name: str):
        """Leave a community event
        
        Args:
            ctx: Command context
            event_name: Name of the event to leave
        """
        # TODO: Implementation
        await ctx.send(f"❌ Removing you from event: {event_name}...")
    
    def format_event_embed(self, event: Dict[str, Any]) -> discord.Embed:
        """Format event information into a Discord embed
        
        Args:
            event: Event data
            
        Returns:
            discord.Embed: Formatted embed
        """
        embed = discord.Embed(
            title=event.get("name", "Unknown Event"),
            description=event.get("description", "No description provided"),
            color=discord.Color.orange()
        )
        
        # TODO: Implementation
        
        return embed

async def setup(bot):
    await bot.add_cog(Events(bot)) 