/* ============================================================
   OCTROVEBOX — game logic
   State persists in localStorage. No backend, no tracking.
============================================================ */

const STORE_KEY = 'coinQuest.v1';
const SCHEMA = 3;               // data schema version (bump when the save shape changes)

const CATEGORIES = {
  expense: [
    { id: 'food',     name: 'FOOD',      icon: '🍔' },
    { id: 'home',     name: 'HOME',      icon: '🏠' },
    { id: 'transit',  name: 'TRANSIT',   icon: '🚗' },
    { id: 'fun',      name: 'FUN',       icon: '🎮' },
    { id: 'shop',     name: 'SHOPPING',  icon: '🛒' },
    { id: 'health',   name: 'HEALTH',    icon: '❤️' },
    { id: 'bills',    name: 'BILLS',     icon: '⚡' },
    { id: 'other',    name: 'OTHER',     icon: '❓' },
  ],
  income: [
    { id: 'salary',   name: 'SALARY',    icon: '💼' },
    { id: 'bonus',    name: 'BONUS',     icon: '⭐' },
    { id: 'gift',     name: 'GIFT',      icon: '🎁' },
    { id: 'side',     name: 'SIDE QUEST',icon: '⚔️' },
    { id: 'invest',   name: 'INVEST',    icon: '📈' },
    { id: 'other',    name: 'OTHER',     icon: '❓' },
  ],
};

const CAT_COLORS = {
  food: '#ff6bc4', home: '#4fa9ff', transit: '#4be35a', fun: '#b06bff',
  shop: '#ffd23f', health: '#ff5d5d', bills: '#ff9f1c', other: '#9a9ad0',
};

/* ---------------- state ---------------- */
let state = {
  transactions: [],
  openingBalance: 0,    // real starting balance before any logged entries
  soundOn: true,
  musicOn: false,
  musicTrack: 0,
  budget: 0,            // monthly spending limit (0 = none)
  goal: null,           // { name, target }
  budgetBreached: false,// fired the "over budget" warning already?
  goalCelebrated: false,// fired the "quest complete" jingle already?
  catBudgets: {},       // { categoryId: monthlyLimit } — mini-bosses
  questsDone: [],       // ids of completed side quests
  theme: 'default',     // unlockable skin
  themesSeen: [],       // skins already announced as unlocked
  lastChest: null,      // YYYY-MM-DD of last daily-chest open
  chestStreak: 0,       // consecutive days opening the chest
  rainbow: false,       // konami-code rainbow mode
  bounties: null,       // { week:'YYYY-MM-DD'(Monday), done:[ids] } — weekly bounty progress
  bountyStreak: 0,      // weeks where all bounties were cleared
  bountyClaimed: '',    // week key already celebrated as complete
  pinHash: null,        // hash of the app-lock PIN (null = no lock)
  schema: SCHEMA,       // data schema version (for backups / migrations)
  currency: 'IDR',      // active currency code (see CURRENCIES)
  recurring: [],        // auto-pilot templates: { id, type, desc, amount, category, freq, nextDue, lastRun }
  lastBackup: 0,        // ts of the last exported backup (0 = never)
  backupNudge: '',      // YYYY-MM-DD we last reminded about backing up
  onboarded: false,     // has the first-run tour been seen/dismissed?
  effects: 'auto',      // ambient animation: 'auto' (follow system) | 'on' | 'off'
  // THE GUILD — local 2-player household co-op (one install, no backend).
  // off by default so solo players are untouched; entries carry an `owner`.
  guild: { on: false, active: 'p1', names: { p1: 'PLAYER 1', p2: 'PLAYER 2' } },
};
let appReady = false;   // true after init, so quests don't celebrate on load
let currentType = 'expense';
let currentFilter = 'all';      // type filter: all / income / expense
let catFilterVal = 'all';       // quest-log category filter
let monthFilterVal = 'all';     // quest-log month filter (y*12+m, or 'all')
let playerFilterVal = 'all';    // quest-log player filter (all / p1 / p2) — Guild mode
let editingId = null; // id of the transaction being edited (null = adding new)

/* ---------------- elements ---------------- */
const $ = (id) => document.getElementById(id);
const els = {
  balance: $('balanceValue'), income: $('incomeValue'), expense: $('expenseValue'),
  balanceFoot: $('balanceFoot'), balanceCard: document.querySelector('.balance'),
  streak: $('streakDisplay'),
  form: $('txForm'), desc: $('descInput'), amount: $('amountInput'), category: $('categoryInput'),
  dateField: $('dateField'), dateLabel: $('dateLabel'),
  calOverlay: $('calOverlay'), calPrev: $('calPrev'), calNext: $('calNext'), calTitle: $('calTitle'), calGrid: $('calGrid'), calToday: $('calToday'),
  btnExpense: $('btnExpense'), btnIncome: $('btnIncome'), submit: $('submitBtn'),
  list: $('txList'), emptyState: $('emptyState'),
  catFilter: $('catFilter'), monthFilter: $('monthFilter'), logSummary: $('logSummary'),
  catBars: $('catBars'), catEmpty: $('catEmpty'),
  filters: $('logFilters'), mute: $('muteBtn'), music: $('musicBtn'),
  editStartBtn: $('editStartBtn'), startEditor: $('startEditor'), startInput: $('startInput'), startSave: $('startSave'),
  reset: $('resetBtn'), toast: $('toast'),
  exportBtn: $('exportBtn'), printReport: $('printReport'),
  updateBar: $('updateBar'), updateBtn: $('updateBtn'),
  backupBtn: $('backupBtn'), restoreBtn: $('restoreBtn'), restoreInput: $('restoreInput'),
  // boss / budget
  bossPanel: $('bossPanel'), bossTitle: $('bossTitle'), bossSprite: $('bossSprite'),
  bossName: $('bossName'), hpFill: $('hpFill'), hpText: $('hpText'),
  editBudgetBtn: $('editBudgetBtn'), budgetEditor: $('budgetEditor'),
  budgetInput: $('budgetInput'), saveBudgetBtn: $('saveBudgetBtn'), clearBudgetBtn: $('clearBudgetBtn'),
  // savings goal
  goalPanel: $('goalPanel'), goalChest: $('goalChest'), goalName: $('goalName'),
  goalFill: $('goalFill'), goalText: $('goalText'),
  editGoalBtn: $('editGoalBtn'), goalEditor: $('goalEditor'),
  goalNameInput: $('goalNameInput'), goalTargetInput: $('goalTargetInput'),
  saveGoalBtn: $('saveGoalBtn'), clearGoalBtn: $('clearGoalBtn'),
  // category mini-bosses
  mbossList: $('mbossList'), mbossEmpty: $('mbossEmpty'),
  catBudgetSelect: $('catBudgetSelect'), catBudgetInput: $('catBudgetInput'), catBudgetSave: $('catBudgetSave'),
  // world map chart + streak
  chart: $('chart'), monthStreak: $('monthStreak'),
  // xp
  xpFill: $('xpFill'), xpNext: $('xpNext'),
  // oracle
  oracleText: $('oracleText'), oracleStage: $('oracleStage'), oracleMore: $('oracleMore'),
  // side quests
  questList: $('questList'),
  questToggle: $('questToggle'), questScroll: $('questScroll'), questProgress: $('questProgress'),
  deedsToggle: $('deedsToggle'), deedsCount: $('deedsCount'),
  // chest + themes
  chestBtn: $('chestBtn'), chestStreak: $('chestStreak'), chestSay: $('chestSay'),
  themeGrid: $('themeGrid'),
  vaultToggle: $('vaultToggle'), vaultScroll: $('vaultScroll'), vaultDial: $('vaultDial'), vaultSub: $('vaultSub'),
  optToggle: $('optToggle'), optScroll: $('optScroll'),
  // monthly recap
  recapBtn: $('recapBtn'), recapOverlay: $('recapOverlay'), recapClose: $('recapClose'),
  recapMonth: $('recapMonth'), recapGrade: $('recapGrade'), recapRows: $('recapRows'),
  // weekly bounties + combo meter
  bountyList: $('bountyList'), bountyReset: $('bountyReset'), bountyReward: $('bountyReward'),
  comboPop: $('comboPop'),
  // PIN lock
  lockOverlay: $('lockOverlay'), lockSub: $('lockSub'), lockDots: $('lockDots'), lockPad: $('lockPad'),
  lockForgot: $('lockForgot'), lockCancel: $('lockCancel'),
  pinSetBtn: $('pinSetBtn'), pinOffBtn: $('pinOffBtn'),
  // currency + effects
  currencySelect: $('currencySelect'), fxBtn: $('fxBtn'),
  // recurring (auto-pilot) — lives inside the New Entry panel
  repeatInput: $('repeatInput'),
  recurInline: $('recurInline'), recurList: $('recurList'), recurSub: $('recurSub'),
  recurHead: $('recurHead'), recurArrow: $('recurArrow'),
  // onboarding tour
  onboardOverlay: $('onboardOverlay'), obArt: $('obArt'), obTitle: $('obTitle'), obBody: $('obBody'),
  obDots: $('obDots'), obNext: $('obNext'), obBack: $('obBack'), obSkip: $('obSkip'), obSample: $('obSample'),
  // PWA install
  installBtn: $('installBtn'), installDone: $('installDone'),
  // THE GUILD (2-player co-op)
  playerTag: $('playerTag'),
  guildToggle: $('guildToggle'), guildScroll: $('guildScroll'),
  guildDial: $('guildDial'), guildSub: $('guildSub'), guildArrow: $('guildArrow'),
  guildDash: $('guildDash'), guildCards: $('guildCards'), guildTeam: $('guildTeam'),
  guildFilters: $('guildFilters'), goalCoop: $('goalCoop'),
  guildBtn: $('guildBtn'), guildSetup: $('guildSetup'),
  guildP1: $('guildP1'), guildP2: $('guildP2'), guildSave: $('guildSave'),
};

/* ============================================================
   SOUND — tiny Web Audio chiptune blips, no assets needed
============================================================ */
let audioCtx;
function getAudio() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function beep(freqs, dur = 0.09, type = 'square', gain = 0.05) {
  if (!state.soundOn) return;
  try {
    getAudio();
    let t = audioCtx.currentTime;
    freqs.forEach((f) => {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type; osc.frequency.value = f;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(audioCtx.destination);
      osc.start(t); osc.stop(t + dur);
      t += dur;
    });
  } catch (e) { /* audio not available */ }
}
// haptic buzz on supporting devices (Android); a no-op on iOS/desktop
const vibe = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* unsupported */ } };
const sfx = {
  coin:    () => { beep([988, 1319], 0.08, 'square', 0.06); vibe(15); },       // earn — classic coin
  spend:   () => { beep([330, 247], 0.1, 'triangle', 0.06); vibe(12); },       // spend
  click:   () => beep([660], 0.04, 'square', 0.03),                            // (no haptic — too frequent)
  delete:  () => { beep([200, 140], 0.08, 'sawtooth', 0.05); vibe(10); },
  levelup: () => { beep([523, 659, 784, 1047], 0.1, 'square', 0.06); vibe([15, 40, 15, 40, 30]); },
  error:   () => { beep([160, 120], 0.12, 'sawtooth', 0.06); vibe([20, 40, 20]); },
  roar:    () => { beep([180, 130, 90], 0.14, 'sawtooth', 0.07); vibe([40, 30, 50]); },       // boss enraged
  victory: () => { beep([659, 784, 988, 1319, 1047, 1319], 0.11, 'square', 0.06); vibe([15, 40, 15, 40, 30]); }, // milestone
};

/* ============================================================
   PERSISTENCE
============================================================ */
// when a PIN is set we encrypt the whole save at rest with AES-GCM, keyed by a
// PBKDF2 hash of the PIN. WebCrypto is async, so save() chains writes; load()
// stashes the encrypted blob until the PIN unlocks it (see attemptUnlock).
const CRYPTO_OK = !!(window.crypto && window.crypto.subtle);
let cryptoKey = null;          // derived AES-GCM key (set once a PIN is active)
let cryptoSalt = null;         // Uint8Array salt paired with the key
let encryptedWrapper = null;   // parsed { enc } blob from disk, awaiting the PIN
let saveChain = Promise.resolve();
const b64 = (bytes) => btoa(String.fromCharCode.apply(null, bytes));
const unb64 = (str) => Uint8Array.from(atob(str), (ch) => ch.charCodeAt(0));

async function deriveKey(pin, saltBytes) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode('octrovebox:' + pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}
async function encryptAndStore(plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(plaintext));
  const wrapper = { v: 1, enc: 'aesgcm', salt: b64(cryptoSalt), iv: b64(iv), ct: b64(new Uint8Array(ctBuf)) };
  localStorage.setItem(STORE_KEY, JSON.stringify(wrapper));
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.enc === 'aesgcm') { encryptedWrapper = parsed; return; } // need the PIN first
    state = { ...state, ...parsed };
  } catch (e) { /* ignore corrupt save */ }
}
function save() {
  if (!cryptoKey) { localStorage.setItem(STORE_KEY, JSON.stringify(state)); return; }
  // snapshot now (state may mutate before the async write lands) and chain the
  // writes so concurrent saves can't race — last write wins
  const snapshot = JSON.stringify(state);
  saveChain = saveChain.then(() => encryptAndStore(snapshot)).catch(() => {});
}

/* ============================================================
   HELPERS
============================================================ */
// supported currencies — symbol drives the prefix, locale drives digit grouping,
// frac = how many decimal places to show (0 for zero-decimal currencies)
const CURRENCIES = {
  IDR: { symbol: 'Rp',  locale: 'id-ID', frac: 0, name: 'INDONESIAN RUPIAH' },
  USD: { symbol: '$',   locale: 'en-US', frac: 2, name: 'US DOLLAR' },
  EUR: { symbol: '€',   locale: 'de-DE', frac: 2, name: 'EURO' },
  GBP: { symbol: '£',   locale: 'en-GB', frac: 2, name: 'BRITISH POUND' },
  JPY: { symbol: '¥',   locale: 'ja-JP', frac: 0, name: 'JAPANESE YEN' },
  INR: { symbol: '₹',   locale: 'en-IN', frac: 0, name: 'INDIAN RUPEE' },
  CNY: { symbol: '¥',   locale: 'zh-CN', frac: 2, name: 'CHINESE YUAN' },
  KRW: { symbol: '₩',   locale: 'ko-KR', frac: 0, name: 'KOREAN WON' },
  SGD: { symbol: 'S$',  locale: 'en-SG', frac: 2, name: 'SINGAPORE DOLLAR' },
  MYR: { symbol: 'RM',  locale: 'ms-MY', frac: 2, name: 'MALAYSIAN RINGGIT' },
  PHP: { symbol: '₱',   locale: 'en-PH', frac: 2, name: 'PHILIPPINE PESO' },
  THB: { symbol: '฿',   locale: 'th-TH', frac: 2, name: 'THAI BAHT' },
  VND: { symbol: '₫',   locale: 'vi-VN', frac: 0, name: 'VIETNAMESE DONG' },
  AUD: { symbol: 'A$',  locale: 'en-AU', frac: 2, name: 'AUSTRALIAN DOLLAR' },
  CAD: { symbol: 'C$',  locale: 'en-CA', frac: 2, name: 'CANADIAN DOLLAR' },
  BRL: { symbol: 'R$',  locale: 'pt-BR', frac: 2, name: 'BRAZILIAN REAL' },
  ZAR: { symbol: 'R',   locale: 'en-ZA', frac: 2, name: 'SOUTH AFRICAN RAND' },
  NGN: { symbol: '₦',   locale: 'en-NG', frac: 0, name: 'NIGERIAN NAIRA' },
};
const cur = () => CURRENCIES[state.currency] || CURRENCIES.IDR;
const fmt = (n) => {
  const c = cur();
  const neg = n < 0;
  const v = Math.abs(n).toLocaleString(c.locale, { minimumFractionDigits: 0, maximumFractionDigits: c.frac });
  return (neg ? '-' + c.symbol : c.symbol) + v;
};
// monotonic unique id — never collides even when several entries are created in the
// same millisecond (e.g. recurring catch-up)
let lastId = 0;
function newId() { let id = Date.now(); if (id <= lastId) id = lastId + 1; lastId = id; return id; }
function catInfo(type, id) {
  return CATEGORIES[type].find((c) => c.id === id) || { name: id, icon: '❓' };
}
function levelFor(income) {
  return Math.max(1, Math.floor(income / 1000) + 1); // +1 level per $1000 earned
}
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
// effective date of an entry — uses the editable `date`, falling back to id (old entries)
const txDate = (t) => t.date || t.id;
// ms timestamp for a YYYY-MM-DD string at local noon (avoids timezone day-shift)
const ymdToTs = (s) => (s ? new Date(s + 'T12:00:00').getTime() : Date.now());
const tsToYmd = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* ---------------- THE GUILD (2-player co-op) ---------------- */
// each player gets a distinct colour so badges/bars read at a glance
const GUILD_COLORS = { p1: 'var(--gold)', p2: '#4fa9ff' };
const GUILD_ICONS  = { p1: '🕹️', p2: '🕹️' };
// guards — `state.guild` may be missing/partial on old saves
function guildOn() { return !!(state.guild && state.guild.on); }
function activePlayer() { return (state.guild && state.guild.active === 'p2') ? 'p2' : 'p1'; }
function playerName(k) {
  const n = state.guild && state.guild.names && state.guild.names[k];
  return (n && String(n).trim()) || (k === 'p2' ? 'PLAYER 2' : 'PLAYER 1');
}
const txOwner = (t) => (t.owner === 'p2' ? 'p2' : 'p1');
// keep state.guild well-formed and stamp legacy entries with an owner (schema<3)
function migrate() {
  if (!state.guild || typeof state.guild !== 'object') state.guild = {};
  if (state.guild.active !== 'p2') state.guild.active = 'p1';
  state.guild.on = !!state.guild.on;
  if (!state.guild.names || typeof state.guild.names !== 'object') state.guild.names = {};
  state.guild.names.p1 = state.guild.names.p1 || 'PLAYER 1';
  state.guild.names.p2 = state.guild.names.p2 || 'PLAYER 2';
  if (Number(state.schema) < 3) {
    state.transactions.forEach((t) => { if (t.owner !== 'p1' && t.owner !== 'p2') t.owner = 'p1'; });
    (state.recurring || []).forEach((r) => { if (r.owner !== 'p1' && r.owner !== 'p2') r.owner = 'p1'; });
  }
  state.schema = SCHEMA;
}
// per-player income/expense/net split
function guildSplit() {
  const out = { p1: { income: 0, expense: 0 }, p2: { income: 0, expense: 0 } };
  state.transactions.forEach((t) => {
    const o = txOwner(t);
    if (t.type === 'income') out[o].income += t.amount; else out[o].expense += t.amount;
  });
  out.p1.net = out.p1.income - out.p1.expense;
  out.p2.net = out.p2.income - out.p2.expense;
  return out;
}

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// income + expense totals for a given year/month (optionally a single category)
function monthTotals(y, m, category) {
  let income = 0, expense = 0;
  state.transactions.forEach((t) => {
    const d = new Date(txDate(t));
    if (d.getFullYear() !== y || d.getMonth() !== m) return;
    if (category && t.category !== category) return;
    if (t.type === 'income') income += t.amount; else expense += t.amount;
  });
  return { income, expense };
}
// total expenses logged in the current calendar month
function monthSpend() {
  const now = new Date();
  return monthTotals(now.getFullYear(), now.getMonth()).expense;
}
// expenses this month for one category (mini-boss)
function catSpend(category) {
  const now = new Date();
  return monthTotals(now.getFullYear(), now.getMonth(), category).expense;
}

/* ============================================================
   RENDER
============================================================ */
function totals() {
  let income = 0, expense = 0;
  state.transactions.forEach((t) => {
    if (t.type === 'income') income += t.amount; else expense += t.amount;
  });
  return { income, expense, balance: (state.openingBalance || 0) + income - expense };
}

const prevStat = { income: 0, expense: 0, balance: 0 };
// shrink the stat font as the Rupiah figure grows (lots of zeros = long string)
function fitStat(el, a, b) {
  const len = Math.max(fmt(a).length, fmt(b).length);
  el.classList.remove('len-m', 'len-l', 'len-xl', 'len-xxl');
  if (len >= 14) el.classList.add('len-xxl');        // Rp1.000.000.000+
  else if (len >= 12) el.classList.add('len-xl');     // Rp100.000.000+
  else if (len >= 10) el.classList.add('len-l');      // Rp1.000.000+
  else if (len >= 8) el.classList.add('len-m');       // Rp10.000+
}
function animateValue(el, from, to, dur = 650) {
  if (from === to) { el.textContent = fmt(to); return; }
  const start = performance.now();
  function frame(t) {
    const k = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(Math.round(from + (to - from) * eased));
    if (k < 1) requestAnimationFrame(frame); else el.textContent = fmt(to);
  }
  requestAnimationFrame(frame);
}

function renderStats(prevLevel) {
  const { income, expense, balance } = totals();
  fitStat(els.income, prevStat.income, income);
  fitStat(els.expense, prevStat.expense, expense);
  fitStat(els.balance, prevStat.balance, balance);
  animateValue(els.income, prevStat.income, income);  prevStat.income = income;
  animateValue(els.expense, prevStat.expense, expense); prevStat.expense = expense;
  animateValue(els.balance, prevStat.balance, balance); prevStat.balance = balance;
  els.balanceCard.classList.toggle('negative', balance < 0);

  els.balanceFoot.textContent = balance >= 0 ? 'KEEP GOING!' : 'GAME OVER?';

  const level = levelFor(income);
  els.streak.textContent = 'LV.' + level;

  // XP bar: progress through the current level (1000 income = 1 level)
  const xpInto = Math.max(0, income) % 1000;
  els.xpFill.style.width = (xpInto / 1000 * 100) + '%';
  els.xpNext.textContent = Math.floor(xpInto) + ' / 1000 XP';

  [els.balance, els.income, els.expense].forEach((el) => {
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  });

  if (prevLevel !== undefined && level > prevLevel) {
    sfx.levelup();
    showToast('★ LEVEL UP! ★  YOU REACHED LV.' + level);
  }
}

function txMonthKey(t) { const d = new Date(txDate(t)); return d.getFullYear() * 12 + d.getMonth(); }
function matchesFilters(t) {
  if (currentFilter !== 'all' && t.type !== currentFilter) return false;
  if (catFilterVal !== 'all' && t.category !== catFilterVal) return false;
  if (monthFilterVal !== 'all' && txMonthKey(t) !== Number(monthFilterVal)) return false;
  if (guildOn() && playerFilterVal !== 'all' && txOwner(t) !== playerFilterVal) return false;
  return true;
}

function renderList() {
  fillMonthFilter();
  const items = state.transactions
    .filter(matchesFilters)
    .slice().sort((a, b) => txDate(b) - txDate(a)); // newest date first (handles backdated entries)

  els.list.innerHTML = '';
  els.emptyState.style.display = items.length ? 'none' : 'block';

  // filtered summary: count + net (income − expense of shown)
  let inc = 0, exp = 0;
  items.forEach((t) => { if (t.type === 'income') inc += t.amount; else exp += t.amount; });
  const net = inc - exp;
  const anyFilter = currentFilter !== 'all' || catFilterVal !== 'all' || monthFilterVal !== 'all';
  els.logSummary.innerHTML = state.transactions.length
    ? `${items.length} ${anyFilter ? 'MATCH' : 'ENTR' + (items.length === 1 ? 'Y' : 'IES')} · <span class="sum-net ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${fmt(net)}</span>`
    : '';

  items.forEach((t) => {
    const c = catInfo(t.type, t.category);
    const li = document.createElement('li');
    li.className = 'tx-item';
    const dObj = new Date(txDate(t));
    const sameYear = dObj.getFullYear() === new Date().getFullYear();
    const date = dObj.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' });
    const o = txOwner(t);
    const ownerBadge = guildOn()
      ? `<span class="tx-owner" style="color:${GUILD_COLORS[o]};border-color:${GUILD_COLORS[o]}">${escapeHtml(playerName(o))}</span>`
      : '';
    li.innerHTML = `
      <span class="tx-icon" style="background:${CAT_COLORS[t.category] || '#2e2e63'}22;border-color:${CAT_COLORS[t.category] || '#050510'}">${c.icon}</span>
      <span class="tx-body">
        <span class="tx-desc">${escapeHtml(t.desc)}</span>
        <span class="tx-meta">${c.name} · ${date}${ownerBadge}</span>
      </span>
      <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount).replace('-','')}</span>
      <span class="tx-actions">
        <button class="tx-edit" title="Edit" data-id="${t.id}">✎</button>
        <button class="tx-del" title="Delete" data-id="${t.id}">✕</button>
      </span>
    `;
    els.list.appendChild(li);
  });
}

