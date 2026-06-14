# 🪙 OCTROVEBOX — 8-Bit Personal Finance Tracker

> Track your money like it's a retro NES adventure. Earn gold, fight the Budget Boss, complete savings quests, and keep your spending streak alive.

A fully client-side personal finance tracker with a retro Nintendo 8-bit theme. No backend, no sign-up, no tracking — everything lives in your browser's `localStorage`. Built with plain HTML, CSS, and vanilla JavaScript. Zero dependencies.

---

## ✨ Features

### 💰 Core tracking
- Log **income** ("EARN") and **expenses** ("SPEND") with emoji categories
- Live **HUD** showing Balance, Income, and Spent — styled like a game heads-up display
- **Quest Log** — scrollable transaction history with type filters (All / Earn / Spend) and delete
- **Spending Map** — animated XP-style bars showing where your money goes
- **Leveling + XP bar** — gain a level for every $1,000 earned, with a live XP bar filling toward the next level and a level-up jingle

### 🗺️ Side Quests (Deeds)
A set of auto-tracked challenges (log 5 entries, spend in 3 categories, reach a $5,000 balance, hit a 3-month budget streak, complete a savings quest, and more). Each shows live progress and fires a celebration when you complete it. They live behind a collapsible **📜 DEEDS** toggle on the Quest Board (with a live done/total count) so the board stays tidy. Completing *every* deed unlocks the secret MIDAS skin and the final COSMOS zone.

### 🎲 Random encounters
Logging an entry has a small chance to trigger a pixel event — a wandering merchant, a found coin, a goblin pickpocket — for a bit of dungeon-crawl surprise.

### ⚔️ Budget Boss
A monthly spending limit rendered as a boss fight. The HP bar **drains as you spend** each month:
- 🐲 Green (>50% left) → 😈 Yellow (20–50%) → 😡 Red flashing (<20%) → 💀 **ENRAGED** (over budget)
- Going over budget triggers a screen-shake, a boss roar, and a warning toast
- Resets automatically each calendar month

### 👾 Category Bosses (mini-bosses)
Per-category monthly limits, each with its own small HP bar:
- Assign a limit to any expense category (Food, Fun, Bills, etc.)
- Auto-sorted **most-threatened first**
- Same color states as the main boss, with a 💀 when a category blows its cap

### 🗺️ Savings Quest
Set a named savings goal and watch a golden treasure bar fill toward it:
- Progress tracks your balance vs. the target
- 🏆 Completing a quest fires a victory jingle and celebration toast

### 📜 Monthly Recap
A "LEVEL COMPLETE" results card for the current month — earned, spent, saved, savings-rate grade (S/A/B/C/D), budget result, and top category — styled to screenshot and share.

### 🔎 Filter the log
Filter entries by category and by month, and see a live count + net total of whatever's shown — so you can answer "how much did I spend on Food in April?" at a glance.

### ✏️ Edit entries & 🗓️ backdate
Tap ✎ on any entry to edit its name, amount, category, type, or **date**. Every entry has a date field (defaults to today) so you can **backdate** old transactions — the Quest Log, monthly streak, World Map history, and all trends use the entry's real date.

### ★ Starting balance
Set your real opening balance (tap **START ✎** on the Balance card) so Balance reflects actual money on hand, not just the sum since you began logging. Balance = starting balance + income − expenses.

### 🔥 Streak Tracking
A `🔥 X MO` counter in the HUD counts consecutive completed months you stayed under your Budget Boss limit.

### 📊 World Map — 6-Month History
A pixel bar chart of the last six months, with paired green (earn) / red (spend) columns and the current month highlighted.

### 🔒 PIN lock + at-rest encryption
An optional 4-digit app lock (set it in Options). A pixel keypad gates the app on launch and re-locks after the app has been backgrounded for a while. Setting a PIN also **encrypts your save at rest** — the whole data store is sealed with AES-GCM, keyed by a PBKDF2 hash of your PIN, using the browser's built-in WebCrypto (still **100% offline**, no libraries). On disk your entries become unreadable ciphertext, and entering the correct PIN is what decrypts them. Because of that, **a forgotten PIN means the data cannot be recovered** — so keep a backup. (On older browsers without WebCrypto it falls back to a salted-hash UI gate without encryption.)

