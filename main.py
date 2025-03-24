import asyncio
from bot.dm_bot import DMBot
import logging

logging.basicConfig(level=logging.INFO)

def main():
    bot = DMBot()
    bot.run()

if __name__ == "__main__":
    main()
