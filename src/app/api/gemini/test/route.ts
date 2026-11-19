import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Cheap key validation: lists models the key can see. */
export async function POST(req: Request) {
  let body: { apiKey?: string };
  try {
    body = (await req.json()) as { apiKey?: string };
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const apiKey = body?.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Enter your Gemini API key first." }, { status: 400 });
  }

  try {
    const res = await fetch(`${GEMINI_BASE}?key=${encodeURIComponent(apiKey)}&pageSize=200`, {
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await res.text();

    if (!res.ok) {
      let message = raw.slice(0, 300);
      try {
        const err = JSON.parse(raw) as { error?: { message?: string } };
        message = err.error?.message ?? message;
      } catch {
        /* keep raw */
      }
      const lower = message.toLowerCase();
      if (res.status === 400 && lower.includes("api key")) {
        return NextResponse.json({ error: "Invalid API key — Google rejected it. Double-check the key from aistudio.google.com/apikey." }, { status: 401 });
      }
      if (res.status === 403) {
        return NextResponse.json({ error: "Key rejected (403). Ensure the Generative Language API is enabled for this key." }, { status: 403 });
      }
      return NextResponse.json({ error: `Key check failed: ${message}` }, { status: 502 });
    }

    const data = JSON.parse(raw) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    const names = (data.models ?? []).map((m) => (m.name ?? "").replace("models/", ""));
    const hasChat = names.some((n) => n.includes("2.5-flash") || n.includes("gemini"));
    const hasImage = names.some((n) => n.includes("image"));

    return NextResponse.json({
      ok: true,
      totalModels: names.length,
      chatReady: hasChat,
      imageReady: hasImage,
      sample: names.slice(0, 12),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach Google: ${err instanceof Error ? err.message : "network error"}` },
      { status: 502 }
    );
  }
}
