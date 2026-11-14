import type { Config, Context } from "@netlify/functions";

// Server-side proxy so the Gamma key (Netlify env var GAMMA) never reaches the browser.
export default async (req: Request, _context: Context) => {
  const key = process.env.GAMMA || process.env.GAMMA_API_KEY;
  if (!key) return Response.json({ message: "Gamma is not configured." }, { status: 500 });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/gamma/, "");
  if (!/^\/generations(\/[\w-]+)?$/.test(path)) return Response.json({ message: "Not found" }, { status: 404 });
  const upstream = await fetch(`https://public-api.gamma.app/v1.0${path}`, {
    method: req.method,
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: req.method === "POST" ? await req.text() : undefined,
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};

export const config: Config = { path: "/api/gamma/*" };
