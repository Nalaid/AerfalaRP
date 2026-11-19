import { NextResponse } from "next/server";
import type { ChatRequestBody } from "@/lib/rp-types";
import { GM_RESPONSE_SCHEMA } from "@/lib/gm-prompt";

export const runtime = "nodejs";
export const maxDuration = 120;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function friendlyError(status: number, message: string): string {
  const lower = message.toLowerCase();
  if (status === 400 && (lower.includes("api key") || lower.includes("api_key"))) {
    return "Invalid API key. Check your Gemini API key in Settings (get one free at aistudio.google.com/apikey).";
  }
  if (status === 400 && lower.includes("quota")) {
    return "API quota exceeded for this key. Try again later or use a different key/project.";
  }
  if (status === 403) {
    return "Access denied by Google (403). Your key may be restricted or the Generative Language API is not enabled for it.";
  }
  if (status === 404) {
    return `Model not found (404) — ${message}. Try switching the chat model in Settings.`;
  }
  if (status === 429) {
    return "Rate limit reached (429). Wait a few seconds and send another action.";
  }
  if (status >= 500) {
    return "Google's servers hiccuped (5xx). Try again in a moment.";
  }
  return message || `Gemini request failed (HTTP ${status}).`;
}

interface GeminiApiError {
  error?: { message?: string };
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

function extractText(data: GeminiGenerateResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts) return null;
  const text = parts.map((p) => p.text ?? "").join("").trim();
  return text || null;
}

/** Strip markdown fences / stray prose that models sometimes wrap around JSON. */
function cleanJson(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
  return t;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const { apiKey, model, systemPrompt, contents } = body ?? ({} as ChatRequestBody);
  if (!apiKey) return NextResponse.json({ error: "Missing Gemini API key. Open Settings and add your key." }, { status: 400 });
  if (!model || !Array.isArray(contents) || contents.length === 0) {
    return NextResponse.json({ error: "Missing model or conversation contents." }, { status: 400 });
  }

  const generationConfig: Record<string, unknown> = {
    temperature: 1.05,
    topP: 0.95,
    maxOutputTokens: 16384,
    responseMimeType: "application/json",
    responseSchema: GM_RESPONSE_SCHEMA,
  };
  if (model.includes("2.5") && model.includes("flash")) {
    // keep RP snappy: no hidden thinking budget
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig,
  };

  let data: GeminiGenerateResponse | null = null;
  let lastStatus = 500;
  let lastMessage = "Unknown error";

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(
        `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(110_000),
        }
      );
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : "network error";
      lastStatus = 504;
      continue;
    }

    const rawText = await res.text();
    if (res.ok) {
      try {
        data = JSON.parse(rawText) as GeminiGenerateResponse;
        lastStatus = 200;
      } catch {
        lastStatus = 502;
        lastMessage = "Gemini returned an unparseable response.";
      }
      break;
    } else {
      lastStatus = res.status;
      try {
        const errJson = JSON.parse(rawText) as GeminiApiError;
        lastMessage = errJson.error?.message ?? rawText.slice(0, 300);
      } catch {
        lastMessage = rawText.slice(0, 300);
      }
      // retry only on transient failures
      if (res.status !== 429 && res.status < 500) break;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  if (lastStatus !== 200 || !data) {
    return NextResponse.json(
      { error: friendlyError(lastStatus, lastMessage) },
      { status: lastStatus === 504 ? 504 : 502 }
    );
  }

  if (data.promptFeedback?.blockReason) {
    return NextResponse.json(
      {
        error: `The story beat was blocked by Gemini's safety filter (${data.promptFeedback.blockReason}). Rephrase your action or soften the scene.`,
      },
      { status: 422 }
    );
  }

  const text = extractText(data);
  if (!text) {
    return NextResponse.json(
      { error: "Gemini returned an empty response. Try rephrasing your last action." },
      { status: 502 }
    );
  }

  try {
    const parsed = JSON.parse(cleanJson(text));
    return NextResponse.json({ data: parsed });
  } catch {
    return NextResponse.json(
      { error: "Gemini's reply was not valid story JSON. Send your action again — this usually fixes itself." },
      { status: 502 }
    );
  }
}
