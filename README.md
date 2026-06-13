# 🪙 COIN QUEST — 8-Bit Personal Finance Tracker

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

### 🗺️ Side Quests
A panel of auto-tracked challenges (log 5 entries, spend in 3 categories, reach a $5,000 balance, hit a 3-month budget streak, complete a savings quest, and more). Each shows live progress and fires a celebration when you complete it.

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

### 🎨 Unlockable skins
Retro theme palettes that re-skin the whole app — Classic, Game Boy, SNES, Arcade, **Mushroom** (sky-blue & brick) and **Jungle** (canopy green & Wumpa orange) unlock as your balance grows, and a secret **Midas** gold skin unlocks only after you complete every Side Quest.

### 🌈 Secret cheat
Enter the Konami code (↑↑↓↓←→←→ B A) on a keyboard, or tap the title 8 times on mobile, to toggle rainbow mode with a coin rain.

### 👾 Roaming buddies
Pac-Man and the four ghosts (drawn as crisp SVG sprites) drift and bounce freely around the screen for extra retro charm — and **scatter in surprise whenever you log a transaction**, then settle back down. They never block clicks, and they respect your "reduced motion" setting.

### 🎶 Chiptune jukebox
Looping 8-bit tracks generated live with the Web Audio API (no audio files). The MUSIC button cycles OFF → Calm → Cozy Town → Overworld → Battle → Victory → Space → Eerie → Classic (Ode to Joy) → Winter (Vivaldi) → Mushroom → Jungle. The Mushroom and Jungle tracks are original chiptune tunes in a platformer / tribal-jungle style, and selecting the matching skin auto-plays its theme while music is on.

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

Coin Quest is a **Progressive Web App** — install it for a home-screen icon, a fullscreen view with no browser chrome, and full **offline** support (a service worker caches the app shell). No app store required.

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

*© 200X COIN QUEST · INSERT COIN*
