import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isGitHubPages = process.env.GITHUB_ACTIONS === "true"

  const config = {
    plugins: [react(), svgr()],
    base: isGitHubPages ? "/DMBot/" : "/",
    build: {
      outDir: "dist",
      assetsDir: "assets",
    },
    server: {}
  }

  if (command !== "build") {
    config.server = {
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
          secure: false,
        }
      },
      historyApiFallback: true,
    }
  }

  return config
})
