"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImagePlus, Loader2, MapPin, Clock3, CalendarDays, Scroll, Swords } from "lucide-react";
import { useRpStore } from "@/lib/rp-store";
import { generateImage } from "@/lib/rp-client";
import { toast } from "@/hooks/use-toast";
import type { KnownNpc } from "@/lib/rp-types";

function speakerHue(name: string): string {
  // deterministic warm palette rotation (no blue/indigo)
  const palette = ["text-amber-300", "text-emerald-300", "text-rose-300", "text-purple-300", "text-orange-300", "text-teal-300", "text-lime-300", "text-pink-300"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function speakerPortraitUrl(name: string): string | null {
  const g = useRpStore.getState().game;
  if (!g) return null;
  const n = name.trim().toLowerCase();
  if (g.player.name.trim().toLowerCase() === n) return g.player.portraitUrl ?? null;
  const comp = g.companions.find((c) => c.name.trim().toLowerCase() === n);
  if (comp) return comp.portraitUrl ?? null;
  const npc = (g.storyState.knownNpcs ?? []).find((k) => k.name.trim().toLowerCase() === n);
  if (npc) return npc.portraitUrl ?? null;
  return null;
}

export function SpeakerAvatar({ name, size = "md" }: { name: string; size?: "md" | "sm" }) {
  const url = speakerPortraitUrl(name);
  const cls = size === "md" ? "h-10 w-10" : "h-8 w-8";
  if (url) {
     
    return <img src={url} alt={`${name} portrait`} className={`${cls} rounded-full object-cover border border-amber-500/40 shrink-0`} />;
  }
  return (
    <div className={`${cls} rounded-full border border-stone-600 bg-stone-800 flex items-center justify-center shrink-0`}>
      <span className={`font-fantasy text-xs ${speakerHue(name)}`}>{name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

export function CastPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { game, settings, setPortrait } = useRpStore();
  const [busyNpc, setBusyNpc] = useState<string | null>(null);

  if (!game) return null;
  const st = game.storyState;

  const relFor = (name: string) => {
    const n = name.trim().toLowerCase();
    return (st.relationships ?? []).find((r) => r.name.trim().toLowerCase() === n);
  };

  const forgeNpcPortrait = async (npc: KnownNpc) => {
    if (!settings.apiKey) return;
    if (!npc.appearance) {
      toast({ title: "No visual details yet", description: "The GM hasn't described this character enough to paint them." });
      return;
    }
    setBusyNpc(npc.name);
    try {
      const prompt = `High quality ${settings.artStyle === "painterly" ? "painterly classical fantasy oil-painting style" : settings.artStyle === "semirealistic" ? "semi-realistic cinematic concept-art style" : "modern anime / light-novel illustration style"}, single character waist-up portrait, centered, detailed expressive face, soft rim lighting, fantasy background with gentle bokeh.
Character: ${npc.name}${npc.role ? `, ${npc.role}` : ""}.
Visual appearance: ${npc.appearance}.
No text, no watermark, one character only.`;
      const res = await generateImage({ apiKey: settings.apiKey, prompt, kind: "portrait", subject: npc.name });
      setPortrait({ kind: "npc", name: npc.name }, res.url);
    } catch (e) {
      toast({ title: "Portrait failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setBusyNpc(null);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      {/* World state */}
      <div className="rounded-xl border border-emerald-500/20 bg-stone-900/70 p-4">
        <p className="font-fantasy text-emerald-300 text-xs tracking-wider mb-2.5">CURRENT SCENE</p>
        <div className="space-y-1.5 text-xs text-stone-300">
          <p className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{st.location || "Somewhere unwritten…"}</span>
          </p>
          <p className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{st.time || "—"}</span>
          </p>
          <p className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{st.day || "Day 1"}</span>
          </p>
        </div>
      </div>

      {/* Player */}
      <div className="rounded-xl border border-amber-500/25 bg-stone-900/70 p-4">
        <p className="font-fantasy text-amber-300 text-xs tracking-wider mb-2.5">YOU</p>
        <div className="flex gap-3">
          <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-amber-500/30 bg-stone-950">
            {game.player.portraitUrl ? (
               
              <img src={game.player.portraitUrl} alt="player" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center font-fantasy text-amber-400 text-xl">
                {game.player.name.slice(0, 1) || "?"}
              </div>
            )}
          </div>
          <div className="min-w-0 text-xs">
            <p className="text-amber-200 font-medium truncate">{game.player.name}</p>
            <p className="text-stone-400 mt-0.5">{game.player.className || "Unclassified"}</p>
            {game.player.cheatSkill && (
              <p className="text-emerald-300/90 mt-1 leading-snug">
                <Swords className="h-3 w-3 inline mr-1" />
                {game.player.cheatSkill}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Companions */}
      {game.companions.length > 0 && (
        <div className="rounded-xl border border-rose-500/20 bg-stone-900/70 p-4">
          <p className="font-fantasy text-rose-300 text-xs tracking-wider mb-2.5">COMPANIONS</p>
          <div className="space-y-3">
            {game.companions.map((c) => {
              const rel = relFor(c.name);
              return (
                <div key={c.id} className="flex gap-2.5">
                  <div className="h-12 w-10 shrink-0 overflow-hidden rounded-md border border-stone-700 bg-stone-950">
                    {c.portraitUrl ? (
                       
                      <img src={c.portraitUrl} alt={c.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center font-fantasy text-stone-500 text-sm">
                        {c.name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-stone-200 text-xs font-medium truncate">
                      {c.name} <span className="text-stone-500">· {c.role || "?"} · {c.dereType || "?"}</span>
                    </p>
                    {rel && (
                      <Badge variant="outline" className="mt-1 text-[10px] border-rose-500/40 text-rose-300 px-1.5 py-0">
                        {rel.level}
                      </Badge>
                    )}
                    {rel?.note && <p className="text-[11px] text-stone-500 mt-1 leading-snug line-clamp-2">{rel.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Known NPCs */}
      {(st.knownNpcs ?? []).length > 0 && (
        <div className="rounded-xl border border-stone-700/60 bg-stone-900/70 p-4">
          <p className="font-fantasy text-stone-300 text-xs tracking-wider mb-2.5">SOULS YOU&apos;VE MET</p>
          <div className="space-y-2.5 max-h-64 overflow-y-auto aerfala-scroll pr-1">
            {(st.knownNpcs ?? []).map((n) => (
              <div key={n.name} className="flex items-center gap-2">
                <SpeakerAvatar name={n.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-stone-300 truncate">{n.name}</p>
                  {n.role && <p className="text-[10px] text-stone-500 truncate">{n.role}</p>}
                </div>
                {!n.portraitUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => forgeNpcPortrait(n)}
                    disabled={busyNpc === n.name}
                    className="h-7 px-2 text-[10px] text-stone-400 hover:text-amber-300"
                    title="Generate portrait"
                  >
                    {busyNpc === n.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quests */}
      {(st.quests ?? []).length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-stone-900/70 p-4">
          <p className="font-fantasy text-amber-300 text-xs tracking-wider mb-2.5 flex items-center gap-1.5">
            <Scroll className="h-3.5 w-3.5" /> QUEST BOARD
          </p>
          <ul className="space-y-2">
            {(st.quests ?? []).map((q, i) => (
              <li key={i} className="text-xs text-stone-300 leading-snug flex gap-2">
                <span className="text-amber-500/80 shrink-0">◆</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={onOpenSettings} className="w-full text-center text-[11px] text-stone-500 hover:text-amber-300 transition-colors py-1">
        Realm settings &amp; GM directives →
      </button>
    </div>
  );
}
