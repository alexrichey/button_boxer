import { buildLayout } from './layout.js';
import { KEYS, getKey, spell } from './theory.js';
import { DIFFICULTIES, QUIZZES_PER_ROUND, newRound, noteOf, pickTarget } from './quiz.js';
import { drawKeyboard, ARROW } from './render.js';

const CONFIG = {
  markRevealMs: 800, // answer flash after marking without revealing first
  swipeThresholdPx: 50,
  tapSlopPx: 12,
  blitz: { settleMs: 3000, answerMs: 1500 },
};

const TILTS = [0, 10, 20, 30];

const SETTINGS_KEY = 'button-boxer-settings';

const $ = (id) => document.getElementById(id);
const els = {
  layout: $('layout-select'),
  key: $('key-select'),
  mode: $('mode-select'),
  difficulty: $('difficulty-select'),
  tilt: $('tilt-select'),
  stage: $('stage'),
  zoom: $('zoom'),
  mini: $('mini'),
  answer: $('answer'),
  hint: $('hint'),
  progress: $('progress'),
  wrong: $('mark-wrong'),
  right: $('mark-right'),
  blitzToggle: $('blitz-toggle'),
  error: $('error'),
};

const layoutCache = new Map();
let layoutIndex = [];
let layout = null;
let settings = loadSettings();

// Round/quiz state, shared by both modes.
let state = freshState();
let blitz = null; // { cancelled } while blitz mode is running

function freshState() {
  return { round: null, quizIndex: 0, target: null, revealed: false, tint: null, flash: false, locked: false };
}

// ---------- settings ----------

function loadSettings() {
  const defaults = { layoutId: null, key: 'D', mode: 'practice', difficulty: 'easy', tilt: '20' };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode etc.) — settings just won't stick.
  }
}

const key = () => getKey(settings.key);
const difficulty = () => DIFFICULTIES[settings.difficulty] ?? DIFFICULTIES.easy;

// ---------- layouts ----------

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function loadLayout(entry) {
  if (!layoutCache.has(entry.id)) {
    layoutCache.set(entry.id, buildLayout(await fetchJson(`layouts/${entry.file}`)));
  }
  return layoutCache.get(entry.id);
}

// ---------- quiz flow ----------

function startRound() {
  state = freshState();
  state.round = newRound(layout, key(), difficulty().boxSize);
}

function nextQuiz() {
  state.target = pickTarget(state.round, state.target);
  state.revealed = false;
  state.tint = null;
  state.flash = true;
}

function reveal() {
  if (!state.target || state.revealed || state.locked) return;
  state.revealed = true;
  state.flash = false;
  render();
}

// Hook for future stats / weighted repeats.
function recordResult(item, correct) {}

function advancePractice() {
  state.quizIndex += 1;
  if (state.quizIndex >= QUIZZES_PER_ROUND) startRound();
  nextQuiz();
  render();
}

function mark(correct) {
  if (settings.mode !== 'practice' || !state.target || state.locked) return;
  recordResult(state.target, correct);
  if (state.revealed) {
    advancePractice();
    return;
  }
  state.revealed = true;
  state.flash = false;
  state.tint = correct ? 'correct' : 'wrong';
  state.locked = true;
  render();
  const current = state;
  setTimeout(() => {
    if (state !== current) return; // settings changed meanwhile
    state.locked = false;
    advancePractice();
  }, CONFIG.markRevealMs);
}

function startPractice() {
  startRound();
  nextQuiz();
  render();
}

// ---------- blitz ----------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBlitz(token) {
  while (!token.cancelled) {
    startRound();
    render();
    await sleep(CONFIG.blitz.settleMs);
    for (let i = 0; i < QUIZZES_PER_ROUND; i++) {
      if (token.cancelled) return;
      state.quizIndex = i;
      nextQuiz();
      render();
      await sleep(difficulty().guessMs);
      if (token.cancelled) return;
      state.revealed = true;
      state.flash = false;
      render();
      await sleep(CONFIG.blitz.answerMs);
    }
  }
}

function startBlitz() {
  stopBlitz();
  blitz = { cancelled: false };
  runBlitz(blitz);
  render();
}

function stopBlitz() {
  if (blitz) blitz.cancelled = true;
  blitz = null;
}

function toggleBlitz() {
  if (blitz) {
    stopBlitz();
    state = freshState();
    render();
  } else {
    startBlitz();
  }
}

// ---------- rendering ----------

