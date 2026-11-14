import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const ELEVEN_VOICE = "JBFqnCBsd6RMkjVDRZzb";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gammaKey = env.GAMMA || env.GAMMA_API_KEY || "";
  const elevenKey = env.ELEVANLABS || env.ELEVENLABS || env.ELEVENLABS_API_KEY || "";
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/public": {
          target: "https://gamma-dream-garden.lovable.app",
          changeOrigin: true,
          secure: true,
        },
        // API keys are added here on the server side and never reach the browser.
        "/api/gamma": {
          target: "https://public-api.gamma.app",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gamma/, "/v1.0"),
          headers: { "X-API-KEY": gammaKey },
        },
        "/api/tts": {
          target: "https://api.elevenlabs.io",
          changeOrigin: true,
          rewrite: () => `/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_64`,
          headers: { "xi-api-key": elevenKey },
        },
      },
    },
  };
});