function fillCatFilter() {
  const seen = new Set();
  const opts = ['<option value="all">ALL CATEGORIES</option>'];
  [...CATEGORIES.expense, ...CATEGORIES.income].forEach((c) => {
    if (seen.has(c.id)) return; seen.add(c.id);
    opts.push(`<option value="${c.id}">${c.icon} ${c.name}</option>`);
  });
  els.catFilter.innerHTML = opts.join('');
}
function fillMonthFilter() {
  const keys = new Set();
  state.transactions.forEach((t) => keys.add(txMonthKey(t)));
  const sorted = [...keys].sort((a, b) => b - a);
  const opts = ['<option value="all">ALL MONTHS</option>'];
  sorted.forEach((k) => { opts.push(`<option value="${k}">${MONTHS[k % 12]} ${Math.floor(k / 12)}</option>`); });
  els.monthFilter.innerHTML = opts.join('');
  if (monthFilterVal !== 'all' && !keys.has(Number(monthFilterVal))) monthFilterVal = 'all';
  els.monthFilter.value = monthFilterVal;
}

function renderCats() {
  const spend = {};
  state.transactions.forEach((t) => {
    if (t.type === 'expense') spend[t.category] = (spend[t.category] || 0) + t.amount;
  });
  const entries = Object.entries(spend).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((e) => e[1]), 1);

  els.catBars.innerHTML = '';
  els.catEmpty.style.display = entries.length ? 'none' : 'block';

  const total = entries.reduce((s, e) => s + e[1], 0);
  entries.forEach(([id, amt], i) => {
    const c = catInfo('expense', id);
    const pct = Math.round((amt / max) * 100);
    const share = total > 0 ? Math.round((amt / total) * 100) : 0;
    const color = CAT_COLORS[id] || '#9a9ad0';
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <span class="cat-name"><span class="cat-slot" style="border-color:${color}">${c.icon}</span><span class="cat-label">${c.name}${i === 0 ? ' <span class="cat-crown">👑</span>' : ''}</span></span>
      <span class="cat-track"><span class="cat-fill" style="background-image:linear-gradient(90deg, ${color}, ${color}aa)"></span></span>
      <span class="cat-amt" style="color:${color}">${fmt(amt)}<span class="cat-share">${share}%</span></span>
    `;
    els.catBars.appendChild(row);
    requestAnimationFrame(() => { row.querySelector('.cat-fill').style.width = pct + '%'; });
  });
}

/* ---------------- BUDGET BOSS ---------------- */
function renderBudget() {
  const monthLabel = MONTHS[new Date().getMonth()];
  els.bossTitle.textContent = 'BUDGET BOSS · ' + monthLabel;

  if (!state.budget) {
    els.bossPanel.classList.remove('enraged');
    els.bossSprite.textContent = '👾';
    els.bossName.textContent = 'NO BUDGET SET';
    els.hpFill.className = 'hpbar-fill';
    els.hpFill.style.width = '0%';
    els.hpText.className = 'bar-text';
    els.hpText.textContent = 'SET A MONTHLY LIMIT TO SPAWN THE BOSS';
    return;
  }

  const spent = monthSpend();
  const remaining = state.budget - spent;
  const pct = clamp((remaining / state.budget) * 100, 0, 100);

  els.hpFill.style.width = (remaining <= 0 ? 100 : pct) + '%';

  let cls, sprite, name, text, over = false;
  if (remaining <= 0) {
    cls = 'hp-dead'; over = true;
    sprite = '💀'; name = 'BOSS ENRAGED!';
    text = 'OVER BUDGET BY ' + fmt(Math.abs(remaining));
  } else if (pct <= 20) {
    cls = 'hp-danger'; sprite = '😡'; name = 'THE SPEND DRAGON';
    text = fmt(remaining) + ' HP LEFT — DANGER!';
  } else if (pct <= 50) {
    cls = 'hp-warn'; sprite = '😈'; name = 'THE SPEND DRAGON';
    text = fmt(remaining) + ' / ' + fmt(state.budget) + ' LEFT';
  } else {
    cls = 'hp-ok'; sprite = '🐲'; name = 'THE SPEND DRAGON';
    text = fmt(remaining) + ' / ' + fmt(state.budget) + ' LEFT';
  }

  els.hpFill.className = 'hpbar-fill ' + cls;
  els.bossSprite.textContent = sprite;
  els.bossName.textContent = name;
  els.hpText.textContent = text;
  els.hpText.className = 'bar-text' + (over ? ' over' : '');
  els.bossPanel.classList.toggle('enraged', over);

  // one-shot roar when first crossing over budget
  if (over && !state.budgetBreached) {
    state.budgetBreached = true; save();
    sfx.roar(); showToast('💀 BUDGET BROKEN! THE BOSS BREAKS FREE!');
  } else if (!over && state.budgetBreached) {
    state.budgetBreached = false; save();
  }
}

/* ---------------- SAVINGS QUEST ---------------- */
// co-op savings: show each partner's net contribution under the quest bar
function renderGoalCoop(active) {
  if (!els.goalCoop) return;
  if (!active || !guildOn()) { els.goalCoop.hidden = true; els.goalCoop.innerHTML = ''; return; }
  const s = guildSplit();
  els.goalCoop.hidden = false;
  els.goalCoop.innerHTML = ['p1', 'p2'].map((k) =>
    `<span class="coop-chip" style="border-color:${GUILD_COLORS[k]}">
       <span class="coop-ico">${GUILD_ICONS[k]}</span>
       <span class="coop-who" style="color:${GUILD_COLORS[k]}">${escapeHtml(playerName(k))}</span>
       <span class="coop-net ${s[k].net >= 0 ? 'pos' : 'neg'}">${s[k].net >= 0 ? '+' : ''}${fmt(s[k].net)}</span>
     </span>`).join('');
}

function renderGoal() {
  if (!state.goal) {
    els.goalPanel.classList.remove('complete');
    els.goalChest.textContent = '🗝️';
    els.goalName.textContent = 'NO ACTIVE QUEST';
    els.goalFill.style.width = '0%';
    els.goalText.className = 'bar-text';
    els.goalText.textContent = 'SET A SAVINGS GOAL TO BEGIN';
    renderGoalCoop(false);
    return;
  }

  const saved = Math.max(0, totals().balance);
  const target = state.goal.target;
  const pct = clamp((saved / target) * 100, 0, 100);
  const done = saved >= target;

  els.goalFill.style.width = pct + '%';
  els.goalName.textContent = (guildOn() ? '⚔ ' : '') + state.goal.name;
  els.goalPanel.classList.toggle('complete', done);
  renderGoalCoop(true);

  if (done) {
    els.goalChest.textContent = '🏆';
    els.goalText.textContent = 'QUEST COMPLETE! ' + fmt(target) + ' SAVED ★';
    els.goalText.className = 'bar-text win';
    if (!state.goalCelebrated) {
      state.goalCelebrated = true; save();
      sfx.victory(); showToast('🏆 QUEST COMPLETE: ' + state.goal.name + '!');
    }
  } else {
    els.goalChest.textContent = '💰';
    els.goalText.textContent = fmt(saved) + ' / ' + fmt(target) + '  (' + Math.floor(pct) + '%)';
    els.goalText.className = 'bar-text';
    if (state.goalCelebrated) { state.goalCelebrated = false; save(); }
  }
}

/* ---------------- THE GUILD — render ---------------- */
// HUD tag: who is logging right now (tap to swap in Guild mode)
function renderPlayerTag() {
  if (!els.playerTag) return;
  const on = guildOn();
  const k = activePlayer();
  els.playerTag.textContent = on ? (GUILD_ICONS[k] + ' ' + playerName(k)) : 'PLAYER 1';
  els.playerTag.style.color = on ? GUILD_COLORS[k] : '';
  els.playerTag.classList.toggle('switchable', on);
  els.playerTag.title = on ? 'Tap to switch active player' : '';
}
// household dashboard: per-player earned/spent/net + who's carrying the team
function renderGuild() {
  const on = guildOn();
  if (els.guildSub) els.guildSub.textContent = on ? 'PARTY OF TWO — TRACKING TOGETHER' : 'SOLO PLAY — TAP TO FORM A PARTY';
  if (els.guildSetup) els.guildSetup.hidden = !on;
  if (!els.guildDash) return;
  if (!on) { els.guildDash.hidden = true; return; }
  els.guildDash.hidden = false;
  const s = guildSplit();
  els.guildCards.innerHTML = ['p1', 'p2'].map((k) => {
    const active = activePlayer() === k;
    return `<div class="guild-card${active ? ' active' : ''}" style="border-color:${GUILD_COLORS[k]}">
      <div class="gc-head"><span class="gc-ico">${GUILD_ICONS[k]}</span><span class="gc-name" style="color:${GUILD_COLORS[k]}">${escapeHtml(playerName(k))}</span>${active ? '<span class="gc-now">LOGGING</span>' : ''}</div>
      <div class="gc-row"><span class="gc-lbl">▲ EARN</span><span class="gc-val pos">${fmt(s[k].income)}</span></div>
      <div class="gc-row"><span class="gc-lbl">▼ SPENT</span><span class="gc-val neg">${fmt(s[k].expense)}</span></div>
      <div class="gc-row gc-net"><span class="gc-lbl">NET</span><span class="gc-val ${s[k].net >= 0 ? 'pos' : 'neg'}">${s[k].net >= 0 ? '+' : ''}${fmt(s[k].net)}</span></div>
    </div>`;
  }).join('');
  // team line: combined net + who contributed more this far
  const teamNet = s.p1.net + s.p2.net;
  let lead = 'EVEN MATCH';
  if (s.p1.net > s.p2.net) lead = playerName('p1') + ' LEADS';
  else if (s.p2.net > s.p1.net) lead = playerName('p2') + ' LEADS';
  els.guildTeam.innerHTML = `TEAM NET <span class="${teamNet >= 0 ? 'pos' : 'neg'}">${teamNet >= 0 ? '+' : ''}${fmt(teamNet)}</span> · ${lead}`;
}
// quest-log player filter chips (BOTH / P1 / P2)
function renderPlayerFilter() {
  if (!els.guildFilters) return;
  if (!guildOn()) { els.guildFilters.hidden = true; els.guildFilters.innerHTML = ''; return; }
  els.guildFilters.hidden = false;
  const chip = (val, label, color) =>
    `<button type="button" class="gfilter-btn${playerFilterVal === val ? ' active' : ''}" data-player="${val}"${color ? ` style="--gf:${color}"` : ''}>${label}</button>`;
  els.guildFilters.innerHTML =
    chip('all', 'BOTH', '') +
    chip('p1', playerName('p1'), GUILD_COLORS.p1) +
    chip('p2', playerName('p2'), GUILD_COLORS.p2);
}
function setGuildLabel() {
  if (els.guildBtn) els.guildBtn.textContent = '🛡 GUILD MODE: ' + (guildOn() ? 'ON' : 'OFF');
}

/* ---------------- CATEGORY MINI-BOSSES ---------------- */
// shared HP threshold -> {class, hex} for any drainable bar
function hpState(pct, over) {
  if (over)      return { cls: 'hp-dead',   hex: '#ff5d5d' };
  if (pct <= 20) return { cls: 'hp-danger', hex: '#ff5d5d' };
  if (pct <= 50) return { cls: 'hp-warn',   hex: '#ffd23f' };
  return                { cls: 'hp-ok',     hex: '#4be35a' };
}

function renderMiniBosses() {
  const entries = Object.entries(state.catBudgets);
  els.mbossEmpty.style.display = entries.length ? 'none' : 'block';
  els.mbossList.innerHTML = '';

  // order by how close to the limit (most threatened first)
  entries
    .map(([id, limit]) => ({ id, limit, spent: catSpend(id) }))
    .sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit))
    .forEach(({ id, limit, spent }) => {
      const c = catInfo('expense', id);
      const remaining = limit - spent;
      const over = remaining < 0;
      const pct = clamp((remaining / limit) * 100, 0, 100);
      const st = hpState(pct, over);

      const row = document.createElement('div');
      row.className = 'mboss-row';
      row.innerHTML = `
        <span class="mboss-icon">${over ? '💀' : c.icon}</span>
        <span class="mboss-mid">
          <span class="mboss-name">
            <span>${c.name}</span>
            <span class="mb-amt ${over ? 'over' : ''}">${over ? 'OVER ' + fmt(Math.abs(remaining)) : fmt(spent) + ' / ' + fmt(limit)}</span>
          </span>
          <span class="mboss-bar-track"><span class="mboss-bar-fill" style="background-color:${st.hex}"></span></span>
        </span>
        <button class="mb-del" title="Remove limit" data-cat="${id}">✕</button>
      `;
      els.mbossList.appendChild(row);
      requestAnimationFrame(() => {
        row.querySelector('.mboss-bar-fill').style.width = (over ? 100 : pct) + '%';
      });
    });
}

/* ---------------- STREAK (consecutive months under budget) ---------------- */
function streakMonths() {
  if (!state.budget || state.transactions.length === 0) return 0;
  const now = new Date();
  const curIdx = now.getFullYear() * 12 + now.getMonth();
  let earliest = Infinity;
  state.transactions.forEach((t) => {
    const d = new Date(txDate(t));
    earliest = Math.min(earliest, d.getFullYear() * 12 + d.getMonth());
  });
  let streak = 0;
  for (let idx = curIdx - 1; idx >= earliest; idx--) {
    const y = Math.floor(idx / 12), m = idx % 12;
    if (monthTotals(y, m).expense <= state.budget) streak++; else break;
  }
  return streak;
}
function renderStreak() {
  if (!state.budget) { els.monthStreak.textContent = '🔥 — '; return; }
  const s = streakMonths();
  els.monthStreak.textContent = '🔥 ' + s + ' MO';
}

/* ---------------- WORLD MAP CHART (last 6 months) ---------------- */
function kfmt(n) {
  const c = cur();
  if (n >= 1000000) return c.symbol + (n / 1000000).toLocaleString(c.locale, { maximumFractionDigits: 1 }) + 'M';
  if (n >= 1000) return c.symbol + (n / 1000).toLocaleString(c.locale, { maximumFractionDigits: 1 }) + 'K';
  return c.symbol + Math.round(n).toLocaleString(c.locale);
}
function renderChart() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const idx = now.getFullYear() * 12 + now.getMonth() - i;
    const y = Math.floor(idx / 12), m = idx % 12;
    const { income, expense } = monthTotals(y, m);
    months.push({ y, m, income, expense, current: i === 0 });
  }
  const max = Math.max(...months.flatMap((d) => [d.income, d.expense]), 1);

  els.chart.innerHTML = '';
  months.forEach((d) => {
    const col = document.createElement('div');
    col.className = 'chart-col' + (d.current ? ' current' : '');
    col.innerHTML = `
      <div class="chart-bars">
        <div class="cbar cbar-in" title="EARN ${fmt(d.income)}">${d.income ? `<span class="cbar-val">${kfmt(d.income)}</span>` : ''}</div>
        <div class="cbar cbar-out" title="SPEND ${fmt(d.expense)}">${d.expense ? `<span class="cbar-val">${kfmt(d.expense)}</span>` : ''}</div>
      </div>
      <div class="chart-label ${d.current ? 'current' : ''}">${d.current ? '🚩 ' : ''}${MONTHS[d.m]}</div>
    `;
    els.chart.appendChild(col);
    requestAnimationFrame(() => {
      col.querySelector('.cbar-in').style.height = Math.max(3, (d.income / max) * 100) + '%';
      col.querySelector('.cbar-out').style.height = Math.max(3, (d.expense / max) * 100) + '%';
    });
  });
}

/* ---------------- THE ORACLE (educational tips from your data) ---------------- */
const EDU_TIPS = [
  '💡 Gold is a classic hedge against inflation and market crashes — many investors keep 5–10% of their portfolio in it.',
  '💡 Stocks have historically grown over the long run. "Time in the market" usually beats "timing the market".',
  '💡 Dollar-cost averaging — investing a fixed amount on a regular schedule — smooths out the market\'s ups and downs.',
  '💡 Diversify: don\'t keep all your gold in one chest. Spread across stocks, bonds, gold, and cash.',
  '💡 Build a 3–6 month emergency fund BEFORE putting money into riskier assets like stocks.',
  '💡 Pay off high-interest debt first — clearing a 20% card is a guaranteed 20% "return".',
  '💡 Index funds let you own a slice of hundreds of companies at once, with low fees — popular for beginners.',
  '💡 Only invest money you won\'t need for 5+ years in stocks; keep short-term savings in cash or gold.',
  '💡 Gold pays no dividends or interest — it\'s a store of value, not an income source. Balance it with assets that grow.',
  '💡 All good until our daily caffeine spending & government boondoggle foreshadows doom.',
  '💡 The 50/30/20 rule: 50% needs, 30% wants, 20% savings — a simple map to start your quest.',
  '💡 Automate the win: schedule a savings transfer on payday, so saving happens before spending can.',
  '💡 Inflation is a silent boss battle — idle cash loses HP every year. Make long-term money work.',
  '💡 An emergency fund isn\'t an investment — it\'s armor. Keep it boring, liquid, and reachable.',
  '💡 Track first, judge later: a month of honest logging beats a year of guessing.',
  '💡 Needs vs wants: sleep 24 hours on any "want" bigger than your daily budget — most cravings quietly fade.',
  '💡 A rupiah saved beats a rupiah earned — saving skips the tax and effort that earning costs you.',
  '💡 Audit subscriptions monthly. The quietest boss is the one that auto-renews while you sleep.',
  '💡 Keep at least one month of expenses in instant-access cash before chasing higher returns.',
  '💡 Pay yourself first: treat savings like a fixed bill, not whatever happens to be left over.',
  '💡 Lifestyle creep is the stealth boss — when income rises, bank the raise before your spending learns about it.',
  // — inspired by "The Psychology of Money" (Morgan Housel)
  '📖 Wealth is the money you DON\'T spend — the car not bought, the upgrade skipped. It\'s invisible by nature, which is exactly why it\'s so easy to undervalue.',
  '📖 Your savings RATE matters more than your income or your returns. You can build wealth on a modest salary, or stay broke on a huge one.',
  '📖 Know your "enough." Without it the goalposts move forever, and you risk what you have and need for what you don\'t.',
  '📖 The biggest dividend money pays is control over your time. That freedom is the highest form of wealth.',
  '📖 Save even with no goal in mind. Plain savings buy you options, flexibility, and time to wait for better opportunities.',
  '📖 Pick a plan you can actually stick with. A "reasonable" strategy you keep beats an "optimal" one you abandon in a panic.',
  '📖 Leave room for error. The single biggest point of failure is needing everything to go right — a margin of safety keeps you in the game.',
  '📖 Getting wealthy and staying wealthy are different skills: one rewards optimism and risk, the other humility and frugality.',
  '📖 Happiness is results minus expectations. If your lifestyle climbs as fast as your income, you never actually feel ahead.',
  '📖 Compounding rewards patience, not intensity. The real magic isn\'t huge returns — it\'s good-enough returns left uninterrupted for a very long time.',
  '📖 Luck and risk are siblings. Don\'t judge your money moves only by the outcome — a good decision can still get an unlucky result.',
  '📖 Nobody is crazy with money. Everyone\'s choices make sense given the life and era they\'ve lived through — including yours.',
];

function distinctMonths() {
  const set = new Set();
  state.transactions.forEach((t) => { const d = new Date(txDate(t)); set.add(d.getFullYear() * 12 + d.getMonth()); });
  return Math.max(1, set.size);
}

function oracleTips() {
  const { income, expense, balance } = totals();
  const tips = [];

  if (state.transactions.length === 0) {
    tips.push('🔮 Add your income and expenses, and I\'ll reveal personalised money insights here.');
  }

  if (income > 0) {
    const rate = Math.round(((income - expense) / income) * 100);
    if (rate < 0) tips.push('⚠ You\'re spending more than you earn. Trim expenses before thinking about investing.');
    else if (rate < 10) tips.push('You\'re saving ' + rate + '% of your income. Aim for 20%+ to build wealth faster.');
    else if (rate < 20) tips.push('Solid ' + rate + '% savings rate! Push toward 20% and invest the surplus.');
    else tips.push('🔥 Great ' + rate + '% savings rate! Consider investing the surplus (index funds, gold) for long-term growth.');

    // specific target: how much to trim to reach a 20% savings rate
    if (rate >= 0 && rate < 20) {
      const cut = expense - income * 0.8;
      if (cut > 0) tips.push('💸 To hit a 20% savings rate, trim about ' + fmt(cut) + ' from your total spending.');
    }
  }

  // month-over-month spending trend
  const now = new Date();
  const curSpend = monthTotals(now.getFullYear(), now.getMonth()).expense;
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastSpend = monthTotals(lm.getFullYear(), lm.getMonth()).expense;
  if (lastSpend > 0 && curSpend > 0) {
    const diff = Math.round(((curSpend - lastSpend) / lastSpend) * 100);
    if (diff > 5) tips.push('📈 Spending is up ' + diff + '% vs last month (' + fmt(curSpend) + ' vs ' + fmt(lastSpend) + '). Watch the leaks.');
    else if (diff < -5) tips.push('📉 Nice — spending is down ' + Math.abs(diff) + '% vs last month. Bank the difference!');
  }

  // top spending category + its share
  const spend = {};
  state.transactions.forEach((t) => { if (t.type === 'expense') spend[t.category] = (spend[t.category] || 0) + t.amount; });
  const top = Object.entries(spend).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const share = expense > 0 ? Math.round((top[1] / expense) * 100) : 0;
    tips.push('Your biggest spend is ' + catInfo('expense', top[0]).name + ' (' + fmt(top[1]) + ', ' + share + '% of spending). Small cuts there free up cash to invest.');
  }

  // emergency fund coverage
  const avgMonthly = expense / distinctMonths();
  if (avgMonthly > 0) {
    const months = balance / avgMonthly;
    if (balance <= 0) tips.push('You have no cash cushion yet. Aim for a 3–6 month emergency fund before investing.');
    else if (months < 3) tips.push('Your savings cover ~' + months.toFixed(1) + ' months of spending. Build it to 3–6 months for safety.');
    else tips.push('💪 Your savings cover ~' + Math.floor(months) + ' months of spending — a healthy emergency fund. Surplus could go into gold or stocks.');
  }

  // budget adherence
  if (state.budget) {
    const remaining = state.budget - monthSpend();
    if (remaining < 0) tips.push('You\'re over budget this month by ' + fmt(Math.abs(remaining)) + '. Rein it in before investing more.');
  }

  // goal pacing — how much per month to reach it
  if (state.goal) {
    const saved = Math.max(0, balance);
    const remain = state.goal.target - saved;
    if (remain > 0) {
      tips.push('🎯 "' + state.goal.name + '": ' + fmt(remain) + ' to go. Save ~' + fmt(remain / 6) + '/month to get there in 6 months.');
    }
  }

  // month-end projection — current pace extrapolated over the whole month
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (dayOfMonth >= 5 && curSpend > 0 && dayOfMonth < daysInMonth) {
    const proj = (curSpend / dayOfMonth) * daysInMonth;
    if (state.budget) {
      tips.push(proj > state.budget
        ? '📅 At this pace you\'ll spend ~' + fmt(proj) + ' this month — bursting your ' + fmt(state.budget) + ' budget. Slow the dragon!'
        : '📅 At this pace you\'ll spend ~' + fmt(proj) + ' this month — safely inside your budget. Keep it up!');
    } else {
      tips.push('📅 At this pace you\'ll spend ~' + fmt(proj) + ' this month.');
    }
  }

  // goal ETA at the actual saving pace
  if (state.goal && Math.max(0, balance) < state.goal.target) {
    const monthlySave = (income - expense) / distinctMonths();
    if (monthlySave > 0) {
      const eta = Math.ceil((state.goal.target - Math.max(0, balance)) / monthlySave);
      tips.push('🗺️ At your real pace (~' + fmt(monthlySave) + '/mo saved), "' + state.goal.name + '" is about ' + eta + ' month' + (eta > 1 ? 's' : '') + ' away.');
    }
  }

  // biggest single expense ever
  const expenses = state.transactions.filter((t) => t.type === 'expense');
  if (expenses.length >= 3) {
    const big = expenses.reduce((a, b) => (b.amount > a.amount ? b : a));
    tips.push('💥 Your biggest single hit: ' + big.desc + ' (' + fmt(big.amount) + '). Sleep a night on purchases that size before striking.');
  }

  // no-spend days this month
  if (dayOfMonth >= 7) {
    const spendDays = new Set();
    state.transactions.forEach((t) => {
      const d = new Date(txDate(t));
      if (t.type === 'expense' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) spendDays.add(d.getDate());
    });
    const noSpend = dayOfMonth - spendDays.size;
    if (noSpend > 0) tips.push('🛡️ ' + noSpend + ' no-spend day' + (noSpend > 1 ? 's' : '') + ' so far this month. Each one is a free win — chain them like a combo.');
  }

  // the latte factor — many small purchases (under half the average expense)
  if (expenses.length >= 8) {
    const avgExp = expense / expenses.length;
    const small = expenses.filter((t) => t.amount < avgExp * 0.5);
    const smallTotal = small.reduce((s, t) => s + t.amount, 0);
    const smallShare = expense > 0 ? Math.round((smallTotal / expense) * 100) : 0;
    if (small.length >= 5 && smallShare >= 15) {
      tips.push('🧋 ' + small.length + ' small purchases quietly add up to ' + fmt(smallTotal) + ' (' + smallShare + '% of all spending). Little leaks sink big ships.');
    }
  }

  // weekend spending share
  if (expenses.length >= 8) {
    let we = 0;
    expenses.forEach((t) => { const dw = new Date(txDate(t)).getDay(); if (dw === 0 || dw === 6) we += t.amount; });
    const weShare = expense > 0 ? Math.round((we / expense) * 100) : 0;
    if (weShare >= 40) tips.push('🎉 ' + weShare + '% of your spending happens on weekends (2 days out of 7). Plan weekend fun with a cap.');
  }

  // best savings month on record
  const monthKeys = new Set();
  state.transactions.forEach((t) => { const d = new Date(txDate(t)); monthKeys.add(d.getFullYear() * 12 + d.getMonth()); });
  if (monthKeys.size >= 2) {
    let best = null;
    monthKeys.forEach((k) => {
      const y = Math.floor(k / 12), m = k % 12;
      const mt = monthTotals(y, m);
      const net = mt.income - mt.expense;
      if (!best || net > best.net) best = { y, m, net };
    });
    if (best && best.net > 0) tips.push('🏅 Your best month on record: ' + MONTHS[best.m] + ' ' + best.y + ' (saved ' + fmt(best.net) + '). Can you beat your high score?');
  }

  // income concentration — nudge toward a second stream
  const incomeCats = new Set(state.transactions.filter((t) => t.type === 'income').map((t) => t.category));
  if (incomeCats.size === 1 && state.transactions.filter((t) => t.type === 'income').length >= 3) {
    tips.push('💼 All your income flows from one source. A side quest income stream is the best armor against surprises.');
  }

  // daily spending allowance for the rest of the month
  if (state.budget) {
    const remaining = state.budget - monthSpend();
    const daysLeft = daysInMonth - dayOfMonth + 1;
    if (remaining > 0 && daysLeft > 0) {
      tips.push('🪙 ' + fmt(remaining) + ' budget left over ' + daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + ' = ~' + fmt(remaining / daysLeft) + '/day to stay on track.');
    }
  }

  // this month's net so far
  const mtNow = monthTotals(now.getFullYear(), now.getMonth());
  if (mtNow.income > 0 || mtNow.expense > 0) {
    const net = mtNow.income - mtNow.expense;
    tips.push((net >= 0 ? '🟢' : '🔴') + ' This month so far: earned ' + fmt(mtNow.income) + ', spent ' + fmt(mtNow.expense) + ' → ' + (net >= 0 ? 'saved ' : 'down ') + fmt(Math.abs(net)) + '.');
  }

  // single-category over-concentration
  if (top && expense > 0) {
    const topShare = Math.round((top[1] / expense) * 100);
    if (topShare >= 45) tips.push('⚠ ' + catInfo('expense', top[0]).name + ' is ' + topShare + '% of all spending — one category dominating is risky. Diversify your spending, not just your investments.');
  }

  // average expense size — point of awareness
  if (expenses.length >= 6) {
    const avgExp = expense / expenses.length;
    tips.push('📊 Your average expense is ' + fmt(avgExp) + ' across ' + expenses.length + ' purchases. Knowing your "normal" makes the outliers obvious.');
  }

  return tips.concat(EDU_TIPS);
}

/* ---------------- SIDE QUESTS (challenges) ---------------- */
const CHALLENGES = [
  { id: 'first',    icon: '🐣', name: 'FIRST STEPS',     desc: 'Log your first entry',     check: () => ({ cur: Math.min(state.transactions.length, 1), goal: 1 }) },
  { id: 'five',     icon: '📜', name: 'GETTING STARTED', desc: 'Log 5 entries',            check: () => ({ cur: Math.min(state.transactions.length, 5), goal: 5 }) },
  { id: 'log25',    icon: '📚', name: 'BOOKKEEPER',      desc: 'Log 25 entries',           check: () => ({ cur: Math.min(state.transactions.length, 25), goal: 25 }) },
  { id: 'budget',   icon: '🛡️', name: 'BUDGET KEEPER',   desc: 'Set a monthly budget',     check: () => ({ cur: state.budget ? 1 : 0, goal: 1 }) },
  { id: 'minib',    icon: '👾', name: 'BOSS HUNTER',     desc: 'Set a category limit',     check: () => ({ cur: Object.keys(state.catBudgets || {}).length ? 1 : 0, goal: 1 }) },
  { id: 'goalset',  icon: '🗺️', name: 'DREAMER',         desc: 'Set a savings quest',      check: () => ({ cur: state.goal ? 1 : 0, goal: 1 }) },
  { id: 'diverse',  icon: '🎨', name: 'DIVERSIFIER',     desc: 'Spend in 3 categories',    check: () => ({ cur: Math.min(new Set(state.transactions.filter((t) => t.type === 'expense').map((t) => t.category)).size, 3), goal: 3 }) },
  { id: 'diverse5', icon: '🌈', name: 'WELL-ROUNDED',    desc: 'Spend in 5 categories',    check: () => ({ cur: Math.min(new Set(state.transactions.filter((t) => t.type === 'expense').map((t) => t.category)).size, 5), goal: 5 }) },
  { id: 'months3',  icon: '🗓️', name: 'CONSISTENT',      desc: 'Track across 3 months',    check: () => ({ cur: Math.min(distinctMonths(), 3), goal: 3 }) },
  { id: 'saver20',  icon: '📈', name: 'DISCIPLINED',     desc: 'Reach a 20% savings rate', check: () => { const { income, expense } = totals(); const r = income > 0 ? (income - expense) / income : 0; return { cur: clamp(Math.round(r * 100), 0, 20), goal: 20 }; } },
  { id: 'earn1m',   icon: '💰', name: 'BIG EARNER',      desc: 'Earn Rp10jt total',        check: () => ({ cur: Math.min(totals().income, 10000000), goal: 10000000 }) },
  { id: 'save5',    icon: '🥚', name: 'NEST EGG',        desc: 'Reach a Rp5jt balance',    check: () => ({ cur: Math.min(Math.max(0, totals().balance), 5000000), goal: 5000000 }) },
  { id: 'streak3',  icon: '🔥', name: 'ON A ROLL',       desc: '3-month budget streak',    check: () => ({ cur: Math.min(streakMonths(), 3), goal: 3 }) },
  { id: 'chest7',   icon: '🎁', name: 'DAILY HABIT',     desc: '7-day chest streak',       check: () => ({ cur: Math.min(state.chestStreak || 0, 7), goal: 7 }) },
  { id: 'wealth50', icon: '👑', name: 'WEALTHY',         desc: 'Reach a Rp50jt balance',   check: () => ({ cur: Math.min(Math.max(0, totals().balance), 50000000), goal: 50000000 }) },
  { id: 'quest',    icon: '⭐', name: 'DREAM ACHIEVED',  desc: 'Complete a savings quest', check: () => ({ cur: (state.goal && totals().balance >= state.goal.target) ? 1 : 0, goal: 1 }) },
];

function renderQuests() {
  els.questList.innerHTML = '';
  CHALLENGES.forEach((c) => {
    const { cur, goal } = c.check();
    const done = cur >= goal;
    const pct = Math.min(100, Math.round((cur / goal) * 100));
    const row = document.createElement('div');
    row.className = 'quest-item' + (done ? ' done' : '');
    row.innerHTML = `
      <span class="q-ico">${done ? '✅' : c.icon}</span>
      <span class="q-body">
        <span class="q-name">${c.name}</span>
        <span class="q-desc">${c.desc}</span>
        <span class="q-track"><span class="q-fill" style="width:${pct}%"></span></span>
      </span>
      <span class="q-status">${done ? 'DONE' : pct + '%'}</span>`;
    els.questList.appendChild(row);

    // record completion; celebrate only for quests finished during this session
    if (done && !state.questsDone.includes(c.id)) {
      state.questsDone.push(c.id);
      save();
      if (appReady) { sfx.victory(); showToast('🗺️ QUEST COMPLETE: ' + c.name + '!'); }
    }
  });

  // guild banner progress
  const doneCount = CHALLENGES.filter((c) => { const { cur, goal } = c.check(); return cur >= goal; }).length;
  els.questProgress.textContent = doneCount + ' / ' + CHALLENGES.length + ' DEEDS COMPLETED';
  els.deedsCount.textContent = doneCount + ' / ' + CHALLENGES.length;
}

/* show/hide the deeds list inside the quest board */
function toggleDeeds() {
  const opening = els.questList.hidden;
  els.questList.hidden = !opening;
  els.deedsToggle.classList.toggle('open', opening);
  if (opening) beep([523, 659], 0.06, 'triangle', 0.04); else sfx.click();
}

/* quest board open/close with a little guild-horn flourish */
function toggleQuestBoard() {
  const opening = els.questScroll.hidden;
  els.questScroll.hidden = !opening;
  els.questToggle.classList.toggle('open', opening);
  if (opening) beep([523, 659, 784], 0.07, 'triangle', 0.04); // unroll fanfare
  else sfx.click();
}

/* the guild: collapsible party panel (matches the Vault/Options style) */
function toggleGuild() {
  const opening = els.guildScroll.hidden;
  els.guildScroll.hidden = !opening;
  els.guildToggle.classList.toggle('open', opening);
  if (opening) beep([392, 523, 659], 0.07, 'triangle', 0.04); // party-up fanfare
  else sfx.click();
}

/* the vault: heavy door over the skins + audio settings */
function toggleVault() {
  const opening = els.vaultScroll.hidden;
  els.vaultScroll.hidden = !opening;
  els.vaultToggle.classList.toggle('open', opening);
  els.vaultDial.textContent = opening ? '🔓' : '🔒';
  els.vaultSub.textContent = opening ? 'UNSEALED — YOUR TREASURES' : 'SEALED — TAP TO UNLOCK';
  if (opening) beep([98, 131, 196], 0.07, 'square', 0.05); // tumbler clunk
  else sfx.click();
}

let oracleIdx = 0;
let typeTimer = null;
let typingFull = '';                 // full text of the tip currently being typed (for tap-to-skip)
function typeBlip() { if (state.soundOn) { try { beep([1180], 0.012, 'square', 0.013); } catch (e) {} } }
function typewrite(el, text) {
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  typingFull = text;
  els.oracleMore.hidden = true;      // hide the continue arrow while typing
  el.textContent = '';
  let i = 0;
  typeTimer = setInterval(() => {
    el.textContent = text.slice(0, i + 1);
    if (text[i] && text[i] !== ' ' && i % 2 === 0) typeBlip(); // soft RPG-textbox blip
    i += 1;
    if (i >= text.length) { clearInterval(typeTimer); typeTimer = null; els.oracleMore.hidden = false; }
  }, 26);
}
function currentTip() {
  const list = oracleTips();
  if (oracleIdx >= list.length) oracleIdx = 0;
  return list[oracleIdx] || '';
}
function renderOracle() {            // instant update from renderAll — don't interrupt active typing
  if (typeTimer) return;
  els.oracleText.textContent = currentTip();
  els.oracleMore.hidden = false;
}
function typeOracle() { typewrite(els.oracleText, currentTip()); } // animated (tap / first load)

/* tap the dialogue: skip the typing if mid-sentence, otherwise next insight */
function oracleTap() {
  if (typeTimer) {                   // skip — reveal the full line instantly
    clearInterval(typeTimer); typeTimer = null;
    els.oracleText.textContent = typingFull;
    els.oracleMore.hidden = false;
    sfx.click();
  } else {
    oracleIdx += 1;
    sfx.click();
    typeOracle();
  }
}

/* ---------------- DAILY CHEST ---------------- */
const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
const chestAvailable = () => state.lastChest !== todayStr();
const CHEST_REWARDS = [
  'A penny saved is a penny earned!',
  'Future You says thanks for saving today.',
  'Tip: automate savings so you never forget.',
  'Small daily habits beat big rare efforts.',
  'You showed up today — that\'s the real win!',
  'Tip: track every expense for one week — it\'s eye-opening.',
  'Compound interest is the 8th wonder of the world.',
  'Pay yourself first, then spend the rest.',
];
function renderChest() {
  const avail = chestAvailable();
  els.chestBtn.classList.toggle('ready', avail);
  els.chestBtn.disabled = !avail;
  els.chestStreak.textContent = state.chestStreak > 0 ? 'DAY ' + state.chestStreak + ' STREAK 🔥' : 'NO STREAK YET';
  els.chestSay.textContent = avail ? "Tap to open today's chest!" : 'Opened! Come back tomorrow.';
}
function openChest() {
  if (!chestAvailable()) { sfx.error(); return; }
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  state.chestStreak = (state.lastChest === yest.toLocaleDateString('en-CA')) ? state.chestStreak + 1 : 1;
  state.lastChest = todayStr();
  save();
  sfx.victory();
  coinRain(28);
  showToast('🎁 ' + CHEST_REWARDS[Math.floor(Math.random() * CHEST_REWARDS.length)]);
  renderChest();
}

/* ---------------- UNLOCKABLE THEMES ---------------- */
// Each theme unlocks either by level (lv) or by a milestone (req + reqLabel).
const THEMES = [
  { id: 'default', name: 'CLASSIC',  lv: 1, sw: ['#0b0b1f', '#ffd23f'] },
  { id: 'gameboy', name: 'GAME BOY', req: () => totals().balance >= 50000000,  reqLabel: 'BAL $50M',  sw: ['#0f380f', '#9bbc0f'] },
  { id: 'snes',    name: 'SNES',     req: () => totals().balance >= 75000000,  reqLabel: 'BAL $75M',  sw: ['#211a3a', '#b6a6ff'] },
  { id: 'arcade',  name: 'ARCADE',   req: () => totals().balance >= 100000000, reqLabel: 'BAL $100M', sw: ['#05050a', '#ff2fd0'] },
  { id: 'mario',   name: 'FANTASY',  req: () => totals().balance >= 125000000, reqLabel: 'BAL $125M', sw: ['#5c94fc', '#e52521'] },
  { id: 'undersea', name: 'UNDERSEA', req: () => totals().balance >= 150000000, reqLabel: 'BAL $150M', sw: ['#06283d', '#2fd0c0'] },
  { id: 'midas',   name: 'MIDAS',    req: () => state.questsDone.length >= CHALLENGES.length, reqLabel: 'ALL QUESTS', sw: ['#120d02', '#ffd23f'] },
];
function themeUnlocked(t) {
  if (t.req) return t.req();
  return levelFor(totals().income) >= (t.lv || 1);
}
function themeReq(t) {
  return t.req ? t.reqLabel : ('LV.' + t.lv);
}
function applyTheme(id) {
  if (id && id !== 'default') document.body.dataset.theme = id;
  else delete document.body.dataset.theme;
}
// when the player picks a skin that has its own theme song, switch the jukebox
// to it — but only if music is already playing, so we never start audio uninvited
function playSkinTrack(id) {
  if (!state.musicOn) return;
  const i = TRACKS.findIndex((t) => t.skin === id);
  if (i < 0 || i === state.musicTrack) return;
  state.musicTrack = i; save(); setMusicLabel();
  stopMusic(); music.step = 0; startMusic();
  showToast('♫ ' + TRACKS[i].name + ' THEME');
}
function renderThemes() {
  els.themeGrid.innerHTML = '';
  THEMES.forEach((t) => {
    const unlocked = themeUnlocked(t);
    // celebrate the moment a skin unlocks (but not silently on first load)
    if (unlocked && !state.themesSeen.includes(t.id)) {
      state.themesSeen.push(t.id);
      save();
      if (appReady) { coinRain(32); sfx.victory(); showToast('🎨 NEW SKIN UNLOCKED: ' + t.name + '!'); }
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-btn' + (state.theme === t.id ? ' active' : '') + (unlocked ? '' : ' locked');
    btn.innerHTML = `<span class="sw"><i style="background:${t.sw[0]}"></i><i style="background:${t.sw[1]}"></i><i style="background:${t.sw[1]}"></i><i style="background:${t.sw[0]}"></i></span><span class="theme-name">${t.name}</span><span class="lock">${unlocked ? (state.theme === t.id ? '✓' : '') : '🔒'}</span>`;
    if (unlocked) {
      btn.addEventListener('click', () => {
        state.theme = t.id; save(); applyTheme(t.id); sfx.click(); renderThemes();
        renderZone();          // skin, zone, and music all move together
        showToast('🎨 SKIN: ' + t.name);
        playSkinTrack(t.id);
      });
    } else {
      btn.addEventListener('click', () => { sfx.error(); showToast('🔒 LOCKED — KEEP PLAYING TO UNLOCK!'); });
    }
    els.themeGrid.appendChild(btn);
  });
}

/* ============================================================
   WORLD ZONES — your net worth is a journey across biomes,
   and reaching THE COSMOS (the full starfield) is the endgame.
============================================================ */
// Each zone is paired with a skin, so reaching a milestone unlocks a skin,
// its zone, and its music together (see THEMES + TRACKS). The balance-gated
// zones run City -> ... -> Whisper Woods; THE COSMOS is the endgame, earned
// by completing every deed (the same condition as the secret MIDAS skin).
const ZONES = [
  { id: 'city',   name: 'NEON CITY',     icon: '🏙️', min: 0,         skin: 'default' },
  { id: 'meadow', name: 'GREEN MEADOW',  icon: '🌱', min: 50000000,  skin: 'gameboy' },
  { id: 'cave',   name: 'CRYSTAL CAVE',  icon: '💎', min: 75000000,  skin: 'snes' },
  { id: 'peak',   name: 'FROZEN PEAK',   icon: '🏔️', min: 100000000, skin: 'arcade' },
  { id: 'desert', name: 'GOLDEN DUNES',  icon: '🏜️', min: 125000000, skin: 'mario' },
  { id: 'undersea', name: 'KRAKEN DEEP', icon: '🐙', min: 150000000, skin: 'undersea' },
  { id: 'cosmos', name: 'THE COSMOS',    icon: '🌌', allDeeds: true,  skin: 'midas' },
];
// how brightly the starfield burns in each zone — dim in the city, blazing in space
const ZONE_STAR = { city: 0.12, meadow: 0.22, cave: 0.38, peak: 0.52, desert: 0.68, undersea: 0.4, cosmos: 1.5 };
function renderZone() {
  // your ACTIVE SKIN decides which realm you stand in — skin, zone, and music
  // all switch together when you pick a skin in the Vault. Drives the
  // biome background + starfield brightness via data-zone (no header UI).
  const z = ZONES.find((zz) => zz.skin === state.theme) || ZONES[0];
  document.documentElement.dataset.zone = z.id;
}

/* ============================================================
   WEEKLY BOUNTIES — three rotating challenges that reset every
   week, computed live from this week's entries.
============================================================ */
// Monday-anchored week so bounties reset on a clean weekly boundary
function weekStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // back up to Monday
  return x;
}
const weekKey = () => tsToYmd(weekStart().getTime());
function weekTx() {
  const s = weekStart().getTime(), e = s + 7 * 86400000;
  return state.transactions.filter((t) => { const d = txDate(t); return d >= s && d < e; });
}
const BOUNTIES = [
  { id: 'b_log5',  icon: '📝', name: 'BUSY WEEK',    desc: 'Log 5 entries this week',   prog: () => ({ cur: Math.min(weekTx().length, 5), goal: 5 }) },
  { id: 'b_log10', icon: '📚', name: 'GRINDER',      desc: 'Log 10 entries this week',  prog: () => ({ cur: Math.min(weekTx().length, 10), goal: 10 }) },
  { id: 'b_inc',   icon: '💰', name: 'PAYDAY',       desc: 'Log income this week',      prog: () => ({ cur: weekTx().some((t) => t.type === 'income') ? 1 : 0, goal: 1 }) },
  { id: 'b_days3', icon: '📅', name: 'STEADY HAND',  desc: 'Log on 3 separate days',    prog: () => ({ cur: Math.min(new Set(weekTx().map((t) => tsToYmd(txDate(t)))).size, 3), goal: 3 }) },
  { id: 'b_cat3',  icon: '🎨', name: 'EXPLORER',     desc: 'Spend in 3 categories',     prog: () => ({ cur: Math.min(new Set(weekTx().filter((t) => t.type === 'expense').map((t) => t.category)).size, 3), goal: 3 }) },
  { id: 'b_save',  icon: '📈', name: 'IN THE GREEN', desc: 'Earn more than you spend',  prog: () => { let i = 0, e = 0; weekTx().forEach((t) => t.type === 'income' ? i += t.amount : e += t.amount); return { cur: (i > e && i > 0) ? 1 : 0, goal: 1 }; } },
  { id: 'b_chest', icon: '🎁', name: 'LOOT HOUND',   desc: 'Open the daily chest',      prog: () => { const s = weekStart().getTime(), e = s + 7 * 86400000, lc = state.lastChest ? ymdToTs(state.lastChest) : 0; return { cur: (lc >= s && lc < e) ? 1 : 0, goal: 1 }; } },
  { id: 'b_big',   icon: '⭐', name: 'BIG MOVE',     desc: 'Log an entry over Rp1jt',   prog: () => ({ cur: weekTx().some((t) => t.amount >= 1000000) ? 1 : 0, goal: 1 }) },
];
// deterministically pick 3 bounties for the current week (seeded shuffle so the
// set is stable all week and rotates from week to week)
function weekBounties() {
  const wk = weekKey();
  let seed = 0; for (let i = 0; i < wk.length; i++) seed = (seed * 31 + wk.charCodeAt(i)) >>> 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const idx = BOUNTIES.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, 3).map((i) => BOUNTIES[i]);
}
function ensureBountyWeek() {
  const wk = weekKey();
  if (!state.bounties || state.bounties.week !== wk) { state.bounties = { week: wk, done: [] }; save(); }
}
function renderBounties() {
  ensureBountyWeek();
  const picks = weekBounties();
  els.bountyList.innerHTML = '';
  let doneCount = 0;
  picks.forEach((b) => {
    const { cur, goal } = b.prog();
    const done = cur >= goal;
    const pct = Math.min(100, Math.round((cur / goal) * 100));
    if (done) {
      doneCount++;
      if (!state.bounties.done.includes(b.id)) {
        state.bounties.done.push(b.id); save();
        if (appReady) { sfx.victory(); coinRain(10); showToast('⚔ BOUNTY DONE: ' + b.name + '!'); }
      }
    }
    const row = document.createElement('div');
    row.className = 'bounty-item' + (done ? ' done' : '');
    row.innerHTML = `
      <span class="bn-ico">${done ? '✅' : b.icon}</span>
      <span class="bn-body">
        <span class="bn-name">${b.name}</span>
        <span class="bn-desc">${b.desc}</span>
        <span class="bn-track"><span class="bn-fill" style="width:${pct}%"></span></span>
      </span>
      <span class="bn-status">${done ? 'DONE' : pct + '%'}</span>`;
    els.bountyList.appendChild(row);
  });
  // countdown to the next Monday reset
  const days = Math.max(1, Math.ceil((weekStart().getTime() + 7 * 86400000 - Date.now()) / 86400000));
  els.bountyReset.textContent = 'RESETS IN ' + days + 'D';
  // all cleared → reward + weekly streak (celebrated once per week)
  if (doneCount >= picks.length) {
    els.bountyReward.textContent = '🏆 ALL BOUNTIES CLEARED! 🏆';
    els.bountyReward.classList.add('claimed');
    if (state.bountyClaimed !== state.bounties.week) {
      state.bountyClaimed = state.bounties.week;
      state.bountyStreak = (state.bountyStreak || 0) + 1; save();
      if (appReady) { coinRain(40); sfx.victory(); showToast('🏆 WEEKLY BOUNTIES COMPLETE — WEEK ' + state.bountyStreak + '!'); }
    }
  } else {
    els.bountyReward.textContent = doneCount + ' / ' + picks.length + ' CLEARED · FINISH ALL FOR A REWARD';
    els.bountyReward.classList.remove('claimed');
  }
}

/* ============================================================
   COMBO METER — logging entries in quick succession builds a
   multiplier with escalating blips. Session-only (not saved).
============================================================ */
const combo = { count: 0, timer: null };
const COMBO_WINDOW = 9000; // ms before the chain breaks
function bumpCombo() {
  combo.count += 1;
  clearTimeout(combo.timer);
  combo.timer = setTimeout(endCombo, COMBO_WINDOW);
  const c = combo.count;
  if (c >= 2) {
    showCombo(c);
    if (state.soundOn) { try { beep([300 + Math.min(c, 14) * 70], 0.05, 'square', 0.045); } catch (e) {} }
    vibe(8);
    if (c === 5 || (c >= 10 && c % 5 === 0)) { sfx.victory(); coinRain(c >= 10 ? 12 : 6); }
  }
}
function endCombo() { combo.count = 0; if (els.comboPop) els.comboPop.classList.remove('show'); }
function showCombo(c) {
  if (!els.comboPop) return;
  els.comboPop.innerHTML = 'COMBO<b>×' + c + '</b>';
  els.comboPop.classList.toggle('fire', c >= 5);
  els.comboPop.classList.add('show');
  els.comboPop.animate(
    [{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
    { duration: 280, easing: 'cubic-bezier(.18,.89,.32,1.28)' }
  );
}

/* ============================================================
   BUDGET-DRIVEN WEATHER — the sky reacts to your Budget Boss:
   clear when healthy, clouding over as you near the limit, rain
   in the danger zone, and a storm once you blow the budget.
============================================================ */
function weatherMode() {
  // rain/storm weather is a Classic-skin (NEON CITY) effect only — other skins
  // keep their own ambient (snow, fish, motes) with no rain
  if (document.documentElement.dataset.zone !== 'city') return 'clear';
  if (!state.budget) return 'clear';
  const spent = monthSpend();
  if (spent > state.budget) return 'storm';
  const remain = 1 - spent / state.budget;
  if (remain <= 0.2) return 'rain';
  if (remain <= 0.5) return 'cloud';
  return 'clear';
}
function renderWeather() { document.documentElement.dataset.weather = weatherMode(); }

/* ---------------- COIN RAIN + KONAMI CHEAT ---------------- */
function coinRain(n = 24) {
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'coin-rain';
    c.textContent = '🪙';
    c.style.left = (Math.random() * 100) + 'vw';
    c.style.fontSize = (16 + Math.random() * 18) + 'px';
    c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
    c.style.animationDelay = (Math.random() * 0.6) + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3800);
  }
}
// coins fly from the form area up into the balance card (on income)
function flyCoinsTo(el, n = 6) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'fly-coin';
    c.textContent = '🪙';
    const sx = window.innerWidth / 2 + (Math.random() * 90 - 45);
    const sy = window.innerHeight - 70 + (Math.random() * 30 - 15);
    c.style.left = sx + 'px';
    c.style.top = sy + 'px';
    document.body.appendChild(c);
    const delay = i * 55;
    setTimeout(() => { c.style.transform = `translate(${tx - sx}px,${ty - sy}px) scale(0.4)`; c.style.opacity = '0'; }, 20 + delay);
    setTimeout(() => c.remove(), 760 + delay);
  }
}
function activateCheat() {
  state.rainbow = !state.rainbow;
  save();
  document.body.classList.toggle('rainbow', state.rainbow);
  if (state.rainbow) { coinRain(44); sfx.victory(); showToast('🌈 CHEAT ACTIVATED — RAINBOW MODE!'); }
  else { sfx.click(); showToast('RAINBOW MODE OFF'); }
}

/* ---------------- RANDOM ENCOUNTERS ---------------- */
const ENCOUNTERS = [
  { msg: '🪙 You found a lucky coin on the ground!', coins: 14 },
  { msg: '👺 A goblin tried to pickpocket you — you dodged!', coins: 0 },
  { msg: '✨ A shooting star streaks past. Make a wish!', coins: 10 },
  { msg: '📦 You spot a mysterious crate in the dungeon.', coins: 8 },
  { msg: '🐉 The Spend Dragon eyes your wallet…', coins: 0 },
];
function maybeEncounter() {
  if (Math.random() > 0.15) return; // ~15% chance per entry
  const e = ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)];
  setTimeout(() => { showToast(e.msg); if (e.coins) coinRain(e.coins); }, 750);
}

/* ============================================================
   RECURRING TRANSACTIONS (AUTO-PILOT) — templates that auto-log
   themselves on a weekly / monthly schedule, catching up on boot.
============================================================ */
// advance a timestamp by one period; monthly clamps to the month's last day
// (e.g. Jan 31 -> Feb 28) so a "31st" rule never skips short months
function addPeriod(ts, freq) {
  const d = new Date(ts);
  if (freq === 'weekly') { d.setDate(d.getDate() + 7); return d.getTime(); }
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, dim));
  return d.getTime();
}
const freqLabel = (f) => (f === 'weekly' ? 'WEEKLY' : 'MONTHLY');
// log any recurring entries whose next-due date has arrived. Returns how many
// were added. A guard caps catch-up so a long-dormant rule can't loop forever.
function runRecurring() {
  const list = state.recurring || [];
  if (!list.length) return 0;
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const cap = end.getTime();
  let added = 0;
  list.forEach((r) => {
    let guard = 0;
    while (r.nextDue <= cap && guard < 240) {
      state.transactions.push({
        id: newId(), date: r.nextDue, type: r.type,
        desc: r.desc, amount: r.amount, category: r.category, auto: true,
        owner: (r.owner === 'p2' ? 'p2' : 'p1'),
      });
      r.lastRun = r.nextDue;
      r.nextDue = addPeriod(r.nextDue, r.freq);
      added += 1; guard += 1;
    }
  });
  if (added) save();
  return added;
}
function renderRecurring() {
  if (!els.recurList) return;
  const list = state.recurring || [];
  // the whole block only appears once there's at least one rule, keeping the
  // New Entry panel tidy (the 🔁 REPEAT field above is the entry point)
  if (els.recurInline) els.recurInline.hidden = list.length === 0;
  if (els.recurSub) els.recurSub.textContent = list.length ? ' · ' + list.length + ' ACTIVE' : '';
  els.recurList.innerHTML = '';
  list.slice().sort((a, b) => a.nextDue - b.nextDue).forEach((r) => {
    const c = catInfo(r.type, r.category);
    const next = new Date(r.nextDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const row = document.createElement('div');
    row.className = 'recur-row';
    row.innerHTML = `
      <span class="rc-ico">${r.freq === 'weekly' ? '📅' : '🗓️'}</span>
      <span class="rc-body">
        <span class="rc-name">${escapeHtml(r.desc)}</span>
        <span class="rc-meta">${freqLabel(r.freq)} ▸ ${next}</span>
      </span>
      <span class="rc-amt ${r.type}">${r.type === 'income' ? '+' : '-'}${fmt(r.amount).replace('-', '')}</span>
      <button class="rc-del" title="Stop repeating" data-id="${r.id}">✕</button>`;
    els.recurList.appendChild(row);
  });
}
function removeRecurring(id) {
  state.recurring = (state.recurring || []).filter((r) => r.id !== Number(id));
  save(); sfx.delete(); renderRecurring();
  showToast('🔁 RECURRING RULE STOPPED');
}

/* ============================================================
   AUTO-BACKUP REMINDER — a gentle nudge to export a backup when
   data is piling up and hasn't been saved off-device in a while.
============================================================ */
const BACKUP_INTERVAL = 14 * 86400000; // 14 days
function maybeBackupReminder() {
  if (state.transactions.length < 8) return;
  if (Date.now() - (state.lastBackup || 0) < BACKUP_INTERVAL) return;
  if (state.backupNudge === todayStr()) return;     // already nudged today
  state.backupNudge = todayStr(); save();
  setTimeout(() => showToast('💾 TIP: BACK UP YOUR DATA — OPTIONS ▸ BACKUP'), 3800);
}

/* ============================================================
   ONBOARDING — a short first-run tour for brand-new players, with
   an option to load explorable sample data.
============================================================ */
const OB_STEPS = [
  { art: '<img class="ob-logo" src="icon-192.png?v=72" alt="Octrovebox" />', title: 'WELCOME TO OCTROVEBOX', body: 'Track your money like a retro RPG. Earn gold, fight the Budget Boss, and complete quests — all saved privately on your own device.' },
  { art: '★',  title: 'SET YOUR BALANCE',     body: 'Tap START ✎ on the BALANCE card to enter how much money you have right now. Everything else builds from there.' },
  { art: '⮞',  title: 'LOG AN ENTRY',         body: 'Use + NEW ENTRY to record what you SPEND or EARN. Set REPEAT to auto-log salary, rent, or subscriptions every week or month.' },
  { art: '⚔️', title: 'BEAT THE BOSS',        body: 'Set a monthly budget to spawn the Budget Boss, chase savings quests, and unlock skins, zones, and music as your gold grows.' },
];
let obIdx = 0;
function renderOnboard() {
  const s = OB_STEPS[obIdx];
  els.obArt.innerHTML = s.art;   // art may be an emoji or the logo <img>
  els.obTitle.textContent = s.title;
  els.obBody.textContent = s.body;
  els.obBack.hidden = obIdx === 0;
  const last = obIdx === OB_STEPS.length - 1;
  els.obNext.textContent = last ? '▶ START' : 'NEXT ▶';
  els.obSample.hidden = !last;
  els.obDots.innerHTML = OB_STEPS.map((_, i) => `<span class="ob-dot${i === obIdx ? ' on' : ''}"></span>`).join('');
}
function showOnboard() { obIdx = 0; renderOnboard(); els.onboardOverlay.hidden = false; }
function finishOnboard(sample) {
  state.onboarded = true; save();
  els.onboardOverlay.hidden = true;
  if (sample) loadSampleData(); else sfx.click();
}
function maybeOnboard() {
  if (!state.onboarded && state.transactions.length === 0) showOnboard();
}
function loadSampleData() {
  const now = Date.now(), day = 86400000;
  state.openingBalance = 2000000;
  state.budget = 3000000;
  state.budgetBreached = false;
  state.goal = { name: 'NEW LAPTOP', target: 15000000 };
  state.goalCelebrated = false;
  const samp = [
    ['income',  'MONTHLY SALARY', 'salary',  8000000, 28],
    ['expense', 'GROCERIES',      'food',     350000, 25],
    ['expense', 'BUS PASS',       'transit',  200000, 24],
    ['expense', 'MOVIE NIGHT',    'fun',      120000, 20],
    ['expense', 'ELECTRIC BILL',  'bills',    450000, 18],
    ['income',  'FREELANCE GIG',  'side',    1500000, 15],
    ['expense', 'MORNING COFFEE', 'food',      45000, 12],
    ['expense', 'NEW SHOES',      'shop',     600000,  8],
    ['expense', 'PHARMACY',       'health',    90000,  5],
    ['expense', 'LUNCH OUT',      'food',      75000,  2],
  ];
  samp.forEach(([type, desc, category, amount, ago]) => {
    state.transactions.push({ id: newId(), date: now - ago * day, type, desc, amount, category });
  });
  save(); sfx.victory(); coinRain(24);
  renderAll();
  showToast('🎁 SAMPLE DATA LOADED — EXPLORE AWAY!');
}

/* reflect the chosen currency everywhere: the symbol prefixes on inputs and the
   amount placeholder. Number rendering itself flows through fmt()/kfmt(). */
function applyCurrency() {
  const c = cur();
  document.querySelectorAll('.dollar, .dollar2').forEach((el) => { el.textContent = c.symbol; });
  if (els.amount) els.amount.placeholder = c.frac ? '0.00' : '0';
  if (els.currencySelect) els.currencySelect.value = state.currency;
}
function fillCurrencySelect() {
  if (!els.currencySelect) return;
  els.currencySelect.innerHTML = Object.entries(CURRENCIES)
    .map(([code, c]) => `<option value="${code}">${c.symbol} ${code} · ${c.name}</option>`).join('');
  els.currencySelect.value = state.currency;
}

function renderAll(prevLevel) {
  renderStats(prevLevel);
  renderPlayerTag();
  renderGuild();
  renderPlayerFilter();
  renderList();
  renderCats();
  renderBudget();
  renderGoal();
  renderMiniBosses();
  renderStreak();
  renderChart();
  renderQuests();
  renderBounties();
  renderOracle();
  renderThemes();
  renderChest();
  renderRecurring();
  renderZone();
  renderWeather();
}

/* ============================================================
   CATEGORY DROPDOWN
============================================================ */
function fillCategories() {
  els.category.innerHTML = '';
  CATEGORIES[currentType].forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.icon + '  ' + c.name;
    els.category.appendChild(opt);
  });
}

/* ============================================================
   ACTIONS
============================================================ */
function setType(type) {
  currentType = type;
  els.btnExpense.classList.toggle('active', type === 'expense');
  els.btnIncome.classList.toggle('active', type === 'income');
  els.submit.textContent = type === 'income' ? '⮞ COLLECT GOLD' : '⮞ ADD ENTRY';
  fillCategories();
  sfx.click();
}

function submitLabel() { return currentType === 'income' ? '⮞ COLLECT GOLD' : '⮞ ADD ENTRY'; }

/* ---- custom date picker ---- */
let pickerDate = Date.now();          // the date chosen for the form
let calView = { y: 0, m: 0 };         // month currently shown in the popup
function fmtDateLabel(ts) {
  return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
}
function setPickerDate(ts) { pickerDate = ts; els.dateLabel.textContent = fmtDateLabel(ts); }
function setDateToday() { setPickerDate(Date.now()); }
function renderCal() {
  els.calTitle.textContent = MONTHS[calView.m] + ' ' + calView.y;
  const daysIn = new Date(calView.y, calView.m + 1, 0).getDate();
  const firstDow = new Date(calView.y, calView.m, 1).getDay();
  const sel = new Date(pickerDate), now = new Date();
  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<span class="cal-cell blank"></span>';
  for (let d = 1; d <= daysIn; d++) {
    const isSel = sel.getFullYear() === calView.y && sel.getMonth() === calView.m && sel.getDate() === d;
    const isToday = now.getFullYear() === calView.y && now.getMonth() === calView.m && now.getDate() === d;
    html += `<button type="button" class="cal-cell${isSel ? ' sel' : ''}${isToday ? ' today' : ''}" data-d="${d}">${d}</button>`;
  }
  els.calGrid.innerHTML = html;
}
function openCal() {
  const d = new Date(pickerDate);
  calView = { y: d.getFullYear(), m: d.getMonth() };
  renderCal();
  els.calOverlay.hidden = false;
  sfx.click();
}
function shiftCal(delta) {
  calView.m += delta;
  if (calView.m < 0) { calView.m = 11; calView.y -= 1; }
  else if (calView.m > 11) { calView.m = 0; calView.y += 1; }
  renderCal();
}

function startEdit(id) {
  const tx = state.transactions.find((t) => t.id === Number(id));
  if (!tx) return;
  editingId = tx.id;
  setType(tx.type);
  els.desc.value = tx.desc;
  els.amount.value = tx.amount;
  els.category.value = tx.category;
  setPickerDate(txDate(tx));
  els.submit.textContent = '✓ SAVE EDIT';
  els.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  els.desc.focus();
}

function addTx(e) {
  e.preventDefault();
  const desc = els.desc.value.trim();
  const amount = parseFloat(els.amount.value);
  if (!desc || !(amount > 0)) { sfx.error(); shake(els.form); return; }

  // edit mode: update the existing entry and exit
  if (editingId != null) {
    const tx = state.transactions.find((t) => t.id === editingId);
    if (tx) { tx.type = currentType; tx.desc = desc; tx.amount = amount; tx.category = els.category.value; tx.date = pickerDate; }
    editingId = null;
    save(); sfx.click();
    renderAll();
    els.form.reset(); setDateToday();
    els.submit.textContent = submitLabel();
    showToast('✓ ENTRY UPDATED');
    return;
  }

  const prevLevel = levelFor(totals().income);

  const category = els.category.value;
  const owner = activePlayer();
  state.transactions.push({
    id: newId(),
    date: pickerDate,
    type: currentType,
    desc,
    amount,
    category,
    owner,
  });

  // "repeat" set → also create an auto-pilot rule, due one period from this entry
  const rep = els.repeatInput ? els.repeatInput.value : 'off';
  if (rep === 'weekly' || rep === 'monthly') {
    state.recurring.push({
      id: newId(), type: currentType, desc, amount, category, owner,
      freq: rep, nextDue: addPeriod(pickerDate, rep), lastRun: pickerDate,
    });
    showToast('🔁 REPEAT SET: ' + freqLabel(rep) + ' "' + desc + '"');
  }
  if (els.repeatInput) els.repeatInput.value = 'off';
  save();

  currentType === 'income' ? sfx.coin() : sfx.spend();
  renderAll(prevLevel);
  if (currentType === 'income') flyCoinsTo(els.balanceCard); // coins fly into the balance
  if (currentType === 'expense') hitBoss(amount); // boss takes a hit
  bumpCombo();       // rapid-logging combo multiplier
  maybeEncounter();  // a chance at a random RPG event

  els.form.reset();
  setDateToday();
  els.desc.focus();
}

function deleteTx(id) {
  state.transactions = state.transactions.filter((t) => t.id !== Number(id));
  save();
  sfx.delete();
  renderAll();
}

/* ---- starting balance editor ---- */
function toggleStartEditor() {
  const open = els.startEditor.classList.toggle('hidden') === false;
  if (open) { els.startInput.value = state.openingBalance || ''; els.startInput.focus(); }
  sfx.click();
}
function saveStart() {
  const v = parseFloat(els.startInput.value);
  if (Number.isNaN(v)) { sfx.error(); shake(els.startEditor); return; }
  state.openingBalance = v;
  save(); sfx.coin();
  els.startEditor.classList.add('hidden');
  showToast('★ STARTING BALANCE SET: ' + fmt(v));
  renderAll();
}

/* ---- budget boss editor ---- */
function toggleBudgetEditor() {
  const open = els.budgetEditor.classList.toggle('hidden') === false;
  if (open) { els.budgetInput.value = state.budget || ''; els.budgetInput.focus(); }
  sfx.click();
}
function saveBudget() {
  const v = parseFloat(els.budgetInput.value);
  if (!(v > 0)) { sfx.error(); shake(els.budgetEditor); return; }
  state.budget = v;
  state.budgetBreached = false; // re-arm warning for the new limit
  save(); sfx.coin();
  els.budgetEditor.classList.add('hidden');
  showToast('⚔️ BOSS SPAWNED: ' + fmt(v) + ' / MONTH');
  renderAll();
}
function clearBudget() {
  state.budget = 0; state.budgetBreached = false;
  save(); sfx.delete();
  els.budgetEditor.classList.add('hidden');
  renderAll();
}

/* ---- savings quest editor ---- */
function toggleGoalEditor() {
  const open = els.goalEditor.classList.toggle('hidden') === false;
  if (open) {
    els.goalNameInput.value = state.goal ? state.goal.name : '';
    els.goalTargetInput.value = state.goal ? state.goal.target : '';
    els.goalNameInput.focus();
  }
  sfx.click();
}
function saveGoal() {
  const name = els.goalNameInput.value.trim() || 'SAVINGS QUEST';
  const target = parseFloat(els.goalTargetInput.value);
  if (!(target > 0)) { sfx.error(); shake(els.goalEditor); return; }
  state.goal = { name, target };
  state.goalCelebrated = false; // re-arm victory for the new goal
  save(); sfx.coin();
  els.goalEditor.classList.add('hidden');
  showToast('🗺️ NEW QUEST: SAVE ' + fmt(target));
  renderAll();
}
function clearGoal() {
  state.goal = null; state.goalCelebrated = false;
  save(); sfx.delete();
  els.goalEditor.classList.add('hidden');
  renderAll();
}

/* ---- category mini-boss budgets ---- */
function fillCatBudgetSelect() {
  els.catBudgetSelect.innerHTML = '';
  CATEGORIES.expense.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.icon + '  ' + c.name;
    els.catBudgetSelect.appendChild(opt);
  });
}
function saveCatBudget() {
  const id = els.catBudgetSelect.value;
  const v = parseFloat(els.catBudgetInput.value);
  if (!(v > 0)) { sfx.error(); shake(els.catBudgetSave.parentElement); return; }
  state.catBudgets[id] = v;
  save(); sfx.coin();
  els.catBudgetInput.value = '';
  const c = catInfo('expense', id);
  showToast('👾 MINI-BOSS SET: ' + c.name + ' ' + fmt(v));
  renderAll();
}
function removeCatBudget(id) {
  delete state.catBudgets[id];
  save(); sfx.delete();
  renderAll();
}

/* ---- PDF export (print-to-PDF of a clean report) ---- */
function buildReport() {
  const { income, expense, balance } = totals();
  const now = new Date();
  const dateStr = now.toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const sign = (n) => (n >= 0 ? 'pr-pos' : 'pr-neg');

  // summary
  let html = `<div class="pr-doc">
    <div class="pr-head">
      <div class="pr-title">OCTROVEBOX</div>
      <div class="pr-sub">Financial Report</div>
      <div class="pr-date">Generated ${dateStr}</div>
    </div>

    <div class="pr-section">
      <div class="pr-h2">SUMMARY</div>
      <div class="pr-line"><span class="k">Balance</span><span class="v pr-big ${sign(balance)}">${fmt(balance)}</span></div>
      <div class="pr-grid">
        <div class="pr-line"><span class="k">Total Income</span><span class="v pr-pos">${fmt(income)}</span></div>
        <div class="pr-line"><span class="k">Total Spent</span><span class="v pr-neg">${fmt(expense)}</span></div>
        <div class="pr-line"><span class="k">Level</span><span class="v">LV.${levelFor(income)}</span></div>
        <div class="pr-line"><span class="k">Budget Streak</span><span class="v">${state.budget ? streakMonths() + ' months' : '—'}</span></div>
      </div>
    </div>`;

  // budget (current month)
  if (state.budget) {
    const spent = monthSpend();
    const remaining = state.budget - spent;
    html += `<div class="pr-section">
      <div class="pr-h2">BUDGET · ${MONTHS[now.getMonth()]} ${now.getFullYear()}</div>
      <div class="pr-grid">
        <div class="pr-line"><span class="k">Monthly Limit</span><span class="v">${fmt(state.budget)}</span></div>
        <div class="pr-line"><span class="k">Spent</span><span class="v">${fmt(spent)}</span></div>
        <div class="pr-line"><span class="k">Remaining</span><span class="v ${sign(remaining)}">${fmt(remaining)}</span></div>
        <div class="pr-line"><span class="k">Status</span><span class="v">${remaining < 0 ? 'OVER BUDGET' : 'ON TRACK'}</span></div>
      </div>
    </div>`;
  }

  // savings quest
  if (state.goal) {
    const saved = Math.max(0, balance);
    const pct = Math.min(100, Math.floor((saved / state.goal.target) * 100));
    html += `<div class="pr-section">
      <div class="pr-h2">SAVINGS QUEST</div>
      <div class="pr-grid">
        <div class="pr-line"><span class="k">Goal</span><span class="v">${escapeHtml(state.goal.name)}</span></div>
        <div class="pr-line"><span class="k">Target</span><span class="v">${fmt(state.goal.target)}</span></div>
        <div class="pr-line"><span class="k">Saved</span><span class="v">${fmt(saved)}</span></div>
        <div class="pr-line"><span class="k">Progress</span><span class="v">${pct}%${saved >= state.goal.target ? ' · COMPLETE' : ''}</span></div>
      </div>
    </div>`;
  }

  // spending by category (all-time)
  const spend = {};
  state.transactions.forEach((t) => { if (t.type === 'expense') spend[t.category] = (spend[t.category] || 0) + t.amount; });
  const cats = Object.entries(spend).sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    html += `<div class="pr-section"><div class="pr-h2">SPENDING BY CATEGORY</div>
      <table class="pr-table"><thead><tr><th>Category</th><th class="num">Amount</th><th class="num">Share</th></tr></thead><tbody>`;
    cats.forEach(([id, amt]) => {
      html += `<tr><td>${catInfo('expense', id).name}</td><td class="num">${fmt(amt)}</td><td class="num">${Math.round((amt / expense) * 100)}%</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // transactions
  html += `<div class="pr-section"><div class="pr-h2">TRANSACTIONS (${state.transactions.length})</div>`;
  if (state.transactions.length) {
    html += `<table class="pr-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th></tr></thead><tbody>`;
    state.transactions.slice().sort((a, b) => txDate(b) - txDate(a)).forEach((t) => {
      const d = new Date(txDate(t)).toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' });
      const c = catInfo(t.type, t.category);
      const amt = (t.type === 'income' ? '+' : '-') + fmt(t.amount).replace('-', '');
      html += `<tr><td>${d}</td><td>${escapeHtml(t.desc)}</td><td>${c.name}</td><td class="num ${t.type === 'income' ? 'pr-pos' : 'pr-neg'}">${amt}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<p>No transactions recorded.</p>`;
  }
  html += `</div>`;

  html += `<div class="pr-foot">Generated by OCTROVEBOX · 8-bit personal finance tracker</div></div>`;
  return html;
}

/* ---- backup (export JSON) & restore (import JSON) ---- */
function exportBackup() {
  sfx.click();
  state.lastBackup = Date.now(); state.schema = SCHEMA; save();
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'octrovebox-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('💾 BACKUP SAVED — KEEP IT SAFE!');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) { sfx.error(); showToast('⚠ INVALID BACKUP FILE'); return; }
    if (!data || !Array.isArray(data.transactions)) {
      sfx.error(); showToast('⚠ NOT AN OCTROVEBOX BACKUP'); return;
    }
    if (Number(data.schema) > SCHEMA && !confirm('This backup is from a NEWER version of Octrovebox.\nSome data may not load correctly. Restore anyway?')) return;
    if (!confirm('RESTORE THIS BACKUP?\nIt will REPLACE your current data.')) return;
    state.transactions = data.transactions;
    state.openingBalance = Number(data.openingBalance) || 0;
    state.budget = Number(data.budget) || 0;
    state.goal = (data.goal && data.goal.target)
      ? { name: String(data.goal.name || 'SAVINGS QUEST'), target: Number(data.goal.target) }
      : null;
    state.catBudgets = (data.catBudgets && typeof data.catBudgets === 'object') ? data.catBudgets : {};
    state.questsDone = Array.isArray(data.questsDone) ? data.questsDone : [];
    state.theme = data.theme || 'default';
    state.themesSeen = Array.isArray(data.themesSeen) ? data.themesSeen : [];
    state.lastChest = data.lastChest || null;
    state.chestStreak = Number(data.chestStreak) || 0;
    state.rainbow = !!data.rainbow;
    applyTheme(state.theme);
    document.body.classList.toggle('rainbow', state.rainbow);
    state.soundOn = data.soundOn !== false;
    state.musicOn = !!data.musicOn;
    state.musicTrack = Number(data.musicTrack) || 0;
    setMusicLabel();
    if (state.musicOn) startMusic(); else stopMusic();
    state.budgetBreached = !!data.budgetBreached;
    state.goalCelebrated = !!data.goalCelebrated;
    state.bounties = (data.bounties && typeof data.bounties === 'object') ? data.bounties : null;
    state.bountyStreak = Number(data.bountyStreak) || 0;
    state.bountyClaimed = data.bountyClaimed || '';
    state.currency = (data.currency && CURRENCIES[data.currency]) ? data.currency : 'IDR';
    state.recurring = Array.isArray(data.recurring) ? data.recurring : [];
    state.lastBackup = Number(data.lastBackup) || 0;
    state.schema = Number(data.schema) || 1;
    state.onboarded = true; // an imported save means an existing player — skip the tour
    state.effects = ['auto', 'on', 'off'].includes(data.effects) ? data.effects : 'auto';
    // THE GUILD — restore co-op roster (owners travel inside each transaction)
    state.guild = (data.guild && typeof data.guild === 'object') ? data.guild : { on: false, active: 'p1', names: {} };
    // NOTE: pinHash is intentionally NOT imported, so a backup never locks this device
    migrate();   // normalise guild + stamp any owner-less entries from older saves
    setGuildLabel();
    if (els.guildSetup) els.guildSetup.hidden = !guildOn();
    if (els.guildP1) els.guildP1.value = playerName('p1');
    if (els.guildP2) els.guildP2.value = playerName('p2');
    save();
    sfx.coin();
    showToast('📂 BACKUP RESTORED! ' + state.transactions.length + ' ENTRIES');
    els.mute.textContent = '♪ SOUND: ' + (state.soundOn ? 'ON' : 'OFF');
    applyCurrency();
    renderAll();
  };
  reader.onerror = () => { sfx.error(); showToast('⚠ COULD NOT READ FILE'); };
  reader.readAsText(file);
}

/* ---- monthly recap card ---- */
function openRecap() {
  sfx.click();
  const now = new Date();
  const { income, expense } = monthTotals(now.getFullYear(), now.getMonth());
  const net = income - expense;
  const rate = income > 0 ? Math.round((net / income) * 100) : 0;

  let grade = 'C';
  if (income === 0 && expense === 0) grade = '—';
  else if (rate >= 40) grade = 'S';
  else if (rate >= 25) grade = 'A';
  else if (rate >= 10) grade = 'B';
  else if (rate >= 0) grade = 'C';
  else grade = 'D';

  // top spending category this month
  const spend = {};
  state.transactions.forEach((t) => {
    const d = new Date(txDate(t));
    if (t.type === 'expense' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      spend[t.category] = (spend[t.category] || 0) + t.amount;
    }
  });
  const top = Object.entries(spend).sort((a, b) => b[1] - a[1])[0];
  const budgetResult = state.budget ? ((state.budget - expense) >= 0 ? 'UNDER ✓' : 'OVER ✗') : '—';

  els.recapMonth.textContent = MONTHS[now.getMonth()] + ' ' + now.getFullYear();
  els.recapGrade.textContent = grade;
  els.recapGrade.className = 'recap-grade g-' + grade.toLowerCase();
  const rows = [
    ['▲ EARNED', fmt(income)],
    ['▼ SPENT', fmt(expense)],
    ['★ SAVED', fmt(net)],
    ['SAVINGS RATE', rate + '%'],
    ['BUDGET BOSS', budgetResult],
    ['TOP SPEND', top ? catInfo('expense', top[0]).name + ' (' + fmt(top[1]) + ')' : '—'],
    ['LEVEL', 'LV.' + levelFor(totals().income)],
  ];
  els.recapRows.innerHTML = rows.map((r) => `<div class="recap-row"><span>${r[0]}</span><span>${r[1]}</span></div>`).join('');
  els.recapOverlay.hidden = false;
  if (grade === 'S' || grade === 'A') { sfx.victory(); coinRain(28); }
}
function closeRecap() { els.recapOverlay.hidden = true; }

function exportPDF() {
  sfx.click();
  // Build synchronously and call print() directly inside the tap handler —
  // mobile browsers block print() if it is deferred out of the user gesture.
  els.printReport.innerHTML = buildReport();
  window.print();
}

function resetAll() {
  if (!confirm('ERASE YOUR ENTIRE SAVE FILE?\nThis cannot be undone.')) return;
  state.transactions = [];
  save();
  sfx.delete();
  showToast('SAVE FILE ERASED. FRESH START!');
  renderAll();
}

/* ============================================================
   UI FX
============================================================ */
let toastTimer;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}
function shake(el) {
  el.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
     { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
    { duration: 250 }
  );
}
// flash the Budget Boss + float a damage number when an expense lands
function hitBoss(amount) {
  if (!state.budget) return;
  els.bossPanel.classList.remove('hit');
  void els.bossPanel.offsetWidth;
  els.bossPanel.classList.add('hit');
  const pop = document.createElement('span');
  pop.className = 'dmg-pop';
  pop.textContent = '-' + fmt(amount);
  els.bossPanel.appendChild(pop);
  setTimeout(() => pop.remove(), 900);
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ============================================================
   PIN LOCK — a fully-offline privacy gate. We store only a salted
   hash of the 4-digit PIN (never the PIN itself). This blocks the
   UI; it is NOT encryption (localStorage stays plaintext).
============================================================ */
const PIN_LEN = 4;
const AUTO_LOCK_MS = 90000;             // re-lock after this long in the background
const lock = { mode: 'unlock', buf: '', first: '', hiddenAt: 0, onSet: null };
// lightweight salted hash (cyrb53) — privacy gate only, not cryptographic security
function pinHashOf(pin) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const s = 'octrovebox:' + pin;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
function renderLockDots() {
  [...els.lockDots.children].forEach((d, i) => d.classList.toggle('on', i < lock.buf.length));
}
function lockShake() {
  els.lockDots.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
    { duration: 260 }
  );
}
// open the overlay. mode 'unlock' (startup/resume) or 'set' (from Options).
function showLock(mode, onSet) {
  lock.mode = mode; lock.buf = ''; lock.first = ''; lock.onSet = onSet || null;
  els.lockSub.textContent = mode === 'set' ? 'SET A 4-DIGIT PIN' : 'ENTER PIN';
  els.lockForgot.hidden = mode !== 'unlock';
  els.lockCancel.style.visibility = mode === 'set' ? 'visible' : 'hidden';
  els.lockOverlay.hidden = false;
  renderLockDots();
}
function hideLock() { els.lockOverlay.hidden = true; lock.buf = ''; lock.first = ''; }
// true while the PIN overlay is up — used to keep music silent so the keypad
// clicks aren't drowned out behind the lock screen
function lockOpen() { return !!(els.lockOverlay && !els.lockOverlay.hidden); }
// verify an entered PIN. In encrypted mode, success == the blob decrypts; in the
// legacy hash-only mode (or no WebCrypto), success == the salted hash matches.
async function attemptUnlock(pin) {
  if (encryptedWrapper) {
    try {
      const salt = unb64(encryptedWrapper.salt);
      const key = await deriveKey(pin, salt);
      const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(encryptedWrapper.iv) }, key, unb64(encryptedWrapper.ct));
      state = { ...state, ...JSON.parse(new TextDecoder().decode(ptBuf)) };
      cryptoKey = key; cryptoSalt = salt; encryptedWrapper = null;
      return true;
    } catch (e) { return false; }
  }
  // legacy hash-gate (plaintext save): verify the PIN…
  if (pinHashOf(pin) !== state.pinHash) return false;
  // …then transparently UPGRADE to real encryption so the data is no longer
  // stored in plain text and "Forgot PIN" becomes genuinely unrecoverable.
  if (CRYPTO_OK && !cryptoKey) {
    try {
      cryptoSalt = crypto.getRandomValues(new Uint8Array(16));
      cryptoKey = await deriveKey(pin, cryptoSalt);
      save();   // rewrites the save ENCRYPTED from now on
    } catch (e) { /* fall back to the hash gate if crypto is unavailable */ }
  }
  return true;
}
// turn the lock on: derive a key (so the next save() encrypts) and store a marker hash
async function enablePin(pin) {
  state.pinHash = pinHashOf(pin);          // marker + fast in-session re-lock check
  if (CRYPTO_OK) {
    cryptoSalt = crypto.getRandomValues(new Uint8Array(16));
    cryptoKey = await deriveKey(pin, cryptoSalt);
  }
  save();                                   // encrypts now if a key was derived
  sfx.victory(); hideLock(); renderPinButtons();
  showToast(CRYPTO_OK ? '🔒 PIN LOCK ON — DATA ENCRYPTED' : '🔒 PIN LOCK ON');
  if (lock.onSet) lock.onSet();
}
// turn the lock off: drop the key so the next save() writes plain text
function disablePin() {
  state.pinHash = null; cryptoKey = null; cryptoSalt = null;
  save(); renderPinButtons();
}
function lockKey(k) {
  if (k === 'cancel') { if (lock.mode === 'set') { hideLock(); sfx.click(); } return; }
  if (k === 'del') { lock.buf = lock.buf.slice(0, -1); renderLockDots(); return; }
  if (lock.buf.length >= PIN_LEN) return;
  if (state.soundOn) { try { beep([880], 0.03, 'square', 0.03); } catch (e) {} }
  lock.buf += k;
  renderLockDots();
  if (lock.buf.length < PIN_LEN) return;
  // a full PIN was entered — act on it
  setTimeout(() => {
    if (lock.mode === 'unlock') {
      attemptUnlock(lock.buf).then((ok) => {
        if (ok) {
          sfx.click(); hideLock();
          if (!appReady) {                  // first unlock after an encrypted boot
            finishBoot();
            setMusicLabel();
          }
          // resume music only now that the lock is gone (kept silent behind it)
          if (state.musicOn) { try { startMusic(); } catch (e) {} }
        } else {
          lockShake(); sfx.error(); els.lockSub.textContent = 'WRONG PIN — TRY AGAIN';
          lock.buf = ''; renderLockDots();
        }
      });
    } else if (lock.mode === 'set') {
      lock.first = lock.buf; lock.buf = ''; lock.mode = 'confirm';
      els.lockSub.textContent = 'CONFIRM PIN'; renderLockDots();
    } else { // confirm
      if (lock.buf === lock.first) {
        enablePin(lock.first);
      } else {
        lockShake(); sfx.error(); lock.mode = 'set'; lock.first = ''; lock.buf = '';
        els.lockSub.textContent = "PINS DIDN'T MATCH — SET PIN"; renderLockDots();
      }
    }
  }, 90);
}
// reflect the current lock state in the Options buttons
function renderPinButtons() {
  els.pinSetBtn.textContent = state.pinHash ? '🔒 CHANGE PIN' : '🔒 SET PIN LOCK';
  els.pinOffBtn.hidden = !state.pinHash;
}

