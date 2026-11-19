import type { CompanionSheet, GameState, PlayerSheet, WorldSettings } from "./rp-types";

// JSON schema sent to Gemini with responseMimeType=application/json
export const GM_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    narration: {
      type: "STRING",
      description:
        "2-4 vivid paragraphs of scene narration describing what happens around the player. Never narrate the player's dialogue, choices or inner thoughts. End with a hook or reaction point.",
    },
    dialog: {
      type: "ARRAY",
      description: "1-6 dialog lines spoken by NPCs this turn. May be empty if nobody speaks.",
      items: {
        type: "OBJECT",
        properties: {
          speaker: { type: "STRING", description: "Exact character name as shown to the player" },
          text: { type: "STRING", description: "What they say, in their unique voice. May include *action beats*." },
          mood: { type: "STRING", description: "One or two words: cheerful, flustered, cold, menacing..." },
        },
        required: ["speaker", "text"],
      },
    },
    storyState: {
      type: "OBJECT",
      description: "Updated persistent world state. Always include all fields.",
      properties: {
        location: { type: "STRING" },
        time: { type: "STRING", description: "e.g. Morning, Midnight, Dusk" },
        day: { type: "STRING", description: "e.g. Day 3" },
        quests: {
          type: "ARRAY",
          description: "Active / known quest hooks (max 5), each a short line",
          items: { type: "STRING" },
        },
        relationships: {
          type: "ARRAY",
          description: "Relationship meter for companions and important NPCs (max 8)",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              level: { type: "STRING", description: "Stranger / Curious / Friendly / Close / Bonded / Rivaled / Hostile..." },
              note: { type: "STRING", description: "One short sentence about the current dynamic" },
            },
            required: ["name", "level"],
          },
        },
        knownNpcs: {
          type: "ARRAY",
          description: "Named NPCs introduced so far (max 12), EXCLUDING the player and starting companions",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              role: { type: "STRING" },
              appearance: { type: "STRING", description: "Visual description usable for portrait art" },
            },
            required: ["name"],
          },
        },
      },
      required: ["location", "time", "day", "quests", "relationships", "knownNpcs"],
    },
    choices: {
      type: "ARRAY",
      description: "Exactly 4 suggested next actions for the player, each a short vivid imperative sentence written from the player's perspective",
      items: { type: "STRING" },
    },
    scenePrompt: {
      type: "STRING",
      description:
        "A rich ENGLISH image-generation prompt for the current scene: subject, action, environment, lighting, mood, camera angle. No character names in quotes, describe visually. Max 60 words.",
    },
    gmNote: {
      type: "STRING",
      description: "Optional short out-of-character note (rules clarification, status effect, level up). Empty string if none.",
    },
  },
  required: ["narration", "dialog", "storyState", "choices", "scenePrompt"],
} as const;

const ROMANCE_RULES: Record<string, string> = {
  none: "No romance. NPCs stay friendly, professional or rivalrous.",
  wholesome:
    "Light romance allowed: blushing, hand-holding, slow-burn feelings. Keep it sweet and PG.",
  classic:
    "Classic light-novel romance: dere archetypes on full display, jealousy, misunderstandings, charged confessions between dungeon dives, kissing allowed. Keep intimate scenes tasteful and fade-to-black.",
  intense:
    "Passionate high-stakes romance: love triangles, dangerous attraction, steamy tension. Keep all intimacy tasteful and fade-to-black before anything explicit. Never sexualize minors.",
};

const ART_STYLE_TEXT: Record<string, string> = {
  anime: "modern anime / light-novel illustration style",
  painterly: "painterly classical fantasy oil-painting style",
  semirealistic: "semi-realistic cinematic concept-art style",
};

const SCENARIO_PRESETS: Record<string, string> = {
  guild: "Start at the Adventurers' Guild — the player walks in to register as a fresh adventurer, guild card exam, quest board, other adventurers watching the newcomer.",
  academy: "Start at the Magic Academy — the player arrives as a mysterious transfer student with an unclassifiable ability, entrance ceremony, curious classmates and strict instructors.",
  summons:
    "Royal Summons — the player is brought before the crown of {world} by guards, a royal secretary explains the kingdom's crisis, and offers a contract.",
  wander: "Free Wanderer — the player wakes at a crossroads near a village with no explanation, free to go anywhere; the world discovers them organically.",
  custom: "Custom opening described by the player below.",
};

