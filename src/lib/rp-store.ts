"use client";

import { create } from "zustand";
import type {
  ApiSettings,
  CompanionSheet,
  GameState,
  GeminiContent,
  GmTurn,
  PlayerSheet,
  WorldSettings,
} from "./rp-types";
import { DEFAULT_CHAT_MODEL, emptyStoryState } from "./rp-types";

const SETTINGS_KEY = "aerfala.api.settings.v1";
const GAME_KEY = "aerfala.game.state.v1";

interface RpStore {
  hydrated: boolean;
  settings: ApiSettings;
  game: GameState | null;
  phase: "landing" | "setup" | "game";
  pending: boolean; // waiting for a GM reply

  hydrate: () => void;
  setPhase: (p: "landing" | "setup" | "game") => void;
  saveSettings: (s: Partial<ApiSettings>) => void;
  startGame: (world: WorldSettings, player: PlayerSheet, companions: CompanionSheet[]) => void;
  updateWorld: (patch: Partial<WorldSettings>) => void;
  pushMessage: (msg: GameState["messages"][number]) => void;
  removeMessage: (id: string) => void;
  applyGmTurn: (turn: GmTurn, raw: string) => void;
  setPortrait: (who: { kind: "player"; } | { kind: "companion"; id: string } | { kind: "npc"; name: string }, url: string) => void;
  setPending: (v: boolean) => void;
  endGame: () => void;
}

function loadSettings(): ApiSettings {
  if (typeof window === "undefined") return { apiKey: "", chatModel: DEFAULT_CHAT_MODEL, artStyle: "anime" };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ApiSettings>;
      return {
        apiKey: parsed.apiKey ?? "",
        chatModel: parsed.chatModel ?? DEFAULT_CHAT_MODEL,
        artStyle: parsed.artStyle ?? "anime",
      };
    }
  } catch {
    /* ignore */
  }
  return { apiKey: "", chatModel: DEFAULT_CHAT_MODEL, artStyle: "anime" };
}

function loadGame(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GAME_KEY);
    if (raw) {
      const g = JSON.parse(raw) as GameState;
      if (g && g.player && g.world && Array.isArray(g.messages)) {
        g.storyState = { ...emptyStoryState(), ...(g.storyState ?? {}) };
        return g;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persistGame(g: GameState | null) {
  if (typeof window === "undefined") return;
  try {
    if (g) window.localStorage.setItem(GAME_KEY, JSON.stringify(g));
    else window.localStorage.removeItem(GAME_KEY);
  } catch {
    /* storage full — ignore */
  }
}

let uid = 0;
const nextId = () => `m${Date.now()}_${++uid}`;

export const useRpStore = create<RpStore>((set, get) => ({
  hydrated: false,
  settings: { apiKey: "", chatModel: DEFAULT_CHAT_MODEL, artStyle: "anime" },
  game: null,
  phase: "landing",
  pending: false,

  hydrate: () => {
    const settings = loadSettings();
    const game = loadGame();
    set({ settings, game, hydrated: true, phase: "landing" });
  },

  setPhase: (p) => set({ phase: p }),

  saveSettings: (s) => {
    const settings = { ...get().settings, ...s };
    set({ settings });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* ignore */
      }
    }
  },

  startGame: (world, player, companions) => {
    const game: GameState = {
      world,
      player,
      companions,
      messages: [],
      storyState: emptyStoryState(),
      lastScenePrompt: "",
      lastChoices: [],
      turnCount: 0,
      createdAt: new Date().toISOString(),
    };
    persistGame(game);
    set({ game, phase: "game" });
  },

  updateWorld: (patch) => {
    const g = get().game;
    if (!g) return;
    const updated = { ...g, world: { ...g.world, ...patch } };
    persistGame(updated);
    set({ game: updated });
  },

  pushMessage: (msg) => {
    const g = get().game;
    if (!g) return;
    const updated = { ...g, messages: [...g.messages, { ...msg, id: msg.id || nextId() }] };
    persistGame(updated);
    set({ game: updated });
  },

  removeMessage: (id) => {
    const g = get().game;
    if (!g) return;
    const updated = { ...g, messages: g.messages.filter((m) => m.id !== id) };
    persistGame(updated);
    set({ game: updated });
  },

  applyGmTurn: (turn, raw) => {
    const g = get().game;
    if (!g) return;
    const msgs: GameState["messages"] = [];
    if (turn.gmNote && turn.gmNote.trim()) msgs.push({ id: nextId(), type: "gm-note", text: turn.gmNote });
    msgs.push({ id: nextId(), type: "narration", text: turn.narration, scenePrompt: turn.scenePrompt, raw });
    for (const d of turn.dialog ?? []) {
      msgs.push({ id: nextId(), type: "dialog", speaker: d.speaker, text: d.text, mood: d.mood });
    }
    const updated: GameState = {
      ...g,
      messages: [...g.messages, ...msgs],
      storyState: { ...emptyStoryState(), ...(turn.storyState ?? {}) },
      lastScenePrompt: turn.scenePrompt || g.lastScenePrompt,
      lastChoices: Array.isArray(turn.choices) ? turn.choices.slice(0, 4) : [],
      turnCount: g.turnCount + 1,
    };
    persistGame(updated);
    set({ game: updated, pending: false });
  },

  setPortrait: (who, url) => {
    const g = get().game;
    if (!g) return;
    const updated = { ...g };
    if (who.kind === "player") {
      updated.player = { ...g.player, portraitUrl: url };
    } else if (who.kind === "companion") {
      updated.companions = g.companions.map((c) => (c.id === who.id ? { ...c, portraitUrl: url } : c));
    } else {
      updated.storyState = {
        ...g.storyState,
        knownNpcs: (g.storyState.knownNpcs ?? []).map((n) => (n.name === who.name ? { ...n, portraitUrl: url } : n)),
      };
    }
    persistGame(updated);
    set({ game: updated });
  },

  setPending: (v) => set({ pending: v }),

  endGame: () => {
    persistGame(null);
    set({ game: null, phase: "landing", pending: false });
  },
}));

// ── Build Gemini contents from stored messages ────────────────

export function buildContents(game: GameState, newUserText: string | null): GeminiContent[] {
  const contents: GeminiContent[] = [];
  let pendingModelParts: string[] = [];
  let coveredByRaw = false; // current GM turn already captured via narration.raw

  const flushModel = () => {
    if (pendingModelParts.length) {
      contents.push({ role: "model", parts: [{ text: pendingModelParts.join("\n") }] });
      pendingModelParts = [];
    }
  };

  for (const m of game.messages) {
    switch (m.type) {
      case "player":
        flushModel();
        coveredByRaw = false;
        contents.push({ role: "user", parts: [{ text: m.text }] });
        break;
      case "narration":
        if (m.raw) {
          pendingModelParts.push(m.raw);
          coveredByRaw = true;
        }
        break;
      case "dialog":
        // Only reconstruct if this dialog was NOT part of a raw GM turn payload
        if (!coveredByRaw) {
          pendingModelParts.push(
            JSON.stringify({ dialog: [{ speaker: m.speaker, text: m.text, mood: m.mood }] })
          );
        }
        break;
      case "gm-note":
        pendingModelParts.push(JSON.stringify({ gmNote: m.text }));
        break;
      default:
        break; // scene-image / system messages are not part of the conversation
    }
  }
  flushModel();

  if (newUserText !== null) contents.push({ role: "user", parts: [{ text: newUserText }] });
  return contents;
}
