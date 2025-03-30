import discord
from discord.ext import commands
import asyncio
from typing import List, Dict, Any
from bot.utils.api_client import DMBotAPI
from bot.utils.ui import SongSelector, PaginatedView

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
            matching_songs = await self.api.search_songs(query)
            
            if not matching_songs:
                await response_msg.edit(content=f"❌ No songs found matching '{query}'")
                return
            
            total_found = len(matching_songs)
            description = f"Found {total_found} songs matching your search"
            
            if total_found > 10:
                def format_page(page_data, page_num):
                    start_idx = page_num * 10 + 1  # 1-based indexing for display
                    return self.format_song_list_embed(
                        page_data,
                        f"Search Results for '{query}'",
                        f"Showing results {start_idx}-{start_idx+len(page_data)-1} of {total_found}",
                        start_index=start_idx
                    )
                
                view = PaginatedView(
                    data=matching_songs,
                    format_page_func=format_page
                )
                view.message = response_msg
                
                embed = format_page(matching_songs[:10], 0)
                await response_msg.edit(content=None, embed=embed, view=view)
            else:
                embed = self.format_song_list_embed(
                    matching_songs,
                    f"Search Results for '{query}'",
                    description
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
        response_msg = await ctx.send("🎵 Fetching most popular songs...")
        
        try:
            popular_songs = await self.api.get_popular_songs()
            
            if not popular_songs:
                await response_msg.edit(content="❌ No popular songs data available at this time")
                return
            
            if len(popular_songs) > 10:
                def format_page(page_data, page_num):
                    start_idx = page_num * 10 + 1  # 1-based indexing for display
                    return self.format_song_list_embed(
                        page_data,
                        "Most Popular Songs",
                        f"Showing results {start_idx}-{start_idx+len(page_data)-1} of {len(popular_songs)}",
                        start_index=start_idx
                    )
                
                view = PaginatedView(
                    data=popular_songs,
                    format_page_func=format_page
                )
                view.message = response_msg
                
                embed = format_page(popular_songs[:10], 0)
                await response_msg.edit(content=None, embed=embed, view=view)
            else:
                embed = self.format_song_list_embed(
                    popular_songs,
                    "Most Popular Songs",
                    "Songs with the most plays across all users"
                )
                await response_msg.edit(content=None, embed=embed)
            
        except Exception as e:
            import traceback
            print(f"Error in popular command: {type(e).__name__}: {e}")
            print(traceback.format_exc())
            await response_msg.edit(content=f"❌ An error occurred: {str(e)[:1000]}")
    
    @commands.command(name="recent", help="Show recently played songs")
    async def recent(self, ctx):
        """Show recently played songs across all users
        
        Args:
            ctx: Command context
        """
        response_msg = await ctx.send("🎵 Fetching recently played songs...")
        
        try:
            recent_songs = await self.api.get_recent_songs()
            
            if not recent_songs:
                await response_msg.edit(content="❌ No recent song data available at this time")
                return
            
            if len(recent_songs) > 10:
                def format_page(page_data, page_num):
                    start_idx = page_num * 10 + 1  # 1-based indexing for display
                    return self.format_song_list_embed(
                        page_data,
                        "Recently Played Songs",
                        f"Showing results {start_idx}-{start_idx+len(page_data)-1} of {len(recent_songs)}",
                        start_index=start_idx
                    )
                
                view = PaginatedView(
                    data=recent_songs,
                    format_page_func=format_page
                )
                view.message = response_msg
                
                embed = format_page(recent_songs[:10], 0)
                await response_msg.edit(content=None, embed=embed, view=view)
            else:
                embed = self.format_song_list_embed(
                    recent_songs,
                    "Recently Played Songs",
                    "Songs that have been played most recently"
                )
                await response_msg.edit(content=None, embed=embed)
            
        except Exception as e:
            import traceback
            print(f"Error in recent command: {type(e).__name__}: {e}")
            print(traceback.format_exc())
            await response_msg.edit(content=f"❌ An error occurred: {str(e)[:1000]}")
    
    @commands.command(name="songinfo", help="Display information about a song")
    async def songinfo_command(self, ctx, *, song_name: str):
        """Display detailed information about a song
        
        Args:
            ctx: Command context
            song_name: Name of the song to search for
        """
        response_msg = await ctx.send(f"🔍 Searching for '{song_name}'...")
        
        try:
            matching_songs = await self.api.search_songs(song_name)
            
            if not matching_songs:
                await response_msg.edit(content=f"❌ No songs found matching '{song_name}'")
                return
            
            # Handle multiple matches with song selection
            selected_song = await self.handle_song_selection(ctx, response_msg, matching_songs)
            if not selected_song:
                return
            
            # Get detailed song info if we have an ID
            if selected_song.get("id"):
                detailed_song = await self.api.get_song_details(selected_song.get("id"))
                if detailed_song:
                    selected_song = detailed_song
            
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
    
    def format_song_list_embed(self, songs: List[Dict[str, Any]], title: str, description: str = None, start_index: int = 1) -> discord.Embed:
        """Format a list of songs into a Discord embed
        
        Args:
            songs: List of song data
            title: Embed title
            description: Optional embed description
            start_index: Starting index for song numbering (for pagination)
            
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
        
        for i, song in enumerate(songs, start_index):
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
            if (i - start_index + 1) % 2 == 0 and (i - start_index + 1) <= len(songs):
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
        
        # Create a SongSelector view
        selector = SongSelector(matching_songs[:25])  # Discord limits to 25 options
        
        await response_msg.edit(
            content="Please select a song:",
            view=selector
        )
        
        selector.message = response_msg
        
        await selector.wait()
        
        return selector.selected_song

async def setup(bot):
    await bot.add_cog(Songs(bot)) 