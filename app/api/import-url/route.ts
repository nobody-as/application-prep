import { identity, fail, jsonBody, HttpError } from "@/lib/study/server";
import { publicUrl, resolvePublicHost } from "@/lib/study/url";
export async function POST(request: Request) {
  try {
    await identity(request);
    const body = await jsonBody(request, 5000);
    let url = publicUrl(String(body.url || ""));
    for (let i = 0; i < 4; i++) {
      await resolvePublicHost(url.hostname);
      const response = await fetch(url, {
        redirect: "manual",
        headers: { Accept: "text/html,text/plain" },
        signal: AbortSignal.timeout(12000),
      });
      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        await response.body?.cancel();
        if (!next) break;
        url = publicUrl(new URL(next, url).href);
        continue;
      }
      if (!response.ok)
        throw new HttpError(
          422,
          "This page could not be read. Paste its text instead.",
        );
      const contentType = response.headers.get("content-type") || "";
      if (!/text\/(html|plain)/i.test(contentType))
        throw new HttpError(
          422,
          "For PDFs, upload the file to select its pages.",
        );
      const reader = response.body?.getReader();
      if (!reader)
        throw new HttpError(422, "The page has no readable content.");
      const decoder = new TextDecoder();
      let text = "",
        size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2000000) {
          await reader.cancel();
          throw new HttpError(
            413,
            "The page is too large. Paste the relevant passage instead.",
          );
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      return Response.json(
        { content: text, html: contentType.includes("html"), url: url.href },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    throw new HttpError(
      422,
      "The page redirected too many times. Paste the relevant text instead.",
    );
  } catch (e) {
    return fail(e);
  }
}
