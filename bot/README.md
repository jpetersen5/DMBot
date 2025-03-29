# DMBot - Discord Bot

A Discord bot for the Drummer's Monthly Clone Hero community that bridges Discord users with their score data on the DMBot web application.

## This is still in development; Features may be listed here that are not implemented yet. Be patient!

## Overview

DMBot provides interactive commands for users to access leaderboards, track scores, view user profiles, and more directly from Discord. It's designed to be both user-friendly and feature-rich for casual to competitive players.

## Bot Architecture

DMBot follows a modular architecture using Discord.py's Cog system for organization and maintainability.

### Core Structure
- `dm_bot.py`: Main bot initialization and setup
- `cogs/`: Modular command categories
- `utils/`: Shared utility functions

### Cog Structure

The bot is organized into the following cogs:

#### Current Cogs
- **General**: Basic utilities and bot information
- **Leaderboard**: Score tracking and leaderboards
- **User**: User profile, stats, scores, and achievements
- **Ranking**: User rankings
- **Songs**: Song discovery and information
- **Charts**: Charter discovery and information

#### Future Cogs
- **Events**: Community events and competitions
- **Integration**: Spotify/streaming service integration
- **Admin**: Administrative commands

## Command Documentation

### General Cog
- `!help`: Display help information
- `!ping`: Check bot's response time
- `!stats`: Display DMBot's overall stats

### Leaderboard Cog
- `!leaderboard <song_name>`: Display leaderboard for a song
- `!scores [user]`: Show user's scores (paginated)

### User Cog
- `!profile [user]`: Display user profile
- `!stats [user]`: Show detailed user statistics
- `!link`, `!login`: Directs user to log in to the website with Discord authentication

### Ranking Cog
- `!rank [user]`: Show user rank and nearby rankings
- `!top`: Show top user rankings by elo
- `!changes`: Show recent ranking shake-ups

### Songs Cog
- `!search <query>`: Search for songs
- `!popular`, `!topsongs`: Show most played songs
- `!recent`: Show recently played songs
- `!songinfo <song_name>`: Display detailed information about a song

### Charts Cog
- `!charter <query>`: Display stats for a certain charter
- `!charters`: List top charters by number of overall plays
- `!registercharter`: Register yourself as a charter! (On admin approval)

### Events Cog (Future)
- `!tourney`, `!tournament`, `!competition`: Show current/upcoming community tournaments
- `!sotw`, `!week`: Show/vote for Song of the Week
- `!challenge`: Create a score challenge

## API Integration

DMBot interfaces with the DMBot backend API to access and modify data. Key API endpoints used:

- `/api/songs`: Search and retrieve song information
- `/api/leaderboard/{song_id}`: Get leaderboard data for a song
- `/api/users/discord/{discord_id}`: Get user profile from Discord ID
- `/api/user/{user_id}/scores`: Get a user's scores

## Development Guidelines

Please DM me `@_.satan` on Discord for help setting up the bot for development and guidelines.

## Future Plans

### Short-term Goals
- Ensure a bug-free user experience
- Add slash command support
- Improve pagination and interactive components

### Medium-term Goals
- Develop Events cog for tournaments, bounties, songs-of-the-week
- Implement notification system

### Long-term Goals
- Spotify / Last.fm integration
- Advanced analytics and recommendations
- Automated events and challenges

## Contributing

Please feel free to submit a Pull Request or a detailed issue if you encounter a bug.