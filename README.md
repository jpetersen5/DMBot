# DMBot
Drummer's Monthly Discord bot and web app for tracking Clone Hero scores

# Setup
Ask me on discord `@._satan` for permission to use the `process_songs.py` file for local testing.
I probably won't be giving out `data/env.json` since it contains the sensitive token for DMBot, but nobody really needs to be local testing the bot but me.

Frontend is running on GitHub Pages
Backend is running on Render's free tier Webservices tool

`backend/.env`:
```
FLASK_APP=app.py
FLASK_ENV=production

ALLOWED_ORIGINS=https://jpetersen5.github.io,http://localhost:3000

SECRET_KEY=
JWT_SECRET=

SUPABASE_URL=https://tczhxtrzfaqgsjoudhoi.supabase.co
SUPABASE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DISCORD_CLIENT_ID=1230729896393703425
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://dmbot-kb5j.onrender.com/api/auth/callback

UPLOAD_FOLDER=uploads

PROCESS_SONGS_SCRIPT=[base64 encoded script, dm me]
```