/* ============================================================
   WIRING
============================================================ */
els.form.addEventListener('submit', addTx);
els.btnExpense.addEventListener('click', () => setType('expense'));
els.btnIncome.addEventListener('click', () => setType('income'));
els.reset.addEventListener('click', resetAll);
els.exportBtn.addEventListener('click', exportPDF);
els.backupBtn.addEventListener('click', exportBackup);
els.recapBtn.addEventListener('click', openRecap);
els.recapClose.addEventListener('click', closeRecap);
els.recapOverlay.addEventListener('click', (e) => { if (e.target === els.recapOverlay) closeRecap(); });
els.oracleStage.addEventListener('click', oracleTap);
els.questToggle.addEventListener('click', toggleQuestBoard);
if (els.guildToggle) els.guildToggle.addEventListener('click', toggleGuild);
els.deedsToggle.addEventListener('click', toggleDeeds);
els.vaultToggle.addEventListener('click', toggleVault);
els.optToggle.addEventListener('click', () => {
  const opening = els.optScroll.hidden;
  els.optScroll.hidden = !opening;
  els.optToggle.classList.toggle('open', opening);
  if (opening) beep([392, 523], 0.05, 'square', 0.04); else sfx.click();
});
els.chestBtn.addEventListener('click', openChest);

// PIN lock wiring
els.lockPad.addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) lockKey(b.dataset.k); });
els.lockForgot.addEventListener('click', () => {
  // A real lock can't be skipped: the only way past a forgotten PIN is to wipe.
  // (If you kept a backup file, you can restore it after starting fresh.)
  if (confirm('Forgot your PIN?\n\nYour save is locked for your privacy and CANNOT be opened without it.\nThe only option is to ERASE this save and start fresh.\n\nErase now?')) {
    localStorage.removeItem(STORE_KEY);
    location.reload();
  }
});
els.pinSetBtn.addEventListener('click', () => showLock('set'));
els.pinOffBtn.addEventListener('click', () => {
  if (state.pinHash && confirm('Turn off the PIN lock?' + (CRYPTO_OK ? '\nYour data will be decrypted and stored as plain text.' : ''))) {
    disablePin(); sfx.click(); showToast('🔓 PIN LOCK OFF');
  }
});