function fmtCompanion(c: CompanionSheet): string {
  return [
    `- Name: ${c.name} (${c.pronouns}, age ${c.age || "?"})`,
    `- Role: ${c.role} | Archetype: ${c.dereType}`,
    `- Appearance: ${c.appearance}`,
    `- Personality: ${c.personality}`,
    `- Relationship to player: ${c.relationship}`,
    c.secret ? `- SECRET (never reveal until the story earns it): ${c.secret}` : null,
    c.portraitUrl ? `- [Has generated portrait]` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSystemPrompt(state: Pick<GameState, "world" | "player" | "companions">): string {
  const w: WorldSettings = state.world;
  const p: PlayerSheet = state.player;
  const scenario = SCENARIO_PRESETS[w.startScenario] ?? w.startScenario;
  const scenarioText = scenario.includes("{world}")
    ? scenario.replaceAll("{world}", w.worldName)
    : scenario;

  return `You are the sole GAME MASTER of an immersive ${w.genre.replace("-", " + ")} isekai roleplaying game set in the world of "${w.worldName}". You control EVERYTHING except the player's own decisions.

════════ ABSOLUTE RULES ════════
1. You control the entire world: every NPC, monster, merchant, king, weather, economy, quest board, rumor. Every dialog line of every character is written by you, in their distinct voice.
2. NEVER speak, decide, or think FOR the player. Never write the player's dialog or inner monologue. When the player declares speech or an action, narrate the world's reaction and let NPCs answer in dialog lines.
3. Stay in ${w.pov === "first" ? "FIRST person from the player's eyes" : "SECOND person"} for narration ("You push the guild door open..."). NPCs speak in third person via dialog lines.
4. Companions ${state.companions.length ? "listed below" : "(none yet — you may introduce followers organically)"} travel with or meet the player and MUST act according to their archetype and personality. Their dialog should reflect their dere type vividly.
5. Continuity is sacred: track location, time, quests, relationship levels and every named NPC through storyState. Never contradict established facts.
6. Keep replies immersive and paced: narration 2-4 paragraphs, then dialog lines, then end. Never summarize time away unless the player asks to skip ahead.
7. Out-of-character player input wrapped like (( ... )) is a DIRECTIVE to you (change pacing, scene, rules). Acknowledge it only inside gmNote, then keep the story flowing.
8. Danger and failure are allowed. Rolls are narrative: judge outcomes by fiction, the player's cheat skill, and preparation. Do not always let the player win.
9. ${ROMANCE_RULES[w.romanceLevel] ?? ROMANCE_RULES.classic}
10. Write narration and dialog in ${w.language === "Auto-detect" ? "the same language the player writes in" : w.language}. The scenePrompt field must ALWAYS be in English.
11. Tone: ${w.tone}. Light-novel pacing: mix action, banter, slice-of-life beats.

════════ WORLD ════════
World name: ${w.worldName}
Genre: ${w.genre.replace("-", " + ")} isekai fantasy
Starting scenario: ${scenarioText}
${w.customLore ? `Extra world lore from the player:\n${w.customLore}` : "Extra lore: none — invent consistent lore (guilds, mana colors, kingdoms, monsters) as needed and stay consistent with it."}
World flavor: light-novel logic — Adventurers' Guild with rank cards (F→SSS), quest boards in every town, color-coded mana, dungeons, and hot springs to relax between adventures.

════════ PLAYER SHEET (never control them) ════════
- Name: ${p.name} (${p.pronouns}${p.age ? `, age ${p.age}` : ""})
- Appearance: ${p.appearance}
- Personality: ${p.personality}
- Previous life: from ${p.originWorld || "another world"}; how they crossed over: ${p.howTheyDied || "mysterious death"}
- Class: ${p.className}
- CHEAT SKILL: ${p.cheatSkill} — an ability this world barely understands. Its full potential unfolds gradually.
- Goals: ${p.goals || "unknown — let the story reveal them"}

════════ COMPANIONS (you voice them fully) ════════
${state.companions.length ? state.companions.map(fmtCompanion).join("\n") : "None defined yet. Introduce NPCs freely; if one becomes a recurring companion, add them to knownNpcs with appearance."}

════════ OUTPUT FORMAT ════════
Respond ONLY with JSON matching the schema: { narration, dialog[], storyState{location,time,day,quests[],relationships[],knownNpcs[]}, choices[4], scenePrompt, gmNote }.
- "choices": exactly 4 suggested next actions written from the player's perspective ("Draw your blade and...", "Ask her why..."). Make at least one choice bold/creative.
- "scenePrompt": English image prompt describing the CURRENT scene visually (no text in image).
- "gmNote": short OOC note when needed, else "".
First turn: open the story at the starting scenario — the player's arrival into ${w.worldName}. Show the world noticing a stranger it cannot explain.`;
}

export function buildIntroInstruction(playerName: string): string {
  return `[SYSTEM — begin the adventure] This is turn 1. Open ${playerName}'s story: their arrival in this world at the chosen starting scenario. Introduce at least one companion or NPC with dialog, set the hook, and give 4 first actions.`;
}

export function buildPortraitPrompt(opts: {
  style: string;
  name: string;
  pronouns?: string;
  age?: string;
  appearance: string;
  outfit?: string;
  mood?: string;
  role?: string;
}): string {
  const styleText = ART_STYLE_TEXT[opts.style] ?? ART_STYLE_TEXT.anime;
  return `High quality ${styleText}, single character waist-up portrait, centered composition, detailed expressive face and eyes, soft rim lighting, painterly fantasy background with gentle bokeh, masterpiece quality.
Character: ${opts.name}${opts.pronouns ? `, ${opts.pronouns}` : ""}${opts.age ? `, ${opts.age} years old` : ""}${opts.role ? `, ${opts.role}` : ""}.
Visual appearance: ${opts.appearance}.
${opts.outfit ? `Wearing: ${opts.outfit}.` : ""} Expression: ${opts.mood || "confident, storybook hero"}.
Absolutely no text, no watermark, no speech bubbles, no logo, one character only.`;
}

export function buildScenePrompt(scenePrompt: string, style: string): string {
  const styleText = ART_STYLE_TEXT[style] ?? ART_STYLE_TEXT.anime;
  return `${scenePrompt}. High quality ${styleText}, cinematic composition, dramatic atmospheric lighting, detailed background, masterpiece quality. No text, no watermark, no speech bubbles, no UI elements.`;
}
