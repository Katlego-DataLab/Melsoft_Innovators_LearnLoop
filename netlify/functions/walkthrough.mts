import type { Config } from "@netlify/functions";
import { generateWalkthrough, sanitizeInput } from "../../server/walkthrough";

export default async (req: Request) => {
  const key = process.env.OPENAI || process.env.OPENAI_API_KEY;
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!key) return Response.json({ message: "AI is not configured." }, { status: 503 });
  const input = sanitizeInput(await req.json().catch(() => null));
  if (!input) return Response.json({ message: "A topic is required." }, { status: 400 });
  try {
    return Response.json({ scenes: await generateWalkthrough(input, key) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "AI request failed." }, { status: 502 });
  }
};

export const config: Config = { path: "/api/walkthrough" };
