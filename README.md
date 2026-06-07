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
- **Leveling** — gain a level for every $1,000 earned, with a level-up jingle

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

### 🔥 Streak Tracking
A `🔥 X MO` counter in the HUD counts consecutive completed months you stayed under your Budget Boss limit.

### 📊 World Map — 6-Month History
A pixel bar chart of the last six months, with paired green (earn) / red (spend) columns and the current month highlighted.

### 💾 Backup & Restore
Export all your data to a `.json` file you can save anywhere, and import it back later — so you can move data between devices or keep it safe before clearing your browser. (Your data lives only in this browser's `localStorage`; clearing site data deletes it, so back up first.)

### 📄 Export to PDF
One click generates a clean, printable financial report — summary, budget status, savings quest, category breakdown, and a full transaction table — then opens your browser's print dialog so you can **Save as PDF**. Works offline and on mobile; no libraries.

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
