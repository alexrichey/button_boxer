import { buildLayout } from './layout.js';
import { KEYS, getKey, spell, toPitchClass } from './theory.js';
import { DIFFICULTIES, QUIZZES_PER_ROUND, newRound, noteOf, pickTarget } from './quiz.js';
import { drawKeyboard, ARROW } from './render.js';
import { drawPhoto } from './render-photo.js';
import { formatJson } from './format.js';

const CONFIG = {
  markRevealMs: 800, // answer flash after marking without revealing first
  swipeThresholdPx: 50,
  tapSlopPx: 12,
  blitz: { settleMs: 3000, answerMs: 1500 },
};

// 'photo' uses the layout's photo; numbers are drawn views tilted by that many degrees.
const VIEWS = [
  ['photo', 'Photo'],
  ['20', 'Drawn 20°'],
  ['10', 'Drawn 10°'],
  ['30', 'Drawn 30°'],
  ['0', 'Flat'],
];

const D_TONES = new Set([toPitchClass('D')]);

const SETTINGS_KEY = 'button-boxer-settings';
const PHOTO_EDITS_KEY = (layoutId) => `button-boxer-photo:${layoutId}`;

const $ = (id) => document.getElementById(id);
const els = {
  layout: $('layout-select'),
  key: $('key-select'),
  mode: $('mode-select'),
  difficulty: $('difficulty-select'),
  view: $('view-select'),
  dtone: $('dtone-toggle'),
  stage: $('stage'),
  zoom: $('zoom'),
  mini: $('mini'),
  answer: $('answer'),
  hint: $('hint'),
  progress: $('progress'),
  actions: $('actions'),
  wrong: $('mark-wrong'),
  right: $('mark-right'),
  blitzToggle: $('blitz-toggle'),
  error: $('error'),
  editor: $('editor'),
  editButton: $('edit-button'),
  editPrev: $('edit-prev'),
  editNext: $('edit-next'),
  editRadius: $('edit-radius'),
  editRadiusValue: $('edit-radius-value'),
  editRadiusAll: $('edit-radius-all'),
  editReset: $('edit-reset'),
  editCopy: $('edit-copy'),
  editDownload: $('edit-download'),
};

const specCache = new Map(); // layout id -> spec as loaded from its file
let layoutIndex = [];
let layout = null;
let settings = loadSettings();

// Round/quiz state, shared by practice and blitz.
let state = freshState();
let blitz = null; // { cancelled } while blitz mode is running

// Circle editor state.
const editor = { selectedId: null, centeredId: null, drag: null, note: '' };

function freshState() {
  return { round: null, quizIndex: 0, target: null, revealed: false, tint: null, flash: false, locked: false };
}

// ---------- settings ----------

