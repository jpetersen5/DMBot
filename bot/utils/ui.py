import discord
from discord.ext import commands
import asyncio
from typing import List, Dict, Any, Callable, Optional

class PaginatedView(discord.ui.View):
    """A view with pagination controls for large datasets"""
    
    def __init__(self, data: List[Any], format_page_func: Callable, timeout: float = 180.0):
        """Initialize a paginated view
        
        Args:
            data: List of data items to paginate
            format_page_func: Function to format a page of data into an embed
            timeout: Timeout for the view in seconds
        """
        super().__init__(timeout=timeout)
        self.data = data
        self.format_page_func = format_page_func
        self.current_page = 0
        self.total_pages = max(1, (len(data) + 9) // 10)  # Ceiling division by 10
        self.last_interaction_time = 0
        self.message = None
        
        # Update button labels and states
        self._update_buttons()
    
    def _update_buttons(self):
        """Update button states based on current page"""
        self.first_page.disabled = (self.current_page == 0)
        self.prev_page.disabled = (self.current_page == 0)
        self.page_counter.label = f"Page {self.current_page + 1}/{self.total_pages}"
        self.next_page.disabled = (self.current_page >= self.total_pages - 1)
        self.last_page.disabled = (self.current_page >= self.total_pages - 1)
    
    async def on_timeout(self):
        """Disable all buttons when the view times out"""
        for item in self.children:
            item.disabled = True
        
        if self.message:
            try:
                await self.message.edit(view=self)
            except Exception as e:
                print(f"Error disabling buttons on timeout: {e}")
    
    @discord.ui.button(emoji="⏪", style=discord.ButtonStyle.blurple)
    async def first_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Go to first page"""
        await interaction.response.defer()
        await self._handle_page_change(interaction, 0)
    
    @discord.ui.button(emoji="◀️", style=discord.ButtonStyle.secondary)
    async def prev_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Go to previous page"""
        await interaction.response.defer()
        await self._handle_page_change(interaction, max(0, self.current_page - 1))
    
    @discord.ui.button(label="Page 1/1", style=discord.ButtonStyle.grey, disabled=True)
    async def page_counter(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Page counter label (not clickable)"""
        await interaction.response.defer()
        try:
            await interaction.followup.send("This button just shows the current page number.", ephemeral=True)
        except:
            pass
    
    @discord.ui.button(emoji="▶️", style=discord.ButtonStyle.secondary)
    async def next_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Go to next page"""
        await interaction.response.defer()
        await self._handle_page_change(interaction, min(self.total_pages - 1, self.current_page + 1))
    
    @discord.ui.button(emoji="⏩", style=discord.ButtonStyle.blurple)
    async def last_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Go to last page"""
        await interaction.response.defer()
        await self._handle_page_change(interaction, self.total_pages - 1)
    
    async def _handle_page_change(self, interaction, new_page):
        """Handle page change, update embed with new data"""
        try:
            # Add throttling to prevent rate limits
            current_time = asyncio.get_event_loop().time()
            time_since_last = current_time - self.last_interaction_time
            if time_since_last < 1.0 and self.last_interaction_time > 0:
                # Add a small delay if interactions are too frequent
                await asyncio.sleep(1.0 - time_since_last)
            
            self.last_interaction_time = asyncio.get_event_loop().time()
            
            self.current_page = new_page
            self._update_buttons()
            
            start_idx = self.current_page * 10
            end_idx = min(start_idx + 10, len(self.data))
            page_data = self.data[start_idx:end_idx]
            
            embed = self.format_page_func(page_data, self.current_page)
            
            await interaction.message.edit(embed=embed, view=self)
            
        except Exception as e:
            import traceback
            print(f"Error handling page change: {type(e).__name__}: {e}")
            print(traceback.format_exc())
            try:
                await interaction.followup.send(f"Error: {type(e).__name__}. Please try again.", ephemeral=True)
            except:
                pass


class SongSelector(discord.ui.View):
    """A view for selecting songs from a dropdown menu"""
    
    def __init__(self, songs: List[Dict[str, Any]], timeout: float = 180.0):
        """Initialize a song selector
        
        Args:
            songs: List of song data to select from
            timeout: Timeout for the view in seconds
        """
        super().__init__(timeout=timeout)
        self.songs = songs
        self.selected_song = None
        self.message = None
        
        self.add_item(SongDropdown(songs))
        self.add_item(discord.ui.Button(
            label="Cancel",
            style=discord.ButtonStyle.red,
            custom_id="song_select_cancel"
        ))
    
    async def _on_select(self, interaction: discord.Interaction):
        """Handle song selection from dropdown"""
        try:
            if interaction.data and "values" in interaction.data:
                selected_index = int(interaction.data["values"][0])
                self.selected_song = self.songs[selected_index]
                
                song_name = self.selected_song.get("name", "Unknown Song")
                artist = self.selected_song.get("artist", "Unknown Artist")
                await interaction.response.edit_message(
                    content=f"Selected: {song_name} by {artist}",
                    view=None
                )
                
                self.stop()
            else:
                await interaction.response.defer()
                await interaction.followup.send("Error processing selection. Please try again.", ephemeral=True)
        except Exception as e:
            print(f"Error in song selection: {type(e).__name__}: {e}")
            try:
                await interaction.response.defer()
                await interaction.followup.send(f"Error: {type(e).__name__}. Please try again.", ephemeral=True)
            except:
                pass
    
    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        """Check if the interaction is from a button or select menu we need to handle"""
        if interaction.data and interaction.data.get("custom_id") == "song_select_cancel":
            await self.handle_cancel(interaction)
            return False
        return True
    
    async def handle_cancel(self, interaction: discord.Interaction):
        """Cancel the song selection"""
        try:
            await interaction.response.edit_message(content="Song selection cancelled.", view=None)
            self.selected_song = None
            self.stop()
        except Exception as e:
            print(f"Error cancelling song selection: {e}")
            try:
                await interaction.response.defer()
                await interaction.followup.send("Failed to cancel selection.", ephemeral=True)
            except:
                pass
    
    async def on_timeout(self):
        """Disable all items when the view times out"""
        for item in self.children:
            item.disabled = True
        
        try:
            if self.message:
                await self.message.edit(content="Song selection timed out.", view=self)
        except Exception as e:
            print(f"Error handling timeout: {e}")


class SongDropdown(discord.ui.Select):
    """Dropdown for selecting a song"""
    
    def __init__(self, songs: List[Dict[str, Any]]):
        # Create options for each song (up to 25 - Discord's limit)
        options = []
        for i, song in enumerate(songs[:25]):
            song_name = song.get("name", "Unknown Song")
            artist = song.get("artist", "Unknown Artist")
            
            # Truncate if too long for Discord's limits
            if len(song_name) > 80:
                song_name = song_name[:77] + "..."
            
            description = f"By {artist}"
            if len(description) > 100:
                description = description[:97] + "..."
            
            options.append(
                discord.SelectOption(
                    label=song_name,
                    description=description,
                    value=str(i),
                    emoji="🎵"
                )
            )
        
        super().__init__(
            placeholder="Select a song...",
            min_values=1,
            max_values=1,
            options=options
        )
    
    async def callback(self, interaction: discord.Interaction):
        """Called when a selection is made"""
        view = self.view
        await view._on_select(interaction)


class ConfirmationView(discord.ui.View):
    """View for confirming an action"""
    
    def __init__(self, timeout: float = 60.0):
        """Initialize a confirmation view
        
        Args:
            timeout: Timeout for the view in seconds
        """
        super().__init__(timeout=timeout)
        self.value = None
        self.message = None
    
    @discord.ui.button(label="Confirm", style=discord.ButtonStyle.green)
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Confirm the action"""
        await interaction.response.defer()
        
        self.value = True
        
        for item in self.children:
            item.disabled = True
            
        await interaction.message.edit(content="Action confirmed.", view=self)
        self.stop()
    
    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.red)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Cancel the action"""
        await interaction.response.defer()
        
        self.value = False
        
        for item in self.children:
            item.disabled = True
            
        await interaction.message.edit(content="Action cancelled.", view=self)
        self.stop()
    
    async def on_timeout(self):
        """Handle timeout"""
        self.value = None
        
        for item in self.children:
            item.disabled = True
            
        if self.message:
            try:
                await self.message.edit(content="Confirmation timed out.", view=self)
            except:
                pass


# Test UI components for development
if __name__ == "__main__":
    # Add example code for testing UI components
    pass 