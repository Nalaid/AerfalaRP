"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Wand2,
  Globe2,
  UserRound,
  UsersRound,
  ScrollText,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  RefreshCcw,
  Trash2,
  Plus,
  KeyRound,
  ArrowLeft,
  Sparkles,
  Lock,
} from "lucide-react";
import { CHAT_MODELS, type ArtStyle, type CompanionSheet, type Genre, type PlayerSheet, type RomanceLevel, type Tone } from "@/lib/rp-types";
import { buildCharacterPortraitPrompt, generateImage, testApiKey, uid } from "@/lib/rp-client";
import type { TestResult } from "@/lib/rp-client";
import { useRpStore } from "@/lib/rp-store";
import { toast } from "@/hooks/use-toast";

// ── Small helpers ─────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-stone-300 text-sm">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-stone-500 leading-snug">{hint}</p>}
    </div>
  );
}

function ChipRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
            value === o
              ? "border-amber-500/70 bg-amber-500/15 text-amber-300"
              : "border-stone-700 text-stone-400 hover:border-amber-500/40 hover:text-amber-300/80"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

const inputCls = "bg-stone-950/60 border-stone-700 focus-visible:ring-amber-500/50 text-stone-200";

// ── Portrait box ──────────────────────────────────────────────

function PortraitBox({
  url,
  generating,
  onGenerate,
  onClear,
  label,
}: {
  url?: string | null;
  generating: boolean;
  onGenerate: () => void;
  onClear?: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-lg border border-amber-500/30 bg-stone-950/70">
        {url ? (
           
          <img src={url} alt={`${label} portrait`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-stone-600">
            <ImagePlus className="h-7 w-7" />
            <span className="text-[10px] px-2 text-center leading-tight">No portrait yet</span>
          </div>
        )}
        {generating && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-950/80">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onGenerate}
          disabled={generating}
          className="h-7 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-[11px] px-2"
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : url ? <RefreshCcw className="h-3 w-3" /> : <Wand2 className="h-3 w-3" />}
          {url ? "Regenerate" : "Forge Portrait"}
        </Button>
        {url && onClear && (
          <Button type="button" size="sm" variant="ghost" onClick={onClear} className="h-7 text-stone-500 hover:text-rose-400 text-[11px] px-2">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Step 1: API / realm link ──────────────────────────────────

function ApiStep() {
  const { settings, saveSettings } = useRpStore();
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  // Debounced autosave: the key becomes usable even if the player skips "Test"
  useEffect(() => {
    const t = setTimeout(() => {
      if (keyDraft.trim() !== settings.apiKey) saveSettings({ apiKey: keyDraft.trim() });
    }, 600);
    return () => clearTimeout(t);
     
  }, [keyDraft]);

  const handleTest = async () => {
    if (!keyDraft.trim()) {
      toast({ title: "Enter your API key first", variant: "destructive" });
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const r = await testApiKey(keyDraft.trim());
      setResult(r);
      if (r.ok) {
        saveSettings({ apiKey: keyDraft.trim() });
        toast({
          title: "The realm accepts your key",
          description: `${r.totalModels ?? 0} models visible${r.imageReady ? " · image generation ready" : ""}.`,
        });
      }
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-stone-400 leading-relaxed">
        <span className="flex items-center gap-1.5 text-amber-300 font-medium mb-1">
          <KeyRound className="h-3.5 w-3.5" /> Bring your own Gemini API key
        </span>
        This engine talks directly to Google&apos;s Gemini API for storytelling <em>and</em> image generation.
        Grab a free key at <span className="text-amber-400">aistudio.google.com/apikey</span>. It is stored only in
        your browser and sent straight to Google — never to anyone else.
      </div>

      <Field label="Gemini API key" hint="Starts with AIza… · saved as your default for every future session.">
        <div className="flex gap-2">
          <Input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="AIzaSy…"
            className={inputCls}
          />
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing}
            className="shrink-0 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Test
          </Button>
        </div>
      </Field>

      {result?.ok && (
        <p className="text-xs text-emerald-400">
          Key valid · {result.totalModels} models visible · {result.imageReady ? "image generation ready" : "no image models on this key"}
        </p>
      )}
      {result?.error && <p className="text-xs text-rose-400">{result.error}</p>}

      <Field label="Storyteller model" hint="Flash is the sweet spot; Pro writes slower, deeper arcs.">
        <Select value={settings.chatModel} onValueChange={(v) => saveSettings({ chatModel: v })}>
          <SelectTrigger className={inputCls}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-stone-900 border-stone-700 text-stone-200">
            {CHAT_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label} — {m.hint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Art style (portraits & scene illustrations)">
        <Select value={settings.artStyle} onValueChange={(v) => saveSettings({ artStyle: v as ArtStyle })}>
          <SelectTrigger className={inputCls}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-stone-900 border-stone-700 text-stone-200">
            <SelectItem value="anime">Anime / light-novel illustration</SelectItem>
            <SelectItem value="painterly">Painterly fantasy oil painting</SelectItem>
            <SelectItem value="semirealistic">Semi-realistic cinematic concept art</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

// ── Step 2: World ─────────────────────────────────────────────

const GENRES: { id: Genre; label: string; icon: string }[] = [
  { id: "adventure-romance", label: "Adventure + Romance", icon: "⚔️❤️" },
  { id: "adventure", label: "Pure Adventure", icon: "⚔️" },
  { id: "romance", label: "Romance-focused", icon: "❤️" },
  { id: "dark-fantasy", label: "Dark Fantasy", icon: "🕯️" },
  { id: "comedy", label: "Comedy Isekai", icon: "🎭" },
  { id: "slice-of-life", label: "Slice of Life", icon: "🍵" },
];

const TONES: { id: Tone; label: string }[] = [
  { id: "light-novel", label: "Light novel — snappy, fun, trope-aware" },
  { id: "epic", label: "Epic — sweeping and dramatic" },
  { id: "dark", label: "Dark — gritty stakes, real losses" },
  { id: "comedic", label: "Comedic — jokes and chaos" },
];

const ROMANCE: { id: RomanceLevel; label: string }[] = [
  { id: "none", label: "None — pure adventure" },
  { id: "wholesome", label: "Wholesome — slow-burn, PG" },
  { id: "classic", label: "Classic light-novel romance" },
  { id: "intense", label: "Intense — high-stakes passion (tasteful)" },
];

const SCENARIOS = [
  { id: "guild", label: "Adventurers' Guild", desc: "Walk in, register, get your rank card. Quest boards await." },
  { id: "academy", label: "Magic Academy", desc: "Mysterious transfer student with an unclassifiable gift." },
  { id: "summons", label: "Royal Summons", desc: "Dragged before the crown. A kingdom in crisis wants you." },
  { id: "wander", label: "Free Wanderer", desc: "Wake at a crossroads. Let the world find you." },
];

export interface WorldDraft {
  worldName: string;
  genre: Genre;
  tone: Tone;
  startScenario: string;
  customScenario: string;
  romanceLevel: RomanceLevel;
  pov: "second" | "first";
  language: string;
  customLore: string;
}

function WorldStep({ draft, set }: { draft: WorldDraft; set: (p: Partial<WorldDraft>) => void }) {
  return (
    <div className="space-y-5">
      <Field label="World name" hint="The GM will build lore around this name.">
        <Input value={draft.worldName} onChange={(e) => set({ worldName: e.target.value })} className={inputCls} placeholder="Aerfála" />
      </Field>

      <Field label="Genre">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {GENRES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => set({ genre: g.id })}
              className={`rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                draft.genre === g.id
                  ? "border-amber-500/70 bg-amber-500/10 text-amber-200"
                  : "border-stone-700 text-stone-400 hover:border-amber-500/40"
              }`}
            >
              <span className="mr-1">{g.icon}</span>
              {g.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Narration tone">
        <Select value={draft.tone} onValueChange={(v) => set({ tone: v as Tone })}>
          <SelectTrigger className={inputCls}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-stone-900 border-stone-700 text-stone-200">
            {TONES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Where does your story begin?" hint="Sandbox at heart — the world opens up after the opening scene.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => set({ startScenario: s.id })}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                draft.startScenario === s.id
                  ? "border-amber-500/70 bg-amber-500/10"
                  : "border-stone-700 hover:border-amber-500/40"
              }`}
            >
              <span className="block text-sm font-medium text-amber-200/90">{s.label}</span>
              <span className="block text-[11px] text-stone-400 mt-0.5 leading-snug">{s.desc}</span>
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => set({ startScenario: "custom" })}
          className={`mt-1 text-xs ${draft.startScenario === "custom" ? "text-amber-300" : "text-stone-400"}`}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" /> Or write your own opening…
        </Button>
        {draft.startScenario === "custom" && (
          <Textarea
            value={draft.customScenario}
            onChange={(e) => set({ customScenario: e.target.value })}
            placeholder="e.g. I wash up on the black-sand coast of a demon realm, with no memory and a talking sword…"
            className={`${inputCls} min-h-[80px] mt-2`}
          />
        )}
      </Field>

      <Field label="Romance intensity">
        <Select value={draft.romanceLevel} onValueChange={(v) => set({ romanceLevel: v as RomanceLevel })}>
          <SelectTrigger className={inputCls}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-stone-900 border-stone-700 text-stone-200">
            {ROMANCE.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Narration voice">
          <Select value={draft.pov} onValueChange={(v) => set({ pov: v as "second" | "first" })}>
            <SelectTrigger className={inputCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-stone-900 border-stone-700 text-stone-200">
              <SelectItem value="second">Second person — “You push the door open…”</SelectItem>
              <SelectItem value="first">First person — “I push the door open…”</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Story language">
          <Select value={draft.language} onValueChange={(v) => set({ language: v })}>
            <SelectTrigger className={inputCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-stone-900 border-stone-700 text-stone-200">
              {["English", "Indonesian", "Japanese", "Spanish", "Portuguese", "Filipino", "Vietnamese", "Auto-detect"].map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field
        label="Custom world rules (optional)"
        hint="Anything the GM must obey: factions, your own magic system, banned tropes, pacing notes…"
      >
        <Textarea
          value={draft.customLore}
          onChange={(e) => set({ customLore: e.target.value })}
          placeholder="e.g. Guild cards outrank noble signatures. Mana glows a personal color. The demon realm border is closed this year…"
          className={`${inputCls} min-h-[80px]`}
        />
      </Field>
    </div>
  );
}

// ── Step 3: Player ────────────────────────────────────────────

export interface PlayerDraft extends Omit<PlayerSheet, "portraitUrl"> {
  portraitUrl?: string | null;
}

const PRONOUNS = ["he/him", "she/her", "they/them"];
const DEATHS = ["Truck-kun", "Overworked to death", "Heroic sacrifice", "Struck by mysterious light", "Fell asleep and never woke", "Choked on instant noodles"];
const CLASSES = ["Swordsman", "Mage", "Necromancer", "Beast Tamer", "Alchemist", "Bard", "Rogue", "Unremarkable Villager (sure…)"];
const CHEATS = [
  "A system that levels without limit",
  "Copy any skill once seen",
  "Save & load reality like a game",
  "Speak with the dead",
  "Absolute luck",
  "Bottomless inventory",
  "Write minor edits into the world",
];

function PlayerStep({
  draft,
  set,
  onPortrait,
  generating,
}: {
  draft: PlayerDraft;
  set: (p: Partial<PlayerDraft>) => void;
  onPortrait: () => void;
  generating: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col-reverse sm:flex-row gap-5">
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Name">
              <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} placeholder="Kael" />
            </Field>
            <Field label="Pronouns">
              <Select value={draft.pronouns} onValueChange={(v) => set({ pronouns: v })}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="pick" />
                </SelectTrigger>
                <SelectContent className="bg-stone-900 border-stone-700 text-stone-200">
                  {PRONOUNS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Age">
              <Input value={draft.age} onChange={(e) => set({ age: e.target.value })} className={inputCls} placeholder="17" />
            </Field>
          </div>

          <Field label="Appearance" hint="Describe hair, eyes, build, vibe — the AI paints the portrait from this.">
            <Textarea
              value={draft.appearance}
              onChange={(e) => set({ appearance: e.target.value })}
              placeholder="Messy black hair, sharp crimson eyes, lean build, faint scar over the left brow, wears a hooded traveler coat…"
              className={`${inputCls} min-h-[70px]`}
            />
          </Field>

          <Field label="Personality">
            <Textarea
              value={draft.personality}
              onChange={(e) => set({ personality: e.target.value })}
              placeholder="Cautious but curious; deadpan humor; secretly terrified of ghosts; loyal to a fault…"
              className={`${inputCls} min-h-[60px]`}
            />
          </Field>
        </div>

        <div className="sm:w-44 flex sm:flex-col items-center gap-3 justify-center">
          <PortraitBox
            url={draft.portraitUrl}
            generating={generating}
            onGenerate={onPortrait}
            onClear={() => set({ portraitUrl: null })}
            label={draft.name || "player"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Previous life (origin world)">
          <Input value={draft.originWorld} onChange={(e) => set({ originWorld: e.target.value })} className={inputCls} placeholder="Modern Earth, dead-end office job" />
        </Field>
        <Field label="How you crossed over">
          <Input value={draft.howTheyDied} onChange={(e) => set({ howTheyDied: e.target.value })} className={inputCls} placeholder="Truck-kun" />
          <div className="mt-2">
            <ChipRow options={DEATHS} value={draft.howTheyDied} onChange={(v) => set({ howTheyDied: v })} />
          </div>
        </Field>
      </div>

      <Field label="Class" hint="The system barely understands your class — lean weird.">
        <Input value={draft.className} onChange={(e) => set({ className: e.target.value })} className={inputCls} placeholder="Swordsman" />
        <div className="mt-2">
          <ChipRow options={CLASSES} value={draft.className} onChange={(v) => set({ className: v })} />
        </div>
      </Field>

      <Field label="Cheat skill" hint="Your unfair advantage. The GM will unfold it gradually — start weak, break worlds later.">
        <Input value={draft.cheatSkill} onChange={(e) => set({ cheatSkill: e.target.value })} className={inputCls} placeholder="Save & load reality like a game" />
        <div className="mt-2">
          <ChipRow options={CHEATS} value={draft.cheatSkill} onChange={(v) => set({ cheatSkill: v })} />
        </div>
      </Field>

      <Field label="Goals (optional)">
        <Input value={draft.goals} onChange={(e) => set({ goals: e.target.value })} className={inputCls} placeholder="Reach SSS rank, find the others who crossed over, survive…" />
      </Field>
    </div>
  );
}

// ── Step 4: Companions ────────────────────────────────────────

const ROLES = ["Knight", "Mage", "Healer", "Rogue", "Archer", "Beast-girl", "Spirit", "Priestess", "Rival Adventurer"];
const DERE = ["Tsundere", "Kuudere", "Deredere", "Dandere", "Yandere", "Himedere", "Onee-san", "Genki"];
const RELATIONSHIPS = ["Childhood friend", "Stranger who joins you", "Rival turned ally", "Owes you a debt", "Assigned by the Guild", "Summoned spirit bound to you", "Mysterious stranger", "Betrothed by arrangement"];

export interface CompanionDraft extends Omit<CompanionSheet, "portraitUrl"> {
  portraitUrl?: string | null;
}

function CompanionCard({
  c,
  onChange,
  onRemove,
  onPortrait,
  generating,
}: {
  c: CompanionDraft;
  onChange: (p: Partial<CompanionDraft>) => void;
  onRemove: () => void;
  onPortrait: () => void;
  generating: boolean;
}) {
  return (
    <Card className="border-amber-500/20 bg-stone-900/70">
      <CardContent className="p-4">
        <div className="flex flex-col-reverse sm:flex-row gap-4">
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Field label="Name">
                <Input value={c.name} onChange={(e) => onChange({ name: e.target.value })} className={inputCls} placeholder="Lyra" />
              </Field>
              <Field label="Pronouns">
                <Select value={c.pronouns} onValueChange={(v) => onChange({ pronouns: v })}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="pick" />
                  </SelectTrigger>
                  <SelectContent className="bg-stone-900 border-stone-700 text-stone-200">
                    {PRONOUNS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Age">
                <Input value={c.age} onChange={(e) => onChange({ age: e.target.value })} className={inputCls} placeholder="18" />
              </Field>
              <Field label="Relationship to you">
                <Input value={c.relationship} onChange={(e) => onChange({ relationship: e.target.value })} className={inputCls} placeholder="Childhood friend" />
              </Field>
            </div>

            <div>
              <p className="text-xs text-stone-400 mb-1.5">Role</p>
              <ChipRow options={ROLES} value={c.role} onChange={(v) => onChange({ role: v })} />
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-1.5">Dere archetype</p>
              <ChipRow options={DERE} value={c.dereType} onChange={(v) => onChange({ dereType: v })} />
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-1.5">Relationship presets</p>
              <ChipRow options={RELATIONSHIPS} value={c.relationship} onChange={(v) => onChange({ relationship: v })} />
            </div>

            <Field label="Appearance" hint="Used to forge their portrait.">
              <Textarea
                value={c.appearance}
                onChange={(e) => onChange({ appearance: e.target.value })}
                placeholder="Silver twin-tails, amber eyes, small fang when flustered, guild uniform with a too-big sword…"
                className={`${inputCls} min-h-[55px]`}
              />
            </Field>
            <Field label="Personality">
              <Textarea
                value={c.personality}
                onChange={(e) => onChange({ personality: e.target.value })}
                placeholder="Fierce on the surface, soft underneath; competitive about everything; terrible cook…"
                className={`${inputCls} min-h-[55px]`}
              />
            </Field>
            <Field label="Secret (the GM knows — you don't)" hint="A hidden hook: true identity, curse, past debt, hidden feelings…">
              <Input value={c.secret} onChange={(e) => onChange({ secret: e.target.value })} className={inputCls} placeholder="She is the runaway heir of a fallen duchy…" />
            </Field>
          </div>

          <div className="sm:w-36 flex sm:flex-col items-center gap-2 justify-center">
            <PortraitBox url={c.portraitUrl} generating={generating} onGenerate={onPortrait} onClear={() => onChange({ portraitUrl: null })} label={c.name || "companion"} />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRemove}
              className="text-stone-500 hover:text-rose-400 h-7 text-[11px]"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Step 5: Review ────────────────────────────────────────────

function ReviewStep({
  world,
  player,
  companions,
  onStart,
  starting,
  canStart,
  missing,
}: {
  world: WorldDraft;
  player: PlayerDraft;
  companions: CompanionDraft[];
  onStart: () => void;
  starting: boolean;
  canStart: boolean;
  missing: string[];
}) {
  const scenarioLabel =
    SCENARIOS.find((s) => s.id === world.startScenario)?.label ?? (world.startScenario === "custom" ? "Custom opening" : world.startScenario);
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm text-stone-300">
        <p className="font-fantasy text-emerald-300 text-base mb-1">Everything is set.</p>
        Once you begin, the AI Game Master takes full control of the world and every soul in it — narration,
        NPC dialog, quests, romance arcs and consequences. You steer <em>your</em> actions only. You can adjust
        romance, art style and directives anytime from in-game settings.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-amber-500/25 bg-stone-900/70">
          <CardContent className="p-4">
            <p className="font-fantasy text-amber-200 text-sm mb-3 flex items-center gap-2">
              <UserRound className="h-4 w-4" /> Player
            </p>
            <div className="flex gap-3">
              {player.portraitUrl && (
                 
                <img src={player.portraitUrl} alt="player portrait" className="h-20 w-16 rounded object-cover border border-amber-500/30" />
              )}
              <div className="text-sm space-y-1 text-stone-300">
                <p>
                  <span className="text-stone-500">Name:</span> <span className="text-amber-200">{player.name || "—"}</span>{" "}
                  <span className="text-stone-500">({player.pronouns}{player.age ? `, ${player.age}` : ""})</span>
                </p>
                <p><span className="text-stone-500">Class:</span> {player.className || "—"}</p>
                <p><span className="text-stone-500">Cheat skill:</span> {player.cheatSkill || "—"}</p>
                <p className="text-xs text-stone-500">
                  {scenarioLabel} · {world.genre.replace("-", " + ")} · {world.tone} · romance: {world.romanceLevel} · {world.language}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/25 bg-stone-900/70">
          <CardContent className="p-4">
            <p className="font-fantasy text-amber-200 text-sm mb-3 flex items-center gap-2">
              <UsersRound className="h-4 w-4" /> Companions ({companions.length})
            </p>
            {companions.length === 0 ? (
              <p className="text-sm text-stone-500">No companions — the GM will introduce people as the story needs.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto aerfala-scroll pr-1">
                {companions.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 text-sm">
                    {c.portraitUrl ? (
                       
                      <img src={c.portraitUrl} alt={`${c.name} portrait`} className="h-9 w-7 rounded object-cover border border-amber-500/30" />
                    ) : (
                      <div className="h-9 w-7 rounded border border-stone-700 bg-stone-950" />
                    )}
                    <div className="min-w-0">
                      <p className="text-amber-200/90 truncate">
                        {c.name || "—"} <span className="text-stone-500 text-xs">· {c.role || "?"} · {c.dereType || "?"}</span>
                      </p>
                      <p className="text-[11px] text-stone-500 truncate">{c.relationship || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!canStart && (
        <p className="text-xs text-rose-400">Still needed before beginning: {missing.join(", ")}.</p>
      )}

      <Button
        size="lg"
        onClick={onStart}
        disabled={starting || !canStart}
        className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-base shadow-[0_0_25px_-5px_rgba(245,158,11,0.6)]"
      >
        {starting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Summoning the Game Master…
          </>
        ) : (
          <>
            <ScrollText className="mr-2 h-5 w-5" /> Begin the Adventure
          </>
        )}
      </Button>
    </div>
  );
}

// ── The wizard ────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: "Realm Link", icon: KeyRound },
  { id: 1, label: "World", icon: Globe2 },
  { id: 2, label: "Player", icon: UserRound },
  { id: 3, label: "Companions", icon: UsersRound },
  { id: 4, label: "Begin", icon: ScrollText },
];

export function SetupWizard({ onExit }: { onExit: () => void }) {
  const { settings, startGame } = useRpStore();
  const [step, setStep] = useState(0);
  const [starting, setStarting] = useState(false);

  const [world, setWorld] = useState<WorldDraft>({
    worldName: "Aerfála",
    genre: "adventure-romance",
    tone: "light-novel",
    startScenario: "guild",
    customScenario: "",
    romanceLevel: "classic",
    pov: "second",
    language: "English",
    customLore: "",
  });

  const [player, setPlayer] = useState<PlayerDraft>({
    name: "",
    pronouns: "he/him",
    age: "",
    appearance: "",
    personality: "",
    originWorld: "",
    howTheyDied: "",
    className: "",
    cheatSkill: "",
    goals: "",
    portraitUrl: null,
  });

  const [companions, setCompanions] = useState<CompanionDraft[]>([]);
  const [portraitBusy, setPortraitBusy] = useState<Record<string, boolean>>({});

  const setWorldDraft = (p: Partial<WorldDraft>) => setWorld((w) => ({ ...w, ...p }));
  const setPlayerDraft = (p: Partial<PlayerDraft>) => setPlayer((v) => ({ ...v, ...p }));

  const addCompanion = () => {
    if (companions.length >= 6) {
      toast({ title: "Six companions is plenty", description: "The GM can introduce side characters on the fly." });
      return;
    }
    setCompanions((cs) => [
      ...cs,
      {
        id: uid("c"),
        name: "",
        pronouns: "she/her",
        age: "",
        role: "",
        dereType: "",
        appearance: "",
        personality: "",
        relationship: "",
        secret: "",
        portraitUrl: null,
      },
    ]);
  };

  const forgePortrait = useCallback(
    async (target: "player" | string) => {
      if (!settings.apiKey) {
        toast({ title: "Add your Gemini API key first", description: "Step 1 — Realm Link.", variant: "destructive" });
        return;
      }
      const who = target === "player" ? player : companions.find((c) => c.id === target);
      if (!who) return;
      const name = who.name.trim();
      if (!name) {
        toast({ title: "Give them a name first", variant: "destructive" });
        return;
      }
      if (!who.appearance.trim()) {
        toast({
          title: "Describe their appearance first",
          description: "The portrait is painted from your description.",
          variant: "destructive",
        });
        return;
      }

      setPortraitBusy((b) => ({ ...b, [target]: true }));
      try {
        const { prompt, subject } = buildCharacterPortraitPrompt(
          settings.artStyle,
          who as PlayerSheet | CompanionSheet,
          target === "player" ? player.className || "isekai protagonist" : companions.find((c) => c.id === target)?.role
        );
        const res = await generateImage({ apiKey: settings.apiKey, prompt, kind: "portrait", subject });
        if (target === "player") setPlayerDraft({ portraitUrl: res.url });
        else setCompanions((cs) => cs.map((c) => (c.id === target ? { ...c, portraitUrl: res.url } : c)));
        toast({ title: `Portrait forged for ${subject}` });
      } catch (e) {
        toast({
          title: "Portrait failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setPortraitBusy((b) => ({ ...b, [target]: false }));
      }
    },
    [settings.apiKey, settings.artStyle, player, companions]
  );

  const canStart = useMemo(
    () => Boolean(settings.apiKey.trim() && world.worldName.trim() && player.name.trim()),
    [settings.apiKey, world.worldName, player.name]
  );

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!settings.apiKey.trim()) m.push("your Gemini API key (step 1)");
    if (!world.worldName.trim()) m.push("the world name (step 2)");
    if (!player.name.trim()) m.push("your character name (step 3)");
    return m;
  }, [settings.apiKey, world.worldName, player.name]);

  const handleStart = async () => {
    if (!canStart) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    setStarting(true);
    const worldFinal = {
      worldName: world.worldName.trim(),
      genre: world.genre,
      tone: world.tone,
      startScenario: world.startScenario === "custom" ? world.customScenario.trim() || "Begin with the player's confused arrival in a strange land." : world.startScenario,
      romanceLevel: world.romanceLevel,
      pov: world.pov,
      language: world.language,
      customLore: world.customLore.trim(),
    };
    const playerFinal: PlayerSheet = {
      name: player.name.trim(),
      pronouns: player.pronouns,
      age: player.age.trim(),
      appearance: player.appearance.trim() || "A nondescript traveler whose face the world cannot quite remember.",
      personality: player.personality.trim(),
      originWorld: player.originWorld.trim(),
      howTheyDied: player.howTheyDied.trim(),
      className: player.className.trim() || "Unclassified",
      cheatSkill: player.cheatSkill.trim() || "Unknown — even the system cannot read it",
      goals: player.goals.trim(),
      portraitUrl: player.portraitUrl ?? null,
    };
    const companionsFinal: CompanionSheet[] = companions.map((c) => ({
      id: c.id,
      name: c.name.trim() || "Unnamed companion",
      pronouns: c.pronouns,
      age: c.age.trim(),
      role: c.role.trim(),
      dereType: c.dereType.trim(),
      appearance: c.appearance.trim(),
      personality: c.personality.trim(),
      relationship: c.relationship.trim(),
      secret: c.secret.trim(),
      portraitUrl: c.portraitUrl ?? null,
    }));

    // small delay so the button state reads before the view switches
    await new Promise((r) => setTimeout(r, 400));
    startGame(worldFinal, playerFinal, companionsFinal);
  };

  return (
    <main className="aerfala-bg min-h-screen text-stone-200 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-stone-800/80 bg-stone-950/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button onClick={onExit} className="flex items-center gap-2 text-sm text-stone-400 hover:text-amber-300 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="font-fantasy text-lg text-amber-300 tracking-wide">Forge Your Legend</h1>
          <div className="w-16" />
        </div>
        {/* Stepper */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex items-center gap-1 overflow-x-auto aerfala-scroll">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
                  step === i
                    ? "bg-amber-500/15 border border-amber-500/50 text-amber-300"
                    : step > i
                      ? "text-emerald-400/80 hover:bg-stone-800"
                      : "text-stone-500 hover:bg-stone-800"
                }`}
              >
                <s.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-4 bg-stone-700" />}
            </div>
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
        {step === 0 && <ApiStep />}
        {step === 1 && <WorldStep draft={world} set={setWorldDraft} />}
        {step === 2 && (
          <PlayerStep draft={player} set={setPlayerDraft} onPortrait={() => forgePortrait("player")} generating={Boolean(portraitBusy["player"])} />
        )}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-stone-400">
              Design the cast that travels with you. The Game Master voices them all — their archetype drives how
              they talk, flirt, argue and fight. Secrets stay hidden until the story earns them.
            </p>
            {companions.map((c) => (
              <CompanionCard
                key={c.id}
                c={c}
                onChange={(p) => setCompanions((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...p } : x)))}
                onRemove={() => setCompanions((cs) => cs.filter((x) => x.id !== c.id))}
                onPortrait={() => forgePortrait(c.id)}
                generating={Boolean(portraitBusy[c.id])}
              />
            ))}
            <button
              onClick={addCompanion}
              className="w-full rounded-lg border border-dashed border-amber-500/40 py-4 text-sm text-amber-300/90 hover:bg-amber-500/5 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add a companion
            </button>
          </div>
        )}
        {step === 4 && (
          <ReviewStep world={world} player={player} companions={companions} onStart={handleStart} starting={starting} canStart={canStart} missing={missing} />
        )}

        <Separator className="my-6 bg-stone-800" />

        {/* Nav */}
        <div className="flex items-center justify-between pb-6">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="border-stone-700 text-stone-300 hover:bg-stone-800">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <span className="text-xs text-stone-500 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Everything above can still be tuned mid-game
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
