import discord
from discord.ext import commands
from typing import List, Dict, Optional, Mapping, Set
import asyncio
import time

class HelpCategoryView(discord.ui.View):
    """Interactive view for help command categories"""
    
    def __init__(self, help_command=None, mapping=None, timeout=180.0):
        super().__init__(timeout=timeout)
        
        self.help_command = help_command
        self.mapping = mapping or {}
        self.message = None
        
        # Add buttons for each cog/category
        if help_command and mapping:
            button_index = 0  # Add an index to ensure unique custom_ids
            for cog in mapping.keys():
                if cog:
                    # Skip empty categories and check permissions for Admin
                    if not mapping[cog]:
                        continue
                        
                    cog_name = getattr(cog, "qualified_name", "No Category")
                    if cog_name == "Admin" and help_command and not help_command.can_access_admin_sync(help_command.context.author):
                        continue
                        
                    style = discord.ButtonStyle.primary
                    if cog_name == "Admin":
                        style = discord.ButtonStyle.danger
                    elif cog_name in ["Leaderboard", "User", "Songs"]:
                        style = discord.ButtonStyle.success
                    elif cog_name in ["Ranking", "Charts", "Events"]:
                        style = discord.ButtonStyle.secondary
                    
                    # Create a button for this category
                    button = discord.ui.Button(
                        label=cog_name,
                        style=style,
                        custom_id=f"help_category_{cog_name}_{button_index}"
                    )
                    button.callback = self.make_callback(cog)
                    self.add_item(button)
                    button_index += 1
    
    def make_callback(self, cog):
        """Create a callback for a specific cog button"""
        async def callback(interaction: discord.Interaction):
            try:
                await interaction.response.defer(ephemeral=False)
                
                embed = await self.help_command.create_category_embed(cog)
                back_view = BackToMainHelpView(self.help_command, self.mapping)
                back_view.message = interaction.message
                
                await interaction.followup.edit_message(
                    message_id=interaction.message.id,
                    embed=embed,
                    view=back_view
                )
            except Exception as e:
                print(f"Error in category button callback: {type(e).__name__}: {str(e)}")
                try:
                    await interaction.followup.send(f"An error occurred: {type(e).__name__}", ephemeral=True)
                except:
                    pass
                    
        return callback
    
    async def on_timeout(self):
        """Disable all buttons when the view times out"""
        for item in self.children:
            item.disabled = True
        
        if self.message:
            try:
                await self.message.edit(view=self)
            except:
                pass


class BackToMainHelpView(discord.ui.View):
    """View with a button to go back to main help menu"""
    
    def __init__(self, help_command=None, mapping=None, timeout=180.0):
        super().__init__(timeout=timeout)
            
        self.help_command = help_command
        self.mapping = mapping or {}
        self.message = None
        
        if help_command and mapping:
            back_button = discord.ui.Button(
                label="Back to Categories",
                style=discord.ButtonStyle.primary,
                custom_id="help_back_to_main"
            )
            back_button.callback = self.back_button_callback
            self.add_item(back_button)
    
    async def back_button_callback(self, interaction: discord.Interaction):
        """Go back to the main help menu"""
        try:
            await interaction.response.defer(ephemeral=False)
            
            embed = await self.help_command.create_main_help_embed(self.mapping)
            category_view = HelpCategoryView(self.help_command, self.mapping)
            category_view.message = interaction.message
            
            await interaction.followup.edit_message(
                message_id=interaction.message.id,
                embed=embed,
                view=category_view
            )
        except Exception as e:
            print(f"Error in back button: {type(e).__name__}: {str(e)}")
            try:
                await interaction.followup.send(f"An error occurred: {type(e).__name__}", ephemeral=True)
            except:
                pass
    
    async def on_timeout(self):
        """Disable all buttons when the view times out"""
        for item in self.children:
            item.disabled = True
        
        if self.message:
            try:
                await self.message.edit(view=self)
            except:
                pass