// currency picker — re-render everything so all figures pick up the new format
if (els.currencySelect) els.currencySelect.addEventListener('change', () => {
  if (!CURRENCIES[els.currencySelect.value]) return;
  state.currency = els.currencySelect.value;
  save(); sfx.coin();
  applyCurrency();
  renderAll();
  showToast('💱 CURRENCY: ' + state.currency + ' ' + cur().symbol);
});

// ambient effects override (auto → on → off)
if (els.fxBtn) els.fxBtn.addEventListener('click', () => {
  const order = ['auto', 'on', 'off'];
  state.effects = order[(order.indexOf(state.effects || 'auto') + 1) % order.length];
  save(); sfx.click(); setFxLabel();
  showToast('✨ EFFECTS: ' + state.effects.toUpperCase() + (state.effects === 'auto' ? ' (FOLLOW SYSTEM)' : ''));
});

/* ---- THE GUILD (2-player co-op) controls ---- */
// tap the HUD player tag to swap who's logging
if (els.playerTag) els.playerTag.addEventListener('click', () => {
  if (!guildOn()) return;
  state.guild.active = activePlayer() === 'p1' ? 'p2' : 'p1';
  save(); sfx.click();
  renderPlayerTag(); renderGuild();
  showToast('🎮 NOW LOGGING AS ' + playerName(activePlayer()));
});
// enable/disable Guild mode from Options
if (els.guildBtn) els.guildBtn.addEventListener('click', () => {
  state.guild.on = !guildOn();
  save(); sfx.click(); setGuildLabel();
  if (els.guildSetup) els.guildSetup.hidden = !guildOn();
  if (guildOn()) {
    if (els.guildP1) els.guildP1.value = playerName('p1');
    if (els.guildP2) els.guildP2.value = playerName('p2');
  } else { playerFilterVal = 'all'; }
  renderAll();
  showToast(guildOn() ? '👥 GUILD FORMED — TWO PLAYERS!' : '👤 BACK TO SOLO PLAY');
});
// save the two player names
if (els.guildSave) els.guildSave.addEventListener('click', () => {
  const n1 = (els.guildP1.value || '').trim().slice(0, 14);
  const n2 = (els.guildP2.value || '').trim().slice(0, 14);
  state.guild.names.p1 = n1 || 'PLAYER 1';
  state.guild.names.p2 = n2 || 'PLAYER 2';
  save(); sfx.coin();
  renderAll();
  showToast('✓ GUILD ROSTER SAVED');
});
// quest-log player filter chips
if (els.guildFilters) els.guildFilters.addEventListener('click', (e) => {
  const btn = e.target.closest('.gfilter-btn');
  if (!btn) return;
  playerFilterVal = btn.dataset.player;
  sfx.click();
  renderPlayerFilter(); renderList();
});

