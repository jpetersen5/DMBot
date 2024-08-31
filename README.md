# DMBot
Drummer's Monthly Discord bot and web app for tracking Clone Hero scores

# Setup
Ask me on discord `@._satan` for permission to use the `process_songs.py` encoded script. It contains info on decoding Clone Hero's score data, so in the interest of the community I'm keeping it private.

Production frontend is running on GitHub Pages
Production backend is running on Render's free tier Webservices tool
Production database is running on Supabase

For local development, the app is containerized to allow fully offline deployment and testing using Docker. Follow these settings to get your environment set up:

`backend/.env.dev`:
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
DISCORD_REDIRECT_URI=https://dmbot-kb5j.onrender.com/api/auth/callback

REDIS_URL=redis://red-cqu6t9ij1k6c73dq6ctg:6379

UPLOAD_FOLDER=uploads

PROCESS_SONGS_SCRIPT=[base64 encoded script, dm me]
```
