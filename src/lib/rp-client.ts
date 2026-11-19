"use client";

import type { GeminiContent, GmTurn, PlayerSheet, CompanionSheet } from "./rp-types";

export interface TestResult {
  ok?: boolean;
  totalModels?: number;
  chatReady?: boolean;
  imageReady?: boolean;
  error?: string;
}

async function postJson<T>(url: string, body: unknown, timeoutMs = 120_000): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || json.error) {
    throw new Error(json.error || `Request failed (HTTP ${res.status})`);
  }
  return json;
}

export async function requestGmTurn(args: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  contents: GeminiContent[];
}): Promise<GmTurn> {
  const { data } = await postJson<{ data: GmTurn }>("/api/gemini/chat", args);
  return data;
}

export async function generateImage(args: {
  apiKey: string;
  prompt: string;
  kind: "portrait" | "scene";
  subject?: string;
}): Promise<{ id: string; url: string; kind: string }> {
  return postJson("/api/gemini/image", args);
}

export async function testApiKey(apiKey: string): Promise<TestResult> {
  return postJson<TestResult>("/api/gemini/test", { apiKey }, 30_000);
}

export function buildCharacterPortraitPrompt(
  style: string,
  who: PlayerSheet | CompanionSheet,
  role?: string
): { prompt: string; subject: string } {
  const isPlayer = "cheatSkill" in who;
  const prompt = [
    `High quality ${styleText(style)}, single character waist-up portrait, centered composition, detailed expressive face and eyes, soft rim lighting, fantasy background with gentle bokeh, masterpiece quality.`,
    `Character: ${who.name}${who.pronouns ? `, ${who.pronouns}` : ""}${who.age ? `, ${who.age} years old` : ""}${role ? `, ${role}` : ""}.`,
    `Visual appearance: ${who.appearance}.`,
    isPlayer ? `Overall vibe: isekai protagonist with a hidden cheat ability.` : `Overall vibe: ${role ?? "companion"} in a fantasy adventure world.`,
    `Absolutely no text, no watermark, no speech bubbles, one character only.`,
  ].join(" ");
  return { prompt, subject: who.name };
}

export function styleText(style: string): string {
  switch (style) {
    case "painterly":
      return "painterly classical fantasy oil-painting style";
    case "semirealistic":
      return "semi-realistic cinematic concept-art style";
    default:
      return "modern anime / light-novel illustration style";
  }
}

export function uid(prefix = "m"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