// auto-pilot (recurring) — collapse/expand the rules list
if (els.recurHead) els.recurHead.addEventListener('click', () => {
  const opening = els.recurList.hidden;
  els.recurList.hidden = !opening;
  els.recurInline.classList.toggle('collapsed', !opening);
  if (opening) beep([330, 440, 587], 0.06, 'square', 0.04); else sfx.click();
});
// stop a rule from the inline list in the New Entry panel
if (els.recurList) els.recurList.addEventListener('click', (e) => {
  const btn = e.target.closest('.rc-del');
  if (btn) removeRecurring(btn.dataset.id);
});

// onboarding tour
if (els.obNext) els.obNext.addEventListener('click', () => {
  if (obIdx >= OB_STEPS.length - 1) { finishOnboard(false); return; }
  obIdx += 1; renderOnboard(); sfx.click();
});
if (els.obBack) els.obBack.addEventListener('click', () => { if (obIdx > 0) { obIdx -= 1; renderOnboard(); sfx.click(); } });
if (els.obSkip) els.obSkip.addEventListener('click', () => finishOnboard(false));
if (els.obSample) els.obSample.addEventListener('click', () => finishOnboard(true));

/* ---- pokeable sprites: little reactive easter-eggs for extra game feel ---- */
function wiggle(el) {
  if (!el) return;
  el.animate(
    [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-12deg) scale(1.2)' },
     { transform: 'rotate(12deg) scale(1.2)' }, { transform: 'rotate(0) scale(1)' }],
    { duration: 360, easing: 'ease-in-out' }
  );
}
// poke the Budget Boss → it flinches and growls
els.bossSprite.addEventListener('click', () => {
  wiggle(els.bossSprite);
  if (state.budget) { sfx.roar(); } else { sfx.click(); }
  vibe(12);
});
// poke the Savings chest → a hopeful little jingle + sparkle
els.goalChest.addEventListener('click', () => {
  wiggle(els.goalChest);
  beep([784, 1047, 1319], 0.06, 'square', 0.05); vibe(10);
});
// poke the title mascot → friendly blip
const logoOcto = document.getElementById('logoOcto');
if (logoOcto) logoOcto.addEventListener('click', () => { wiggle(logoOcto); sfx.coin(); });

