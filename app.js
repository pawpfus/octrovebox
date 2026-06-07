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
  soundOn: true,
  budget: 0,            // monthly spending limit (0 = none)
  goal: null,           // { name, target }
  budgetBreached: false,// fired the "over budget" warning already?
  goalCelebrated: false,// fired the "quest complete" jingle already?
  catBudgets: {},       // { categoryId: monthlyLimit } — mini-bosses
};
let currentType = 'expense';
let currentFilter = 'all';

/* ---------------- elements ---------------- */
const $ = (id) => document.getElementById(id);
const els = {
  balance: $('balanceValue'), income: $('incomeValue'), expense: $('expenseValue'),
  balanceFoot: $('balanceFoot'), balanceCard: document.querySelector('.balance'),
  streak: $('streakDisplay'),
  form: $('txForm'), desc: $('descInput'), amount: $('amountInput'), category: $('categoryInput'),
  btnExpense: $('btnExpense'), btnIncome: $('btnIncome'), submit: $('submitBtn'),
  list: $('txList'), emptyState: $('emptyState'),
  catBars: $('catBars'), catEmpty: $('catEmpty'),
  filters: $('logFilters'), mute: $('muteBtn'),
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
};

/* ============================================================
   SOUND — tiny Web Audio chiptune blips, no assets needed
============================================================ */
let audioCtx;
function beep(freqs, dur = 0.09, type = 'square', gain = 0.05) {
  if (!state.soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
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
const sfx = {
  coin:    () => beep([988, 1319], 0.08, 'square', 0.06),       // earn — classic coin
  spend:   () => beep([330, 247], 0.1, 'triangle', 0.06),       // spend
  click:   () => beep([660], 0.04, 'square', 0.03),
  delete:  () => beep([200, 140], 0.08, 'sawtooth', 0.05),
  levelup: () => beep([523, 659, 784, 1047], 0.1, 'square', 0.06),
  error:   () => beep([160, 120], 0.12, 'sawtooth', 0.06),
  roar:    () => beep([180, 130, 90], 0.14, 'sawtooth', 0.07),         // boss enraged
  victory: () => beep([659, 784, 988, 1319, 1047, 1319], 0.11, 'square', 0.06), // quest done
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
  const v = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return (neg ? '-$' : '$') + v;
};
function catInfo(type, id) {
  return CATEGORIES[type].find((c) => c.id === id) || { name: id, icon: '❓' };
}
function levelFor(income) {
  return Math.max(1, Math.floor(income / 1000) + 1); // +1 level per $1000 earned
}
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// income + expense totals for a given year/month (optionally a single category)
function monthTotals(y, m, category) {
  let income = 0, expense = 0;
  state.transactions.forEach((t) => {
    const d = new Date(t.id);
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
  return { income, expense, balance: income - expense };
}

function renderStats(prevLevel) {
  const { income, expense, balance } = totals();
  els.income.textContent = fmt(income);
  els.expense.textContent = fmt(expense);
  els.balance.textContent = fmt(balance);
  els.balanceCard.classList.toggle('negative', balance < 0);

  els.balanceFoot.textContent = balance >= 0 ? 'KEEP GOING!' : 'GAME OVER?';

  const level = levelFor(income);
  els.streak.textContent = 'LV.' + level;

  [els.balance, els.income, els.expense].forEach((el) => {
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  });

  if (prevLevel !== undefined && level > prevLevel) {
    sfx.levelup();
    showToast('★ LEVEL UP! ★  YOU REACHED LV.' + level);
  }
}

function renderList() {
  const items = state.transactions
    .filter((t) => currentFilter === 'all' || t.type === currentFilter)
    .slice().reverse();

  els.list.innerHTML = '';
  els.emptyState.style.display = items.length ? 'none' : 'block';

  items.forEach((t) => {
    const c = catInfo(t.type, t.category);
    const li = document.createElement('li');
    li.className = 'tx-item';
    const date = new Date(t.id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    li.innerHTML = `
      <span class="tx-icon" style="background:${CAT_COLORS[t.category] || '#2e2e63'}22;border-color:${CAT_COLORS[t.category] || '#050510'}">${c.icon}</span>
      <span class="tx-body">
        <span class="tx-desc">${escapeHtml(t.desc)}</span>
        <span class="tx-meta">${c.name} · ${date}</span>
      </span>
      <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount).replace('-','')}</span>
      <button class="tx-del" title="Delete" data-id="${t.id}">✕</button>
    `;
    els.list.appendChild(li);
  });
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
    const d = new Date(t.id);
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
  if (n >= 1000) return '$' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
  return '$' + Math.round(n);
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

function renderAll(prevLevel) {
  renderStats(prevLevel);
  renderList();
  renderCats();
  renderBudget();
  renderGoal();
  renderMiniBosses();
  renderStreak();
  renderChart();
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

function addTx(e) {
  e.preventDefault();
  const desc = els.desc.value.trim();
  const amount = parseFloat(els.amount.value);
  if (!desc || !(amount > 0)) { sfx.error(); shake(els.form); return; }

  const prevLevel = levelFor(totals().income);

  state.transactions.push({
    id: Date.now(),
    type: currentType,
    desc,
    amount,
    category: els.category.value,
  });
  save();

  currentType === 'income' ? sfx.coin() : sfx.spend();
  renderAll(prevLevel);

  els.form.reset();
  els.desc.focus();
}

function deleteTx(id) {
  state.transactions = state.transactions.filter((t) => t.id !== Number(id));
  save();
  sfx.delete();
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
    state.transactions.slice().sort((a, b) => b.id - a.id).forEach((t) => {
      const d = new Date(t.id).toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' });
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
    state.budget = Number(data.budget) || 0;
    state.goal = (data.goal && data.goal.target)
      ? { name: String(data.goal.name || 'SAVINGS QUEST'), target: Number(data.goal.target) }
      : null;
    state.catBudgets = (data.catBudgets && typeof data.catBudgets === 'object') ? data.catBudgets : {};
    state.soundOn = data.soundOn !== false;
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
els.restoreBtn.addEventListener('click', () => els.restoreInput.click());
els.restoreInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) importBackup(f);
  e.target.value = ''; // allow re-importing the same file
});

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
  const btn = e.target.closest('.tx-del');
  if (btn) deleteTx(btn.dataset.id);
});

els.filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  [...els.filters.children].forEach((b) => b.classList.toggle('active', b === btn));
  sfx.click();
  renderList();
});

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
  fillCategories();
  fillCatBudgetSelect();
  renderAll();

  // seed a friendly demo entry the very first time
  if (state.transactions.length === 0 && !localStorage.getItem(STORE_KEY)) {
    showToast('WELCOME! ADD YOUR FIRST ENTRY ⮞');
  }
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
