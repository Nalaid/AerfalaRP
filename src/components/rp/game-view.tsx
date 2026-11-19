"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings,
  Users,
  ImagePlus,
  Send,
  Loader2,
  AlertTriangle,
  X,
  MapPin,
  Clock3,
  CalendarDays,
  RefreshCcw,
  Swords,
  Sparkles,
} from "lucide-react";
import { useRpStore, buildContents } from "@/lib/rp-store";
import { buildIntroInstruction, buildSystemPrompt } from "@/lib/gm-prompt";
import { requestGmTurn, generateImage, uid } from "@/lib/rp-client";
import { emptyStoryState, type GmTurn, type GameMessage } from "@/lib/rp-types";
import { CastPanel, SpeakerAvatar, speakerPortraitUrl } from "./cast-panel";
import { SettingsDialog } from "./settings-dialog";
import { toast } from "@/hooks/use-toast";

// ── Normalize whatever Gemini returns into a safe GmTurn ──────

function normalizeTurn(t: Partial<GmTurn> & Record<string, unknown>): GmTurn {
  const ss = (t.storyState ?? {}) as Record<string, unknown>;
  return {
    narration: typeof t.narration === "string" && t.narration.trim() ? t.narration : "The world turns, and the scene shifts around you…",
    dialog: Array.isArray(t.dialog)
      ? (t.dialog as unknown as Array<Record<string, unknown>>)
          .filter((d) => Boolean(d) && typeof d.text === "string")
          .map((d) => ({
            speaker: String(d.speaker ?? "???").slice(0, 60),
            text: String(d.text),
            mood: typeof d.mood === "string" ? d.mood.slice(0, 40) : undefined,
          }))
          .slice(0, 10)
      : [],
    storyState: {
      location: String(ss.location ?? ""),
      time: String(ss.time ?? ""),
      day: String(ss.day ?? ""),
      quests: Array.isArray(ss.quests) ? ss.quests.map(String).slice(0, 6) : [],
      relationships: Array.isArray(ss.relationships)
        ? (ss.relationships as Array<Record<string, unknown>>)
            .filter((r) => r && typeof r.name === "string")
            .map((r) => ({ name: String(r.name), level: String(r.level ?? "?"), note: r.note ? String(r.note) : undefined }))
            .slice(0, 10)
        : [],
      knownNpcs: Array.isArray(ss.knownNpcs)
        ? (ss.knownNpcs as Array<Record<string, unknown>>)
            .filter((n) => n && typeof n.name === "string")
            .map((n) => ({
              name: String(n.name),
              role: n.role ? String(n.role) : undefined,
              appearance: n.appearance ? String(n.appearance) : undefined,
              portraitUrl: null,
            }))
            .slice(0, 15)
        : [],
    },
    choices: Array.isArray(t.choices) ? t.choices.map(String).filter(Boolean).slice(0, 4) : [],
    scenePrompt: typeof t.scenePrompt === "string" ? t.scenePrompt : "",
    gmNote: typeof t.gmNote === "string" ? t.gmNote : "",
  };
}

// ── Narration paragraphs ──────────────────────────────────────

