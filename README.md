# AERFÁLA — AI Isekai Roleplay Engine

A **Gemini-powered roleplaying game** that runs entirely with **your own Gemini API key**.
Forge a player and a cast of companions before the story begins, then let the AI Game Master
control **everything** in the RP — the world, the plot, every NPC, every line of dialog — while
generating **AI portraits and scene illustrations** for the Player and NPCs along the way.

> *"You died. Or you didn't. Either way, you're not home anymore."*

Inspired by sandbox isekai worlds such as the Voyage.io *GoT Isekai'd — Adventure or Romance
(Aerfála Edition)* experience: isekai arrival, adventure **or** romance genres, companion
relationships, and a world that reacts to you.

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Screens & Game Flow](#screens--game-flow)
3. [How the AI Controls the RP](#how-the-ai-controls-the-rp)
4. [Quick Start](#quick-start)
5. [Getting a Gemini API Key](#getting-a-gemini-api-key)
6. [Project Structure](#project-structure)
7. [Configuration Reference](#configuration-reference)
8. [API Endpoints](#api-endpoints)
9. [Data & Persistence](#data--persistence)
10. [Tech Stack](#tech-stack)
11. [Troubleshooting](#troubleshooting)
12. [FAQ](#faq)

---

## Feature Overview

| Feature | Description |
| --- | --- |
| **Bring Your Own API Key** | Paste your free Gemini API key in the built-in settings. It is stored only in your browser's `localStorage` and forwarded solely to Google's API for your own requests. A **Test** button validates it instantly. |
| **Pre-Game Setup (Player)** | Name, pronouns, age, appearance, personality, previous-life world, *how you crossed over* (Truck-kun included), class (Swordsman / Mage / Necromancer / Beast Tamer / Alchemist / Bard / Rogue), a **cheat skill**, goals — plus one-click **AI portrait generation**. |
| **Pre-Game Setup (Companions)** | Add unlimited companions with name, pronouns, age, role, **dere archetype** (Tsundere, Kuudere, Deredere, Dandere, Yandere, Himedere, Onee-san, Genki…), appearance, personality, relationship to you, and a **secret** the GM knows but hides until the story earns it. Each companion can also get an AI portrait. |
| **World Settings** | World name, genre (Adventure, Romance, Adventure + Romance, Dark Fantasy, Comedy, Slice of Life), tone, starting scenario (Adventurers' Guild / Magic Academy / Royal Summons / Free Wanderer / custom), romance intensity, narration POV (second/first person), story language, and custom lore directives. |
| **AI Game Master** | Gemini acts as the *sole* GM. It narrates the world, runs encounters, judges outcomes, tracks quests, locations, time, relationships, and every named NPC — using a strict JSON contract. |
| **Total Dialog Control** | Every NPC line comes from the GM in structured `dialog` entries with speaker, text, and mood badges. It never speaks or decides for your player. |
| **Choices + Free Input** | Each turn ends with 4 suggested actions (one is always bold/creative), and you can always type anything instead — speech, actions, or `(( out-of-character directives ))`. |
| **Image Creations (Player & NPC)** | Portrait generation for the player, every companion, and NPCs you meet (via the cast panel). **Illustrate** button renders the current scene as cinematic 16:9 art. Art style: anime, painterly, or semi-realistic. |
| **Persistent Story** | The whole game (story log, world state, choices, portraits) auto-saves in your browser. Close the tab, come back, *Continue Your Adventure*. |
| **GM Notes & Mid-Game Tuning** | Out-of-character GM notes render as distinct cards. Romance intensity and extra GM directives can be changed mid-game from Settings. |

---

## Screens & Game Flow

```
Landing ("Forge Your Legend")
        │
        ▼
Setup Wizard ── Step 0: API key + storyteller model + art style
        │      Step 1: World (name, genre, scenario, romance, POV, language, lore)
        │      Step 2: Player sheet (+ optional portrait)
        │      Step 3: Companions (+ optional portraits)
        │      Step 4: Review → "Begin the Adventure"
        ▼
Game View
  ├── Story column: narration → NPC dialog cards → your actions
  ├── Choice chips (4 per turn) + free-text input
  ├── "Illustrate" → AI scene image of the current moment
  └── Cast & World sidebar: scene state, you, companions,
      souls you've met (one-click NPC portraits), quest board
```

The **Continue Your Adventure** button appears on the landing page whenever a saved game exists.

---

## How the AI Controls the RP

The GM is a single Gemini call with a **system prompt** + **JSON response schema**
(`src/lib/gm-prompt.ts`), enforced with `responseMimeType: application/json`.

**Absolute rules baked into the system prompt:**

1. The GM controls *everything* except the player's own decisions: every NPC, monster,
   merchant, king, the weather, the economy, quest boards and rumors.
2. It **never** writes the player's dialog, thoughts, or decisions.
3. Narration uses second (or first) person; NPCs speak in third person via dialog lines.
4. Companions act strictly per their archetype; secrets stay hidden until earned.
5. Continuity is sacred — location, time, day, quests, relationships and known NPCs are
   tracked and returned every turn in `storyState`.
6. Player input wrapped in `(( ... ))` is treated as a directive (pacing, scene, rules).
7. Romance intensity and story language are enforced per your settings.

**Per-turn JSON the GM must return:**

```json
{
  "narration":   "2-4 vivid paragraphs, ends on a hook",
  "dialog":      [{ "speaker": "Lyra", "text": "...", "mood": "flustered" }],
  "storyState": {
    "location": "Adventurers' Guild, Oakhollow",
    "time": "Morning", "day": "Day 1",
    "quests":       ["Register at the guild", "..."],
    "relationships":[{ "name": "Lyra", "level": "Curious", "note": "..." }],
    "knownNpcs":    [{ "name": "Guildmaster Bren", "role": "...", "appearance": "..." }]
  },
  "choices":     ["action A", "action B", "action C", "action D"],
  "scenePrompt": "English image prompt for the current scene",
  "gmNote":      "optional OOC note"
}
```

The reply is normalized defensively (`normalizeTurn` in `game-view.tsx`), rendered as
parchment narration + dialog cards + choice chips, and the full raw JSON is preserved in
history so the conversation can be reconstructed for the next turn (`buildContents`).

**Image generation** uses Gemini image models (`gemini-2.5-flash-image` with automatic
fallbacks, 3:4 for portraits / 16:9 for scenes) and stores results in SQLite, served via
`/api/images/<id>` so they survive refreshes.

---

## Quick Start

### Run in this sandbox

The dev server is already running — just open the preview panel. Nothing else to configure.

### Run on your own machine

**Prerequisites:** Node.js 20+ (or Bun), and a Gemini API key.

```bash
# 1. Install dependencies
bun install        # or: npm install

# 2. Point Prisma at a local SQLite database
echo 'DATABASE_URL="file:./db/custom.db"' > .env

# 3. Create the database tables
bun run db:push    # or: npm run db:push

# 4. Start the dev server
bun run dev        # or: npm run dev
```

Open `http://localhost:3000`, click **Forge Your Legend**, paste your API key in Step 0,
press **Test** to confirm, then design your world, player and companions.

> Your API key lives in your browser only. Server routes forward it to Google per request
> and never persist it.

---

## Getting a Gemini API Key

1. Go to **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**.
2. Sign in with a Google account and click **Create API key** (the free tier is enough).
3. Copy the key (starts with `AIza…`) and paste it into the app's **Realm Link** step or the
   in-game **Settings → Realm Settings** dialog.
4. Click **Test** — a valid key reports how many models are visible and whether image
   generation is available on it.

---

## Project Structure

```
├── prisma/
│   └── schema.prisma              # GeneratedImage model (SQLite)
├── db/
│   └── custom.db                  # SQLite database (auto-created)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Metadata, Cinzel + Lora fonts, toaster
│   │   ├── page.tsx               # Landing / Setup / Game phase router
│   │   ├── globals.css            # AERFÁLA dark-fantasy theme & animations
│   │   └── api/
│   │       ├── gemini/chat/route.ts    # GM turn (JSON schema, retries, friendly errors)
│   │       ├── gemini/image/route.ts   # Portrait & scene generation (model fallback chain)
│   │       ├── gemini/test/route.ts    # API key validation
│   │       └── images/[id]/route.ts    # Serves stored images from SQLite
│   ├── components/
│   │   ├── rp/
│   │   │   ├── landing.tsx        # Hero landing with feature grid
│   │   │   ├── setup-wizard.tsx   # 5-step pre-game setup (API/World/Player/Companions/Review)
│   │   │   ├── game-view.tsx      # RP gameplay: story log, choices, input, illustrate
│   │   │   ├── cast-panel.tsx     # Scene state, player, companions, NPCs, quests
│   │   │   └── settings-dialog.tsx# API key, model, art style, mid-game tuning
│   │   └── ui/                    # shadcn/ui component library
│   ├── lib/
│   │   ├── rp-types.ts            # All shared types + model catalogue
│   │   ├── rp-store.ts            # Zustand store + localStorage persistence
│   │   ├── gm-prompt.ts           # GM system prompt, JSON schema, portrait prompts
│   │   ├── rp-client.ts           # Typed fetch helpers for the API routes
│   │   ├── db.ts                  # Prisma client singleton
│   │   └── utils.ts               # cn() helper
│   └── hooks/
│       └── use-toast.ts           # Toast hook
└── README.md
```

---

## Configuration Reference

### Settings (Realm Settings dialog / wizard step 0)

| Setting | Values | What it does |
| --- | --- | --- |
| Gemini API key | `AIza…` | Authenticates every call. Stored in `localStorage` (`aerfala.api.settings.v1`). |
| Storyteller model | `gemini-2.5-flash` (default), `gemini-2.5-flash-lite`, `gemini-2.5-pro`, `gemini-2.0-flash` | The GM brain. Flash is fast & creative; Pro is deepest but slower. |
| Art style | Anime / Painterly / Semi-realistic | Used for portraits and scene illustrations. |
| Romance intensity *(mid-game)* | None / Wholesome / Classic / Intense | Governs how far romance goes; always tasteful, fade-to-black. |
| Extra GM directives *(mid-game)* | Free text | Standing orders to the GM, e.g. *"keep fights tactical; always end on cliffhangers"*. |

### World settings (wizard step 1)

| Setting | Values |
| --- | --- |
| World name | Any string (default `Aerfála`) |
| Genre | Adventure / Romance / Adventure + Romance / Dark Fantasy / Comedy / Slice of Life |
| Tone | Light novel / Epic / Dark / Comedic |
| Starting scenario | Adventurers' Guild / Magic Academy / Royal Summons / Free Wanderer / custom text |
| Romance level | None / Wholesome / Classic / Intense |
| POV | Second person ("You…") / First person ("I…") |
| Language | English, Indonesian, Japanese, Chinese, Spanish, Auto-detect |
| Custom lore | Free text world rules the GM must obey |

### Player & companion sheets

See [Feature Overview](#feature-overview). Everything except the player name and appearance
is optional — empty fields are filled by the GM organically. Only **API key + player name**
are required before *Begin the Adventure* unlocks.

---

## API Endpoints

All endpoints are internal to the app (`POST` unless noted), JSON in/out.

| Endpoint | Body | Returns |
| --- | --- | --- |
| `POST /api/gemini/chat` | `{ apiKey, model, systemPrompt, contents[] }` | `{ data: GmTurn }` — validated GM JSON. Retries transient failures; maps Google errors to friendly messages. |
| `POST /api/gemini/image` | `{ apiKey, prompt, kind: "portrait"\|"scene", subject? }` | `{ id, url, kind }` — tries `gemini-2.5-flash-image` (with aspect ratio), then fallback preview models. Stores image in SQLite. |
| `POST /api/gemini/test` | `{ apiKey }` | `{ ok, totalModels, chatReady, imageReady, sample[] }` |
| `GET /api/images/[id]` | — | Raw image bytes with immutable caching. |

The Gemini REST base is `https://generativelanguage.googleapis.com/v1beta/models` — the
key is only ever sent there.

---

## Data & Persistence

| Data | Where | Notes |
| --- | --- | --- |
| API settings (key, model, art style) | Browser `localStorage` → `aerfala.api.settings.v1` | Never persisted server-side. |
| Full game state (world, sheets, story log, choices, portraits) | Browser `localStorage` → `aerfala.game.state.v1` | Auto-saved on every change; powers *Continue Your Adventure*. |
| Generated images | SQLite (`db/custom.db`), table `GeneratedImage` | Base64 payload out of localStorage; served via `/api/images/[id]`. |

**Reset:** *Abandon run* (in-game X button) clears the saved game; clearing your browser
storage clears settings. Deleting `db/custom.db` clears generated images.

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript 5** + **React 19**
- **Tailwind CSS 4** + **shadcn/ui** (New York) + **Lucide** icons
- **Zustand** for client state with manual `localStorage` persistence
- **Prisma + SQLite** for generated-image storage
- **Google Gemini API** (`generateContent`) for the GM and image models
- Fonts: **Cinzel** (display) + **Lora** (story text) via `next/font`

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| *"Invalid API key"* | Re-copy the key from AI Studio; make sure it starts with `AIza`. Test it in Settings. |
| *"Model not found (404)"* | Your key can't see the selected model. Switch storyteller model in Settings (e.g. to `gemini-2.0-flash`). |
| *"Rate limit reached (429)"* | Free-tier quota — wait a few seconds; the chat route already retries once automatically. |
| *"Access denied (403)"* | Enable the **Generative Language API** for the key's project, or create a new key. |
| *"Image generation failed"* | Free-tier image models can be restricted. The route tries 5 model configurations; if all fail, try later or a different key/project. |
| Blocked by safety filter (422) | Rephrase the action; soften the scene. Gemini safety applies to all keys. |
| Portrait of an NPC missing | Open **Cast & World → Souls you've met** and click the paint icon — portraits need the GM's appearance description first. |
| Lost your save | Game state is browser-local; same browser + same origin restores it via *Continue Your Adventure*. |

---

## FAQ

**Does my API key leave my device?**
Only to Google's `generativelanguage.googleapis.com` endpoint, per request, via this app's
server routes as a pass-through. Nothing is stored server-side except generated images.

**Can the GM speak for my character?**
No — rule #2 of the system prompt forbids it. It narrates the world's reaction and lets
NPCs answer through dialog lines.

**Can I play in another language?**
Yes. Pick the story language in the World step (or Auto-detect). Scene-image prompts stay
in English for best art quality.

**Is it only isekai fantasy?**
The engine is tuned for light-novel isekai (guild cards, mana colors, dungeons, hot
springs), but you can rename the world, rewrite the lore, and set any genre/tone —
including dark fantasy or comedy.

**How many companions can I add?**
As many as you like; each gets a full sheet and portrait. The GM keeps up to 12 named NPCs
in `storyState.knownNpcs` beyond your starting cast.

---

*Your story, your rules. Made with Gemini.*
