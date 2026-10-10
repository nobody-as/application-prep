import { env } from "cloudflare:workers";
import { identity, jsonBody, fail, HttpError } from "@/lib/study/server";
import { generationSchema, selectedPages } from "@/lib/study/model";
import { generateFromSources } from "@/lib/study/generator";
import { generateAI } from "@/lib/study/ai";
export async function POST(request: Request) {
  try {
    const user = await identity(request);
    const input = generationSchema.parse(await jsonBody(request));
    const size = input.sources
      .flatMap((s) => selectedPages(s))
      .reduce((n, p) => n + p.text.length, 0);
    if (size < 100)
      throw new HttpError(
        400,
        "Select at least 100 characters of readable source material.",
      );
    if (size > 100000)
      throw new HttpError(
        413,
        "Select fewer pages. A generation pass supports up to 100,000 characters.",
      );
    if (!input.useAI) return Response.json({ set: generateFromSources(input) });
    if (!env.OPENAI_API_KEY)
      throw new HttpError(
        503,
        "AI is not connected. Source-based mode is available now.",
      );
    if (!env.DB) throw new HttpError(503, "Storage is unavailable.");
    const now = Date.now(),
      window = now - 3600000;
    await env.DB.prepare(
      "INSERT INTO generation_limits (user_id, window_start, count) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET count = CASE WHEN window_start < ? THEN 0 ELSE count END, window_start = CASE WHEN window_start < ? THEN ? ELSE window_start END",
    )
      .bind(user.userId, now, window, window, now)
      .run();
    const r = await env.DB.prepare(
      "UPDATE generation_limits SET count = count + 1 WHERE user_id = ? AND count < 12",
    )
      .bind(user.userId)
      .run();
    if (!r.meta.changes)
      throw new HttpError(
        429,
        "Hourly generation limit reached. Source-based mode is still available.",
      );
    return Response.json({
      set: await generateAI(
        input,
        env.OPENAI_API_KEY,
        env.OPENAI_MODEL || "gpt-4.1",
      ),
    });
  } catch (e) {
    return fail(e);
  }
}
