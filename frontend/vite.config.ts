import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import icons from "unplugin-icons/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Iconify icons compiled to inline SVG at build time (works offline on the Pi)
    icons({ compiler: "jsx", jsx: "react" }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    // The build lands inside the backend and is served by FastAPI
    outDir: "../backend/static",
    emptyOutDir: true,
  },
});
