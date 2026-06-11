/* ============================================================
   COIN QUEST — game logic
   State persists in localStorage. No backend, no tracking.
============================================================ */

const STORE_KEY = 'coinQuest.v1';

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
};
let appReady = false;   // true after init, so quests don't celebrate on load
let currentType = 'expense';
let currentFilter = 'all';      // type filter: all / income / expense
let catFilterVal = 'all';       // quest-log category filter
let monthFilterVal = 'all';     // quest-log month filter (y*12+m, or 'all')
let editingId = null; // id of the transaction being edited (null = adding new)
let scatterBuddies = () => {}; // assigned by the roaming-buddies system below

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
  // chest + themes
  chestBtn: $('chestBtn'), chestStreak: $('chestStreak'), chestSay: $('chestSay'),
  themeGrid: $('themeGrid'),
  // monthly recap
  recapBtn: $('recapBtn'), recapOverlay: $('recapOverlay'), recapClose: $('recapClose'),
  recapMonth: $('recapMonth'), recapGrade: $('recapGrade'), recapRows: $('recapRows'),
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
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (e) { /* ignore corrupt save */ }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

/* ============================================================
   HELPERS
============================================================ */
const fmt = (n) => {
  const neg = n < 0;
  const v = Math.abs(n).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return (neg ? '-Rp' : 'Rp') + v;
};
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
  if (len >= 17) el.classList.add('len-xxl');
  else if (len >= 14) el.classList.add('len-xl');
  else if (len >= 12) el.classList.add('len-l');
  else if (len >= 10) el.classList.add('len-m');
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
    li.innerHTML = `
      <span class="tx-icon" style="background:${CAT_COLORS[t.category] || '#2e2e63'}22;border-color:${CAT_COLORS[t.category] || '#050510'}">${c.icon}</span>
      <span class="tx-body">
        <span class="tx-desc">${escapeHtml(t.desc)}</span>
        <span class="tx-meta">${c.name} · ${date}</span>
      </span>
      <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount).replace('-','')}</span>
      <button class="tx-edit" title="Edit" data-id="${t.id}">✎</button>
      <button class="tx-del" title="Delete" data-id="${t.id}">✕</button>
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

  entries.forEach(([id, amt]) => {
    const c = catInfo('expense', id);
    const pct = Math.round((amt / max) * 100);
    const color = CAT_COLORS[id] || '#9a9ad0';
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <span class="cat-name"><span>${c.icon}</span>${c.name}</span>
      <span class="cat-track"><span class="cat-fill" style="background-image:linear-gradient(90deg, ${color}, ${color}aa)"></span></span>
      <span class="cat-amt" style="color:${color}">${fmt(amt)}</span>
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
function renderGoal() {
  if (!state.goal) {
    els.goalPanel.classList.remove('complete');
    els.goalChest.textContent = '🗝️';
    els.goalName.textContent = 'NO ACTIVE QUEST';
    els.goalFill.style.width = '0%';
    els.goalText.className = 'bar-text';
    els.goalText.textContent = 'SET A SAVINGS GOAL TO BEGIN';
    return;
  }

  const saved = Math.max(0, totals().balance);
  const target = state.goal.target;
  const pct = clamp((saved / target) * 100, 0, 100);
  const done = saved >= target;

  els.goalFill.style.width = pct + '%';
  els.goalName.textContent = state.goal.name;
  els.goalPanel.classList.toggle('complete', done);

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
  if (n >= 1000000) return 'Rp' + (n / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'jt';
  if (n >= 1000) return 'Rp' + (n / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'rb';
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
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
    col.className = 'chart-col';
    col.innerHTML = `
      <div class="chart-bars">
        <div class="cbar cbar-in" title="EARN ${fmt(d.income)}">${d.income ? `<span class="cbar-val">${kfmt(d.income)}</span>` : ''}</div>
        <div class="cbar cbar-out" title="SPEND ${fmt(d.expense)}">${d.expense ? `<span class="cbar-val">${kfmt(d.expense)}</span>` : ''}</div>
      </div>
      <div class="chart-label ${d.current ? 'current' : ''}">${MONTHS[d.m]}</div>
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
}

