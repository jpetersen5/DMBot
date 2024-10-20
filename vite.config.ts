import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isGitHubPages = process.env.GITHUB_ACTIONS === "true"
  const isProduction = mode === "production"
  const env = loadEnv(mode, process.cwd())
  const spotifyClientId = env.VITE_SPOTIFY_CLIENT_ID
  const spotifyClientSecret = env.VITE_SPOTIFY_CLIENT_SECRET

  const config = {
    plugins: [react(), svgr()],
    base: isGitHubPages ? "/DMBot/" : "/",
    build: {
      outDir: "dist",
      assetsDir: "assets",
    },
    server: {
      host: true,
      port: 3000,
      strictPort: true,
      watch: {
        usePolling: true,
      },
    },
    define: {
      "import.meta.env.VITE_API_URL": isProduction 
        ? JSON.stringify("https://dmbot-kb5j.onrender.com")
        : JSON.stringify("http://localhost:5000"),
      "import.meta.env.VITE_COMMIT_DATE": JSON.stringify(process.env.VITE_COMMIT_DATE),
      "import.meta.env.VITE_SPOTIFY_CLIENT_ID": spotifyClientId ? JSON.stringify(spotifyClientId) : JSON.stringify(process.env.VITE_SPOTIFY_CLIENT_ID),
      "import.meta.env.VITE_SPOTIFY_CLIENT_SECRET": spotifyClientSecret ? JSON.stringify(spotifyClientSecret) : JSON.stringify(process.env.VITE_SPOTIFY_CLIENT_SECRET),
    }
  }

  return config
})