// Konami code (keyboard) → rainbow cheat
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
let kbuf = [];
window.addEventListener('keydown', (e) => {
  kbuf.push(e.key.toLowerCase());
  if (kbuf.length > KONAMI.length) kbuf.shift();
  if (KONAMI.length === kbuf.length && KONAMI.every((k, i) => kbuf[i] === k)) { kbuf = []; activateCheat(); }
});
// mobile secret: tap the title 8 times quickly
let titleTaps = 0, titleTimer;
const h1 = document.querySelector('h1');
if (h1) h1.addEventListener('click', () => {
  titleTaps += 1;
  clearTimeout(titleTimer);
  titleTimer = setTimeout(() => { titleTaps = 0; }, 1500);
  if (titleTaps >= 8) { titleTaps = 0; activateCheat(); }
});
els.restoreBtn.addEventListener('click', () => els.restoreInput.click());
els.restoreInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) importBackup(f);
  e.target.value = ''; // allow re-importing the same file
});

els.editStartBtn.addEventListener('click', toggleStartEditor);
els.startSave.addEventListener('click', saveStart);
els.startInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveStart(); });

// custom date picker
els.dateField.addEventListener('click', openCal);
els.calPrev.addEventListener('click', () => shiftCal(-1));
els.calNext.addEventListener('click', () => shiftCal(1));
els.calToday.addEventListener('click', () => { setPickerDate(Date.now()); sfx.click(); els.calOverlay.hidden = true; });
els.calGrid.addEventListener('click', (e) => {
  const cell = e.target.closest('.cal-cell[data-d]');
  if (!cell) return;
  setPickerDate(new Date(calView.y, calView.m, Number(cell.dataset.d), 12).getTime());
  sfx.click();
  els.calOverlay.hidden = true;
});
els.calOverlay.addEventListener('click', (e) => { if (e.target === els.calOverlay) els.calOverlay.hidden = true; });

els.editBudgetBtn.addEventListener('click', toggleBudgetEditor);
els.saveBudgetBtn.addEventListener('click', saveBudget);
els.clearBudgetBtn.addEventListener('click', clearBudget);
els.budgetInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBudget(); });

els.editGoalBtn.addEventListener('click', toggleGoalEditor);
els.saveGoalBtn.addEventListener('click', saveGoal);
els.clearGoalBtn.addEventListener('click', clearGoal);
els.goalTargetInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveGoal(); });

els.catBudgetSave.addEventListener('click', saveCatBudget);
els.catBudgetInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCatBudget(); });
els.mbossList.addEventListener('click', (e) => {
  const btn = e.target.closest('.mb-del');
  if (btn) removeCatBudget(btn.dataset.cat);
});

els.list.addEventListener('click', (e) => {
  const ed = e.target.closest('.tx-edit');
  if (ed) { startEdit(ed.dataset.id); return; }
  const del = e.target.closest('.tx-del');
  if (del) deleteTx(del.dataset.id);
});

els.filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  [...els.filters.children].forEach((b) => b.classList.toggle('active', b === btn));
  sfx.click();
  renderList();
});
els.catFilter.addEventListener('change', () => { catFilterVal = els.catFilter.value; sfx.click(); renderList(); });
els.monthFilter.addEventListener('change', () => { monthFilterVal = els.monthFilter.value; sfx.click(); renderList(); });

els.mute.addEventListener('click', () => {
  state.soundOn = !state.soundOn;
  els.mute.textContent = '♪ SOUND: ' + (state.soundOn ? 'ON' : 'OFF');
  save();
  if (state.soundOn) sfx.click();
});

/* ============================================================
   BOOT
============================================================ */
// everything that needs the real (decrypted) state — runs immediately for a
// plaintext save, or only after a correct PIN unlocks an encrypted one
function finishBoot() {
  migrate();   // normalise the guild + stamp legacy entries with an owner
  els.mute.textContent = '♪ SOUND: ' + (state.soundOn ? 'ON' : 'OFF');
  applyTheme(state.theme);
  applyCurrency();
  setFxLabel();
  setGuildLabel();
  if (els.guildSetup) els.guildSetup.hidden = !guildOn();
  if (els.guildP1) els.guildP1.value = playerName('p1');
  if (els.guildP2) els.guildP2.value = playerName('p2');
  document.body.classList.toggle('rainbow', !!state.rainbow);
  fillCategories();
  fillCatBudgetSelect();
  fillCatFilter();
  setDateToday();
  const added = runRecurring();          // auto-log any due recurring entries
  renderAll();
  if (added) showToast('🔁 ' + added + ' RECURRING ENTR' + (added > 1 ? 'IES' : 'Y') + ' LOGGED');
  appReady = true; // from now on, completing a side quest celebrates
  typeOracle();    // type out the first Oracle tip for that RPG-textbox feel
  maybeBackupReminder();
  maybeOnboard();
}
function init() {
  load();
  fillCurrencySelect();
  renderPinButtons();
  if (encryptedWrapper) {
    // the save is encrypted — gate first; finishBoot() runs after a correct PIN
    els.mute.textContent = '♪ SOUND: ' + (state.soundOn ? 'ON' : 'OFF');
    showLock('unlock');
    return;
  }
  finishBoot();
  if (state.pinHash) showLock('unlock'); // legacy hash-gate (plaintext save + PIN)
}
init();

/* ---- PWA: service worker + "update ready" banner ---- */
if ('serviceWorker' in navigator) {
  let userWantsUpdate = false;
  let reloading = false;

  // show the banner; `worker` is the installed-but-waiting service worker
  const showBanner = (worker) => {
    if (!worker || !navigator.serviceWorker.controller) return; // first install, not an update
    els.updateBar.hidden = false;
    els.updateBtn.onclick = () => {
      userWantsUpdate = true;
      els.updateBtn.textContent = '⟳ UPDATING…';
      worker.postMessage('SKIP_WAITING');
    };
  };

  // when the new SW takes control (after the user taps refresh), reload once
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (userWantsUpdate && !reloading) { reloading = true; window.location.reload(); }
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');

      // Case A: an update finished in a PREVIOUS session and is already waiting.
      // reg.waiting can be null right when register() resolves, so re-check a few times.
      const checkWaiting = () => { if (reg.waiting) { showBanner(reg.waiting); return true; } return false; };
      if (!checkWaiting()) [800, 2000, 4000].forEach((t) => setTimeout(checkWaiting, t));

      // Case B: an update installs while this page is open.
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed') showBanner(nw);  // use the worker directly (avoids reg.waiting race)
        });
      });

      // periodically look for a new deploy even without a reload
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch (e) { /* unsupported / file:// */ }
  });
}

/* ============================================================
   PWA INSTALL — capture the browser's install prompt and surface
   a tidy "INSTALL APP" button inside Options. Hidden when the app
   is already installed / running standalone (or the browser can't
   install it, e.g. iOS Safari, where we leave a hint instead).
============================================================ */
(function pwaInstall() {
  const btn = els.installBtn, done = els.installDone;
  if (!btn) return;

  // already running as an installed app?
  const standalone = () =>
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  let deferred = null;

  // chromium fires this when the app meets installability criteria
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // stop the mini-infobar; we drive it ourselves
    deferred = e;
    if (!standalone()) btn.hidden = false;
  });

  btn.addEventListener('click', async () => {
    if (!deferred) return;
    btn.disabled = true;
    deferred.prompt();
    try { await deferred.userChoice; } catch (_) {}
    deferred = null;
    btn.hidden = true;
    btn.disabled = false;
  });

  // fired after a successful install (button + browser UI)
  window.addEventListener('appinstalled', () => {
    deferred = null;
    btn.hidden = true;
    if (done) done.hidden = false;
    if (typeof showToast === 'function') showToast('📲 OCTROVEBOX INSTALLED!');
  });

  // iOS Safari has no beforeinstallprompt — show an Add-to-Home-Screen hint
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
  if (isIOS && !standalone() && done) {
    done.hidden = false;
    done.textContent = '📲 TO INSTALL: SHARE → ADD TO HOME SCREEN';
  } else if (standalone() && done) {
    done.hidden = false; // already installed
  }
})();

/* ---- launch shortcuts (manifest "shortcuts" deep-links) ---- */
(function handleLaunchShortcut() {
  let go;
  try { go = new URLSearchParams(location.search).get('go'); } catch (_) { return; }
  if (!go) return;
  // run after first paint so panels/handlers are wired
  window.addEventListener('load', () => setTimeout(() => {
    if (go === 'add') {
      const panel = document.querySelector('.form-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (els.desc) els.desc.focus({ preventScroll: true });
    } else if (go === 'quests') {
      if (els.questScroll && els.questScroll.hidden && els.questToggle) els.questToggle.click();
      const panel = document.querySelector('.quests-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (go === 'backup') {
      if (els.backupBtn) els.backupBtn.click();
    }
    // tidy the URL so a reload doesn't repeat the action
    if (history.replaceState) history.replaceState(null, '', location.pathname);
  }, 350));
})();

/* ============================================================
   AMBIENT EFFECTS GATE — the starfield, weather, and floats all
   consult this. 'auto' honours the system "reduce motion" setting;
   'on'/'off' (from Options) let the user override it either way.
============================================================ */
function prefersReduce() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
function fxAnimate() {
  const m = state.effects || 'auto';
  if (m === 'on') return true;
  if (m === 'off') return false;
  return !prefersReduce();
}
function setFxLabel() {
  if (els.fxBtn) els.fxBtn.textContent = '✨ EFFECTS: ' + (state.effects || 'auto').toUpperCase();
}

/* ============================================================
   LOW-END PERFORMANCE BUDGET — sniff weak hardware once, then let
   the canvas loops dial themselves down (fewer particles, capped
   frame rate, lighter pixel ratio) so cheap phones / old laptops
   stay smooth. Desktops with unknown specs stay full-power.
============================================================ */
const lowEnd = (() => {
  const mem = navigator.deviceMemory || 8;            // GiB, Chrome/Android only
  const cores = navigator.hardwareConcurrency || 8;
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  return mem <= 4 || cores <= 4 || (coarse && cores <= 6);
})();
// Build a frame gate: returns a fn(ts)->bool that is true only when enough
// time has passed to paint again. `lowFps` applies on weak devices, `hiFps`
// otherwise (0 = uncapped). Only use on loops whose motion is time-based (dt),
// never on frame-counter animations — capping those would slow them down.
function makeFrameGate(lowFps, hiFps) {
  const fps = lowEnd ? lowFps : hiFps;
  if (!fps) return () => true;
  const interval = 1000 / fps;
  let prev = -1e9;
  return (now) => (now - prev < interval ? false : (prev = now, true));
}

/* ============================================================
   THEMED AMBIENT FLOATS — particles that match the active zone:
   city rain, frozen-peak snow, undersea fish, and twinkling motes
   tinted to each other biome. Replaces the old roaming buddies.
============================================================ */
(function ambientFloats() {
  const cv = document.getElementById('ambient');
  if (!cv) return;
  const ctx = cv.getContext('2d');

  // zone -> particle mode (+ palette for motes / fish). NEON CITY (Classic skin)
  // gets a driving rainstorm as its signature ambient effect.
  const MODES = {
    city:     { kind: 'rain' },
    peak:     { kind: 'snow' },
    undersea: { kind: 'fish',  cols: ['#ff9f1c', '#2fd0c0', '#ff6bc4', '#ffd23f'] },
    meadow:   { kind: 'mote',  cols: ['#6cd957', '#a8e063', '#ffd23f'] },   // pollen / leaves
    cave:     { kind: 'mote',  cols: ['#b06bff', '#2fd0c0', '#ff6bc4'] },   // crystal sparks
    desert:   { kind: 'mote',  cols: ['#ffd23f', '#ffe08a', '#ffffff'] },   // fantasy fairy dust
    cosmos:   { kind: 'mote',  cols: ['#ffd23f', '#ffffff', '#b06bff'] },   // stardust
  };
  let w, h, mode = null, key = '', parts = [], flash = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // density scales with viewport AREA; phones get fewer (but bolder — see paint)
  // particles so the effect reads clearly without cluttering a small screen
  const dens = (div, min) => {
    let n = Math.max(min, Math.round((w * h) / div));
    if (w <= 600) n = Math.max(10, Math.round(n * 0.5));
    if (lowEnd) n = Math.max(8, Math.round(n * 0.55));   // thin out on weak hardware
    return n;
  };
  function build() {
    parts = [];
    if (!mode) return;
    const mob = w <= 600;
    if (mode.kind === 'rain') {                  // driving rainstorm (Classic / city)
      const n = dens(9000, 50);
      for (let i = 0; i < n; i++) parts.push({ x: Math.random() * w, y: Math.random() * h, len: rnd(14, 24), sp: rnd(8, 14) });
    } else if (mode.kind === 'snow') {
      const n = dens(14000, 38);
      for (let i = 0; i < n; i++) parts.push({ x: Math.random() * w, y: Math.random() * h, sz: rnd(mob ? 3 : 2, mob ? 6 : 4) | 0, sp: rnd(0.5, 1.6), ph: Math.random() * 6.28 });
    } else if (mode.kind === 'fish') {
      const n = mob ? 3 : Math.max(6, Math.round((w * h) / 80000));
      for (let i = 0; i < n; i++) { const dir = Math.random() < 0.5 ? 1 : -1; parts.push({ x: Math.random() * w, y: rnd(h * 0.2, h * 0.9), sp: dir * rnd(0.4, 1.1), sz: rnd(5, 9) | 0, col: pick(mode.cols), ph: Math.random() * 6.28 }); }
    } else { // mote
      const n = dens(26000, 24);
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; const s = rnd(0.15, 0.5); parts.push({ x: Math.random() * w, y: Math.random() * h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, sz: rnd(mob ? 3 : 2, mob ? 6 : 4) | 0, col: pick(mode.cols), tw: Math.random() * 6.28 }); }
    }
  }
  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    if (!W || !H) { setTimeout(resize, 250); return; }
    w = cv.width = W; h = cv.height = H; build();
  }
  function drawFish(p) {
    const d = p.sp > 0 ? 1 : -1, x = p.x | 0, y = p.y | 0, s = p.sz;
    ctx.fillStyle = p.col;
    ctx.fillRect(x, y, s * 2, s);                                   // body
    ctx.beginPath();                                               // tail
    if (d > 0) { ctx.moveTo(x, y + s / 2); ctx.lineTo(x - s, y); ctx.lineTo(x - s, y + s); }
    else { ctx.moveTo(x + s * 2, y + s / 2); ctx.lineTo(x + s * 2 + s, y); ctx.lineTo(x + s * 2 + s, y + s); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';                                     // eye
    ctx.fillRect(d > 0 ? x + s * 1.4 : x + s * 0.4, y + 1, 2, 2);
  }
  function paint() {
    if (cv.width !== window.innerWidth || cv.height !== window.innerHeight) resize();
    if (!fxAnimate()) { ctx.clearRect(0, 0, w, h); return; }   // effects off → nothing
    const z = document.documentElement.dataset.zone || '';
    if (z !== key) { key = z; mode = MODES[z] || null; build(); }
    ctx.clearRect(0, 0, w, h);
    if (!mode) return;
    if (mode.kind === 'rain') {                  // fast diagonal rain + occasional lightning
      const mob = w <= 600;
      ctx.strokeStyle = mob ? 'rgba(170,198,255,.6)' : 'rgba(150,185,255,.5)';
      ctx.lineWidth = 2; ctx.beginPath();
      for (const p of parts) { p.y += p.sp; p.x += p.sp * 0.28; if (p.y > h) { p.y = -p.len; p.x = Math.random() * w; } ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.sp * 0.5, p.y - p.len); }
      ctx.stroke();
      if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.12).toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); flash -= 0.05; }
      else if (Math.random() < 0.0025) flash = 1;
    } else if (mode.kind === 'snow') {
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.85;
      for (const p of parts) { p.ph += 0.02; p.y += p.sp; p.x += Math.sin(p.ph) * 0.4; if (p.y > h) { p.y = -4; p.x = Math.random() * w; } ctx.fillRect(p.x | 0, p.y | 0, p.sz, p.sz); }
      ctx.globalAlpha = 1;
    } else if (mode.kind === 'fish') {
      for (const p of parts) { p.ph += 0.03; p.x += p.sp; p.y += Math.sin(p.ph) * 0.3; if (p.sp > 0 && p.x > w + 24) p.x = -24; else if (p.sp < 0 && p.x < -24) p.x = w + 24; drawFish(p); }
    } else { // mote
      for (const p of parts) {
        p.tw += 0.04; p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;
        ctx.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(p.tw));
        ctx.fillStyle = p.col; ctx.fillRect(p.x | 0, p.y | 0, p.sz, p.sz);
      }
      ctx.globalAlpha = 1;
    }
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 300));
  (function loop() { paint(); requestAnimationFrame(loop); })();
})();

/* ============================================================
   CHIPTUNE BACKGROUND MUSIC (generated live, looping)
============================================================ */
const N2F = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> frequency
// jukebox: cycle OFF -> CALM -> COZY TOWN -> OFF with the MUSIC button
// One original chiptune theme PER unlockable skin, in the same order as THEMES.
// Each `skin` id ties a track to its palette so picking a skin auto-plays its song.
const TRACKS = [
  { // CLASSIC (default skin): heroic NES overworld march — C–G–Am–F oom-pah + bright square hero line
    name: 'CLASSIC', stepMs: 170, drone: false, skin: 'default',
    bass: [48, 55, 48, 55, 43, 50, 43, 50, 45, 52, 45, 52, 41, 48, 41, 48], bassType: 'triangle', bassDur: 0.14, bassVol: 0.05,
    lead: [72, 0, 72, 74, 76, 0, 79, 0, 77, 0, 76, 74, 72, 0, 67, 0], leadType: 'square', leadDur: 0.15, leadVol: 0.04,
    twinkle: [84, 88, 91],
  },
  { // GAME BOY skin: lo-fi monochrome handheld — thin pulse bass + bouncy A-minor-pentatonic blips, no pads
    name: 'GAME BOY', stepMs: 140, drone: false, skin: 'gameboy',
    bass: [45, 45, 52, 45, 41, 41, 48, 41, 43, 43, 50, 43, 40, 40, 47, 40], bassType: 'square', bassDur: 0.09, bassVol: 0.045,
    lead: [69, 72, 76, 72, 74, 72, 69, 0, 67, 69, 72, 69, 76, 74, 72, 0], leadType: 'square', leadDur: 0.1, leadVol: 0.038,
    twinkle: [81, 84],
  },
  { // SNES skin: lush 16-bit dream — sustained sine pads (F–Dm–Bb–C) under a flowing triangle melody
    name: 'SNES', stepMs: 230, drone: false, skin: 'snes',
    pad: [41, 0, 0, 0, 38, 0, 0, 0, 46, 0, 0, 0, 48, 0, 0, 0], padDur: 1.8,
    lead: [0, 0, 77, 81, 84, 0, 81, 77, 0, 0, 74, 77, 81, 0, 77, 74], leadType: 'triangle', leadDur: 0.5, leadVol: 0.038,
    twinkle: [89, 93, 96],
  },
  { // ARCADE skin: neon coin-op attract mode — fast descending-chromatic square pulse + flashy high riff
    name: 'ARCADE', stepMs: 130, drone: false, skin: 'arcade',
    bass: [45, 45, 45, 45, 44, 44, 44, 44, 43, 43, 43, 43, 42, 42, 42, 42], bassType: 'square', bassDur: 0.09, bassVol: 0.05,
    lead: [81, 0, 84, 81, 88, 0, 84, 81, 80, 0, 83, 80, 87, 0, 83, 80], leadType: 'square', leadDur: 0.1, leadVol: 0.04,
    twinkle: [93, 96], twinkleCluster: true,
  },
  { // FANTASY (mario skin): original bouncy storybook-platformer romp — C–Am–F–G oom-pah
    name: 'FANTASY', stepMs: 150, drone: false, skin: 'mario',
    bass: [48, 55, 48, 55, 45, 52, 45, 52, 41, 48, 41, 48, 43, 50, 43, 50], bassType: 'triangle', bassDur: 0.13, bassVol: 0.05,
    lead: [72, 76, 79, 0, 76, 72, 69, 0, 77, 81, 84, 0, 79, 74, 67, 0], leadType: 'square', leadDur: 0.12, leadVol: 0.04,
    twinkle: [88, 91, 96],
  },
  { // UNDERSEA skin: slow, mysterious deep-water theme — open-fifth sine pads + a sparse drifting lead with bubble twinkles
    name: 'UNDERSEA', stepMs: 185, drone: true, droneNote: 31, droneDur: 3.2, skin: 'undersea',
    pad: [43, 0, 0, 0, 41, 0, 0, 0, 46, 0, 0, 0, 38, 0, 0, 0], padChord: [0, 7, 12], padDur: 2.0,
    lead: [0, 0, 69, 72, 0, 74, 72, 69, 0, 0, 67, 69, 0, 72, 69, 67], leadType: 'sine', leadDur: 0.55, leadVol: 0.035,
    twinkle: [81, 84, 88, 91], twinkleCluster: true,
  },
  { // MIDAS skin: regal golden fanfare — major-triad pads (C–F–G–C) under a shimmering ascending hero line
    name: 'MIDAS', stepMs: 195, drone: false, skin: 'midas',
    pad: [48, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0, 48, 0, 0, 0], padChord: [0, 4, 7], padDur: 1.3,
    lead: [72, 76, 79, 84, 0, 83, 79, 76, 77, 81, 84, 89, 0, 84, 79, 84], leadType: 'square', leadDur: 0.2, leadVol: 0.045,
    twinkle: [91, 96, 98],
  },
];
const music = { timer: null, step: 0 };
function curTrack() { return TRACKS[state.musicTrack] || TRACKS[0]; }

function mNote(freq, dur, type, vol) {
  try {
    const ctx = getAudio();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.03);
  } catch (e) { /* audio unavailable */ }
}
function musicTick() {
  const tk = curTrack();
  const i = music.step % 16;
  if (tk.drone && i === 0) {                       // low sustained drone (optionally detuned)
    const dn = tk.droneNote || 36, dd = tk.droneDur || 2.6;
    mNote(N2F(dn), dd, 'sine', 0.03);
    if (tk.droneDetune) mNote(N2F(dn) * 1.005, dd, 'sine', 0.02);
  }
  if (tk.bass) {                                   // driving staccato bass
    const b = tk.bass[i];
    if (b) mNote(N2F(b), tk.bassDur || 0.12, tk.bassType || 'square', tk.bassVol || 0.045);
  }
  if (tk.pad) {                                    // sustained chord (intervals from padChord)
    const p = tk.pad[i];
    if (p) {
      const pd = tk.padDur || 1.9;
      const chord = tk.padChord || [0, 7, 12];
      const vols = [0.05, 0.03, 0.018];
      chord.forEach((off, idx) => mNote(N2F(p + off), pd, tk.padType || 'sine', vols[idx] != null ? vols[idx] : 0.018));
    }
  }
  if (tk.lead) {
    const m = tk.lead[i];
    if (m) mNote(N2F(m), tk.leadDur || 0.5, tk.leadType || 'triangle', tk.leadVol || 0.04);
  }
  if (tk.twinkle && Math.random() < 0.2) {
    const tw = tk.twinkle[Math.floor(Math.random() * tk.twinkle.length)];
    mNote(N2F(tw), 0.32, 'sine', 0.02);
    if (tk.twinkleCluster) mNote(N2F(tw + 1), 0.32, 'sine', 0.012); // dissonant minor-2nd shimmer
  }
  music.step += 1;
}
function startMusic() {
  if (music.timer) return;
  try { getAudio(); } catch (e) { return; }
  musicTick();
  music.timer = setInterval(musicTick, curTrack().stepMs);
}
function stopMusic() {
  if (music.timer) { clearInterval(music.timer); music.timer = null; }
}
function setMusicLabel() { els.music.textContent = state.musicOn ? ('♫ ' + curTrack().name) : '♫ MUSIC: OFF'; }
// a track is locked until its related skin is unlocked (CLASSIC/default is always free)
function trackUnlocked(tk) {
  if (!tk || !tk.skin || tk.skin === 'default') return true;
  const th = THEMES.find((t) => t.id === tk.skin);
  return th ? themeUnlocked(th) : true;
}
function cycleMusic() {
  if (!state.musicOn) {
    state.musicOn = true;
    state.musicTrack = 0; // CLASSIC (default skin) is always available
  } else {
    // advance to the next UNLOCKED track; wrap round to OFF past the last one
    let i = state.musicTrack;
    do { i += 1; } while (i < TRACKS.length && !trackUnlocked(TRACKS[i]));
    if (i >= TRACKS.length) { state.musicOn = false; state.musicTrack = 0; }
    else state.musicTrack = i;
  }
  save();
  setMusicLabel();
  stopMusic();
  if (state.musicOn) { music.step = 0; startMusic(); }
}
els.music.addEventListener('click', cycleMusic);
// if a saved track points at a now-locked skin (e.g. after a restore), fall back to CLASSIC
if (!trackUnlocked(curTrack())) state.musicTrack = 0;
setMusicLabel();

