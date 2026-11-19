// ─────────────────────────────────────────────────────────────
//  AERFÁLA — AI Isekai Roleplay Engine
//  Shared types for the game state, Gemini requests & responses
// ─────────────────────────────────────────────────────────────

export type ArtStyle = "anime" | "painterly" | "semirealistic";
export type Genre = "adventure" | "romance" | "adventure-romance" | "dark-fantasy" | "comedy" | "slice-of-life";
export type Tone = "light-novel" | "epic" | "dark" | "comedic";
export type RomanceLevel = "none" | "wholesome" | "classic" | "intense";
export type Pov = "second" | "first";

export interface ApiSettings {
  apiKey: string;
  chatModel: string; // e.g. gemini-2.5-flash
  artStyle: ArtStyle;
}

export interface WorldSettings {
  worldName: string;
  genre: Genre;
  tone: Tone;
  startScenario: string; // preset label or free text
  romanceLevel: RomanceLevel;
  pov: Pov;
  language: string; // "English", "Indonesian", "Auto-detect"...
  customLore: string; // extra world rules the player wants
}

export interface PlayerSheet {
  name: string;
  pronouns: string;
  age: string;
  appearance: string; // used for portrait generation + GM references
  personality: string;
  originWorld: string; // where they came from before isekai
  howTheyDied: string; // the classic isekai trigger
  className: string;
  cheatSkill: string;
  goals: string;
  portraitUrl?: string | null;
}

export interface CompanionSheet {
  id: string;
  name: string;
  pronouns: string;
  age: string;
  role: string; // knight / mage / healer / rogue...
  dereType: string; // tsundere / kuudere / yandere / deredere ...
  appearance: string;
  personality: string;
  relationship: string; // childhood friend, rival, stranger...
  secret: string; // hidden hook the GM knows but the player doesn't
  portraitUrl?: string | null;
}

export interface DialogLine {
  speaker: string;
  text: string;
  mood?: string;
}

export interface RelationshipEntry {
  name: string;
  level: string;
  note?: string;
}

export interface KnownNpc {
  name: string;
  role?: string;
  appearance?: string;
  portraitUrl?: string | null;
}

export interface StoryState {
  location: string;
  time: string;
  day: string;
  quests: string[];
  relationships: RelationshipEntry[];
  knownNpcs: KnownNpc[];
}

export interface GmTurn {
  narration: string;
  dialog: DialogLine[];
  storyState: StoryState;
  choices: string[];
  scenePrompt: string;
  gmNote?: string;
}

export type GameMessage =
  | { id: string; type: "narration"; text: string; scenePrompt?: string; raw?: string }
  | { id: string; type: "dialog"; speaker: string; text: string; mood?: string }
  | { id: string; type: "player"; text: string }
  | { id: string; type: "scene-image"; imageUrl: string; prompt: string }
  | { id: string; type: "gm-note"; text: string }
  | { id: string; type: "system"; text: string };

export interface GameState {
  world: WorldSettings;
  player: PlayerSheet;
  companions: CompanionSheet[];
  messages: GameMessage[];
  storyState: StoryState;
  lastScenePrompt: string;
  lastChoices: string[];
  turnCount: number;
  createdAt: string;
}

// ── Gemini API payload types ──────────────────────────────────

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface ChatRequestBody {
  apiKey: string;
  model: string;
  systemPrompt: string;
  contents: GeminiContent[];
}

export interface ImageRequestBody {
  apiKey: string;
  prompt: string;
  kind: "portrait" | "scene";
  subject?: string;
}

// ── Chat model catalogue ──────────────────────────────────────

export const CHAT_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Recommended — fast & creative" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", hint: "Fastest, lighter stories" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Deepest storytelling, slower" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", hint: "Legacy fallback" },
] as const;

export const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";

export const emptyStoryState = (): StoryState => ({
  location: "",
  time: "",
  day: "",
  quests: [],
  relationships: [],
  knownNpcs: [],
});
