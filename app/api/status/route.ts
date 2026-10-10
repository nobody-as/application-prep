import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export async function GET() {
  const user = await getChatGPTUser();
  return Response.json(
    {
      signedIn: !!user,
      name: user?.displayName || null,
      userKey: user?.userId || "local",
      ai: !!env.OPENAI_API_KEY,
      storage: !!env.DB,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
