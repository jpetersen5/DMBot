import discord
from discord.ext import commands
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from bot.utils.api_client import DMBotAPI
from bot.utils.ui import PaginatedView, SongSelector

class Leaderboard(commands.Cog):
    """Commands for viewing and interacting with song leaderboards"""
    
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
        
        print(f"Leaderboard cog initialized with API URL: {self.api_url}")
    
    def cog_unload(self):
        """Clean up when cog is unloaded"""
        asyncio.create_task(self.api.close())
    
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
    
    def format_leaderboard_embed(self, song: Dict[str, Any], leaderboard: List[Dict[str, Any]], 
                                page: int = 0) -> discord.Embed:
        """Format leaderboard data into a Discord embed"""
        try:
            # Calculate page indices if this is a subset
            start_idx = page * 10
            end_idx = min(start_idx + 10, len(leaderboard))
            total_entries = len(leaderboard)
            
            # Create the embed
            embed = discord.Embed(
                title=f"Leaderboard for {song.get('name', 'Unknown Song')}",
                description=f"Artist: {song.get('artist', 'Unknown')}\nCharter: {', '.join(song.get('charter_refs', ['Unknown']))}",
                color=discord.Color.blue()
            )
            
            if start_idx < end_idx:
                embed.description += f"\nShowing entries {start_idx+1}-{end_idx} of {total_entries}"
            
            # Add song image if available
            if song.get("image_url"):
                embed.set_thumbnail(url=song.get("image_url"))
            
            # Add footer with total entries
            embed.set_footer(text=f"Total entries: {total_entries}")
            
            # If no entries, show a message
            if not leaderboard:
                embed.add_field(name="No scores found", value="Be the first to submit a score!", inline=False)
                return embed
            
            # Format each entry
            for i, entry in enumerate(leaderboard[start_idx:end_idx], start_idx + 1):
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
                    
                    # Add the field to the embed
                    field_name = f"{medal}#{rank} __{username}__"
                    # Truncate field name if it's too long
                    if len(field_name) > 256:
                        field_name = field_name[:253] + "..."
                        
                    embed.add_field(name=field_name, value=field_value, inline=True)
                    
                    # Add an empty field after every second entry for formatting
                    if (i - start_idx) % 2 == 1 and i < end_idx - 1:
                        embed.add_field(name="\u200b", value="\u200b", inline=True)
                        
                except Exception as e:
                    print(f"Error formatting leaderboard entry {i}: {e}")
                    continue
            
            return embed
            
        except Exception as e:
            print(f"Error creating leaderboard embed: {e}")
            return discord.Embed(
                title="Error Displaying Leaderboard",
                description="An error occurred while formatting the leaderboard. Please try again.",
                color=discord.Color.red()
            )
    
    def format_user_scores_embed(self, user: Dict[str, Any], scores: List[Dict[str, Any]], 
                                page: int = 0) -> discord.Embed:
        """Format user's scores into a Discord embed"""
        try:
            username = user.get("username", "Unknown User")
            
            # Calculate page indices
            start_idx = page * 10
            end_idx = min(start_idx + 10, len(scores))
            total_scores = len(scores)
            
            embed = discord.Embed(
                title=f"{username}'s Scores",
                description=f"Showing scores {start_idx + 1}-{end_idx} of {total_scores}",
                color=discord.Color.gold()
            )
            
            # Add user avatar if available
            if user.get("avatar"):
                user_id = user.get("id")
                avatar_hash = user.get("avatar")
                avatar_url = f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png"
                embed.set_thumbnail(url=avatar_url)
            
            # If no scores, show a message
            if not scores:
                embed.add_field(name="No scores found", value="This user hasn't submitted any scores yet.", inline=False)
                return embed
            
            # Get scores for current page
            page_scores = scores[start_idx:end_idx]
            
            # Format each score
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
                    
                    # Format percentage display
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
                    
                    # Add the field to the embed
                    field_index = i - start_idx
                    field_name = f"{i}. __{song_name}__"
                    # Truncate field name if it's too long
                    if len(field_name) > 256:
                        field_name = field_name[:253] + "..."
                    
                    embed.add_field(name=field_name, value=field_value, inline=True)
                    
                    # Add an empty field after every second entry for formatting
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
            
            return embed
            
        except Exception as e:
            print(f"Error creating scores embed: {e}")
            return discord.Embed(
                title="Error Displaying Scores",
                description="An error occurred while formatting the scores. Please try again.",
                color=discord.Color.red()
            )
    
    @commands.command(name="leaderboard", help="Display the leaderboard for a song")
    async def leaderboard_command(self, ctx, *, song_name: str):
        """Display a leaderboard for a specific song
        
        Args:
            ctx: Command context
            song_name: Name of the song to search for
        """
        # Send initial response
        response_msg = await ctx.send(f"🔍 Searching for '{song_name}'...")
        
        try:
            # Check if songs are cached - if not, update message
            cache_key = self.api._get_cache_key("api/songs", None)
            if not self.api._is_cache_valid(cache_key):
                await response_msg.edit(content=f"🔍 Fetching song database (this may take a moment)...")
            
            matching_songs = await self.api.search_songs(song_name)
            
            if not matching_songs:
                await response_msg.edit(content=f"❌ No songs found matching '{song_name}'")
                return
            
            # If multiple matches, use SongSelector for selection
            selected_song = await self.handle_song_selection(ctx, response_msg, matching_songs)
            if not selected_song:
                return  # Selection was canceled or timed out
            
            await response_msg.edit(content=f"📊 Fetching leaderboard for '{selected_song.get('name')}'...")
            
            leaderboard = await self.api.get_leaderboard(selected_song.get("id"))
            
            if not leaderboard:
                await response_msg.edit(content=f"📊 No leaderboard entries found for '{selected_song.get('name')}'.")
                return
            
            embed = self.format_leaderboard_embed(selected_song, leaderboard, 0)
            
            if len(leaderboard) > 10:
                def format_page(page_data, page_num):
                    return self.format_leaderboard_embed(selected_song, leaderboard, page_num)
                
                view = PaginatedView(
                    data=leaderboard,
                    format_page_func=format_page
                )
                view.message = response_msg
                await response_msg.edit(content=None, embed=embed, view=view)
            else:
                # Just show the embed without pagination
                await response_msg.edit(content=None, embed=embed)
            
        except Exception as e:
            import traceback
            print(f"Error in leaderboard command: {type(e).__name__}: {e}")
            print(traceback.format_exc())
            await response_msg.edit(content=f"❌ An error occurred: {str(e)[:1000]}")
    
    @commands.command(name="scores", help="Display a user's scores with pagination")
    async def scores_command(self, ctx, member: Optional[discord.Member] = None):
        """Display a user's scores with pagination
        
        Args:
            ctx: Command context
            member: Optional Discord member (defaults to command author)
        """
        target_member = member or ctx.author
        
        # Send initial response
        response_msg = await ctx.send(f"🔍 Looking up scores for {target_member.display_name}...")
        
        try:
            user = await self.api.get_user_by_discord_id(str(target_member.id))
            
            if not user:
                await response_msg.edit(content=f"❌ User {target_member.display_name} not found in the database. They may need to log in to the web app first.")
                return
            
            await response_msg.edit(content=f"📊 Fetching scores for {target_member.display_name}...")
            scores = await self.api.get_user_scores(user.get("id"))
            
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
            
            embed = self.format_user_scores_embed(user, scores, 0)
            
            def format_page(page_data, page_num):
                return self.format_user_scores_embed(user, scores, page_num)
            
            view = PaginatedView(
                data=scores,
                format_page_func=format_page
            )
            view.message = response_msg
            
            await response_msg.edit(content=None, embed=embed, view=view)
            
        except Exception as e:
            import traceback
            print(f"Error in scores command: {type(e).__name__}: {e}")
            print(traceback.format_exc())
            await response_msg.edit(content=f"❌ An error occurred: {str(e)[:1000]}")
    
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
        
        selector = SongSelector(matching_songs[:25])  # Discord limits to 25 options
        
        await response_msg.edit(
            content="Please select a song: (Limited to 25 options)",
            view=selector
        )
        
        selector.message = response_msg
        
        await selector.wait()
        
        return selector.selected_song


async def setup(bot):
    await bot.add_cog(Leaderboard(bot)) 