### 🔁 Auto-Pilot (recurring entries)
Tick **🔁 REPEAT** when adding an entry to turn it into a recurring rule — perfect for salary, rent, or subscriptions. Octrovebox then **auto-logs it every week or month**, even catching up on any occurrences you missed while away (monthly rules clamp cleanly to short months, so a "31st" rule never skips February). View or stop your rules anytime from the **AUTO-PILOT** panel.

### 💱 Currency & locale
Pick your currency in Options — Rupiah, US Dollar, Euro, Pound, Yen, Rupee, Won, and many more. Every figure, chart, and input re-formats instantly with the right symbol and digit grouping for that locale.

### 🎓 First-run tour
Brand-new players get a short pixel onboarding walkthrough — set your balance, log an entry, meet the Budget Boss — with a one-tap **LOAD SAMPLE DATA** option so you can explore a fully populated app before committing your own numbers.

### 💾 Backup reminders & versioning
Backups carry a schema version (so future format changes import safely), and if your data is piling up and hasn't been backed up in a while, a gentle one-time reminder nudges you to export — no nagging.

### 💾 Backup & Restore
Export all your data to a `.json` file you can save anywhere, and import it back later — so you can move data between devices or keep it safe before clearing your browser. (Your data lives only in this browser's `localStorage`; clearing site data deletes it, so back up first.)

### 📄 Export to PDF
One click generates a clean, printable financial report — summary, budget status, savings quest, category breakdown, and a full transaction table — then opens your browser's print dialog so you can **Save as PDF**. Works offline and on mobile; no libraries.

### 🔮 The Oracle (insights & education)
A retro advisor that reads **your own tracked data** and gives personalised tips — savings rate, biggest spending category, emergency-fund coverage, budget and goal nudges — plus rotating general education on stocks & gold (diversification, dollar-cost averaging, gold as a hedge). Tips type out character-by-character with RPG-textbox blips. Works offline. *Educational only — not financial advice.*

### 📳 Haptic feedback
A tiny buzz on supported devices (Android) for key actions and milestones — earning, spending, level-ups, and quest/skin unlocks.

### 🎁 Daily chest
A daily bounty on the Quest Board — open it once per day for a coin-shower animation and a random tip, building a daily-login streak.

### ⚔️ Weekly bounties
Three rotating challenges on the Quest Board that **reset every Monday**, computed live from the current week's entries (log 5 entries, log income, spend across 3 categories, open the chest, and more). The set is seeded by the week so it's stable all week and rotates afterward. Clear all three for a celebration and a weekly-clear streak, with a live "resets in N days" countdown.

### 🔥 Combo meter
Logging several entries in quick succession builds a **combo multiplier** — a pulsing "COMBO ×N" badge with escalating chiptune blips that bursts into an "on fire" state at ×5+, rewarding focused logging sessions. The chain breaks after a short idle gap (session-only, never saved).

### 🎨 Unlockable skins
Retro theme palettes that re-skin the whole app — Classic, Game Boy, SNES, Arcade, **Fantasy** (sky-blue & brick) and **Undersea** (abyssal navy & bioluminescent teal) unlock as your balance grows, and a secret **Midas** gold skin unlocks only after you complete every Side Quest.

### 🌈 Secret cheat
Enter the Konami code (↑↑↓↓←→←→ B A) on a keyboard, or tap the title 8 times on mobile, to toggle rainbow mode with a coin rain.

### 🌧️ Themed ambient floats
Each zone has its own drifting ambience that changes with your active skin: **slow rain** in Neon City, **snow** on the Frozen Peak, **fish** swimming through Kraken Deep, and twinkling **motes** tinted to each other biome (green pollen in the meadow, crystal sparks in the cave, gold fairy-dust in the dunes, stardust in the cosmos). They never block clicks, and they respect your "reduced motion" setting.

### 🎶 Chiptune jukebox
Looping 8-bit tracks generated live with the Web Audio API (no audio files) — **one original theme per skin, locked behind that skin**. The MUSIC button cycles OFF → Classic → Game Boy → SNES → Arcade → Fantasy → Undersea → Midas, **skipping any track whose skin you haven't unlocked yet** (Classic is always free). Every track is an original chiptune tune written to match its skin's mood (heroic NES march, lo-fi handheld, lush 16-bit pads, neon arcade pulse, storybook-platformer romp, deep-water mystery, regal golden fanfare), and selecting any unlocked skin auto-plays its theme while music is on.

### 🗺️ World zones
Every skin is paired with a biome, and **your active skin decides which realm you stand in** — picking a skin in the Vault switches the palette, the world behind the app, and the theme music all at once: **🏙️ NEON CITY (Classic) · 🌱 GREEN MEADOW (Game Boy) · 💎 CRYSTAL CAVE (SNES) · 🏔️ FROZEN PEAK (Arcade) · 🏜️ GOLDEN DUNES (Fantasy) · 🐙 KRAKEN DEEP (Undersea) · 🌌 THE COSMOS (Midas)**. Each biome carries its own pixel scenery (trees, mushrooms, crystals, snow peaks, a bubbling kraken, a ringed planet). Skins unlock as your balance grows (Midas only after completing *every* deed). The starfield is the reward: stars are dim in the city and grow brighter in each later realm, blazing in full only once you don the Midas skin and ascend to THE COSMOS.

### 🌧️ Budget-driven weather
The sky reacts to your Budget Boss. Stay healthy and it's **clear**; as you approach the limit it **clouds over**, then **rains** in the danger zone, and breaks into a **lightning storm** once you blow the budget — wordless, ambient feedback on how the month is going (respects reduced-motion).

### ✨ Parallax starfield + day/night
Slow-drifting pixel stars twinkle behind the panels, and the sky shifts with your real local time — warm dawn, bright day, dusk, and a deep starry night with a moon (respects reduced-motion).

### 🪙 Juicy numbers
The Balance/Income/Spent figures animate counting up and down, and coins fly into the balance when you log income.

### 🎵 Chiptune sound effects
Coin pickups, spend blips, error buzzes, boss roars, and victory fanfares — all generated live with the Web Audio API (no audio files). Toggle with the SOUND button.

---

## 🚀 Getting started

### Just open it
Download or clone the repo and open **`index.html`** in any modern browser. That's it — no build step, no server.

```bash
git clone https://github.com/<your-username>/coin-quest.git
cd coin-quest
# then double-click index.html, or:
start index.html      # Windows
open index.html       # macOS
```

### Single-file version
Prefer one portable file you can email or drop anywhere? Run the build to inline the CSS and JS into a single HTML file:

```powershell
pwsh ./build.ps1      # outputs dist/coin-quest.html
```

`dist/coin-quest.html` is completely self-contained (the only external request is the Google Fonts pixel typeface).

---

## 📱 Install as an app (PWA)

Octrovebox is a **Progressive Web App** — install it for a home-screen icon, a fullscreen view with no browser chrome, and full **offline** support (a service worker caches the app shell). No app store required.

**Android (Chrome):** open the site → menu (⋮) → **Install app** / **Add to Home screen**.

**iPhone/iPad (Safari):** open the site → Share button → **Add to Home Screen**.

**Desktop (Chrome/Edge):** open the site → click the **install icon** in the address bar.

> The service worker requires HTTPS, so install from the deployed site (e.g. GitHub Pages), not from a local `file://` path.

When a new version is deployed, the app shows a **"★ NEW VERSION READY"** banner — tap **REFRESH** to update instantly. No cache-clearing needed.

---

## 🗂️ Project structure

```
coin-quest/
├── index.html             # markup / structure
├── styles.css             # the 8-bit theme (palette, pixel bevels, CRT overlay)
├── app.js                 # all logic (state, persistence, rendering, sound)
├── manifest.webmanifest   # PWA manifest (name, icons, theme)
├── sw.js                  # service worker (offline app-shell cache)
├── icon-192.png           # app icons
├── icon-512.png
├── apple-touch-icon.png
├── favicon-32.png
├── build.ps1              # inlines CSS/JS into dist/coin-quest.html
├── generate-icons.ps1     # regenerates the app icons
├── README.md
└── LICENSE
```

---

## 🛠️ Tech

- **HTML + CSS + vanilla JS** — no frameworks, no build tooling required
- **localStorage** for persistence (key: `coinQuest.v1`)
- **Web Audio API** for procedurally generated chiptune SFX
- **Press Start 2P** + **VT323** pixel fonts via Google Fonts

## 🎨 Design notes

The theme leans into a real NES aesthetic rather than a generic "dashboard" look: a deep navy void background, candy-bright accents, chunky beveled "sprite" panels with hard pixel shadows, animated scanlines and a CRT vignette overlay, and a bobbing pixel title.

---

## 📦 Data & privacy

All data stays on your device in `localStorage`. Nothing is ever sent anywhere. Clearing your browser data — or hitting **ERASE SAVE FILE** — wipes it.

## 📄 License

[MIT](LICENSE)

---

*© 200X OCTROVEBOX · INSERT COIN*
