import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const config = {
    plugins: [react(), svgr()],
    base: "/DMBot/",
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
