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
        response_msg = await ctx.send(f"🔍 Searching for songs matching '{query}'...")
        
        try:
            matching_songs = await self.search_songs_by_name(query)
            
            if not matching_songs:
                await response_msg.edit(content=f"❌ No songs found matching '{query}'")
                return
            
            embed = self.format_song_list_embed(
                matching_songs[:10],
                f"Search Results for '{query}'",
                f"Found {len(matching_songs)} songs matching your search"
            )
            
            await response_msg.edit(content=None, embed=embed)
            
        except Exception as e:
            import traceback
            print(f"Error in search command: {type(e).__name__}: {e}")
            print(traceback.format_exc())
            await response_msg.edit(content=f"❌ An error occurred: {str(e)[:1000]}")
    
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
    
    @commands.command(name="songinfo", help="Display information about a song")
    async def songinfo_command(self, ctx, *, song_name: str):
        """Display detailed information about a song
        
        Args:
            ctx: Command context
            song_name: Name of the song to search for
        """
        response_msg = await ctx.send(f"🔍 Searching for '{song_name}'...")
        
        try:
            matching_songs = await self.search_songs_by_name(song_name)
            
            if not matching_songs:
                await response_msg.edit(content=f"❌ No songs found matching '{song_name}'")
                return
            
            # Handle multiple matches with song selection
            selected_song = await self.handle_song_selection(ctx, response_msg, matching_songs)
            if not selected_song:
                return
            
            await response_msg.edit(content=f"📝 Fetching details for '{selected_song.get('name')}'...")
            
            embed = self.format_song_info_embed(selected_song)
            embed.add_field(
                name="Commands", 
                value=f"Use `!leaderboard {selected_song.get('name')}` to view the leaderboard for this song.",
                inline=False
            )
            
            await response_msg.edit(content=None, embed=embed)
            
        except Exception as e:
            import traceback
            print(f"Error in songinfo command: {type(e).__name__}: {e}")
            print(traceback.format_exc())
            await response_msg.edit(content=f"❌ An error occurred: {str(e)[:1000]}")
    
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
        
        if not songs:
            embed.add_field(name="No songs found", value="Try a different search term", inline=False)
            return embed
        
        for i, song in enumerate(songs, 1):
            song_name = song.get("name", "Unknown Song")
            artist = song.get("artist", "Unknown")
            
            field_value = f"**Artist:** {artist}"
            if song.get("charter_refs"):
                field_value += f"\n**Charter:** {', '.join(song.get('charter_refs', ['Unknown']))}"
            if song.get("scores_count"):
                field_value += f"\n**Scores:** {song.get('scores_count', 0)}"
            
            embed.add_field(
                name=f"{i}. {song_name}",
                value=field_value,
                inline=True
            )
            
            # Add an empty field after every second entry
            if i % 2 == 0 and i < len(songs):
                embed.add_field(name="\u200b", value="\u200b", inline=True)
        
        return embed
    
    def format_song_info_embed(self, song: Dict[str, Any]) -> discord.Embed:
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
        
        info_text = ""
        if song.get("album"):
            info_text += f"**Album:** {song.get('album')}\n"
        if song.get("year"):
            info_text += f"**Year:** {song.get('year')}\n"
        if song.get("genre"):
            info_text += f"**Genre:** {song.get('genre')}\n"
        if song.get("charter_refs"):
            info_text += f"**Charters:** {', '.join(song.get('charter_refs', []))}\n"
        if song.get("song_length"):
            # Convert from milliseconds to minutes:seconds
            minutes = int(song.get("song_length", 0)) // 60000
            seconds = int((song.get("song_length", 0) % 60000) / 1000)
            info_text += f"**Length:** {minutes}:{seconds:02d}\n"
            
        embed.add_field(name="Song Info", value=info_text or "No additional info available", inline=False)
        
        scores_info = ""
        scores_count = song.get("scores_count", 0)
        scores_info += f"**Total Scores:** {scores_count}\n"
        
        embed.add_field(name="Scores", value=scores_info, inline=False)
            
        return embed
    
    # Helper methods
    async def handle_song_selection(self, ctx, response_msg, matching_songs):
        """Handle selection from multiple matching songs using SongSelector
        
        Args:
            ctx: Command context
            response_msg: Message to edit with selection options
            matching_songs: List of matching songs
            
        Returns:
            Dict[str, Any] or None: Selected song or None if selection failed
        """
        if len(matching_songs) == 1:
            return matching_songs[0]
        
        selector = EnhancedSongSelector(matching_songs[:25])  # Discord limits to 25 options
        
        await response_msg.edit(
            content="Please select a song:",
            view=selector
        )
        await selector.wait()
        
        return selector.selected_song

    # Temporary API methods until DMBotAPI is fully implemented
    async def search_songs_by_name(self, song_name: str) -> List[Dict[str, Any]]:
        """Search for songs by name from the API"""
        try:
            await self.api.ensure_session()
            
            async with self.api.session.get(f"{self.api_url}/api/songs") as response:
                if response.status != 200:
                    return []
                
                songs = await response.json()
                # Filter songs by name (case-insensitive partial match)
                song_name_lower = song_name.lower()
                matching_songs = [
                    song for song in songs 
                    if song_name_lower in song.get("name", "").lower()
                ]
                
                # Sort by exact match first, then by popularity
                matching_songs.sort(key=lambda s: (
                    0 if s.get("name", "").lower() == song_name_lower else 1,
                    -(s.get("scores_count", 0) or 0)
                ))
                
                return matching_songs[:10]  # Return top 10 matches
        except Exception as e:
            print(f"Error searching songs: {e}")
            return []


class EnhancedSongSelector(SongSelector):
    """Enhanced version of SongSelector with implemented callbacks"""
    
    async def _on_select(self, interaction: discord.Interaction):
        """Handle song selection"""
        selected_index = int(interaction.data["values"][0])
        self.selected_song = self.songs[selected_index]
        
        await interaction.response.defer()
        
        for item in self.children:
            item.disabled = True
        
        await interaction.message.edit(
            content=f"Selected: {self.selected_song.get('name')} by {self.selected_song.get('artist')}",
            view=self
        )
        
        self.stop()
    
    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.red)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Cancel selection"""
        await interaction.response.defer()
        
        self.selected_song = None
        
        for item in self.children:
            item.disabled = True
        
        await interaction.message.edit(content="Song selection cancelled.", view=self)
        
        self.stop()


async def setup(bot):
    await bot.add_cog(Songs(bot)) 