"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";
import { CHAT_MODELS } from "@/lib/rp-types";
import type { ArtStyle, RomanceLevel } from "@/lib/rp-types";
import { testApiKey } from "@/lib/rp-client";
import type { TestResult } from "@/lib/rp-client";
import { useRpStore } from "@/lib/rp-store";
import { toast } from "@/hooks/use-toast";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, saveSettings, updateWorld, game } = useRpStore();
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

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
        toast({
          title: "Connection blessed",
          description: `Key valid — ${r.totalModels ?? 0} models visible.${r.imageReady ? " Image models available." : ""}`,
        });
      }
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveSettings({
      apiKey: keyDraft.trim(),
    });
    toast({ title: "Settings saved", description: "Your realm link is updated." });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-stone-900 border-amber-500/25 text-stone-200 max-h-[85vh] overflow-y-auto aerfala-scroll max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-fantasy text-amber-200">Realm Settings</DialogTitle>
          <DialogDescription className="text-stone-400 text-sm">
            Change your Gemini API key, models and story dials at any time — even mid-adventure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* API key */}
          <div className="space-y-2">
            <Label htmlFor="settings-api-key" className="text-stone-300">
              Gemini API key
            </Label>
            <div className="flex gap-2">
              <Input
                id="settings-api-key"
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="AIza..."
                className="bg-stone-950/60 border-stone-700 focus-visible:ring-amber-500/50"
              />
              <Button variant="outline" onClick={handleTest} disabled={testing} className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 shrink-0">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Test
              </Button>
            </div>
            {result?.ok && (
              <p className="text-xs text-emerald-400">
                Valid key · {result.totalModels} models · {result.imageReady ? "image generation ready" : "no image models found"}
              </p>
            )}
            {result?.error && <p className="text-xs text-rose-400">{result.error}</p>}
            <p className="text-[11px] text-stone-500">
              Free keys: <span className="text-amber-400/90">aistudio.google.com/apikey</span>. Stored only in your browser.
            </p>
          </div>

          {/* Chat model */}
          <div className="space-y-2">
            <Label className="text-stone-300">Storyteller model (chat)</Label>
            <Select
              value={settings.chatModel}
              onValueChange={(v) => saveSettings({ chatModel: v })}
            >
              <SelectTrigger className="bg-stone-950/60 border-stone-700 focus:ring-amber-500/50">
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
          </div>

          {/* Art style */}
          <div className="space-y-2">
            <Label className="text-stone-300">Art style for portraits &amp; scenes</Label>
            <Select
              value={settings.artStyle}
              onValueChange={(v) => saveSettings({ artStyle: v as ArtStyle })}
            >
              <SelectTrigger className="bg-stone-950/60 border-stone-700 focus:ring-amber-500/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-stone-900 border-stone-700 text-stone-200">
                <SelectItem value="anime">Anime / light-novel illustration</SelectItem>
                <SelectItem value="painterly">Painterly fantasy oil painting</SelectItem>
                <SelectItem value="semirealistic">Semi-realistic cinematic concept art</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Romance level (edits live game) */}
          {game && (
            <>
              <div className="space-y-2">
                <Label className="text-stone-300">Romance intensity (applies to future scenes)</Label>
                <Select
                  value={game.world.romanceLevel}
                  onValueChange={(v) => updateWorld({ romanceLevel: v as RomanceLevel })}
                >
                  <SelectTrigger className="bg-stone-950/60 border-stone-700 focus:ring-amber-500/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-stone-900 border-stone-700 text-stone-200">
                    <SelectItem value="none">None — pure adventure</SelectItem>
                    <SelectItem value="wholesome">Wholesome — slow-burn, PG</SelectItem>
                    <SelectItem value="classic">Classic light-novel romance</SelectItem>
                    <SelectItem value="intense">Intense — high-stakes passion (tasteful)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-lore" className="text-stone-300">
                  Extra directives to the Game Master (optional)
                </Label>
                <Textarea
                  id="settings-lore"
                  value={game.world.customLore}
                  onChange={(e) => updateWorld({ customLore: e.target.value })}
                  placeholder="e.g. Keep fights tactical; the Guild Master secretly knows me; always end scenes on a cliffhanger."
                  className="bg-stone-950/60 border-stone-700 min-h-[70px] focus-visible:ring-amber-500/50"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="text-stone-400 hover:text-stone-200">
            Close
          </Button>
          <Button onClick={handleSave} className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
