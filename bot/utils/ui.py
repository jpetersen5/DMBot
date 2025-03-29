import discord
from discord.ext import commands
import asyncio
from typing import List, Dict, Any, Callable, Optional

class PaginatedView(discord.ui.View):
    """Base view for paginated content"""
    
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
        self.total_pages = max(1, (len(data) + 9) // 10)  # Ceiling division
        self.message = None
        self.last_interaction_time = 0
        
        # Update button states
        self._update_buttons()
    
    def _update_buttons(self):
        """Update button states based on current page"""
        self.first_page.disabled = self.current_page == 0
        self.prev_page.disabled = self.current_page == 0
        self.next_page.disabled = self.current_page == self.total_pages - 1
        self.last_page.disabled = self.current_page == self.total_pages - 1
        
        # Update page counter label
        self.page_counter.label = f"Page {self.current_page + 1}/{self.total_pages}"
    
    async def on_timeout(self):
        """Handle view timeout by disabling all buttons"""
        for item in self.children:
            item.disabled = True
        
        if self.message:
            try:
                await self.message.edit(view=self)
            except Exception as e:
                print(f"Error disabling buttons on timeout: {e}")
    
    async def _handle_page_change(self, interaction, new_page):
        """Common handler for page changes"""
        pass
    
    @discord.ui.button(emoji="⏪", style=discord.ButtonStyle.blurple)
    async def first_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Go to first page"""
        pass
    
    @discord.ui.button(emoji="◀️", style=discord.ButtonStyle.secondary)
    async def prev_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Go to previous page"""
        pass
    
    @discord.ui.button(label="Page 1/1", style=discord.ButtonStyle.grey, disabled=True)
    async def page_counter(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Page counter label (not clickable)"""
        pass
    
    @discord.ui.button(emoji="▶️", style=discord.ButtonStyle.secondary)
    async def next_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Go to next page"""
        pass
    
    @discord.ui.button(emoji="⏩", style=discord.ButtonStyle.blurple)
    async def last_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Go to last page"""
        pass


class SongSelector(discord.ui.View):
    """View for selecting a song from multiple options"""
    
    def __init__(self, songs: List[Dict[str, Any]], timeout: float = 60.0):
        """Initialize a song selector
        
        Args:
            songs: List of song data to select from
            timeout: Timeout for the view in seconds
        """
        super().__init__(timeout=timeout)
        self.songs = songs
        self.selected_song = None
        self.message = None
        
        # Add select menu with song options
        self._add_song_select()
    
    def _add_song_select(self):
        """Add song selection dropdown"""
        options = []
        
        for i, song in enumerate(self.songs[:25]):  # Discord supports max 25 options
            name = song.get("name", "Unknown Song")
            artist = song.get("artist", "Unknown")
            label = f"{name}"
            description = f"by {artist}"
            
            # Truncate if too long
            if len(label) > 100:
                label = label[:97] + "..."
            if len(description) > 100:
                description = description[:97] + "..."
                
            options.append(discord.SelectOption(
                label=label,
                description=description,
                value=str(i)
            ))
        
        select = discord.ui.Select(
            placeholder="Select a song...",
            options=options,
            min_values=1,
            max_values=1
        )
        select.callback = self._on_select
        self.add_item(select)
    
    async def _on_select(self, interaction: discord.Interaction):
        """Handle song selection"""
        pass
    
    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.red)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Cancel selection"""
        pass


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
        pass
    
    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.red)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Cancel the action"""
        pass 