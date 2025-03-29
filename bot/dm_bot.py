import discord
from discord.ext import commands
from bot.cogs.general import CustomHelpCommand, HelpCategoryView, BackToMainHelpView
import json
import os

class DMBot(commands.Bot):
    def __init__(self):
        # Load environment variables
        with open("data/env.json", "r") as f:
            env = json.load(f)
            self.token = env["DISCORD_TOKEN"]

        intents = discord.Intents.default()
        intents.message_content = True
        intents.messages = True

        # Initialize the bot
        super().__init__(command_prefix="!", intents=intents, help_command=CustomHelpCommand())

    async def setup_hook(self):
        # Load all cogs
        for filename in os.listdir("bot/cogs"):
            if filename.endswith(".py") and filename != "__init__.py":
                await self.load_extension(f"bot.cogs.{filename[:-3]}")
        
        # Sync slash commands
        await self.tree.sync()

    async def on_ready(self):
        print(f"Logged in as {self.user}")
        print(f"Bot is ready and connected to Discord!")

    def run(self):
        super().run(self.token)