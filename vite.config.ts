import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProduction = mode === "production"

  const config = {
    plugins: [react(), svgr()],
    base: "/",
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
    }
  }

  return config
})