function loadSettings() {
  const defaults = { layoutId: null, key: 'D', mode: 'practice', difficulty: 'easy', view: 'photo', showDs: false };
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
const usePhoto = () => settings.view === 'photo' && !!layout.photo;
const editing = () => settings.mode === 'edit' && !!layout.photo;

// ---------- layouts & photo edits ----------

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function loadSpec(entry) {
  if (!specCache.has(entry.id)) specCache.set(entry.id, await fetchJson(`layouts/${entry.file}`));
  return specCache.get(entry.id);
}

function loadPhotoEdits(layoutId) {
  try {
    return JSON.parse(localStorage.getItem(PHOTO_EDITS_KEY(layoutId)) ?? 'null');
  } catch {
    return null;
  }
}

function savePhotoEdits(layoutId, buttons) {
  try {
    if (buttons) localStorage.setItem(PHOTO_EDITS_KEY(layoutId), JSON.stringify(buttons));
    else localStorage.removeItem(PHOTO_EDITS_KEY(layoutId));
  } catch {
    // Edits just won't survive a reload.
  }
}

// The layout file plus any circle edits saved in this browser.
function effectiveSpec(layoutId) {
  const spec = specCache.get(layoutId);
  const edits = spec.photo && loadPhotoEdits(layoutId);
  if (!edits) return spec;
  return { ...spec, photo: { ...spec.photo, buttons: { ...spec.photo.buttons, ...edits } } };
}

function rebuildLayout() {
  layout = buildLayout(effectiveSpec(settings.layoutId), 'layouts/');
}

async function selectLayout(entry) {
  await loadSpec(entry);
  settings.layoutId = entry.id;
  rebuildLayout();
  editor.selectedId = layout.buttons[0].id;
  editor.centeredId = null;
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

// ---------- circle editor ----------

function editedButtons() {
  const out = {};
  for (const [id, p] of layout.photo.points) out[id] = { x: Math.round(p.x), y: Math.round(p.y), r: round3(p.r) };
  return out;
}

const round3 = (v) => Math.round(v * 1000) / 1000;

function applyEdit(change) {
  const buttons = editedButtons();
  change(buttons);
  savePhotoEdits(settings.layoutId, buttons);
  rebuildLayout();
  render();
}

function moveSelected(dx, dy) {
  applyEdit((buttons) => {
    const p = buttons[editor.selectedId];
    p.x = Math.round(p.x + dx);
    p.y = Math.round(p.y + dy);
  });
}

function selectButton(id) {
  editor.selectedId = id;
  editor.note = '';
  render();
}

function stepSelection(delta) {
  const ids = layout.buttons.map((b) => b.id);
  const i = ids.indexOf(editor.selectedId);
  selectButton(ids[(i + delta + ids.length) % ids.length]);
}

function exportSpec() {
  const spec = specCache.get(settings.layoutId);
  return formatJson({ ...spec, photo: { ...spec.photo, buttons: editedButtons() } }) + '\n';
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(exportSpec());
    editor.note = 'Copied layout JSON to the clipboard';
  } catch {
    editor.note = "Couldn't copy here; use Download instead";
  }
  render();
}

function downloadJson() {
  const entry = layoutIndex.find((l) => l.id === settings.layoutId);
  const url = URL.createObjectURL(new Blob([exportSpec()], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = entry.file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetEdits() {
  if (!confirm('Discard your circle edits and go back to the layout file?')) return;
  savePhotoEdits(settings.layoutId, null);
  rebuildLayout();
  editor.centeredId = null;
  editor.note = 'Reset to the layout file';
  render();
}

// Converts a screen-pixel distance into photo pixels for the zoomed view.
function screenToPhotoScale() {
  const ctm = els.zoom.getScreenCTM();
  return ctm ? 1 / ctm.a : 1;
}

// ---------- rendering ----------

function render() {
  const edit = editing();
  const view = {
    box: edit ? null : state.round?.box,
    anchor: edit ? null : state.round?.anchor,
    target: edit ? null : state.target,
    key: key(),
    revealed: state.revealed,
    tint: state.tint,
    flash: state.flash,
    tilt: Number(settings.view) || 0,
    highlight: !edit && settings.showDs ? D_TONES : null,
  };

  if (edit || usePhoto()) {
    // Only re-centre the editor's zoom when the selection changes, so dragging is stable.
    const editView = edit && {
      selectedId: editor.selectedId,
      keepView: editor.centeredId === editor.selectedId,
    };
    drawPhoto(els.zoom, layout, { ...view, edit: editView });
    drawPhoto(els.mini, layout, { ...view, mini: true, edit: edit && { selectedId: editor.selectedId } });
    if (edit) editor.centeredId = editor.selectedId;
  } else {
    drawKeyboard(els.zoom, layout, view);
    drawKeyboard(els.mini, layout, { ...view, mini: true });
  }

  const practice = settings.mode === 'practice';
  els.wrong.hidden = !practice;
  els.right.hidden = !practice;
  els.blitzToggle.hidden = settings.mode !== 'blitz';
  els.blitzToggle.textContent = blitz ? 'Stop' : 'Start';
  els.progress.hidden = edit;
  els.editor.hidden = !edit;
  els.difficulty.closest('label').hidden = edit;
  els.key.closest('label').hidden = edit;
  els.view.closest('label').hidden = edit;
  els.dtone.closest('label').hidden = edit;
  // The main view shows the whole keyboard; the minimap only helps the zoomed editor.
  els.mini.toggleAttribute('hidden', !edit);
  els.stage.classList.toggle('editing', edit);

  els.answer.className = 'answer' + (state.tint ? ` ${state.tint}` : '');
  els.answer.replaceChildren();
  if (!edit && state.target && state.revealed) {
    const t = state.target;
    const note = document.createElement('span');
    note.className = 'answer-note';
    note.textContent = spell(noteOf(t), key());
    const dir = document.createElement('span');
    dir.className = 'answer-dir';
    dir.textContent = `${ARROW[t.dir]} ${t.dir}`;
    els.answer.append(note, dir);
  }

  if (edit) {
    renderEditorPanel();
    els.hint.textContent = editor.note || 'Drag to move the circle · tap a circle to select it';
  } else if (practice) {
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

function renderEditorPanel() {
  els.editButton.value = editor.selectedId;
  const r = layout.photo.points.get(editor.selectedId).r;
  els.editRadius.value = r;
  els.editRadiusValue.textContent = r.toFixed(3);
}

// ---------- input ----------

function bindInput() {
  let start = null;

  els.stage.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, targetId: e.target.closest?.('[data-id]')?.dataset.id };
    if (editing()) {
      const p = layout.photo.points.get(editor.selectedId);
      editor.drag = { x0: p.x, y0: p.y, scale: screenToPhotoScale(), moved: false };
      els.stage.setPointerCapture(e.pointerId);
    }
  });
  els.stage.addEventListener('pointermove', (e) => {
    if (!start || !editor.drag || !editing()) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!editor.drag.moved && Math.hypot(dx, dy) <= CONFIG.tapSlopPx) return;
    editor.drag.moved = true;
    const { x0, y0, scale } = editor.drag;
    const p = layout.photo.points.get(editor.selectedId);
    moveSelected(x0 + dx * scale - p.x, y0 + dy * scale - p.y);
  });
  els.stage.addEventListener('pointercancel', () => {
    start = null;
    editor.drag = null;
  });
  els.stage.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const { targetId } = start;
    start = null;
    if (editing()) {
      const moved = editor.drag?.moved;
      editor.drag = null;
      if (!moved && targetId && targetId !== editor.selectedId) selectButton(targetId);
      return;
    }
    if (Math.abs(dx) >= CONFIG.swipeThresholdPx && Math.abs(dx) > Math.abs(dy)) {
      mark(dx > 0);
    } else if (Math.hypot(dx, dy) <= CONFIG.tapSlopPx && settings.mode === 'practice') {
      reveal();
    }
  });

  els.wrong.addEventListener('click', () => mark(false));
  els.right.addEventListener('click', () => mark(true));
  els.blitzToggle.addEventListener('click', toggleBlitz);

  els.editButton.addEventListener('change', (e) => selectButton(e.target.value));
  els.editPrev.addEventListener('click', () => stepSelection(-1));
  els.editNext.addEventListener('click', () => stepSelection(1));
  els.editRadius.addEventListener('input', (e) =>
    applyEdit((buttons) => {
      buttons[editor.selectedId].r = round3(Number(e.target.value));
    }),
  );
  els.editRadiusAll.addEventListener('click', () => {
    const r = layout.photo.points.get(editor.selectedId).r;
    applyEdit((buttons) => Object.values(buttons).forEach((p) => (p.r = round3(r))));
    editor.note = `Size ${r.toFixed(3)} applied to every circle`;
    render();
  });
  els.editReset.addEventListener('click', resetEdits);
  els.editCopy.addEventListener('click', copyJson);
  els.editDownload.addEventListener('click', downloadJson);

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t instanceof HTMLSelectElement || t instanceof HTMLInputElement) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (editing()) {
      const step = e.shiftKey ? 10 : 1;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        moveSelected(...moves[e.key]);
      } else if (e.key === '[' || e.key === ']') {
        const delta = e.key === ']' ? 0.005 : -0.005;
        applyEdit((buttons) => {
          const p = buttons[editor.selectedId];
          p.r = round3(Math.max(0.1, p.r + delta));
        });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        stepSelection(e.shiftKey ? -1 : 1);
      }
      return;
    }
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
    if (name === 'layoutId') {
      await selectLayout(layoutIndex.find((l) => l.id === settings.layoutId));
      fillLayoutDependentSelects();
    }
    if (name === 'view') render();
    else restart();
  };
  els.layout.addEventListener('change', onSettingChange('layoutId'));
  els.key.addEventListener('change', onSettingChange('key'));
  els.mode.addEventListener('change', onSettingChange('mode'));
  els.difficulty.addEventListener('change', onSettingChange('difficulty'));
  els.view.addEventListener('change', onSettingChange('view'));
  els.dtone.addEventListener('change', (e) => {
    settings.showDs = e.target.checked;
    saveSettings();
    e.target.blur();
    render();
  });
}