function Narration({ text }: { text: string }) {
  const paras = text.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="parchment rounded-xl p-4 sm:p-5 rise-in">
      <div className="font-story text-[15px] sm:text-base leading-relaxed text-stone-200/95 space-y-3">
        {paras.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}

// ── Message renderer ──────────────────────────────────────────

function MessageView({ msg }: { msg: GameMessage }) {
  switch (msg.type) {
    case "narration":
      return <Narration text={msg.text} />;
    case "dialog": {
      const hasPortrait = Boolean(speakerPortraitUrl(msg.speaker));
      return (
        <div className="flex gap-3 rise-in sm:ml-10">
          <SpeakerAvatar name={msg.speaker} />
          <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-stone-700/70 bg-stone-900/80 px-4 py-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`font-fantasy text-sm ${hasPortrait ? "text-amber-200" : "text-stone-300"}`}>{msg.speaker}</span>
              {msg.mood && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-stone-600 text-stone-400">
                  {msg.mood}
                </Badge>
              )}
            </div>
            <p className="text-sm leading-relaxed text-stone-200/90 whitespace-pre-wrap">{msg.text}</p>
          </div>
        </div>
      );
    }
    case "player":
      return (
        <div className="flex justify-end rise-in">
          <div className="max-w-[85%] rounded-xl rounded-tr-sm border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <p className="font-fantasy text-[11px] text-amber-400/90 mb-1 flex items-center gap-1.5">
              <Swords className="h-3 w-3" /> YOU
            </p>
            <p className="text-sm leading-relaxed text-stone-100 whitespace-pre-wrap">{msg.text}</p>
          </div>
        </div>
      );
    case "scene-image":
      return (
        <div className="rise-in sm:ml-10">
          { }
          <img
            src={msg.imageUrl}
            alt="AI scene illustration"
            className="w-full max-w-2xl rounded-xl border border-amber-500/30 shadow-[0_10px_40px_-15px_rgba(245,158,11,0.4)]"
          />
          <p className="text-[11px] text-stone-500 mt-1.5 italic font-story">Illustrated by Gemini — {msg.prompt.slice(0, 120)}…</p>
        </div>
      );
    case "gm-note":
      return (
        <div className="rounded-xl border border-dashed border-purple-400/40 bg-purple-500/5 px-4 py-3 rise-in">
          <p className="text-[11px] font-fantasy text-purple-300 mb-1 tracking-wider">GM NOTE</p>
          <p className="text-xs text-stone-300 leading-relaxed italic">{msg.text}</p>
        </div>
      );
    case "system":
      return (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 rise-in flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-200/90 leading-relaxed flex-1">{msg.text}</p>
        </div>
      );
    default:
      return null;
  }
}

// ── The game view ─────────────────────────────────────────────

