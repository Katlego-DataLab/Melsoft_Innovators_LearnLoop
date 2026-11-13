import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/public": {
        target: "https://gamma-dream-garden.lovable.app",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