class CustomHelpCommand(commands.HelpCommand):
    """Enhanced help command with interactive category selection"""
    
    # Category descriptions
    CATEGORY_DESCRIPTIONS = {
        "General": "Basic utilities and bot information",
        "Leaderboard": "Commands for viewing song leaderboards and user scores",
        "User": "User profile, stats, and account management",
        "Songs": "Song discovery and detailed information",
        "Ranking": "Global user rankings and leaderboards",
        "Charts": "Chart and charter information",
        "Events": "Community events and competitions",
        "Integration": "Third-party service integrations",
        "Admin": "Administrative commands for bot management",
    }
    
    def can_access_admin_sync(self, user: discord.User) -> bool:
        """Synchronous version of permission check for admin commands"""
        if not user.guild_permissions:
            return False
            
        # Check for admin or manage_guild permission
        return user.guild_permissions.administrator or user.guild_permissions.manage_guild
    
    async def _can_access_admin(self, user: discord.User) -> bool:
        """Async check if a user can access admin commands"""
        return self.can_access_admin_sync(user)
    
    async def create_main_help_embed(self, mapping: Mapping[Optional[commands.Cog], List[commands.Command]]) -> discord.Embed:
        """Create the main help embed with category descriptions"""
        embed = discord.Embed(
            title="DMBot Help",
            description="Select a category to view available commands.",
            color=discord.Color.blue()
        )
        
        for cog in mapping.keys():
            if cog:
                cog_name = getattr(cog, "qualified_name", "No Category")
                
                # Skip Admin category for users without permissions
                if cog_name == "Admin" and not self.can_access_admin_sync(self.context.author):
                    continue
                
                # Skip categories with no commands
                if not mapping[cog]:
                    continue
                    
                # Add field for each category with its description
                description = self.CATEGORY_DESCRIPTIONS.get(cog_name, "No description available")
                command_count = len(mapping[cog])
                embed.add_field(
                    name=f"{cog_name} ({command_count} commands)",
                    value=description,
                    inline=False
                )
                
        embed.set_footer(text="Click a category button below or use !help [category] (case-sensitive)")
        return embed
    
    async def create_category_embed(self, cog: commands.Cog) -> discord.Embed:
        """Create an embed for a specific command category"""
        cog_name = getattr(cog, "qualified_name", "No Category")
        
        # Get filtered commands for this cog
        filtered = await self.filter_commands(cog.get_commands(), sort=True)
        if not filtered:
            return discord.Embed(
                title=f"{cog_name} Commands",
                description="No commands available in this category.",
                color=discord.Color.red()
            )
        
        embed = discord.Embed(
            title=f"{cog_name} Commands",
            description=self.CATEGORY_DESCRIPTIONS.get(cog_name, "No description available"),
            color=discord.Color.blue()
        )
        
        # Add each command with its help text
        for command in filtered:
            signature = f"{self.context.clean_prefix}{command.name} {command.signature}"
            help_text = command.short_doc or "No description available"
            embed.add_field(
                name=signature,
                value=help_text,
                inline=False
            )
            
        return embed
    
    async def send_bot_help(self, mapping: Mapping[Optional[commands.Cog], List[commands.Command]]):
        """Send the main help menu with category selection"""
        # Filter mapping to exclude empty categories
        filtered_mapping = {}
        for cog, commands_list in mapping.items():
            filtered = await self.filter_commands(commands_list, sort=True)
            if filtered:
                filtered_mapping[cog] = filtered
        
        embed = await self.create_main_help_embed(filtered_mapping)
        view = HelpCategoryView(self, filtered_mapping)
        
        # Send the help message with the interactive view
        channel = self.get_destination()
        message = await channel.send(embed=embed, view=view)
        view.message = message

    async def send_cog_help(self, cog: commands.Cog):
        """Send help for a specific category/cog"""
        # Check permissions for Admin cog
        if cog.qualified_name == "Admin" and not self.can_access_admin_sync(self.context.author):
            await self.get_destination().send("You don't have permission to view Admin commands.", ephemeral=True)
            return
            
        embed = await self.create_category_embed(cog)
        
        # Create a mapping of all cogs for the back button
        bot = self.context.bot
        mapping = {}
        for cmd in bot.commands:
            if cmd.cog:
                if cmd.cog not in mapping:
                    mapping[cmd.cog] = []
                mapping[cmd.cog].append(cmd)
        
        view = BackToMainHelpView(self, mapping)
        
        # Send the category help message with a back button
        channel = self.get_destination()
        message = await channel.send(embed=embed, view=view)
        view.message = message

    async def send_command_help(self, command: commands.Command):
        """Send detailed help for a specific command"""
        # Check if user can use this command (for Admin commands)
        cog = command.cog
        if cog and cog.qualified_name == "Admin" and not self.can_access_admin_sync(self.context.author):
            await self.get_destination().send("You don't have permission to view this command.", ephemeral=True)
            return
            
        embed = discord.Embed(
            title=f"Help: {self.context.clean_prefix}{command.name}",
            description=command.help or "No description available.",
            color=discord.Color.blue()
        )
        
        # Command usage
        usage = f"{self.context.clean_prefix}{command.name} {command.signature}"
        embed.add_field(name="Usage", value=f"`{usage}`", inline=False)
        
        # Command aliases if any
        if command.aliases:
            aliases = ", ".join(f"`{self.context.clean_prefix}{alias}`" for alias in command.aliases)
            embed.add_field(name="Aliases", value=aliases, inline=False)
        
        # Command arguments
        if command.clean_params:
            args_description = []
            for name, param in command.clean_params.items():
                arg_help = param.description or "No description"
                arg_type = param.annotation.__name__ if param.annotation is not param.empty else "Any"
                arg_default = f" (default: {param.default})" if param.default is not param.empty else ""
                args_description.append(f"**{name}** ({arg_type}): {arg_help}{arg_default}")
            embed.add_field(name="Arguments", value="\n".join(args_description), inline=False)
        
        channel = self.get_destination()
        await channel.send(embed=embed)


class General(commands.Cog):
    """Basic utilities and bot information"""
    
    def __init__(self, bot):
        self.bot = bot
        # Replace the default help command
        bot.help_command = CustomHelpCommand()
        
    @commands.command(name="ping", help="Check the bot's latency")
    async def ping(self, ctx):
        """Check the bot's latency"""
        await ctx.send(f"Pong! Latency: {round(self.bot.latency * 1000)}ms")


async def setup(bot):
    await bot.add_cog(General(bot))