export function GameView() {
  const { game, settings, pending, setPending, pushMessage, removeMessage, applyGmTurn, endGame } = useRpStore();
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [castOpen, setCastOpen] = useState(false);
  const [illustrating, setIllustrating] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ errId: string; message: string; text: string | null; isIntro: boolean } | null>(null);
  const introSentRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // auto-scroll to the newest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [game?.messages.length, pending]);

  const runGmTurn = useCallback(
    async (playerText: string | null, isIntro: boolean) => {
      const g = useRpStore.getState().game;
      if (!g) return;
      if (!settings.apiKey) {
        setSettingsOpen(true);
        toast({ title: "Gemini API key required", description: "Add your key in Realm Settings.", variant: "destructive" });
        return;
      }

      const playerId = playerText ? uid("p") : null;
      if (playerId && playerText) {
        pushMessage({ id: playerId, type: "player", text: playerText });
      }
      setPending(true);
      try {
        const fresh = useRpStore.getState().game!;
        const systemPrompt = buildSystemPrompt(fresh);
        const contents = buildContents(fresh, isIntro && !playerText ? buildIntroInstruction(fresh.player.name) : null);
        const turn = await requestGmTurn({
          apiKey: settings.apiKey,
          model: settings.chatModel,
          systemPrompt,
          contents,
        });
        const normalized = normalizeTurn(turn as Partial<GmTurn> & Record<string, unknown>);
        applyGmTurn(normalized, JSON.stringify(turn));
        setErrorInfo(null);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        if (playerId) removeMessage(playerId); // take the action back so it can be retried
        const errId = uid("e");
        pushMessage({ id: errId, type: "system", text: message });
        setErrorInfo({ errId, message, text: playerText, isIntro });
        toast({ title: "The threads tangled", description: message, variant: "destructive" });
      } finally {
        setPending(false);
      }
    },
    [settings.apiKey, settings.chatModel, pushMessage, removeMessage, applyGmTurn, setPending]
  );

  // fire the opening turn once
  useEffect(() => {
    const g = useRpStore.getState().game;
    if (!g || introSentRef.current) return;
    if (g.messages.length === 0 && !useRpStore.getState().pending) {
      introSentRef.current = true;
      void runGmTurn(null, true);
    }
  }, [runGmTurn]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    void runGmTurn(text, false);
  };

  const handleRetry = () => {
    if (!errorInfo) return;
    removeMessage(errorInfo.errId);
    const { text, isIntro } = errorInfo;
    setErrorInfo(null);
    void runGmTurn(text, isIntro);
  };

  const handleDismissError = () => {
    if (errorInfo) removeMessage(errorInfo.errId);
    setErrorInfo(null);
  };

  const handleIllustrate = async () => {
    const g = useRpStore.getState().game;
    if (!g || !settings.apiKey) return;
    const prompt = g.lastScenePrompt;
    if (!prompt) {
      toast({ title: "No scene to illustrate yet" });
      return;
    }
    setIllustrating(true);
    try {
      const styleText =
        settings.artStyle === "painterly"
          ? "painterly classical fantasy oil-painting style"
          : settings.artStyle === "semirealistic"
            ? "semi-realistic cinematic concept-art style"
            : "modern anime / light-novel illustration style";
      const fullPrompt = `${prompt}. High quality ${styleText}, cinematic composition, dramatic atmospheric lighting, detailed background, masterpiece quality. No text, no watermark, no speech bubbles, no UI elements.`;
      const res = await generateImage({ apiKey: settings.apiKey, prompt: fullPrompt, kind: "scene", subject: g.storyState.location || "scene" });
      pushMessage({ id: uid("s"), type: "scene-image", imageUrl: res.url, prompt });
    } catch (e) {
      toast({ title: "Illustration failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setIllustrating(false);
    }
  };

  if (!game) return null;

  const st = game.storyState ?? emptyStoryState();

  return (
    <div className="aerfala-bg h-screen flex flex-col text-stone-200">
      {/* Header */}
      <header className="shrink-0 border-b border-stone-800/80 bg-stone-950/80 backdrop-blur z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-3">
          <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
            <h1 className="font-fantasy text-base sm:text-lg text-amber-300 tracking-wide truncate">{game.world.worldName}</h1>
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] border-stone-600 text-stone-400">
              Turn {game.turnCount}
            </Badge>
            <div className="hidden md:flex items-center gap-2 text-[11px] text-stone-400">
              {st.location && (
                <span className="flex items-center gap-1 border border-stone-700 rounded-full px-2 py-0.5">
                  <MapPin className="h-3 w-3 text-emerald-400" /> {st.location}
                </span>
              )}
              {st.time && (
                <span className="flex items-center gap-1 border border-stone-700 rounded-full px-2 py-0.5">
                  <Clock3 className="h-3 w-3 text-emerald-400" /> {st.time}
                </span>
              )}
              {st.day && (
                <span className="flex items-center gap-1 border border-stone-700 rounded-full px-2 py-0.5">
                  <CalendarDays className="h-3 w-3 text-emerald-400" /> {st.day}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Cast drawer (mobile / tablet) */}
            <div className="lg:hidden">
              <Sheet open={castOpen} onOpenChange={setCastOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="border-stone-700 text-stone-300 hover:bg-stone-800 h-9 px-2.5">
                    <Users className="h-4 w-4" />
                    <span className="sr-only">Open cast panel</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-stone-950 border-stone-800 overflow-y-auto aerfala-scroll w-[320px] sm:max-w-sm p-4">
                  <SheetHeader className="p-0 pb-3">
                    <SheetTitle className="font-fantasy text-amber-300">Cast &amp; World</SheetTitle>
                    <SheetDescription className="sr-only">Player, companions, NPCs, quests and current scene state</SheetDescription>
                  </SheetHeader>
                  <CastPanel onOpenSettings={() => { setCastOpen(false); setSettingsOpen(true); }} />
                </SheetContent>
              </Sheet>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleIllustrate}
              disabled={illustrating || !game.lastScenePrompt || !settings.apiKey}
              title="Illustrate the current scene with Gemini"
              className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 h-9 px-2.5"
            >
              {illustrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              <span className="hidden sm:inline ml-1.5">Illustrate</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="border-stone-700 text-stone-300 hover:bg-stone-800 h-9 px-2.5"
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">Settings</span>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 h-9 px-2.5"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Abandon run</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-stone-900 border-stone-700 text-stone-200">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-fantasy text-amber-200">Abandon this legend?</AlertDialogTitle>
                  <AlertDialogDescription className="text-stone-400">
                    The story, characters and portraits will be cleared. There is no undo — the world forgets you.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-stone-700 text-stone-300 hover:bg-stone-800">Stay</AlertDialogCancel>
                  <AlertDialogAction onClick={endGame} className="bg-rose-600 hover:bg-rose-500 text-white">
                    Abandon
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto flex">
        {/* Story column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto aerfala-scroll px-3 sm:px-6 py-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {game.messages.length === 0 && !pending && (
                <div className="text-center text-stone-500 py-16">
                  <Sparkles className="h-8 w-8 mx-auto mb-3 text-amber-500/60" />
                  <p className="font-story italic">The first threads of fate are being woven…</p>
                </div>
              )}

              {game.messages.map((m) => (
                <div key={m.id} className="space-y-4">
                  <MessageView msg={m} />
                  {m.type === "system" && errorInfo?.errId === m.id && (
                    <div className="flex gap-2 sm:ml-10">
                      <Button size="sm" onClick={handleRetry} className="h-8 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs">
                        <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Retry {errorInfo.isIntro ? "opening" : "action"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleDismissError} className="h-8 text-stone-400 text-xs">
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {pending && (
                <div className="flex items-center gap-3 rise-in sm:ml-10">
                  <div className="flex gap-1.5">
                    <span className="orb h-2 w-2 rounded-full bg-amber-400" style={{ animationDelay: "0s" }} />
                    <span className="orb h-2 w-2 rounded-full bg-amber-400" style={{ animationDelay: "0.2s" }} />
                    <span className="orb h-2 w-2 rounded-full bg-amber-400" style={{ animationDelay: "0.4s" }} />
                  </div>
                  <p className="text-xs text-stone-500 font-story italic">The Game Master is weaving the scene…</p>
                </div>
              )}
            </div>
          </div>

          {/* Choices + input */}
          <div className="shrink-0 border-t border-stone-800/80 bg-stone-950/70 backdrop-blur">
            <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3 space-y-2.5">
              {game.lastChoices.length > 0 && !pending && (
                <div className="flex flex-wrap gap-2">
                  {game.lastChoices.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => void runGmTurn(c, false)}
                      className="rounded-full border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-200/90 hover:bg-amber-500/15 hover:border-amber-500/60 transition-colors text-left"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={2}
                  placeholder="What do you do? Speak, act, or wrap (( )) for out-of-character commands…"
                  className="resize-none bg-stone-900/80 border-stone-700 focus-visible:ring-amber-500/50 text-sm min-h-[52px] max-h-40"
                />
                <Button
                  onClick={handleSend}
                  disabled={pending || !input.trim()}
                  size="icon"
                  className="h-[52px] w-[52px] shrink-0 bg-amber-500 hover:bg-amber-400 text-stone-950"
                  aria-label="Send action"
                >
                  {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Cast sidebar (desktop) */}
        <aside className="hidden lg:block w-80 xl:w-96 shrink-0 border-l border-stone-800/80 bg-stone-950/50 overflow-y-auto aerfala-scroll p-4">
          <h2 className="font-fantasy text-amber-300 text-sm tracking-wider mb-4">CAST &amp; WORLD</h2>
          <CastPanel onOpenSettings={() => setSettingsOpen(true)} />
        </aside>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
