import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { generateWalkthrough, sanitizeInput } from "./server/walkthrough";

const ELEVEN_VOICE = "JBFqnCBsd6RMkjVDRZzb";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gammaKey = env.GAMMA || env.GAMMA_API_KEY || "";
  const elevenKey = env.ELEVANLABS || env.ELEVENLABS || env.ELEVENLABS_API_KEY || "";
  const openAiKey = env.OPENAI || env.OPENAI_API_KEY || "";
  return {
    plugins: [
      react(),
      {
        name: "walkthrough-api",
        configureServer(server) {
          server.middlewares.use("/api/walkthrough", async (req, res) => {
            const send = (status: number, body: unknown) => {
              res.statusCode = status;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(body));
            };
            if (req.method !== "POST") return send(405, { message: "Method not allowed" });
            if (!openAiKey) return send(503, { message: "AI is not configured." });
            let raw = "";
            for await (const chunk of req) raw += chunk;
            const input = sanitizeInput((() => { try { return JSON.parse(raw); } catch { return null; } })());
            if (!input) return send(400, { message: "A topic is required." });
            try {
              send(200, { scenes: await generateWalkthrough(input, openAiKey) });
            } catch (error) {
              send(502, { message: error instanceof Error ? error.message : "AI request failed." });
            }
          });
        },
      },
    ],
    server: {
      proxy: {
        "/api/public": {
          target: "https://learnloop-slide-weaver.lovable.app",
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
