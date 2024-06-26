import discord
from discord.ext import commands
import io
import json
from utils.process_songs import parse_score_data

class ScoreDataProcessor(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.song_data = self.load_song_data()

    def load_song_data(self):
        try:
            with open('data/songs.json', 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print("Warning: songs.json not found. Song lookup will not be available.")
            return {}

    @commands.command(name="parse_scores", help="Parse an uploaded scoredata.bin file")
    async def parse_scores(self, ctx):
        if not ctx.message.attachments:
            await ctx.send("Please upload a scoredata.bin file with your command.")
            return

        attachment = ctx.message.attachments[0]
        if attachment.size > 1_000_000:  # 1 MB limit
            await ctx.send("File is too large. Please upload a file smaller than 1 MB.")
            return
        
        if not attachment.filename.endswith(".bin") or not attachment.filename.lower().startswith("scoredata"):
            await ctx.send("Invalid file type. Please upload a scoredata.bin file.")
            return

        # Download the attachment
        file_bytes = await attachment.read()

        try:
            # Process the file
            parsed_data = parse_score_data(io.BytesIO(file_bytes), self.song_data)

            # Create a text file with the parsed content
            result_file = discord.File(io.StringIO(parsed_data), filename="parsed_scores.txt")

            # Send the result back to the user
            await ctx.send("Here's your parsed score data:", file=result_file)
        except Exception as e:
            await ctx.send(f"An error occurred while processing the file: {str(e)}")

async def setup(bot):
    await bot.add_cog(ScoreDataProcessor(bot))