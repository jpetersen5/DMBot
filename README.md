# DMBot

Drummer's Monthly Discord bot and web app for tracking Clone Hero scores

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
   - [Installing Docker](#installing-docker)
   - [Cloning the Repo](#cloning-the-repo)
   - [Configuration](#configuration)
   - [Building and Running the App](#building-and-running-the-app)
4. [Troubleshooting](#troubleshooting)
5. [Production Environments](#production-environments)
6. [Contributing](#contributing)
7. [Contact](#contact)

## Introduction

DMBot is a Discord bot and web application designed to track Clone Hero scores for the Drummer's Monthly community. If you want to contribute, this README provides a guide to set up the project for local development.

## Prerequisites

This guide is created by me, a Windows user, so it's not universal. Please contribute to this guide if you are experienced in another OS and have successfully set up this project for local development.

It's assumed you have the following installed on your system:
- Git
- A text editor of your choice (VSCode, Notepad++, etc.)
  - Building the Docker containers requires a terminal so VSCode is recommended

No prior experience with Docker is required.

## Local Development Setup

### Installing Docker

Docker is a platform that allows users to develop, ship, and run applications in containers.

1. Visit [Docker Desktop website](https://www.docker.com/products/docker-desktop)
2. Download the appropriate version for your OS
3. Follow the installation instructions provided by Docker
4. After installation, open a terminal/command prompt and run `docker --version` to verify the installation

### Cloning the Repo

1. Open a terminal/command prompt (or integrated VSCode terminal)
2. Navigate to the directory where you want to store the project
3. Run the following command:
   ```
   git clone https://github.com/jpetersen5/DMBot.git
   ```
   - Or if you have GitHub CLI set up:
   ```
   gh repo clone jpetersen5/DMBot
   ```
4. Navigate into the project directory:
   ```
   cd DMBot
   ```

### Configuration

1. Navigate into the backend directory:
  ```
  cd backend
  ```

2. Create a file named `.env.dev` and add this to its content or rename `.env.dev.example` to `.env.dev`:

   ```
   FLASK_APP=app.py
   FLASK_ENV=development

   ALLOWED_ORIGINS=http://localhost:3000

   SECRET_KEY=
   JWT_SECRET=

   SUPABASE_URL=https://tczhxtrzfaqgsjoudhoi.supabase.co
   SUPABASE_KEY=
   SUPABASE_SERVICE_ROLE_KEY=

   DISCORD_CLIENT_ID=1230729896393703425
   DISCORD_CLIENT_SECRET=
   DISCORD_REDIRECT_URI=http://localhost:5000/api/auth/callback # change to 5001 for Mac
   FRONTEND_URL=http://localhost:3000

   REDIS_URL=redis://redis:6379

   UPLOAD_FOLDER=uploads
   
   VITE_SPOTIFY_CLIENT_ID=
   VITE_SPOTIFY_CLIENT_SECRET=

   PROCESS_SONGS_SCRIPT=
   ```

   Contact me `@._satan` on Discord for sensitive environment variables.

   Production secrets aren't necessary for local development

   Supabase keys are only necessary for working with the data in the Supabase hosted database. Contact me for the service role key but be really careful with it!

   Discord client secret is for me, the bot master, only.

   The process songs script decodes Clone Hero's scoredata.bin file, which could be used by unethical players to modify their scores, so in the spirit of fairness to the community I'll only release it to trusted contributers who need it to contribute.

### Building and Running the App

1. Launch Docker
2. Open a terminal/command prompt (or integrate terminal in your IDE) and navigate to the project root directory
3. Build and start the Docker containers:
   ```
   docker-compose up --build
   ```
4. Wait for the build process to complete. This may take a few minutes the first time.
5. Once complete, you should see output indicating that the services are running and green containers in the Docker UI
6. Open a web browser and navigate to `http://localhost:3000` to view the site
7. The backend API is accessible to the frontend at `http://localhost:5000` (or `http://localhost:5001` for Mac)

To stop the application, press `Ctrl+C` in the terminal where Docker is running or open another terminal and run:
```
docker-compose down
```

## Troubleshooting

If you encounter issues:
1. Ensure all required ports (3000, 5000 or 5001, 6379) are free and not used by other applications
2. Check the Docker logs for any error messages:
   ```
   docker-compose logs
   ```
3. Ensure all environment variables in `.env.dev` are correctly set
4. Try rebuilding the containers:
   ```
   docker-compose down
   docker-compose up --build
   ```
5. Contact me `@._satan` on Discord to try to help you get set up

## Production Environments

- Frontend: Running on GitHub Pages
- Backend: Deployed on Render's free tier Webservices tool
- Database: Hosted on Supabase

## Contributing

Contributions are welcome from anyone of any level of experience, please open a Pull Request with your contribution when you think it's ready to be reviewed.

## Contact

For questions or access to the `process_songs.py` encoded script, contact me `@._satan` on Discord.
