"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Users, MessageSquareDashed, ImagePlus, KeyRound, Swords, Heart, BookOpen } from "lucide-react";

interface LandingProps {
  hasSavedGame: boolean;
  onNewAdventure: () => void;
  onContinue: () => void;
}

const FEATURES = [
  { icon: Wand2, title: "AI Game Master", desc: "Gemini runs the whole world — quests, monsters, kingdoms, consequences." },
  { icon: MessageSquareDashed, title: "Total Dialog Control", desc: "Every NPC line is voiced by the GM. You never break the story." },
  { icon: Users, title: "Companion Designer", desc: "Set name, dere archetype, secrets and bonds before turn one." },
  { icon: ImagePlus, title: "AI Portraits & Scenes", desc: "Generate character art and cinematic scene illustrations on demand." },
];

export function Landing({ hasSavedGame, onNewAdventure, onContinue }: LandingProps) {
  return (
    <main className="aerfala-bg min-h-screen text-stone-200 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* Sigil */}
        <div className="drift mb-6 select-none">
          <div className="relative h-20 w-20">
            <div className="absolute inset-0 rounded-full border border-amber-500/40 rotate-45" />
            <div className="absolute inset-2 rounded-full border border-amber-500/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Swords className="h-8 w-8 text-amber-400" />
            </div>
          </div>
        </div>

        <p className="font-fantasy tracking-[0.35em] text-xs text-amber-500/80 uppercase mb-3">Powered by your Gemini API key</p>
        <h1 className="font-fantasy text-5xl sm:text-7xl font-bold text-center bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(245,158,11,0.25)]">
          AERFÁLA
        </h1>
        <p className="font-fantasy text-sm sm:text-base text-stone-400 tracking-widest mt-2 text-center">
          AI ISEKAI ROLEPLAY ENGINE
        </p>

        <p className="font-story italic text-lg sm:text-xl text-stone-300/90 text-center mt-8 max-w-2xl">
          “You died. Or you didn&apos;t. Either way, you&apos;re not home anymore.”
        </p>
        <p className="text-sm text-stone-400 text-center mt-3 max-w-2xl leading-relaxed">
          Forge your character and companions, choose how you arrive — the Guild, the Academy, a royal summons, or
          the open road — and let the AI Game Master narrate every scene, speak every soul, and paint the world
          you walk through.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
          <Button
            size="lg"
            onClick={onNewAdventure}
            className="h-12 px-8 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-base shadow-[0_0_25px_-5px_rgba(245,158,11,0.6)]"
          >
            <Wand2 className="mr-2 h-5 w-5" />
            {hasSavedGame ? "Start a New Legend" : "Forge Your Legend"}
          </Button>
          {hasSavedGame && (
            <Button
              size="lg"
              variant="outline"
              onClick={onContinue}
              className="h-12 px-8 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 text-base"
            >
              <BookOpen className="mr-2 h-5 w-5" />
              Continue Your Adventure
            </Button>
          )}
        </div>

        <p className="text-xs text-stone-500 mt-4 flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          Bring your own free Gemini API key — it never leaves your browser except to call Google directly.
        </p>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-16 w-full max-w-5xl">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-amber-500/15 bg-stone-900/60 backdrop-blur p-5 hover:border-amber-500/40 transition-colors"
            >
              <f.icon className="h-6 w-6 text-amber-400 mb-3" />
              <h3 className="font-fantasy text-sm font-semibold text-amber-200 tracking-wide">{f.title}</h3>
              <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Genre strip */}
        <div className="flex flex-wrap justify-center gap-2 mt-10 max-w-3xl">
          <Badge variant="outline" className="border-amber-500/30 text-amber-300">Adventurers&apos; Guild</Badge>
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">Cheat Skills</Badge>
          <Badge variant="outline" className="border-rose-500/30 text-rose-300">
            <Heart className="h-3 w-3 mr-1" /> Romance &amp; Dere Archetypes
          </Badge>
          <Badge variant="outline" className="border-purple-500/30 text-purple-300">Color-coded Mana</Badge>
          <Badge variant="outline" className="border-orange-500/30 text-orange-300">Monster Roads</Badge>
          <Badge variant="outline" className="border-teal-500/30 text-teal-300">Hot-spring Slice of Life</Badge>
        </div>
      </div>

      <footer className="mt-auto w-full border-t border-stone-800/80 py-4 text-center text-xs text-stone-500">
        Inspired by sandbox isekai worlds like Aerfála · Your story, your rules · Made with Gemini
      </footer>
    </main>
  );
}
