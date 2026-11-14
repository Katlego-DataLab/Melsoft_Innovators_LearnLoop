import type { Config, Context } from "@netlify/functions";

const VOICE = "JBFqnCBsd6RMkjVDRZzb";

// Server-side proxy so the ElevenLabs key (Netlify env var ELEVANLABS) never reaches the browser.
export default async (req: Request, _context: Context) => {
  const key = process.env.ELEVANLABS || process.env.ELEVENLABS || process.env.ELEVENLABS_API_KEY;
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!key) return Response.json({ message: "Audio is not configured." }, { status: 500 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.length > 600) return Response.json({ message: "Provide a short text." }, { status: 400 });
  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    },
  );
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "audio/mpeg" },
  });
};

export const config: Config = { path: "/api/tts" };