function restart() {
  stopBlitz();
  state = freshState();
  editor.note = '';
  editor.centeredId = null;
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
  if (select.value !== String(value) && options.length) select.value = options[0][0];
  return select.value;
}

// Options that depend on whether the current layout has a photo.
function fillLayoutDependentSelects() {
  const hasPhoto = !!layout.photo;
  settings.view = fillSelect(els.view, VIEWS.filter(([v]) => hasPhoto || v !== 'photo'), settings.view);
  const modes = [['practice', 'Practice'], ['blitz', 'Blitz']];
  if (hasPhoto) modes.push(['edit', 'Edit circles']);
  settings.mode = fillSelect(els.mode, modes, settings.mode);
  fillSelect(els.editButton, layout.buttons.map((b) => [b.id, `${b.row}${b.number}`]), editor.selectedId);
}

async function init() {
  try {
    layoutIndex = await fetchJson('layouts/index.json');
    const entry = layoutIndex.find((l) => l.id === settings.layoutId) ?? layoutIndex[0];
    await Promise.all(layoutIndex.map(loadSpec));
    await selectLayout(entry);
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent =
      `Couldn't load layouts (${err.message}). ` +
      (location.protocol === 'file:' ? 'Serve the folder over HTTP, e.g. `python3 -m http.server`.' : '');
    return;
  }

  fillSelect(els.layout, layoutIndex.map((l) => [l.id, specCache.get(l.id).name ?? l.id]), settings.layoutId);
  els.layout.closest('label').hidden = layoutIndex.length < 2;
  fillSelect(els.key, KEYS.map((k) => [k.name, `${k.name} major`]), key().name);
  settings.difficulty = fillSelect(
    els.difficulty,
    Object.entries(DIFFICULTIES).map(([id, d]) => [id, d.label]),
    settings.difficulty,
  );
  fillLayoutDependentSelects();
  els.dtone.checked = !!settings.showDs;

  bindInput();
  restart();
}

init();
