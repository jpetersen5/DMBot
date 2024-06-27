# DMBot
Drummer's Monthly Discord bot and web app for tracking Clone Hero scores

# Setup
Ask me on discord `@._satan` for permission to use the `process_songs.py` file for local testing.
I probably won't be giving out `data/env.json` since it contains the sensitive token for DMBot, but nobody really needs to be local testing the bot but me.

Frontend is running on GitHub Pages
Backend is running on Render's free tier Webservices tool

Running the webapp (locally, you can otherwise deploy and view on GH pages at https://jpetersen5.github.io/DMBot/): 
- `npm install`
- `npm install -D tailwindcss postcss autoprefixer`
- `pip install -r backend/requirements.txt`

If Tailwind is showing errors in VSCode install Tailwind CSS IntelliSense extension and add this to your `settings.json`:
```json
{
  "css.validate": false,
  "editor.quickSuggestions": {
    "strings": true
  },
  "tailwindCSS.includeLanguages": {
    "plaintext": "html"
  },
  "tailwindCSS.emmetCompletions": true,
  "editor.inlineSuggest.enabled": true
}
```

`backend/.env`:
```
FLASK_APP=app.py
FLASK_ENV=production
ALLOWED_ORIGINS=https://jpetersen5.github.io,http://localhost:3000
```