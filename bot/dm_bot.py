import discord
from discord.ext import commands
from bot.cogs.general import CustomHelpCommand
import json
import os

class DMBot(commands.Bot):
    def __init__(self):
        # Load environment variables
        with open("data/env.json", "r") as f:
            env = json.load(f)
            self.token = env["DISCORD_TOKEN"]

        # Set up intents
        intents = discord.Intents.default()
        intents.messages = True
        intents.message_content = True

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

    def run(self):
        super().run(self.token)