/* quest board open/close with a little guild-horn flourish */
function toggleQuestBoard() {
  const opening = els.questScroll.hidden;
  els.questScroll.hidden = !opening;
  els.questToggle.classList.toggle('open', opening);
  if (opening) beep([523, 659, 784], 0.07, 'triangle', 0.04); // unroll fanfare
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
        showToast('🎨 SKIN: ' + t.name);
      });
    } else {
      btn.addEventListener('click', () => { sfx.error(); showToast('🔒 LOCKED — KEEP PLAYING TO UNLOCK!'); });
    }
    els.themeGrid.appendChild(btn);
  });
}

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
  { msg: '🧙 A wandering merchant nods approvingly.', coins: 0 },
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

function renderAll(prevLevel) {
  renderStats(prevLevel);
  renderList();
  renderCats();
  renderBudget();
  renderGoal();
  renderMiniBosses();
  renderStreak();
  renderChart();
  renderQuests();
  renderOracle();
  renderThemes();
  renderChest();
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

  state.transactions.push({
    id: Date.now(),
    date: pickerDate,
    type: currentType,
    desc,
    amount,
    category: els.category.value,
  });
  save();

  currentType === 'income' ? sfx.coin() : sfx.spend();
  renderAll(prevLevel);
  if (currentType === 'income') flyCoinsTo(els.balanceCard); // coins fly into the balance
  if (currentType === 'expense') hitBoss(amount); // boss takes a hit
  scatterBuddies(); // the pixel buddies bolt away in surprise
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
      <div class="pr-title">COIN QUEST</div>
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

  html += `<div class="pr-foot">Generated by COIN QUEST · 8-bit personal finance tracker</div></div>`;
  return html;
}

/* ---- backup (export JSON) & restore (import JSON) ---- */
function exportBackup() {
  sfx.click();
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'coin-quest-backup-' + new Date().toISOString().slice(0, 10) + '.json';
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
      sfx.error(); showToast('⚠ NOT A COIN QUEST BACKUP'); return;
    }
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
    save();
    sfx.coin();
    showToast('📂 BACKUP RESTORED! ' + state.transactions.length + ' ENTRIES');
    els.mute.textContent = '♪ SOUND: ' + (state.soundOn ? 'ON' : 'OFF');
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
els.chestBtn.addEventListener('click', openChest);

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
function init() {
  load();
  els.mute.textContent = '♪ SOUND: ' + (state.soundOn ? 'ON' : 'OFF');
  applyTheme(state.theme);
  document.body.classList.toggle('rainbow', !!state.rainbow);
  fillCategories();
  fillCatBudgetSelect();
  fillCatFilter();
  setDateToday();
  renderAll();

  // seed a friendly demo entry the very first time
  if (state.transactions.length === 0 && !localStorage.getItem(STORE_KEY)) {
    showToast('WELCOME! ADD YOUR FIRST ENTRY ⮞');
  }
  appReady = true; // from now on, completing a side quest celebrates
  typeOracle();    // type out the first Oracle tip for that RPG-textbox feel
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
   ROAMING BUDDIES — little pixel characters that drift around
============================================================ */
(function spawnFloaters() {
  // respect users who prefer no motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Pac-Man cast, drawn as inline SVG so the ghosts get their proper colors
  const ghost = (c) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M12 54 a38 38 0 0 1 76 0 L88 90 L80 81 L68 90 L56 81 L44 90 L32 81 L20 90 L12 81 Z" fill="${c}"/><circle cx="38" cy="50" r="12" fill="#fff"/><circle cx="64" cy="50" r="12" fill="#fff"/><circle cx="34" cy="50" r="6" fill="#1b1b46"/><circle cx="60" cy="50" r="6" fill="#1b1b46"/></svg>`;
  const PACMAN = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 50 L92 30 A46 46 0 1 0 92 70 Z" fill="#ffd23f"/><circle cx="46" cy="26" r="5.5" fill="#0b0b1f"/></svg>`;
  const SPRITES = [
    PACMAN,
    ghost('#ff5d5d'), // Blinky (red)
    ghost('#ff6bc4'), // Pinky (pink)
    ghost('#2fe0e0'), // Inky (cyan)
    ghost('#ff9f1c'), // Clyde (orange)
  ];
  const COUNT = 4;
  const buddies = [];

  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'floater';
    const inner = document.createElement('span');
    inner.className = 'fl-inner';
    const size = 24 + Math.random() * 14;
    inner.innerHTML = SPRITES[Math.floor(Math.random() * SPRITES.length)];
    const svg = inner.firstChild;
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.display = 'block';
    el.appendChild(inner);
    document.body.appendChild(el);

    inner.style.animationDelay = (Math.random() * 1.5) + 's';

    const ang = Math.random() * Math.PI * 2;
    const base = 0.3 + Math.random() * 0.4;             // gentle drift speed
    const b = {
      el, size,
      x: Math.random() * Math.max(1, window.innerWidth - size),
      y: Math.random() * Math.max(1, window.innerHeight - size),
      vx: Math.cos(ang) * base, vy: Math.sin(ang) * base,
      base, boostUntil: 0, boostSpeed: base,
    };
    buddies.push(b);
  }

  // burst: fling every buddy in a fresh random direction at high speed
  scatterBuddies = () => {
    const now = performance.now();
    buddies.forEach((b) => {
      const a = Math.random() * Math.PI * 2;
      b.boostSpeed = 6 + Math.random() * 4;
      b.vx = Math.cos(a) * b.boostSpeed;
      b.vy = Math.sin(a) * b.boostSpeed;
      b.boostUntil = now + 850;
    });
  };

  (function step(now) {
    buddies.forEach((b) => {
      const boosting = now < b.boostUntil;
      const target = boosting ? b.boostSpeed : b.base;
      if (!boosting) {            // gentle wander only when calm
        b.vx += (Math.random() - 0.5) * 0.04;
        b.vy += (Math.random() - 0.5) * 0.04;
      }
      const sp = Math.hypot(b.vx, b.vy) || 0.001;
      b.vx = (b.vx / sp) * target;
      b.vy = (b.vy / sp) * target;

      b.x += b.vx; b.y += b.vy;
      const m = b.size + 6;
      if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); } else if (b.x > window.innerWidth - m) { b.x = window.innerWidth - m; b.vx = -Math.abs(b.vx); }
      if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); } else if (b.y > window.innerHeight - m) { b.y = window.innerHeight - m; b.vy = -Math.abs(b.vy); }

      // ease the boost speed back down toward base so they settle smoothly
      if (!boosting && b.boostSpeed > b.base) b.boostSpeed = b.base;

      b.el.style.transform = 'translate(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px)' + (b.vx < 0 ? ' scaleX(-1)' : '');
    });
    requestAnimationFrame(step);
  })(performance.now());
})();