function render() {
  const view = {
    box: state.round?.box,
    anchor: state.round?.anchor,
    target: state.target,
    key: key(),
    revealed: state.revealed,
    tint: state.tint,
    flash: state.flash,
    tilt: Number(settings.tilt) || 0,
  };
  drawKeyboard(els.zoom, layout, view);
  drawKeyboard(els.mini, layout, { ...view, mini: true });

  const practice = settings.mode === 'practice';
  els.wrong.hidden = !practice;
  els.right.hidden = !practice;
  els.blitzToggle.hidden = practice;
  els.blitzToggle.textContent = blitz ? 'Stop' : 'Start';

  els.answer.className = 'answer' + (state.tint ? ` ${state.tint}` : '');
  if (state.target && state.revealed) {
    const t = state.target;
    els.answer.innerHTML = '';
    const note = document.createElement('span');
    note.className = 'answer-note';
    note.textContent = spell(noteOf(t), key());
    const dir = document.createElement('span');
    dir.className = 'answer-dir';
    dir.textContent = `${ARROW[t.dir]} ${t.dir}`;
    els.answer.append(note, dir);
  } else {
    els.answer.textContent = '';
  }

  if (practice) {
    els.hint.textContent = state.revealed
      ? 'Swipe → if you got it, ← if not'
      : 'Tap to reveal · or just swipe → / ←';
  } else if (!blitz) {
    els.hint.textContent = 'Press Start';
  } else {
    els.hint.textContent = state.target ? '' : 'Find the anchor…';
  }

  els.progress.textContent = state.round
    ? `${Math.min(state.quizIndex + 1, QUIZZES_PER_ROUND)} / ${QUIZZES_PER_ROUND}`
    : '';
  // Flash should only play once per new target.
  state.flash = false;
}

// ---------- input ----------

function bindInput() {
  let start = null;

  els.stage.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  els.stage.addEventListener('pointercancel', () => {
    start = null;
  });
  els.stage.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) >= CONFIG.swipeThresholdPx && Math.abs(dx) > Math.abs(dy)) {
      mark(dx > 0);
    } else if (Math.hypot(dx, dy) <= CONFIG.tapSlopPx && settings.mode === 'practice') {
      reveal();
    }
  });

  els.wrong.addEventListener('click', () => mark(false));
  els.right.addEventListener('click', () => mark(true));
  els.blitzToggle.addEventListener('click', toggleBlitz);

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (settings.mode === 'practice') reveal();
      else toggleBlitz();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      mark(true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      mark(false);
    }
  });

  const onSettingChange = (name) => async (e) => {
    settings[name] = e.target.value;
    saveSettings();
    e.target.blur();
    if (name === 'layoutId') layout = await loadLayout(layoutIndex.find((l) => l.id === settings.layoutId));
    restart();
  };
  els.layout.addEventListener('change', onSettingChange('layoutId'));
  els.key.addEventListener('change', onSettingChange('key'));
  els.mode.addEventListener('change', onSettingChange('mode'));
  els.difficulty.addEventListener('change', onSettingChange('difficulty'));
  els.tilt.addEventListener('change', (e) => {
    settings.tilt = e.target.value;
    saveSettings();
    e.target.blur();
    render();
  });
}

function restart() {
  stopBlitz();
  state = freshState();
  if (settings.mode === 'practice') startPractice();
  else render();
}

// ---------- setup ----------

function fillSelect(select, options, value) {
  select.replaceChildren(
    ...options.map(([v, label]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      return o;
    }),
  );
  select.value = value;
}

async function init() {
  try {
    layoutIndex = await fetchJson('layouts/index.json');
    const entry = layoutIndex.find((l) => l.id === settings.layoutId) ?? layoutIndex[0];
    settings.layoutId = entry.id;
    layout = await loadLayout(entry);
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent =
      `Couldn't load layouts (${err.message}). ` +
      (location.protocol === 'file:' ? 'Serve the folder over HTTP, e.g. `python3 -m http.server`.' : '');
    return;
  }

  // Layout names come from each file; load them all for the dropdown.
  const names = await Promise.all(layoutIndex.map(async (l) => [l.id, (await loadLayout(l)).name]));
  fillSelect(els.layout, names, settings.layoutId);
  els.layout.closest('label').hidden = layoutIndex.length < 2;
  fillSelect(els.key, KEYS.map((k) => [k.name, `${k.name} major`]), key().name);
  fillSelect(els.mode, [['practice', 'Practice'], ['blitz', 'Blitz']], settings.mode);
  fillSelect(
    els.difficulty,
    Object.entries(DIFFICULTIES).map(([id, d]) => [id, d.label]),
    DIFFICULTIES[settings.difficulty] ? settings.difficulty : 'easy',
  );

  fillSelect(els.tilt, TILTS.map((t) => [String(t), t ? `${t}°` : 'Off']), settings.tilt);
  if (!els.tilt.value) els.tilt.value = '20';
  settings.tilt = els.tilt.value;

  bindInput();
  restart();
}

init();
