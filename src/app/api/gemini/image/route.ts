import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ImageRequestBody } from "@/lib/rp-types";

export const runtime = "nodejs";
export const maxDuration = 120;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface InlinePart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiImageResponse {
  candidates?: Array<{ content?: { parts?: InlinePart[] } }>;
  error?: { message?: string };
}

interface Attempt {
  model: string;
  modalities: string[];
  aspectRatio?: string;
}

/** 3:4 for character portraits, 16:9 for scene illustrations */
function buildAttempts(kind: "portrait" | "scene"): Attempt[] {
  const aspect = kind === "portrait" ? "3:4" : "16:9";
  return [
    { model: "gemini-2.5-flash-image", modalities: ["IMAGE"], aspectRatio: aspect },
    { model: "gemini-2.5-flash-image", modalities: ["TEXT", "IMAGE"], aspectRatio: aspect },
    { model: "gemini-2.5-flash-image", modalities: ["IMAGE"] },
    { model: "gemini-2.5-flash-image-preview", modalities: ["TEXT", "IMAGE"], aspectRatio: aspect },
    { model: "gemini-2.0-flash-preview-image-generation", modalities: ["TEXT", "IMAGE"] },
  ];
}

export async function POST(req: Request) {
  let body: ImageRequestBody;
  try {
    body = (await req.json()) as ImageRequestBody;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const { apiKey, prompt, kind, subject } = body ?? ({} as ImageRequestBody);
  if (!apiKey) return NextResponse.json({ error: "Missing Gemini API key." }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Missing image prompt." }, { status: 400 });

  let lastError = "Image generation failed.";

  for (const attempt of buildAttempts(kind)) {
    const generationConfig: Record<string, unknown> = {
      responseModalities: attempt.modalities,
    };
    if (attempt.aspectRatio) {
      generationConfig.imageConfig = { aspectRatio: attempt.aspectRatio };
    }

    try {
      const res = await fetch(`${GEMINI_BASE}/${attempt.model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig,
        }),
        signal: AbortSignal.timeout(110_000),
      });

      const raw = await res.text();

      if (!res.ok) {
        try {
          const err = JSON.parse(raw) as GeminiImageResponse;
          lastError = err.error?.message ?? raw.slice(0, 300);
        } catch {
          lastError = raw.slice(0, 300);
        }
        // 404 → model unavailable for this key, try the next candidate model
        continue;
      }

      const data = JSON.parse(raw) as GeminiImageResponse;
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/"));

      if (!imagePart?.inlineData) {
        const textOut = parts.map((p) => p.text ?? "").join(" ").trim();
        lastError = textOut
          ? `Model replied with text instead of an image: "${textOut.slice(0, 140)}"`
          : "Model returned no image data.";
        continue;
      }

      // Persist so the image survives refresh (base64 kept out of localStorage)
      const row = await db.generatedImage.create({
        data: {
          kind,
          subject: subject ?? "",
          prompt: prompt.slice(0, 2000),
          mimeType: imagePart.inlineData.mimeType,
          data: imagePart.inlineData.data,
        },
      });

      return NextResponse.json({ id: row.id, url: `/api/images/${row.id}`, kind });
    } catch (err) {
      lastError = err instanceof Error ? err.message : "network error during image generation";
    }
  }

  return NextResponse.json(
    {
      error: `Image generation failed: ${lastError}. Your API key may not have image-model access (check quotas in AI Studio), or all image models were rejected.`,
    },
    { status: 502 }
  );
}
