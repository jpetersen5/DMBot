import discord
from discord.ext import commands

class CustomHelpCommand(commands.HelpCommand):
    async def send_bot_help(self, mapping):
        embed = discord.Embed(title="DMBot Commands", description="Here's a list of available commands:", color=discord.Color.blue())
        for cog, cmds in mapping.items():
            filtered = await self.filter_commands(cmds, sort=True)
            command_signatures = [f"{self.context.clean_prefix}{c.name} {c.signature}" for c in filtered]
            if command_signatures:
                cog_name = getattr(cog, "qualified_name", "No Category")
                embed.add_field(name=cog_name, value="\n".join(command_signatures), inline=False)
        
        channel = self.get_destination()
        await channel.send(embed=embed)

    async def send_command_help(self, command):
        embed = discord.Embed(title=f"Help for {command.name}", description=command.help or "No description available.", color=discord.Color.blue())
        
        # Command usage
        usage = f"{self.context.clean_prefix}{command.name} {command.signature}"
        embed.add_field(name="Usage", value=usage, inline=False)
        
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
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="ping", help="Check the bot's latency")
    async def ping(self, ctx):
        await ctx.send(f"Pong! Latency: {round(self.bot.latency * 1000)}ms")

async def setup(bot):
    await bot.add_cog(General(bot))