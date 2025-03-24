import discord
from discord.ext import commands
import aiohttp
import json
import asyncio
from typing import List, Dict, Any, Optional
import os
from datetime import datetime, timezone

class ScoresPaginator(discord.ui.View):
    def __init__(self, user: Dict[str, Any], scores: List[Dict[str, Any]], format_embed_func, timeout: float = 180.0):
        super().__init__(timeout=timeout)  # Increased timeout to 3 minutes
        self.user = user
        self.scores = scores
        self.format_embed_func = format_embed_func
        self.current_page = 0
        self.total_pages = max(1, (len(scores) + 9) // 10)  # Ceiling division to get total pages
        self.message = None
        self.last_interaction_time = 0  # Track the last time an interaction was handled
        
        # Update button states
        self._update_buttons()
    
    def _update_buttons(self):
        # Disable/enable buttons based on current page
        self.first_page.disabled = self.current_page == 0
        self.prev_page.disabled = self.current_page == 0
        self.next_page.disabled = self.current_page == self.total_pages - 1
        self.last_page.disabled = self.current_page == self.total_pages - 1
        
        # Update page counter label
        self.page_counter.label = f"Page {self.current_page + 1}/{self.total_pages}"
    
    async def on_timeout(self):
        # Disable all buttons on timeout
        for item in self.children:
            item.disabled = True
        
        if self.message:
            try:
                await self.message.edit(view=self)
            except Exception as e:
                print(f"Error disabling buttons on timeout: {e}")
    
    async def _handle_page_change(self, interaction, new_page):
        """Common handler for page changes to reduce code duplication"""
        try:
            # Add throttling to prevent rate limits
            current_time = asyncio.get_event_loop().time()
            time_since_last = current_time - self.last_interaction_time
            if time_since_last < 1.0 and self.last_interaction_time > 0:
                # Add a small delay if interactions are too frequent
                await asyncio.sleep(1.0 - time_since_last)
                
            # Update the timestamp
            self.last_interaction_time = asyncio.get_event_loop().time()
            
            # Update the current page and buttons
            self.current_page = new_page
            self._update_buttons()
            
            # Create the embed
            embed = self.format_embed_func(self.user, self.scores, self.current_page)
            
            # Edit the message with the new content - interaction is already deferred in the button handler
            await interaction.message.edit(embed=embed, view=self)
            print(f"Successfully updated to page {self.current_page + 1}")
            
        except discord.errors.HTTPException as http_error:
            print(f"HTTP Exception in page change: {http_error}")
            if http_error.code == 429:
                print(f"Rate limited! Retry after: {http_error.retry_after} seconds")
                try:
                    # Create a follow-up message to inform the user
                    await interaction.followup.send("Rate limited! Please try again in a few seconds.", ephemeral=True)
                except:
                    print("Failed to send rate limit message")
            else:
                try:
                    await interaction.followup.send(f"HTTP error: {http_error.status}", ephemeral=True)
                except:
                    print("Failed to send HTTP error message")
        except Exception as e:
            # Log the error in detail
            import traceback
            print(f"Error handling page change: {type(e).__name__}: {e}")
            print(traceback.format_exc())
            try:
                # Create a follow-up message to inform the user
                await interaction.followup.send(f"Error: {type(e).__name__}. Please try again.", ephemeral=True)
            except Exception as follow_up_error:
                print(f"Failed to send error message: {follow_up_error}")
    
    @discord.ui.button(emoji="⏪", style=discord.ButtonStyle.blurple)
    async def first_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            # First, immediately defer the response 
            await interaction.response.defer()
            # Then handle the page change
            await self._handle_page_change(interaction, 0)
        except Exception as e:
            print(f"Error in first_page handler: {e}")
    
    @discord.ui.button(emoji="◀️", style=discord.ButtonStyle.secondary)
    async def prev_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            # First, immediately defer the response 
            await interaction.response.defer()
            # Then handle the page change
            await self._handle_page_change(interaction, max(0, self.current_page - 1))
        except Exception as e:
            print(f"Error in prev_page handler: {e}")
    
    @discord.ui.button(label="Page 1/1", style=discord.ButtonStyle.grey, disabled=True)
    async def page_counter(self, interaction: discord.Interaction, button: discord.ui.Button):
        # This is just a label, does nothing on click but we need to acknowledge it
        try:
            # Immediately defer the response to prevent "This interaction failed"
            await interaction.response.defer(thinking=True)
            try:
                # Optionally send a hint message
                await interaction.followup.send("This button just shows the current page number.", ephemeral=True)
            except:
                pass
        except Exception as e:
            print(f"Error handling page_counter interaction: {e}")
    
    @discord.ui.button(emoji="▶️", style=discord.ButtonStyle.secondary)
    async def next_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            # First, immediately defer the response 
            await interaction.response.defer()
            # Then handle the page change
            await self._handle_page_change(interaction, min(self.total_pages - 1, self.current_page + 1))
        except Exception as e:
            print(f"Error in next_page handler: {e}")
    
    @discord.ui.button(emoji="⏩", style=discord.ButtonStyle.blurple)
    async def last_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            # First, immediately defer the response 
            await interaction.response.defer()
            # Then handle the page change
            await self._handle_page_change(interaction, self.total_pages - 1)
        except Exception as e:
            print(f"Error in last_page handler: {e}")

class Leaderboard(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        # Try to get API URL from environment or config, default to localhost if not found
        try:
            with open("data/env.json", "r") as f:
                env = json.load(f)
                self.api_url = env.get("API_URL", "https://dmbot-kb5j.onrender.com")
        except (FileNotFoundError, json.JSONDecodeError):
            self.api_url = "https://dmbot-kb5j.onrender.com"
            
        self.session = aiohttp.ClientSession()
        print(f"Leaderboard cog initialized with API URL: {self.api_url}")
        
    def cog_unload(self):
        # Close aiohttp session when cog is unloaded
        self.bot.loop.create_task(self.session.close())
    
    async def search_songs_by_name(self, song_name: str) -> List[Dict[str, Any]]:
        """Search for songs by name from the API"""
        try:
            async with self.session.get(f"{self.api_url}/api/songs") as response:
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
    
    async def get_leaderboard(self, song_id: str) -> List[Dict[str, Any]]:
        """Get leaderboard data for a specific song"""
        try:
            async with self.session.get(f"{self.api_url}/api/leaderboard/{song_id}") as response:
                if response.status != 200:
                    return []
                
                data = await response.json()
                return data.get("leaderboard", [])
        except Exception as e:
            print(f"Error fetching leaderboard: {e}")
            return []
    
    async def get_user_by_discord_id(self, discord_id: str) -> Optional[Dict[str, Any]]:
        """Get user profile from their Discord ID"""
        try:
            async with self.session.get(f"{self.api_url}/api/users/discord/{discord_id}") as response:
                if response.status != 200:
                    return None
                
                return await response.json()
        except Exception as e:
            print(f"Error fetching user: {e}")
            return None
    
    async def get_user_scores(self, user_id: str) -> List[Dict[str, Any]]:
        """Get a user's scores from the API"""
        try:
            async with self.session.get(f"{self.api_url}/api/user/{user_id}/scores") as response:
                if response.status != 200:
                    return []
                
                data = await response.json()
                return data.get("scores", [])
        except Exception as e:
            print(f"Error fetching user scores: {e}")
            return []
    
    async def get_song_details(self, song_ids: List[str]) -> Dict[str, Any]:
        """Get details for multiple songs by ID"""
        try:
            async with self.session.post(
                f"{self.api_url}/api/songs-by-ids", 
                json={"ids": song_ids}
            ) as response:
                if response.status != 200:
                    return {}
                
                songs = await response.json()
                return {str(song.get("id")): song for song in songs}
        except Exception as e:
            print(f"Error fetching songs: {e}")
            return {}
    
    def format_time_difference(self, timestamp_str: str) -> str:
        """Format a timestamp into a human-readable 'time ago' format"""
        try:
            now = datetime.now(timezone.utc)
            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            diff = now - timestamp
            
            seconds = int(diff.total_seconds())
            minutes = seconds // 60
            hours = minutes // 60
            days = hours // 24
            weeks = days // 7
            months = days // 30
            years = days // 365
            
            if years > 0:
                return f"{years} year{'s' if years > 1 else ''} ago"
            if months > 0:
                return f"{months} month{'s' if months > 1 else ''} ago"
            if weeks > 0:
                return f"{weeks} week{'s' if weeks > 1 else ''} ago"
            if days > 0:
                return f"{days} day{'s' if days > 1 else ''} ago"
            if hours > 0:
                return f"{hours} hour{'s' if hours > 1 else ''} ago"
            if minutes > 0:
                return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
            return f"{seconds} second{'s' if seconds != 1 else ''} ago"
        except (ValueError, AttributeError, TypeError):
            return "Unknown time"
    
    def format_leaderboard_embed(self, song: Dict[str, Any], leaderboard: List[Dict[str, Any]]) -> discord.Embed:
        """Format leaderboard data into a Discord embed"""
        try:
            embed = discord.Embed(
                title=f"Leaderboard for {song.get('name', 'Unknown Song')}",
                description=f"Artist: {song.get('artist', 'Unknown')}\nCharter: {', '.join(song.get('charter_refs', ['Unknown']))}",
                color=discord.Color.blue()
            )
            
            # Add top scores
            entries = leaderboard[:10]  # Show top 10 scores
            
            if not entries:
                embed.add_field(name="No scores found", value="Be the first to submit a score!", inline=False)
                return embed
            
            # Format each entry in its own field
            for i, entry in enumerate(entries, 1):
                try:
                    rank = entry.get("rank", "?")
                    username = entry.get("username", "Unknown")
                    score = entry.get("score", 0)
                    percent = entry.get("percent", 0)
                    is_fc = entry.get("is_fc", False)
                    
                    # Add medal for top 3 ranks
                    medal = ""
                    if rank == 1:
                        medal = "🥇 "
                    elif rank == 2:
                        medal = "🥈 "
                    elif rank == 3:
                        medal = "🥉 "
                    
                    # Format percentage display - use crown emoji for 100% FCs
                    if percent == 100 and is_fc:
                        percent_display = "👑 FC"
                    else:
                        percent_display = f"{percent:,}%" + (" ✓" if is_fc else "")
                    
                    # Format posted time if available
                    time_ago = ""
                    if entry.get("posted"):
                        time_ago = self.format_time_difference(entry["posted"])
                    
                    # Format each leaderboard entry
                    field_value = f"**Score:** {score:,}\n**Percent:** {percent_display}"
                    if time_ago:
                        field_value += f"\n**Posted:** {time_ago}"
                    
                    # Add the field to the embed with medal and underlined name for better visual separation
                    field_name = f"{medal}#{rank} __{username}__"
                    # Truncate field name if it's too long
                    if len(field_name) > 256:
                        field_name = field_name[:253] + "..."
                        
                    embed.add_field(name=field_name, value=field_value, inline=True)
                    
                    # Add an empty field after every second entry to create 2 fields per row
                    if i % 2 == 0 and i < len(entries):
                        embed.add_field(name="\u200b", value="\u200b", inline=True)
                except Exception as e:
                    print(f"Error formatting leaderboard entry {i}: {e}")
                    continue
            
            # Add footer with total entries
            embed.set_footer(text=f"Total entries: {len(leaderboard)}")
            
            # Add song image if available
            if song.get("image_url"):
                embed.set_thumbnail(url=song.get("image_url"))
            
            return embed
        except Exception as e:
            print(f"Error creating leaderboard embed: {e}")
            # Return a simple error embed if formatting fails
            error_embed = discord.Embed(
                title="Error Displaying Leaderboard",
                description="An error occurred while formatting the leaderboard. Please try again.",
                color=discord.Color.red()
            )
            return error_embed
    
    def format_user_scores_embed(self, user: Dict[str, Any], scores: List[Dict[str, Any]], page: int = 0) -> discord.Embed:
        """Format user's top scores into a Discord embed"""
        try:
            username = user.get("username", "Unknown User")
            
            # Calculate start and end indices for pagination
            start_idx = page * 10
            end_idx = min(start_idx + 10, len(scores))
            
            embed = discord.Embed(
                title=f"{username}'s Scores",
                description=f"Showing scores {start_idx + 1}-{end_idx} of {len(scores)}",
                color=discord.Color.gold()
            )
            
            if not scores:
                embed.add_field(name="No scores found", value="This user hasn't submitted any scores yet.", inline=False)
                return embed
            
            # Get scores for current page
            page_scores = scores[start_idx:end_idx]
            
            # Format each score in its own field to avoid exceeding the 1024 character limit
            for i, score in enumerate(page_scores, start_idx + 1):
                try:
                    song_name = score.get("song_name", "Unknown Song")
                    score_value = score.get("score", 0)
                    percent = score.get("percent", 0)
                    rank = score.get("rank", "?")
                    is_fc = score.get("is_fc", False)
                    
                    # Add medal for top 3 ranks
                    medal = ""
                    if rank == 1:
                        medal = "🥇 "
                    elif rank == 2:
                        medal = "🥈 "
                    elif rank == 3:
                        medal = "🥉 "
                    
                    # Format percentage display - use crown emoji for 100% FCs
                    if percent == 100 and is_fc:
                        percent_display = "👑 FC"
                    else:
                        percent_display = f"{percent:,}%" + (" ✓" if is_fc else "")
                    
                    # Format posted time if available
                    time_ago = ""
                    if score.get("posted"):
                        time_ago = self.format_time_difference(score["posted"])
                    
                    # Format the score details
                    field_value = f"**Score:** {score_value:,}\n**Percent:** {percent_display}\n**Rank:** {medal}#{rank}"
                    
                    # Add artist and posted time
                    artist = score.get("artist", "Unknown")
                    field_value += f"\n**Artist:** {artist}"
                    if time_ago:
                        field_value += f"\n**Posted:** {time_ago}"
                    
                    # Add separator line - use a shorter one to save space
                    field_value += "\n▬▬▬▬▬▬"
                    
                    # Add the field to the embed with underlined song name for better visual separation
                    field_index = i - start_idx
                    field_name = f"{i}. __{song_name}__"
                    # Truncate field name if it's too long to prevent discord API errors
                    if len(field_name) > 256:
                        field_name = field_name[:253] + "..."
                    
                    embed.add_field(name=field_name, value=field_value, inline=True)
                    
                    # Add an empty field after every second entry to create 2 fields per row
                    if field_index % 2 == 1 and field_index < len(page_scores) - 1:
                        embed.add_field(name="\u200b", value="\u200b", inline=True)
                except Exception as e:
                    print(f"Error formatting score {i}: {e}")
                    continue
            
            # Add stats if available
            if "stats" in user:
                stats = user.get("stats", {})
                stats_text = (
                    f"Total Scores: {stats.get('total_scores', 0)}\n"
                    f"Total FCs: {stats.get('total_fcs', 0)}\n"
                    f"Average Percent: {stats.get('avg_percent', 0):.2f}%"
                )
                embed.add_field(name="Stats", value=stats_text, inline=False)
            
            # Add user profile pic if available
            if user.get("avatar"):
                # Properly format Discord avatar URL
                user_id = user.get("id")
                avatar_hash = user.get("avatar")
                avatar_url = f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png"
                embed.set_thumbnail(url=avatar_url)
            
            return embed
        except Exception as e:
            print(f"Error creating scores embed: {e}")
            # Return a simple error embed if formatting fails
            error_embed = discord.Embed(
                title="Error Displaying Scores",
                description=f"An error occurred while formatting the scores. Please try again.",
                color=discord.Color.red()
            )
            return error_embed
    
    def format_song_info_embed(self, song: Dict[str, Any]) -> discord.Embed:
        """Format song information into a Discord embed"""
        embed = discord.Embed(
            title=song.get("name", "Unknown Song"),
            description=f"Artist: {song.get('artist', 'Unknown')}",
            color=discord.Color.green()
        )
        
        # Basic info
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
        
        # Score info
        scores_info = ""
        scores_count = song.get("scores_count", 0)
        scores_info += f"**Total Scores:** {scores_count}\n"
        
        # Add leaderboard link if applicable
        embed.add_field(name="Scores", value=scores_info, inline=False)
        
        # Add image if available
        if song.get("image_url"):
            embed.set_thumbnail(url=song.get("image_url"))
            
        return embed
    
    @commands.command(name="leaderboard", help="Display the leaderboard for a song")
    async def leaderboard_command(self, ctx, *, song_name: str):
        """Command to display a song's leaderboard"""
        # Send initial response
        response_msg = await ctx.send(f"🔍 Searching for '{song_name}'...")
        
        try:
            # Search for the song
            matching_songs = await self.search_songs_by_name(song_name)
            
            if not matching_songs:
                await response_msg.edit(content=f"❌ No songs found matching '{song_name}'")
                return
            
            # If we have multiple matches, show selection
            if len(matching_songs) > 1:
                selection_text = "Found multiple matches. Reply with the number to select:\n\n"
                for i, song in enumerate(matching_songs, 1):
                    song_name = song.get("name", "Unknown")
                    artist = song.get("artist", "Unknown")
                    selection_text += f"**{i}.** {song_name} by {artist}\n"
                
                await response_msg.edit(content=selection_text)
                
                # Wait for user selection
                try:
                    selection_response = await self.bot.wait_for(
                        "message",
                        check=lambda m: m.author == ctx.author and m.channel == ctx.channel and m.content.isdigit(),
                        timeout=30.0
                    )
                    
                    selection = int(selection_response.content)
                    if selection < 1 or selection > len(matching_songs):
                        await response_msg.edit(content="❌ Invalid selection. Try again with a valid number.")
                        return
                    
                    selected_song = matching_songs[selection - 1]
                except asyncio.TimeoutError:
                    await response_msg.edit(content="⏱️ Selection timed out. Please try again.")
                    return
            else:
                # Only one match, use it directly
                selected_song = matching_songs[0]
            
            # Get leaderboard data
            await response_msg.edit(content=f"📊 Fetching leaderboard data for '{selected_song.get('name')}'...")
            
            leaderboard = await self.get_leaderboard(selected_song.get("id"))
            
            if not leaderboard:
                await response_msg.edit(content=f"📊 No leaderboard entries found for '{selected_song.get('name')}'.")
                return
            
            # Create the initial embed
            embed = self.format_leaderboard_embed(selected_song, leaderboard)
            
            # Create paginator view if there are many entries
            if len(leaderboard) > 10:
                # Format the leaderboard function to match paginator expected format
                def format_leaderboard_page(_, entries, page):
                    # Calculate start and end indices for pagination
                    start_idx = page * 10
                    end_idx = min(start_idx + 10, len(entries))
                    page_entries = entries[start_idx:end_idx]
                    return self.format_leaderboard_embed(selected_song, page_entries)
                
                view = ScoresPaginator(
                    user={"username": selected_song.get("name")},  # Just need username for logging
                    scores=leaderboard,
                    format_embed_func=format_leaderboard_page
                )
                
                # Set the message reference first
                view.message = response_msg
                
                # Send the paginator view and embed together
                await response_msg.edit(content=None, embed=embed, view=view)
                
                print(f"Leaderboard paginator created with {len(leaderboard)} entries for {selected_song.get('name')}")
            else:
                # Just show the embed without pagination for small leaderboards
                await response_msg.edit(content=None, embed=embed)
            
        except Exception as e:
            print(f"Error in leaderboard command: {type(e).__name__}: {e}")
            await response_msg.edit(content=f"❌ An error occurred while fetching the leaderboard: {str(e)[:1000]}")
    
    @commands.command(name="scores", help="Display a user's recent scores with pagination")
    async def scores_command(self, ctx, member: Optional[discord.Member] = None):
        """Command to display a user's scores with pagination"""
        # If no member is specified, use the command author
        target_member = member or ctx.author
        
        # Send initial response
        response_msg = await ctx.send(f"🔍 Looking up scores for {target_member.display_name}...")
        
        try:
            # Get user from API using their Discord ID
            user = await self.get_user_by_discord_id(str(target_member.id))
            
            if not user:
                await response_msg.edit(content=f"❌ User {target_member.display_name} not found in the database. They may need to log in to the web app first.")
                return
            
            # Get user's scores
            await response_msg.edit(content=f"📊 Fetching scores for {target_member.display_name}...")
            scores = await self.get_user_scores(user.get("id"))
            
            if not scores:
                await response_msg.edit(content=f"📊 {target_member.display_name} hasn't submitted any scores yet.")
                return
            
            # Sort scores by posted date (most recent first)
            scores.sort(key=lambda s: s.get("posted", ""), reverse=True)
            
            # Limit to a reasonable number of scores to prevent performance issues
            MAX_SCORES = 100  # Limit to 100 scores (10 pages)
            if len(scores) > MAX_SCORES:
                await response_msg.edit(content=f"⚠️ {target_member.display_name} has {len(scores)} scores. Showing only the {MAX_SCORES} most recent scores.")
                scores = scores[:MAX_SCORES]
            
            # Create the initial embed
            embed = self.format_user_scores_embed(user, scores, 0)
            
            # Create paginator view
            view = ScoresPaginator(
                user=user, 
                scores=scores, 
                format_embed_func=self.format_user_scores_embed
            )
            
            # Set the message reference first
            view.message = response_msg
            
            # Send the paginator view and embed together
            await response_msg.edit(content=None, embed=embed, view=view)
            
            print(f"Paginator created successfully with {len(scores)} scores for {user.get('username')}")
            
        except Exception as e:
            print(f"Error in scores command: {type(e).__name__}: {e}")
            await response_msg.edit(content=f"❌ An error occurred while fetching scores: {str(e)[:1000]}")
    
    @commands.command(name="songinfo", help="Display information about a song")
    async def songinfo_command(self, ctx, *, song_name: str):
        """Command to display detailed information about a song"""
        # Send initial response
        response_msg = await ctx.send(f"🔍 Searching for '{song_name}'...")
        
        try:
            # Search for the song
            matching_songs = await self.search_songs_by_name(song_name)
            
            if not matching_songs:
                await response_msg.edit(content=f"❌ No songs found matching '{song_name}'")
                return
            
            # If we have multiple matches, show selection
            if len(matching_songs) > 1:
                selection_text = "Found multiple matches. Reply with the number to select:\n\n"
                for i, song in enumerate(matching_songs, 1):
                    song_name = song.get("name", "Unknown")
                    artist = song.get("artist", "Unknown")
                    selection_text += f"**{i}.** {song_name} by {artist}\n"
                
                await response_msg.edit(content=selection_text)
                
                # Wait for user selection
                try:
                    selection_response = await self.bot.wait_for(
                        "message",
                        check=lambda m: m.author == ctx.author and m.channel == ctx.channel and m.content.isdigit(),
                        timeout=30.0
                    )
                    
                    selection = int(selection_response.content)
                    if selection < 1 or selection > len(matching_songs):
                        await response_msg.edit(content="❌ Invalid selection. Try again with a valid number.")
                        return
                    
                    selected_song = matching_songs[selection - 1]
                except asyncio.TimeoutError:
                    await response_msg.edit(content="⏱️ Selection timed out. Please try again.")
                    return
            else:
                # Only one match, use it directly
                selected_song = matching_songs[0]
            
            # Get detailed song info if needed
            await response_msg.edit(content=f"📝 Fetching details for '{selected_song.get('name')}'...")
            
            # Format song info into embed
            embed = self.format_song_info_embed(selected_song)
            
            # Add command hints
            embed.add_field(
                name="Commands", 
                value=f"Use `!leaderboard {selected_song.get('name')}` to view the leaderboard for this song.",
                inline=False
            )
            
            await response_msg.edit(content=None, embed=embed)
            
        except Exception as e:
            print(f"Error in songinfo command: {e}")
            await response_msg.edit(content=f"❌ An error occurred while fetching song information: {str(e)[:1000]}")

async def setup(bot):
    # Import asyncio inside the setup function to avoid circular import
    await bot.add_cog(Leaderboard(bot)) 