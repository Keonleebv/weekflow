import Anthropic from "@anthropic-ai/sdk";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Model used for the reflection summary. Opus 5 is the default; swap to
// "claude-sonnet-5" or "claude-haiku-4-5" here if you'd rather trade a little
// quality for lower cost — this is the only line you need to change.
const MODEL = "claude-opus-5";
const MAX_INPUT_CHARS = 20000;

const SYSTEM_PROMPT =
  "You summarize a person's daily journal reflection into 2 to 4 short, concrete bullet points. " +
  "Each bullet is one line, under ~15 words, in the person's own perspective. " +
  "Capture what actually happened, how they felt, and any intention for next time. " +
  "Do not invent details. Return JSON only.";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }

  const text = String(req.body?.text ?? "")
    .slice(0, MAX_INPUT_CHARS)
    .trim();
  if (!text) {
    return res.status(400).json({ error: "Missing 'text' to summarize." });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" }, // small task; keep it fast + cheap
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              bullets: { type: "array", items: { type: "string" } },
            },
            required: ["bullets"],
            additionalProperties: false,
          },
        },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    if (response.stop_reason === "refusal") {
      return res
        .status(200)
        .json({ bullets: [], error: "The model declined to summarize this text." });
    }

    const block = response.content.find((b) => b.type === "text");
    const raw = block && "text" in block ? block.text : "";
    let bullets: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.bullets)) {
        bullets = parsed.bullets.filter((b: unknown) => typeof b === "string");
      }
    } catch {
      // model returned non-JSON despite the schema — treat as empty
    }

    return res.status(200).json({ bullets });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Summary generation failed.";
    return res.status(500).json({ error: message });
  }
}
