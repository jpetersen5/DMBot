import discord
from discord.ext import commands
from typing import Optional
import asyncio
from bot.utils.api_client import DMBotAPI

class User(commands.Cog):
    """User-related commands for viewing profiles and statistics"""
    
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
    
    @commands.command(name="profile", help="Display a user's profile")
    async def profile(self, ctx, member: Optional[discord.Member] = None):
        """Display a user's profile with their stats and achievements
        
        Args:
            ctx: Command context
            member: Optional Discord member (defaults to command author)
        """
        target_member = member or ctx.author
        
        # TODO: Implementation
        await ctx.send(f"🔍 Looking up profile for {target_member.display_name}...")
    
    @commands.command(name="stats", help="Show detailed user statistics")
    async def stats(self, ctx, member: Optional[discord.Member] = None):
        """Show detailed statistics for a user
        
        Args:
            ctx: Command context
            member: Optional Discord member (defaults to command author)
        """
        target_member = member or ctx.author
        
        # TODO: Implementation
        await ctx.send(f"📊 Fetching statistics for {target_member.display_name}...")
    
    @commands.command(name="link", aliases=["login"], help="Link your Discord account to the web app")
    async def link_account(self, ctx):
        """Link the user's Discord account to their DMBot web app account
        
        Args:
            ctx: Command context
        """
        # TODO: Implementation
        await ctx.send("🔗 Please check your DMs for account linking instructions.")

async def setup(bot):
    await bot.add_cog(User(bot)) 