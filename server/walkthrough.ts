// Shared by the Vite dev middleware and the Netlify function. Runs only on the server so the OpenAI key stays private.
export const VISUAL_IDS = ["hub", "flow", "checklist", "compare", "cycle", "layers", "timeline", "bars", "venn", "tree", "idea", "target", "blocks", "qa", "spotlight"] as const;

export type WalkthroughInput = { topic: string; summary?: string; explanation?: string; practice?: string; learnerType?: string };
export type WalkthroughScene = { title: string; text: string; visual: (typeof VISUAL_IDS)[number]; words: string[] };

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function sanitizeInput(raw: unknown): WalkthroughInput | null {
  const body = (raw ?? {}) as Record<string, unknown>;
  const topic = clean(body.topic, 120);
  if (!topic) return null;
  return {
    topic,
    summary: clean(body.summary, 600),
    explanation: clean(body.explanation, 1500),
    practice: clean(body.practice, 400),
    learnerType: clean(body.learnerType, 30),
  };
}

export async function generateWalkthrough(input: WalkthroughInput, apiKey: string): Promise<WalkthroughScene[]> {
  const system = [
    "You write very short, friendly, accurate study walkthroughs for students.",
    "Return JSON only: {\"scenes\":[{\"title\":string,\"narration\":string,\"visual\":string,\"terms\":string[]}]}.",
    "Exactly 3 scenes: overview, how it works, try it yourself.",
    "title: 2-4 words. narration: 1-2 sentences, max 200 characters, plain spoken English, no markdown.",
    `visual: pick the best fit from ${VISUAL_IDS.join(", ")}; do not repeat a visual.`,
    "terms: 3-5 key labels from the content, each max 10 characters (e.g. an acronym or short noun).",
    "Use only the provided material; do not invent facts. Describe a learning preference as a suggestion, never a limit. Never include personal information.",
  ].join(" ");
  const user = `Topic: ${input.topic}\nSummary: ${input.summary}\nExplanation: ${input.explanation}\nPractice: ${input.practice}${input.learnerType ? `\nLearning preference (a suggestion only): ${input.learnerType}` : ""}`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed (${response.status})`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as { scenes?: Array<Record<string, unknown>> };
  const used = new Set<string>();
  const scenes = (parsed.scenes ?? []).slice(0, 3).map((scene): WalkthroughScene => {
    const wanted = clean(scene.visual, 20);
    const visual = (VISUAL_IDS as readonly string[]).includes(wanted) && !used.has(wanted)
      ? (wanted as WalkthroughScene["visual"])
      : VISUAL_IDS.find((id) => !used.has(id))!;
    used.add(visual);
    const words = Array.isArray(scene.terms) ? scene.terms.map((term) => clean(term, 12)).filter(Boolean).slice(0, 5) : [];
    return { title: clean(scene.title, 40), text: clean(scene.narration, 260), visual, words };
  });
  if (scenes.length < 3 || scenes.some((scene) => !scene.text || scene.words.length < 3)) throw new Error("OpenAI returned an incomplete walkthrough.");
  return scenes;
}