/* ============================================================
   CHIPTUNE BACKGROUND MUSIC (generated live, looping)
============================================================ */
const N2F = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> frequency
// jukebox: cycle OFF -> CALM -> COZY TOWN -> OFF with the MUSIC button
const TRACKS = [
  { // calm/hopeful: warm major pads (C–G–Am–F), gentle rising lead
    name: 'CALM', stepMs: 300, drone: true,
    pad:  [48, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0],
    lead: [0, 0, 72, 76, 0, 79, 76, 0, 0, 0, 81, 79, 0, 76, 74, 72], leadType: 'triangle', leadDur: 0.55,
    twinkle: [84, 88, 91, 96],
  },
  { // cozy town: bouncier mid-tempo C–Am–F–G with a friendly skipping melody
    name: 'COZY TOWN', stepMs: 220, drone: false,
    pad:  [48, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0],
    lead: [76, 0, 72, 0, 74, 0, 69, 0, 72, 0, 77, 0, 74, 0, 79, 0], leadType: 'triangle', leadDur: 0.5,
    twinkle: [84, 88, 91],
  },
  { // overworld: upbeat oom-pah bass + bright bouncy square melody
    name: 'OVERWORLD', stepMs: 175, drone: false,
    bass: [48, 55, 48, 55, 43, 50, 43, 50, 45, 52, 45, 52, 41, 48, 41, 48], bassType: 'triangle', bassDur: 0.14, bassVol: 0.05,
    lead: [72, 0, 76, 79, 81, 79, 76, 72, 74, 0, 77, 81, 79, 77, 74, 72], leadType: 'square', leadDur: 0.16, leadVol: 0.038,
    twinkle: [88, 91, 96],
  },
  { // battle: fast driving A-minor pulse with an urgent square riff
    name: 'BATTLE', stepMs: 145, drone: false,
    bass: [45, 45, 45, 45, 41, 41, 41, 41, 48, 48, 48, 48, 43, 43, 43, 43], bassType: 'square', bassDur: 0.1, bassVol: 0.05,
    lead: [69, 72, 76, 69, 72, 76, 81, 76, 77, 74, 72, 69, 71, 72, 74, 76], leadType: 'square', leadDur: 0.12, leadVol: 0.04,
  },
  { // victory: triumphant ascending fanfare over big chords
    name: 'VICTORY', stepMs: 200, drone: false,
    pad:  [48, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0, 48, 0, 0, 0], padDur: 1.1,
    lead: [72, 76, 79, 84, 79, 84, 88, 0, 77, 81, 84, 89, 84, 0, 84, 0], leadType: 'square', leadDur: 0.22, leadVol: 0.05,
    twinkle: [91, 96],
  },
  { // space: slow airy open-fifth pads (Am–F–C–G) with a sparse drifting lead
    name: 'SPACE', stepMs: 300, drone: false,
    pad:  [45, 0, 0, 0, 41, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0], padChord: [0, 7], padDur: 1.6,
    lead: [0, 0, 76, 79, 0, 81, 79, 76, 0, 0, 72, 74, 0, 76, 74, 72], leadType: 'triangle', leadDur: 0.55, leadVol: 0.036,
    twinkle: [81, 84, 88, 91],
  },
  { // eerie: detuned low drone, dissonant tritone+min3rd pads, Phrygian lead, min-2nd shimmer
    name: 'EERIE', stepMs: 360, drone: true, droneNote: 33, droneDur: 3.0, droneDetune: true,
    pad:  [45, 0, 0, 0, 0, 0, 0, 0, 51, 0, 0, 0, 0, 0, 0, 0], padChord: [0, 6, 3], padDur: 2.4,
    lead: [0, 0, 77, 0, 76, 0, 0, 72, 0, 0, 70, 0, 69, 0, 0, 0], leadType: 'triangle', leadDur: 0.7, leadVol: 0.034,
    twinkle: [81, 83, 86, 89], twinkleCluster: true,
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
function cycleMusic() {
  if (!state.musicOn) { state.musicOn = true; state.musicTrack = 0; }
  else {
    state.musicTrack += 1;
    if (state.musicTrack >= TRACKS.length) { state.musicOn = false; state.musicTrack = 0; }
  }
  save();
  setMusicLabel();
  stopMusic();
  if (state.musicOn) { music.step = 0; startMusic(); }
}
els.music.addEventListener('click', cycleMusic);
setMusicLabel();

// stop the music loop when the app is hidden/backgrounded; resume if it was on
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopMusic();
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
  } else if (state.musicOn) {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    startMusic();
  }
});
// browsers block audio until a gesture — if music was on last session, start on first interaction
if (state.musicOn) {
  const kick = () => { startMusic(); window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
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
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#ffffff', '#ffffff', '#ffd23f', '#4fa9ff', '#b06bff'];
  let w, h, stars;
  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    if (!W || !H) { setTimeout(resize, 250); return; } // mobile viewport not ready yet — retry
    w = cv.width = W;
    h = cv.height = H;
    const count = Math.max(28, Math.round((w * h) / 14000));
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
    // stars (dimmer by day)
    for (const st of stars) {
      if (animate) { st.y += st.sp; if (st.y > h) { st.y = -2; st.x = Math.random() * w; } st.tw += 0.05; }
      ctx.globalAlpha = (animate ? 0.45 + 0.55 * Math.abs(Math.sin(st.tw)) : 0.8) * ph.starMul;
      ctx.fillStyle = st.c;
      ctx.fillRect(st.x | 0, st.y | 0, st.s, st.s);
    }
    ctx.globalAlpha = 1;
  }
  function loop() {
    // self-heal: mobile browsers can settle the viewport after load without a
    // usable resize event, leaving the canvas 0x0 or stale — fix it every frame
    if (cv.width !== window.innerWidth || cv.height !== window.innerHeight) resize();
    paint(true);
    requestAnimationFrame(loop);
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 300));
  if (reduce) {
    paint(false);
    setInterval(() => { resize(); paint(false); }, 60000); // keep phase current without animation
  } else {
    requestAnimationFrame(loop);
  }
})();
