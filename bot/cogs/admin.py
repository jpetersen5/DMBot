import discord
from discord.ext import commands
import asyncio
from typing import List, Dict, Any, Optional
from discord.ext.commands import has_permissions, MissingPermissions
from bot.utils.api_client import DMBotAPI
from bot.utils.ui import ConfirmationView

class Admin(commands.Cog):
    """Administrative commands for bot management"""
    
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
    
    async def cog_check(self, ctx):
        """Check if user has admin permissions for all commands in this cog"""
        # Check if the user has admin permissions (either Discord admin or specific role)
        return ctx.author.guild_permissions.administrator or any(role.name.lower() == "dmbot admin" for role in ctx.author.roles)
    
    @commands.command(name="announce", help="Send an announcement to the server")
    @has_permissions(administrator=True)
    async def announce(self, ctx, *, message: str):
        """Send an announcement to a designated channel
        
        Args:
            ctx: Command context
            message: Announcement message
        """
        # TODO: Implementation
        await ctx.send(f"📢 Announcement prepared: \"{message}\"")
    
    @commands.command(name="config", help="Configure bot settings")
    @has_permissions(administrator=True)
    async def config(self, ctx, setting: Optional[str] = None, *, value: Optional[str] = None):
        """Configure bot settings
        
        Args:
            ctx: Command context
            setting: Setting to configure
            value: New value for the setting
        """
        if not setting:
            # Show all settings
            await ctx.send("⚙️ Available settings: (WIP)")
            return
            
        # TODO: Implementation
        await ctx.send(f"⚙️ Setting '{setting}' has been updated.")
    
    @commands.command(name="prune", help="Clean up bot messages")
    @has_permissions(manage_messages=True)
    async def prune(self, ctx, limit: int = 100):
        """Clean up bot messages in the current channel
        
        Args:
            ctx: Command context
            limit: Maximum number of messages to check
        """
        # TODO: Implementation
        await ctx.send(f"🧹 Cleaning up bot messages (limit: {limit})...")
    
    @commands.command(name="modlog", help="Moderate users")
    @has_permissions(kick_members=True)
    async def modlog(self, ctx, action: str, member: discord.Member, *, reason: Optional[str] = None):
        """Perform moderation actions and log them
        
        Args:
            ctx: Command context
            action: Action to perform (warn, mute, kick, ban)
            member: Member to moderate
            reason: Reason for moderation
        """
        reason = reason or "No reason provided"
        
        # TODO: Implementation
        await ctx.send(f"🛡️ {action.title()} action against {member.display_name} logged: {reason}")
    
    @commands.group(name="event", help="Manage events", invoke_without_command=True)
    @has_permissions(administrator=True)
    async def event(self, ctx):
        """Manage community events (create, edit, delete)"""
        await ctx.send_help(ctx.command)
    
    @event.command(name="create")
    async def event_create(self, ctx, *, name: str):
        """Create a new community event
        
        Args:
            ctx: Command context
            name: Name of the event
        """
        # TODO: Implementation
        await ctx.send(f"📅 Creating new event: {name}")
    
    @event.command(name="edit")
    async def event_edit(self, ctx, event_id: str, field: str, *, value: str):
        """Edit an existing community event
        
        Args:
            ctx: Command context
            event_id: ID of the event to edit
            field: Field to edit
            value: New value for the field
        """
        # TODO: Implementation
        await ctx.send(f"📝 Editing event {event_id}, setting {field} to: {value}")
    
    @event.command(name="delete")
    async def event_delete(self, ctx, event_id: str):
        """Delete a community event
        
        Args:
            ctx: Command context
            event_id: ID of the event to delete
        """
        # TODO: Implementation
        await ctx.send(f"❌ Deleting event: {event_id}")
    
    @commands.command(name="approvecharter", help="Approve a charter registration")
    @has_permissions(administrator=True)
    async def approve_charter(self, ctx, user_id: str):
        """Approve a charter registration request
        
        Args:
            ctx: Command context
            user_id: ID of the user to approve
        """
        # TODO: Implementation
        await ctx.send(f"✅ Charter registration for user {user_id} approved.")
    
    @commands.command(name="rejectcharter", help="Reject a charter registration")
    @has_permissions(administrator=True)
    async def reject_charter(self, ctx, user_id: str, *, reason: Optional[str] = None):
        """Reject a charter registration request
        
        Args:
            ctx: Command context
            user_id: ID of the user to reject
            reason: Reason for rejection
        """
        reason = reason or "No reason provided"
        
        # TODO: Implementation
        await ctx.send(f"❌ Charter registration for user {user_id} rejected: {reason}")

    @announce.error
    @config.error
    @prune.error
    @modlog.error
    @event.error
    @event_create.error
    @event_edit.error
    @event_delete.error
    @approve_charter.error
    @reject_charter.error
    async def admin_command_error(self, ctx, error):
        """Handle errors for admin commands"""
        if isinstance(error, MissingPermissions):
            await ctx.send("❌ You don't have permission to use this command.")
        else:
            await ctx.send(f"❌ An error occurred: {str(error)}")
            # Log the full error for debugging
            print(f"Error in {ctx.command.name}: {error}")

async def setup(bot):
    await bot.add_cog(Admin(bot)) 