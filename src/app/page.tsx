"use client";

import { useEffect } from "react";
import { useRpStore } from "@/lib/rp-store";
import { Landing } from "@/components/rp/landing";
import { SetupWizard } from "@/components/rp/setup-wizard";
import { GameView } from "@/components/rp/game-view";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { hydrated, phase, game, hydrate, setPhase } = useRpStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <main className="aerfala-bg min-h-screen flex items-center justify-center text-stone-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="font-story italic text-sm">Opening the gate between worlds…</p>
        </div>
      </main>
    );
  }

  if (phase === "game" && game) {
    return <GameView />;
  }

  if (phase === "setup") {
    return <SetupWizard onExit={() => setPhase("landing")} />;
  }

  return (
    <Landing
      hasSavedGame={Boolean(game)}
      onNewAdventure={() => setPhase("setup")}
      onContinue={() => setPhase("game")}
    />
  );
}
