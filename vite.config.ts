import { defineConfig, type UserConfig } from "vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === "production"

  const config: UserConfig = {
    plugins: [react(), svgr()],
    base: "/",
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ["import"],
          quietDeps: true,
        },
      },
    },
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