// stop the music loop when the app is hidden/backgrounded; resume if it was on
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopMusic();
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
    lock.hiddenAt = Date.now();
  } else {
    // re-lock if a PIN is set and we were away long enough
    if (state.pinHash && els.lockOverlay.hidden && lock.hiddenAt && Date.now() - lock.hiddenAt > AUTO_LOCK_MS) {
      showLock('unlock');
    }
    // stay silent if we came back to a (re)locked screen — resumes after unlock
    if (state.musicOn && !lockOpen()) {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      startMusic();
    }
  }
});
// browsers block audio until a gesture — if music was on last session, start on
// first interaction, but NOT while the PIN screen is up (taps there are for the
// keypad; we don't want music kicking in over the click sounds)
if (state.musicOn) {
  const kick = () => {
    if (lockOpen()) return;   // ignore PIN-pad taps; wait for a gesture after unlock
    startMusic();
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
  };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
}

/* ============================================================
   PARALLAX STARFIELD (behind everything)
============================================================ */
(function starfield() {
  const cv = document.getElementById('stars');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const COLORS = ['#ffffff', '#ffffff', '#ffd23f', '#4fa9ff', '#b06bff'];
  let w, h, stars, needPaint = true;
  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    if (!W || !H) { setTimeout(resize, 250); return; } // mobile viewport not ready yet — retry
    w = cv.width = W;
    h = cv.height = H;
    needPaint = true;
    let count = Math.max(28, Math.round((w * h) / 14000));
    if (lowEnd) count = Math.max(18, Math.round(count * 0.55));
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        s: Math.random() < 0.85 ? 1 : 2,
        sp: 0.12 + Math.random() * 0.5,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
        tw: Math.random() * Math.PI * 2,
      });
    }
  }
  // day/night phase from the user's real local time
  function phaseInfo() {
    const d = new Date();
    const hf = d.getHours() + d.getMinutes() / 60;
    let p;
    if (hf >= 5 && hf < 7.5) p = 'dawn';
    else if (hf >= 7.5 && hf < 17) p = 'day';
    else if (hf >= 17 && hf < 19.5) p = 'dusk';
    else p = 'night';
    const cfg = {
      dawn:  { sky: '255,158,107', skyA: 0.34, starMul: 0.5,  body: 'sun',  bodyCol: '#ffd27a' },
      day:   { sky: '91,139,224',  skyA: 0.30, starMul: 0.16, body: 'sun',  bodyCol: '#fff1a8' },
      dusk:  { sky: '255,111,145', skyA: 0.34, starMul: 0.55, body: 'sun',  bodyCol: '#ff9e6b' },
      night: { sky: '26,26,85',    skyA: 0.22, starMul: 1,    body: 'moon', bodyCol: '#e8e8ff' },
    }[p];
    return Object.assign({ hf, name: p }, cfg);
  }
  function drawBody(type, x, y, col) {
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill();      // soft glow
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();      // body
    if (type === 'moon') {
      ctx.fillStyle = 'rgba(120,120,160,0.55)';
      ctx.beginPath(); ctx.arc(x - 4, y - 3, 2.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4, y + 2, 2, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 1, y + 5, 1.5, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  let lastPhase = '';
  function paint(animate) {
    ctx.clearRect(0, 0, w, h);
    const ph = phaseInfo();
    // tag the page so CSS can tint the whole background by phase (visible on mobile
    // where panels cover most of the canvas)
    if (ph.name !== lastPhase) { lastPhase = ph.name; document.documentElement.dataset.daynight = ph.name; }
    // sky tint (top glow) for the time of day
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    g.addColorStop(0, `rgba(${ph.sky},${ph.skyA})`);
    g.addColorStop(1, `rgba(${ph.sky},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.5);
    // sun / moon positioned by time of day
    const frac = ph.hf / 24;
    drawBody(ph.body, frac * w, 66 + 26 * Math.cos(frac * 2 * Math.PI), ph.bodyCol);
    // stars (dimmer by day, and dimmer in low zones — they blaze in THE COSMOS)
    const zmul = ZONE_STAR[document.documentElement.dataset.zone] || 1;
    for (const st of stars) {
      if (animate) { st.y += st.sp; if (st.y > h) { st.y = -2; st.x = Math.random() * w; } st.tw += 0.05; }
      ctx.globalAlpha = Math.min(1, (animate ? 0.45 + 0.55 * Math.abs(Math.sin(st.tw)) : 0.8) * ph.starMul * zmul);
      ctx.fillStyle = st.c;
      ctx.fillRect(st.x | 0, st.y | 0, st.s, st.s);
    }
    ctx.globalAlpha = 1;
  }
  function loop() {
    // self-heal: mobile browsers can settle the viewport after load without a
    // usable resize event, leaving the canvas 0x0 or stale — fix it every frame
    if (cv.width !== window.innerWidth || cv.height !== window.innerHeight) resize();
    if (fxAnimate()) {
      paint(true);        // effects on → live twinkle/drift every frame
    } else {
      // static stars: the scene only changes when the day/night phase flips or
      // on resize, so redraw then instead of burning a full repaint each frame
      if (needPaint || phaseInfo().name !== lastPhase) { paint(false); needPaint = false; }
    }
    requestAnimationFrame(loop);
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 300));
  requestAnimationFrame(loop);
})();

/* ============================================================
   BUDGET WEATHER (foreground particles, driven by data-weather)
============================================================ */
(function weather() {
  const cv = document.getElementById('weather');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let w, h, mode = '', drops = [], clouds = [], flash = 0;
  function newDrop() {
    return { x: Math.random() * w, y: Math.random() * -h, len: (mode === 'storm' ? 14 : 9) + Math.random() * 8, sp: (mode === 'storm' ? 10 : 6) + Math.random() * 5 };
  }
  function build() {
    let rain = mode === 'rain' ? Math.round(w / 14) : mode === 'storm' ? Math.round(w / 7) : 0;
    if (lowEnd) rain = Math.round(rain * 0.6);
    drops = []; for (let i = 0; i < rain; i++) { const d = newDrop(); d.y = Math.random() * h; drops.push(d); }
    const cloud = mode === 'cloud' ? 3 : mode === 'storm' ? 5 : 0;
    clouds = []; for (let i = 0; i < cloud; i++) clouds.push({ x: Math.random() * w, y: 20 + Math.random() * h * 0.28, sp: 0.08 + Math.random() * 0.18, s: 46 + Math.random() * 70 });
  }
  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    if (!W || !H) { setTimeout(resize, 250); return; }
    w = cv.width = W; h = cv.height = H; build();
  }
  function paint() {
    if (cv.width !== window.innerWidth || cv.height !== window.innerHeight) resize();
    if (!fxAnimate()) { ctx.clearRect(0, 0, w, h); return; }   // effects off → no weather
    const m = document.documentElement.dataset.weather || 'clear';
    if (m !== mode) { mode = m; build(); }
    ctx.clearRect(0, 0, w, h);
    if (mode === 'clear') return;
    // drifting pixel clouds
    if (clouds.length) {
      ctx.fillStyle = mode === 'storm' ? 'rgba(70,78,104,0.16)' : 'rgba(150,160,190,0.12)';
      clouds.forEach((c) => {
        c.x += c.sp; if (c.x - c.s > w) c.x = -c.s;
        ctx.fillRect(c.x | 0, c.y | 0, c.s, (c.s * 0.4) | 0);
        ctx.fillRect((c.x + c.s * 0.3) | 0, (c.y - c.s * 0.16) | 0, (c.s * 0.5) | 0, (c.s * 0.34) | 0);
      });
    }
    // falling pixel rain
    if (drops.length) {
      ctx.strokeStyle = mode === 'storm' ? 'rgba(150,185,255,0.5)' : 'rgba(130,170,255,0.38)';
      ctx.lineWidth = 2; ctx.beginPath();
      drops.forEach((d) => {
        d.y += d.sp; d.x += d.sp * 0.3;
        if (d.y > h) { d.y = -d.len; d.x = Math.random() * w; }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.sp * 0.6, d.y - d.len);
      });
      ctx.stroke();
    }
    // storm lightning flash (visual only — never plays uninvited audio)
    if (mode === 'storm') {
      if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.22).toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); flash -= 0.06; }
      else if (Math.random() < 0.004) flash = 1;
    }
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 300));
  // the loop always runs; paint() gates itself on fxAnimate() (honours the
  // EFFECTS setting / system reduce-motion) and clears when off
  (function loop() { paint(); requestAnimationFrame(loop); })();
})();

/* ============================================================
   THE PALACE — a walkable, isometric 2D view of your finances.
   Tap "ENTER THE PALACE" and you steer an octopus around a tiled
   throne room. Each station is a real dashboard feature: walk to
   the ATM for your balance, the Quest Board for side quests, the
   Treasury for your savings goal, the Boss Arena for the budget
   boss, and the Oracle for a tip. Stepping on the door leaves.

   It's a self-contained module: a fullscreen canvas tile-engine
   (iso projection, depth-sorted sprites, camera follows the hero)
   plus DOM "kiosk" dialogs that read straight from `state`. Runs
   only while open, so it costs nothing on the normal dashboard.
============================================================ */
(function palace() {
  const enterBtn = document.getElementById('palaceEnter');
  if (!enterBtn) return;

  // ---- iso world constants ----
  const MAP = 11;            // 11x11 floor (gx, gy in 0..10)
  const TW = 64, TH = 32;    // tile diamond width / height (classic 2:1 iso)
  const SPEED = 5.2;         // hero movement, tiles per second

  // ---- stations: the Deep is now a minigame arcade — three games + the way up ----
  const STATIONS = [
    { id: 'pearl', gx: 4, gy: 6, ico: '🎮', label: 'PEARL RUSH', tint: 'gold'  },
    { id: 'fish',  gx: 6, gy: 4, ico: '🎣', label: 'FISHING',    tint: 'blue'  },
    { id: 'raid',  gx: 8, gy: 8, ico: '⚔️', label: 'RAID BOSS',  tint: 'red'   },
    { id: 'exit',  gx: 5, gy: 1, ico: '🌊', label: 'SURFACE',    tint: 'plain' },
  ];

  // ---- runtime state ----
  let overlay, canvas, ctx, dialog, hintEl, hud, gameHud, pgScore, pgTime, musicBtn;
  let W = 0, H = 0, dpr = 1, originX = 0, originY = 0;
  let raf = 0, running = false, last = 0;
  let built = false;
  const hero = { gx: 5, gy: 5, tx: 5, ty: 5, face: 1, bob: 0 };
  const held = {};            // keyboard direction state
  let pendingOpen = null;     // station to auto-open once the hero arrives
  let near = null;            // station currently in range (for the prompt)
  let clock = 0;              // animation time (seconds) for shimmer / drift
  let bubbles = [];           // rising bubble particles
  let fish = [];              // drifting background fish
  // minigame state — mode is 'pearl' | 'fish' | 'raid'
  const game = { on: false, mode: null, score: 0, time: 0, items: [], spawn: 0, boss: null, cd: 0, flash: 0 };
  let jukeWasOn = false;      // was the dashboard music playing before we dived?
  const deepBgm = { timer: null, step: 0 };

  // the octopus hero IS the Octrovebox logo — load it once, fall back to emoji
  const heroImg = new Image();
  let heroReady = false;
  heroImg.onload = () => { heroReady = true; };
  heroImg.src = 'icon-192.png?v=72';

  // Fixed UNDERSEA palette — the Deep always reads aquatic, regardless of the
  // dashboard skin. Deep blue water up top fading to lit turquoise on the floor,
  // sandy reef decking, with coral/gold accents for the stations.
  const palette = {
    waterA: '#15618f', waterB: '#1f86b8',   // water tiles
    causticTop: '#7fe9ff', causticBot: '#bff6ff',
    deck:   '#e6c98f', deckEdge: '#caa15a', // sandy pool/reef rim
    stone:  '#7c8a82', stoneLt: '#9fb0a6', stoneSh: '#566159', stoneMoss: '#5fae7a',
    ink:    '#eaf8ff', gold: '#ffd23f',
    blue:   '#5fd0ff', violet: '#c08bff', red: '#ff6f8c', green: '#5fe6a8',
    deep:   '#06283d',
  };
  const tintColor = (t) => palette[t] || palette.gold;

  /* ---- gradient cache ----
     Building a CanvasGradient is expensive, and the old draw() minted ten-plus
     of them EVERY frame (backdrop, god-rays, every station glow, every pearl).
     Gradients live in user space, so we make each one once and just translate
     the context to wherever it's needed. Size-dependent ones (backdrop, rays)
     rebuild on resize; the rest are positionless and cached forever. */
  const grad = { bg: null, ray: null, station: {}, pearl: null, fishHalo: null };
  function buildSizeGrads() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, palette.deep); bg.addColorStop(0.55, '#0a4d68'); bg.addColorStop(1, '#0e6c86');
    grad.bg = bg;
    const ray = ctx.createLinearGradient(0, 0, 90, H);
    ray.addColorStop(0, 'rgba(150,235,255,0.10)'); ray.addColorStop(1, 'rgba(150,235,255,0)');
    grad.ray = ray;
  }
  function stationGrad(tint, active) {
    const key = tint + (active ? '1' : '0');
    if (grad.station[key]) return grad.station[key];
    const col = tintColor(tint);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, TW * 0.75);
    g.addColorStop(0, col + (active ? 'cc' : '77')); g.addColorStop(1, col + '00');
    return (grad.station[key] = g);
  }
  function pearlGrad() {
    if (grad.pearl) return grad.pearl;
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, palette.gold); g.addColorStop(1, palette.gold + '00');
    return (grad.pearl = g);
  }
  function fishHaloGrad() {
    if (grad.fishHalo) return grad.fishHalo;
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 18);
    g.addColorStop(0, 'rgba(170,240,255,0.5)'); g.addColorStop(1, 'rgba(170,240,255,0)');
    return (grad.fishHalo = g);
  }

  /* ---- build the overlay DOM once, on first entry ---- */
  function build() {
    overlay = document.createElement('div');
    overlay.className = 'palace-overlay';
    overlay.id = 'palaceOverlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'The Palace — walkable finance view');
    overlay.innerHTML = `
      <canvas class="palace-canvas" id="palaceCanvas"></canvas>
      <div class="palace-hud" id="palaceHud">
        <span class="ph-title">≈ THE DEEP ≈</span>
        <div class="ph-right">
          <button type="button" class="ph-icon" id="palaceMusic" title="Toggle music">♫</button>
          <button type="button" class="ph-exit" id="palaceExit" title="Surface — leave the deep">✕ SURFACE</button>
        </div>
      </div>
      <div class="palace-game" id="palaceGame" hidden>
        <span class="pg-score">🪙 <b id="pgScore">0</b></span>
        <span class="pg-time">⏱ <b id="pgTime">30</b>s</span>
      </div>
      <div class="palace-hint" id="palaceHint" hidden></div>
      <div class="palace-pad" id="palacePad" aria-hidden="true">
        <button type="button" class="pp-btn pp-up"    data-dir="up">▲</button>
        <button type="button" class="pp-btn pp-left"  data-dir="left">◀</button>
        <button type="button" class="pp-btn pp-right" data-dir="right">▶</button>
        <button type="button" class="pp-btn pp-down"  data-dir="down">▼</button>
        <button type="button" class="pp-btn pp-act"   data-dir="act">★</button>
      </div>
      <div class="palace-tip" id="palaceTip">TAP TO SWIM · DIVE INTO A GAME · 🌊 SURFACE TO LEAVE</div>
      <div class="palace-dialog" id="palaceDialog" hidden>
        <div class="pd-card" id="palaceDialogCard"></div>
      </div>`;
    document.body.appendChild(overlay);

    canvas = overlay.querySelector('#palaceCanvas');
    ctx = canvas.getContext('2d');
    dialog = overlay.querySelector('#palaceDialog');
    hintEl = overlay.querySelector('#palaceHint');
    hud = overlay.querySelector('#palaceHud');
    gameHud = overlay.querySelector('#palaceGame');
    pgScore = overlay.querySelector('#pgScore');
    pgTime = overlay.querySelector('#pgTime');
    musicBtn = overlay.querySelector('#palaceMusic');

    overlay.querySelector('#palaceExit').addEventListener('click', () => exit());
    musicBtn.addEventListener('click', toggleDeepMusic);

    // tap / click to walk; tap a station to walk over and open it
    canvas.addEventListener('pointerdown', onPointer);

    // on-screen D-pad (mobile) — hold to move, ★ to interact
    overlay.querySelector('#palacePad').addEventListener('pointerdown', onPadDown);
    overlay.querySelector('#palacePad').addEventListener('pointerup', onPadUp);
    overlay.querySelector('#palacePad').addEventListener('pointerleave', onPadUp);
    overlay.querySelector('#palacePad').addEventListener('pointercancel', onPadUp);

    // dialog: close on backdrop tap or ✕
    dialog.addEventListener('pointerdown', (e) => { if (e.target === dialog) closeDialog(); });

    built = true;
  }

  /* ---- iso projection helpers ---- */
  function recenter() {
    // camera keeps the hero in the middle (lifted slightly above center)
    originX = W / 2 - (hero.gx - hero.gy) * (TW / 2);
    originY = H / 2 - (hero.gx + hero.gy) * (TH / 2) - 36;
  }
  function toScreen(gx, gy) {
    return { x: originX + (gx - gy) * (TW / 2), y: originY + (gx + gy) * (TH / 2) };
  }
  function toGrid(px, py) {
    const dx = px - originX, dy = py - originY;
    return {
      gx: (dx / (TW / 2) + dy / (TH / 2)) / 2,
      gy: (dy / (TH / 2) - dx / (TW / 2)) / 2,
    };
  }

  /* ---- input ---- */
  function onPointer(e) {
    if (!dialog.hidden) return;
    const r = canvas.getBoundingClientRect();
    const g = toGrid(e.clientX - r.left, e.clientY - r.top);
    // during PEARL RUSH, taps only steer — never open stations
    if (!game.on) {
      let hit = null, best = 1.1;
      for (const s of STATIONS) {
        const d = Math.hypot(g.gx - s.gx, g.gy - s.gy);
        if (d < best) { best = d; hit = s; }
      }
      if (hit) { walkToStation(hit); return; }
    }
    // otherwise walk to the tapped tile (clamped inside the floor)
    hero.tx = clamp(g.gx, 0.5, MAP - 1.5);
    hero.ty = clamp(g.gy, 0.5, MAP - 1.5);
    pendingOpen = null;
    Object.keys(held).forEach((k) => delete held[k]);
  }
  function walkToStation(s) {
    // stand on the tile just "south" of the station so the hero faces it
    hero.tx = clamp(s.gx + 0.0, 0.5, MAP - 1.5);
    hero.ty = clamp(s.gy + 0.9, 0.5, MAP - 1.5);
    pendingOpen = s;
    Object.keys(held).forEach((k) => delete held[k]);
  }
  function onPadDown(e) {
    const b = e.target.closest('.pp-btn'); if (!b) return;
    e.preventDefault();
    const dir = b.dataset.dir;
    if (dir === 'act') { interact(); return; }
    held[dir] = true; pendingOpen = null;
    b.classList.add('on');
  }
  function onPadUp(e) {
    overlay.querySelectorAll('.pp-btn.on').forEach((b) => b.classList.remove('on'));
    held.up = held.down = held.left = held.right = false;
  }
  function onKey(e, down) {
    const k = e.key.toLowerCase();
    let dir = null;
    if (k === 'arrowup' || k === 'w') dir = 'up';
    else if (k === 'arrowdown' || k === 's') dir = 'down';
    else if (k === 'arrowleft' || k === 'a') dir = 'left';
    else if (k === 'arrowright' || k === 'd') dir = 'right';
    else if (down && (k === ' ' || k === 'enter')) { interact(); e.preventDefault(); return; }
    else if (down && k === 'escape') { if (!dialog.hidden) closeDialog(); else exit(); return; }
    if (!dir) return;
    e.preventDefault();
    if (down) { held[dir] = true; pendingOpen = null; } else held[dir] = false;
  }
  // act on the station in range (or walk-then-open the nearest)
  function interact() {
    if (!dialog.hidden) { closeDialog(); return; }
    if (near) openStation(near);
  }

  /* ---- update + render loop ---- */
  // movement here is all dt-scaled, so capping the frame rate on weak devices
  // only thins the redraws — it never changes how fast anything moves
  const drawGate = makeFrameGate(32, 0);
  function step(ts) {
    if (!running) return;
    raf = requestAnimationFrame(step);
    if (!drawGate(ts)) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    update(dt);
    draw();
  }

  function update(dt) {
    // ambient sea life keeps drifting even behind an open kiosk
    clock += dt;
    for (const b of bubbles) {
      b.y -= b.sp * dt;
      b.x += Math.sin(clock * b.wob + b.ph) * 0.3;
      if (b.y < -10) { b.y = H + 8; b.x = rnd(0, W); }
    }
    for (const f of fish) {
      f.x += f.sp * dt;
      f.y += Math.sin(clock * 0.8 + f.ph) * 0.25;
      if (f.sp > 0 && f.x > W + 40) f.x = -40;
      else if (f.sp < 0 && f.x < -40) f.x = W + 40;
    }
    if (!dialog.hidden) return; // movement frozen while a kiosk is open
    // keyboard / d-pad steering takes over the tap target
    let kdx = 0, kdy = 0;
    if (held.up)    { kdx -= 1; kdy -= 1; }
    if (held.down)  { kdx += 1; kdy += 1; }
    if (held.left)  { kdx -= 1; kdy += 1; }
    if (held.right) { kdx += 1; kdy -= 1; }
    if (kdx || kdy) {
      const m = Math.hypot(kdx, kdy);
      hero.gx = clamp(hero.gx + (kdx / m) * SPEED * dt, 0.5, MAP - 1.5);
      hero.gy = clamp(hero.gy + (kdy / m) * SPEED * dt, 0.5, MAP - 1.5);
      hero.tx = hero.gx; hero.ty = hero.gy;
      if (kdx !== 0) hero.face = kdx > 0 ? 1 : -1;
    } else {
      // glide toward the tapped target
      const dx = hero.tx - hero.gx, dy = hero.ty - hero.gy;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.04) {
        const move = Math.min(dist, SPEED * dt);
        hero.gx += (dx / dist) * move;
        hero.gy += (dy / dist) * move;
        if (Math.abs(dx) > 0.001) hero.face = (dx - dy) > 0 ? 1 : -1;
      } else if (pendingOpen) {
        const s = pendingOpen; pendingOpen = null;
        openStation(s);
      }
    }
    hero.bob += dt * 6;

    // during PEARL RUSH: collect pearls, no station prompts, no exit-tile trigger
    if (game.on) { near = null; updateHint(); updateGame(dt); recenter(); return; }

    // proximity prompt + auto-trigger the exit door
    near = null; let bd = 1.25;
    for (const s of STATIONS) {
      const d = Math.hypot(hero.gx - s.gx, hero.gy - s.gy);
      if (d < bd) { bd = d; near = s; }
    }
    if (near && near.id === 'exit' && bd < 0.6) { exit(); return; }
    updateHint();
    recenter();
  }

  function updateHint() {
    if (near && near.id !== 'exit') {
      hintEl.hidden = false;
      hintEl.innerHTML = `<span class="ph-key">★ / SPACE</span> ${near.ico} ${near.label}`;
    } else {
      hintEl.hidden = true;
    }
  }

  // draw one iso floor diamond centered at screen (x,y)
  function diamond(x, y, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x, y - TH / 2);
    ctx.lineTo(x + TW / 2, y);
    ctx.lineTo(x, y + TH / 2);
    ctx.lineTo(x - TW / 2, y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  const isEdge = (gx, gy) => gx === 0 || gy === 0 || gx === MAP - 1 || gy === MAP - 1;

  function draw() {
    if (!grad.bg) buildSizeGrads();
    // deep-sea backdrop: dark up top, lit turquoise toward the floor
    ctx.fillStyle = grad.bg; ctx.fillRect(0, 0, W, H);

    // god-rays slanting down from the surface (fewer on weak devices)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad.ray;
    const rays = lowEnd ? 2 : 4;
    for (let i = 0; i < rays; i++) {
      const rx = W * (0.2 + i * 0.22) + Math.sin(clock * 0.2 + i) * 30;
      ctx.save(); ctx.translate(rx, 0);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(60, 0); ctx.lineTo(150, H); ctx.lineTo(30, H); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // background bubbles (the deepest, faintest ones drift behind everything)
    drawBubbles(false);

    // clean all-blue floor: every tile is animated water (no reef rim, no border)
    for (let sum = 0; sum <= (MAP - 1) * 2; sum++) {
      for (let gx = 0; gx < MAP; gx++) {
        const gy = sum - gx;
        if (gy < 0 || gy >= MAP) continue;
        const p = toScreen(gx, gy);
        if (p.x < -TW || p.x > W + TW || p.y < -TH || p.y > H + TH) continue;
        // a slow diagonal swell brightens each tile like light rippling across a
        // pool, with a faster bright caustic crest layered on top
        diamond(p.x, p.y, palette.waterA, 'rgba(0,30,50,0.25)');
        const wv = 0.5 + 0.5 * Math.sin(clock * 1.3 + gx * 0.7 + gy * 0.5);
        ctx.globalAlpha = 0.45 * wv;
        diamond(p.x, p.y, palette.waterB, null);
        // bright caustic crest — a third fill per tile, skipped on weak devices
        if (!lowEnd) {
          const a = 0.06 + 0.10 * (0.5 + 0.5 * Math.sin(clock * 2.1 + gx * 1.1 - gy * 0.6));
          ctx.globalAlpha = a;
          diamond(p.x, p.y - 1, palette.causticTop, null);
        }
        ctx.globalAlpha = 1;
      }
    }

    // mid-water fish drift between floor and sprites — but hide them during
    // FISHING so the ambient drifters aren't mistaken for the catchable targets
    if (!(game.on && game.mode === 'fish')) drawFish();

    // depth-sorted sprites: stations + hero, back-to-front. While a minigame is
    // running the kiosks are inert, so we clear them off the floor entirely to
    // give a clean, unobstructed play field.
    const sprites = game.on ? [] : STATIONS.map((s) => ({ kind: 'station', s, depth: s.gx + s.gy }));
    sprites.push({ kind: 'hero', depth: hero.gx + hero.gy });
    sprites.sort((a, b) => a.depth - b.depth);
    sprites.forEach((sp) => (sp.kind === 'hero' ? drawHero() : drawStation(sp.s)));

    // minigame actors draw above the floor
    if (game.on) { if (game.mode === 'raid') drawBoss(); else drawItems(); }

    // foreground bubbles float over the scene
    drawBubbles(true);
  }

  // two passes: small bubbles sit behind the reef (front=false), bigger, brighter
  // ones float in front of it (front=true)
  function drawBubbles(front) {
    ctx.save();
    const base = front ? 0.85 : 0.42;
    ctx.strokeStyle = 'rgba(220,250,255,0.85)'; ctx.lineWidth = 1;
    for (const b of bubbles) {
      if ((b.r >= 4.5) !== front) continue;
      ctx.globalAlpha = base;
      ctx.fillStyle = 'rgba(180,240,255,0.12)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';   // glint
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.28, 0, 6.283); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFish() {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of fish) {
      ctx.globalAlpha = 0.85;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.sp < 0 ? -1 : 1, 1);   // face travel direction
      ctx.font = f.sz + 'px serif';
      ctx.fillText(f.ico, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawStation(s) {
    const p = toScreen(s.gx, s.gy);
    const col = tintColor(s.tint);
    const active = near === s;
    const LIFT = 15; // pedestal height

    // soft glow pad on the floor (cached gradient, translated into place)
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = stationGrad(s.tint, active);
    ctx.beginPath(); ctx.ellipse(0, 0, TW * 0.72, TH * 0.72, 0, 0, 6.283); ctx.fill();
    ctx.restore();

    // SOLID raised stone pedestal — side walls give it real height
    ctx.fillStyle = palette.stoneSh;
    ctx.beginPath();
    ctx.moveTo(p.x - TW / 2, p.y); ctx.lineTo(p.x, p.y + TH / 2);
    ctx.lineTo(p.x, p.y + TH / 2 - LIFT); ctx.lineTo(p.x - TW / 2, p.y - LIFT); ctx.closePath(); ctx.fill();
    ctx.fillStyle = palette.stone;
    ctx.beginPath();
    ctx.moveTo(p.x + TW / 2, p.y); ctx.lineTo(p.x, p.y + TH / 2);
    ctx.lineTo(p.x, p.y + TH / 2 - LIFT); ctx.lineTo(p.x + TW / 2, p.y - LIFT); ctx.closePath(); ctx.fill();
    // opaque coloured top cap + light edge
    diamond(p.x, p.y - LIFT, col, '#05131f');
    ctx.globalAlpha = 0.35; diamond(p.x, p.y - LIFT - 1, palette.stoneLt, null); ctx.globalAlpha = 1;

    // opaque medallion behind the icon so it reads crisply (no wash-out)
    const iy = p.y - LIFT - 17 - (active ? 4 + Math.sin(hero.bob) * 2 : 0);
    ctx.fillStyle = '#070f1c';
    ctx.beginPath(); ctx.arc(p.x, iy, 18, 0, 6.283); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(p.x, iy, 18, 0, 6.283); ctx.stroke();

    // the feature icon — fully opaque
    ctx.font = '26px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.ico, p.x, iy + 1);

    // label plate below the pedestal
    ctx.font = '900 9px "Press Start 2P", monospace';
    ctx.textBaseline = 'middle';
    const lw = ctx.measureText(s.label).width + 14;
    ctx.fillStyle = 'rgba(5,5,16,0.88)';
    roundRect(p.x - lw / 2, p.y + 4, lw, 16, 4); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1; roundRect(p.x - lw / 2, p.y + 4, lw, 16, 4); ctx.stroke();
    ctx.fillStyle = active ? col : palette.ink;
    ctx.fillText(s.label, p.x, p.y + 13);
  }

  function drawHero() {
    const p = toScreen(hero.gx, hero.gy);
    const bob = Math.sin(hero.bob) * 3;

    // rippling shadow on the water
    ctx.fillStyle = 'rgba(0,20,35,0.45)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 17, 7, 0, 0, 6.283); ctx.fill();

    // the Octrovebox logo octopus is the diver (flip to face travel direction)
    ctx.save();
    ctx.translate(p.x, p.y - 18 + bob);
    ctx.scale(hero.face, 1);
    if (heroReady) {
      const S = 46;
      ctx.shadowColor = 'rgba(95,208,255,0.55)'; ctx.shadowBlur = 10;
      ctx.drawImage(heroImg, -S / 2, -S / 2, S, S);
      ctx.shadowBlur = 0;
    } else {
      ctx.font = '34px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐙', 0, 0);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---- station dialogs: a START intro for each minigame ---- */
  function openStation(s) {
    if (s.id === 'exit') { exit(); return; }
    const info = GAME_INFO[s.id];
    if (!info) return;
    if (typeof sfx !== 'undefined' && sfx.click) sfx.click();
    const card = dialog.querySelector('#palaceDialogCard');
    card.innerHTML =
      `<button type="button" class="pd-close" title="Close">✕</button>
       <div class="pd-head"><span class="pd-ico">${info.ico}</span><span class="pd-title">${info.title}</span></div>
       <div class="pd-body" style="text-align:center">
         <p class="pd-empty" style="opacity:.92">${info.desc}</p>
         <p class="pd-note" style="opacity:.9">BEST: ${info.best()} ${info.unit}</p>
         <button type="button" class="pd-go" id="pgStart">▶ START</button>
       </div>`;
    dialog.hidden = false;
    card.querySelector('.pd-close').addEventListener('click', closeDialog);
    card.querySelector('#pgStart').addEventListener('click', () => { closeDialog(); startGame(s.id); });
  }
  function closeDialog() { dialog.hidden = true; }

  /* ---- underwater BGM: a slow generative sine-pad loop, gated by the master
     SOUND toggle and a per-Deep mute. Self-contained so it never collides with
     the dashboard chiptune jukebox (which we pause on the way down). ---- */
  const DEEP_CHORDS = [[50, 57, 62], [48, 55, 60], [46, 53, 58], [53, 60, 65]]; // Dm Am Bb C-ish
  function deepBgmStart() {
    if (deepBgm.timer || !state.soundOn || state.deepMute) return;
    try { getAudio(); } catch (e) { return; }
    const tick = () => {
      if (!state.soundOn || state.deepMute) return;
      const ch = DEEP_CHORDS[deepBgm.step % DEEP_CHORDS.length];
      ch.forEach((n) => mNote(N2F(n), 2.8, 'sine', 0.03));        // soft pad swell
      if (Math.random() < 0.55) mNote(N2F(72 + (Math.random() * 9 | 0)), 0.45, 'sine', 0.018); // bubble shimmer
      deepBgm.step++;
    };
    tick();
    deepBgm.timer = setInterval(tick, 2600);
  }
  function deepBgmStop() { if (deepBgm.timer) { clearInterval(deepBgm.timer); deepBgm.timer = null; } }
  function syncMusicBtn() {
    if (!musicBtn) return;
    const on = state.soundOn && !state.deepMute;
    musicBtn.textContent = on ? '♫' : '♪';
    musicBtn.classList.toggle('off', !on);
  }
  function toggleDeepMusic() {
    if (typeof sfx !== 'undefined' && sfx.click) sfx.click();
    state.deepMute = !state.deepMute;
    if (typeof save === 'function') save();
    if (state.deepMute) deepBgmStop(); else deepBgmStart();
    syncMusicBtn();
  }

  /* ============================================================
     MINIGAMES — three swim challenges sharing one engine:
       pearl  collect static pearls that pop up around the floor
       fish   chase darting fish and swim into them to net them
       raid   ram the roaming Leviathan to drain its HP before time
  ============================================================ */
  const GAME_INFO = {
    pearl: { ico: '🎮', title: 'PEARL RUSH', unit: 'PEARLS', best: () => state.deepBest || 0,
      desc: 'Swim over glowing pearls to scoop them up.<br>Grab as many as you can in <b>30 seconds!</b>' },
    fish:  { ico: '🎣', title: 'FISHING', unit: 'FISH', best: () => state.deepBestFish || 0,
      desc: 'Chase the darting fish and swim into them to net them.<br>Catch as many as you can in <b>30 seconds!</b>' },
    raid:  { ico: '⚔️', title: 'RAID BOSS', unit: 'HITS', best: () => state.deepBestRaid || 0,
      desc: 'A Leviathan prowls the deep — <b>swim into it</b> to strike!<br>Land 24 hits before <b>45 seconds</b> run out.' },
  };

  function startGame(mode) {
    game.on = true; game.mode = mode; game.score = 0; game.items = []; game.spawn = 0;
    game.boss = null; game.cd = 0; game.flash = 0;
    gameHud.hidden = false;
    if (mode === 'pearl') { game.time = 30; for (let i = 0; i < 3; i++) spawnPearl(); }
    else if (mode === 'fish') { game.time = 30; for (let i = 0; i < 4; i++) spawnFish(); }
    else if (mode === 'raid') { game.time = 45; game.boss = { hp: 24, max: 24, gx: 5, gy: 3, vx: rnd(-1.4, 1.4), vy: rnd(-1.4, 1.4) }; }
    updateHudScore();
  }
  function spawnPearl() {
    if (game.items.length >= 6) return;
    for (let t = 0; t < 12; t++) {
      const gx = 1 + (Math.random() * (MAP - 2) | 0), gy = 1 + (Math.random() * (MAP - 2) | 0);
      if (isEdge(gx, gy) || Math.hypot(gx - hero.gx, gy - hero.gy) < 1.2) continue;
      game.items.push({ kind: 'pearl', gx: gx + rnd(-0.25, 0.25), gy: gy + rnd(-0.25, 0.25), ph: rnd(0, 6.28) });
      return;
    }
  }
  function spawnFish() {
    for (let t = 0; t < 12; t++) {
      const gx = 1.3 + Math.random() * (MAP - 2.6), gy = 1.3 + Math.random() * (MAP - 2.6);
      if (Math.hypot(gx - hero.gx, gy - hero.gy) < 1.4) continue;
      const a = rnd(0, 6.28), sp = rnd(0.7, 1.5);
      game.items.push({ kind: 'fish', gx, gy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ph: rnd(0, 6.28), ico: pick(['🐠', '🐟', '🐡']) });
      return;
    }
  }
  function updateHudScore() {
    pgScore.textContent = game.score;
    pgTime.textContent = Math.max(0, Math.ceil(game.time));
  }
  function updateGame(dt) {
    game.time -= dt;
    if (game.flash > 0) game.flash -= dt;

    if (game.mode === 'pearl') {
      game.spawn -= dt;
      if (game.spawn <= 0) { spawnPearl(); game.spawn = rnd(0.8, 1.6); }
      for (let i = game.items.length - 1; i >= 0; i--) {
        const it = game.items[i];
        if (Math.hypot(it.gx - hero.gx, it.gy - hero.gy) < 0.55) {
          game.items.splice(i, 1); game.score++;
          if (typeof sfx !== 'undefined' && sfx.coin) sfx.coin();
        }
      }
    } else if (game.mode === 'fish') {
      game.spawn -= dt;
      if (game.items.length < 4 && game.spawn <= 0) { spawnFish(); game.spawn = rnd(0.6, 1.2); }
      for (let i = game.items.length - 1; i >= 0; i--) {
        const f = game.items[i];
        f.gx += f.vx * dt; f.gy += f.vy * dt;
        if (f.gx < 1 || f.gx > MAP - 2) { f.vx *= -1; f.gx = clamp(f.gx, 1, MAP - 2); }
        if (f.gy < 1 || f.gy > MAP - 2) { f.vy *= -1; f.gy = clamp(f.gy, 1, MAP - 2); }
        if (Math.hypot(f.gx - hero.gx, f.gy - hero.gy) < 0.6) {
          game.items.splice(i, 1); game.score++;
          if (typeof sfx !== 'undefined' && sfx.coin) sfx.coin();
        }
      }
    } else if (game.mode === 'raid') {
      const b = game.boss;
      if (b) {
        b.gx += b.vx * dt; b.gy += b.vy * dt;
        if (b.gx < 2 || b.gx > MAP - 3) { b.vx *= -1; b.gx = clamp(b.gx, 2, MAP - 3); }
        if (b.gy < 2 || b.gy > MAP - 3) { b.vy *= -1; b.gy = clamp(b.gy, 2, MAP - 3); }
        if (game.cd > 0) game.cd -= dt;
        if (game.cd <= 0 && Math.hypot(b.gx - hero.gx, b.gy - hero.gy) < 0.95) {
          b.hp--; game.score++; game.cd = 0.5; game.flash = 0.18;
          if (typeof sfx !== 'undefined' && sfx.spend) sfx.spend();
        }
        if (b.hp <= 0) { endGame(true); return; }
      }
    }
    updateHudScore();
    if (game.time <= 0) endGame(game.mode === 'raid' ? false : undefined);
  }
  // win is undefined for collect-games, true/false for the raid
  function endGame(win) {
    const mode = game.mode;
    game.on = false; gameHud.hidden = true;
    const info = GAME_INFO[mode];
    let record = false, metric = '', bestLine = '', headline = 'TIME!';

    if (mode === 'pearl') {
      record = game.score > (state.deepBest || 0); state.deepBest = Math.max(state.deepBest || 0, game.score);
      metric = '🪙 ' + game.score; bestLine = 'BEST: ' + state.deepBest + ' PEARLS';
    } else if (mode === 'fish') {
      record = game.score > (state.deepBestFish || 0); state.deepBestFish = Math.max(state.deepBestFish || 0, game.score);
      metric = '🐟 ' + game.score; bestLine = 'BEST: ' + state.deepBestFish + ' FISH';
    } else { // raid
      if (win) {
        const t = Math.max(1, Math.round(45 - game.time));
        const prev = state.deepBestRaid || 0;
        record = !prev || t < prev; state.deepBestRaid = record ? t : prev;
        headline = '★ LEVIATHAN SLAIN! ★'; metric = '🏆 ' + t + 's'; bestLine = 'BEST: ' + state.deepBestRaid + 's';
      } else {
        headline = '💀 IT SURVIVED'; metric = game.score + ' / 24'; bestLine = 'LAND 24 HITS TO WIN';
      }
    }
    if (typeof save === 'function') save();
    if (typeof sfx !== 'undefined') { if (mode === 'raid' && !win) { if (sfx.roar) sfx.roar(); } else if (sfx.victory) sfx.victory(); }

    const card = dialog.querySelector('#palaceDialogCard');
    card.innerHTML =
      `<button type="button" class="pd-close" title="Close">✕</button>
       <div class="pd-head"><span class="pd-ico">${info.ico}</span><span class="pd-title">${info.title}</span></div>
       <div class="pd-body" style="text-align:center">
         <div class="pd-quest-name" style="font-size:13px">${record ? '★ NEW RECORD! ★' : headline}</div>
         <div class="pg-final">${metric}</div>
         <p class="pd-note" style="opacity:.9">${bestLine}</p>
         <button type="button" class="pd-go" id="pgAgain">↺ DIVE AGAIN</button>
       </div>`;
    dialog.hidden = false;
    card.querySelector('.pd-close').addEventListener('click', closeDialog);
    card.querySelector('#pgAgain').addEventListener('click', () => { closeDialog(); startGame(mode); });
  }

  function drawItems() {
    for (const it of game.items) {
      const p = toScreen(it.gx, it.gy);
      if (it.kind === 'fish') {
        const bob = Math.sin(clock * 4 + it.ph) * 2;
        ctx.save();
        ctx.translate(p.x, p.y - 14 + bob);
        // catch-glow halo so targets pop against the water (cached gradient)
        ctx.fillStyle = fishHaloGrad(); ctx.beginPath(); ctx.arc(0, 0, 18, 0, 6.283); ctx.fill();
        ctx.scale(it.vx < 0 ? -1 : 1, 1);
        ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(it.ico, 0, 0);
        ctx.restore();
      } else { // glowing gold pearl (cached gradient, translated into place)
        const bob = Math.sin(clock * 3 + it.ph) * 3, y = p.y - 16 + bob;
        ctx.save(); ctx.translate(p.x, y);
        ctx.fillStyle = pearlGrad(); ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -3, 2.5, 0, 6.283); ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawBoss() {
    const b = game.boss; if (!b) return;
    const p = toScreen(b.gx, b.gy);
    const bob = Math.sin(clock * 2) * 4;
    // shadow
    ctx.fillStyle = 'rgba(0,20,35,0.4)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 30, 12, 0, 0, 6.283); ctx.fill();
    // body (a pulse when freshly hit reads as a flinch)
    const s = 1 + (game.flash > 0 ? 0.14 : 0);
    ctx.save();
    ctx.translate(p.x, p.y - 28 + bob);
    if (game.flash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; }
    ctx.font = (52 * s | 0) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🦈', 0, 0);
    ctx.restore();
    // HP bar
    const w = 76, h = 8, x = p.x - w / 2, y = p.y - 28 - 46;
    ctx.fillStyle = 'rgba(5,12,22,0.85)'; roundRect(x - 2, y - 2, w + 4, h + 4, 3); ctx.fill();
    ctx.fillStyle = palette.red; ctx.fillRect(x, y, w * clamp(b.hp / b.max, 0, 1), h);
    ctx.font = '900 7px "Press Start 2P", monospace'; ctx.fillStyle = palette.ink;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LEVIATHAN  ' + Math.max(0, b.hp) + '/' + b.max, p.x, y - 9);
  }

  /* ---- canvas sizing (dpr-aware) ---- */
  function resize() {
    if (!overlay || overlay.hidden) return;
    // weak devices render at 1x — a full-screen canvas at 2x is 4x the pixels
    dpr = lowEnd ? 1 : Math.min(2, window.devicePixelRatio || 1);
    W = overlay.clientWidth; H = overlay.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildSizeGrads();   // backdrop + god-ray gradients depend on H
    recenter();
    seedBubbles();
    seedFish();
  }

  /* ---- ambient sea life ---- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  function seedBubbles() {
    let n = Math.max(14, Math.round((W * H) / 26000));
    if (lowEnd) n = Math.max(8, Math.round(n * 0.5));
    bubbles = [];
    for (let i = 0; i < n; i++) {
      bubbles.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(2, 7), sp: rnd(18, 46), ph: rnd(0, 6.28), wob: rnd(0.4, 1.2) });
    }
  }
  function seedFish() {
    const n = Math.max(3, Math.round(W / 320));
    fish = [];
    const kinds = ['🐠', '🐟', '🐡', '🦐'];
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      fish.push({ x: rnd(0, W), y: rnd(H * 0.18, H * 0.8), sp: dir * rnd(14, 34), sz: rnd(18, 28) | 0, ico: kinds[i % kinds.length], ph: rnd(0, 6.28) });
    }
  }
  const pick = (a) => a[Math.random() * a.length | 0];

  /* ---- enter / exit ---- */
  function enter() {
    if (!built) build();
    // reset the hero to the center of the room each time
    hero.gx = hero.tx = 5; hero.gy = hero.ty = 5; hero.face = 1; hero.bob = 0;
    pendingOpen = null; near = null;
    Object.keys(held).forEach((k) => delete held[k]);
    overlay.hidden = false;
    dialog.hidden = true;
    game.on = false; if (gameHud) gameHud.hidden = true;
    // pause the dashboard jukebox, then dive into the underwater BGM
    jukeWasOn = !!music.timer; if (jukeWasOn) stopMusic();
    syncMusicBtn(); deepBgmStart();
    document.body.classList.add('palace-open');
    resize();
    running = true; last = performance.now();
    raf = requestAnimationFrame(step);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
  }
  function exit(scrollSel) {
    running = false;
    if (raf) cancelAnimationFrame(raf), raf = 0;
    game.on = false; if (gameHud) gameHud.hidden = true;
    deepBgmStop();
    if (jukeWasOn) { try { startMusic(); } catch (e) {} jukeWasOn = false; } // resume the jukebox
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('palace-open');
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVis);
    if (typeof scrollSel === 'string') {
      const t = document.querySelector(scrollSel);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  const kd = (e) => onKey(e, true);
  const ku = (e) => onKey(e, false);
  const onVis = () => {                       // pause the loop + BGM when the tab is hidden
    if (document.hidden) { running = false; if (raf) cancelAnimationFrame(raf), raf = 0; deepBgmStop(); }
    else if (overlay && !overlay.hidden) { running = true; last = performance.now(); raf = requestAnimationFrame(step); deepBgmStart(); }
  };

  enterBtn.addEventListener('click', () => { if (typeof sfx !== 'undefined' && sfx.coin) sfx.coin(); enter(); });
})();
