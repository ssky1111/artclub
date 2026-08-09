/**
 * storage.js — 設定と練習履歴。全部この端末のlocalStorageに入る。サーバーは無い。
 */

const SETTINGS_KEY = 'croqui.settings.v1';
const HISTORY_KEY = 'croqui.history.v1';
const CARDS_KEY = 'croqui.cards.v1';

const DEFAULT_SETTINGS = {
  source: 'picsum',          // 'unsplash' | 'picsum' | 'local'
  unsplashKey: '',
  categories: ['pose', 'dance', 'sitting', 'hands'],   // 人物を描きたい人が大半なので
  weakParts: [],             // 苦手だと申告した部位（レッスンID）
  theme: 'light',            // 'light' | 'dark' | 'paper'
  sound: true,
  sfx: true,
  autoFlip: false,
  keepAwake: true,
  orientation: 'any',
  penAlpha: 0.6,              // キャンバスの線の濃さ（0.1〜1）
  hintOpen: true,            // 描いている最中の手順ヒントを開いておくか
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write(SETTINGS_KEY, next);
  return next;
}

/** 履歴は新しい順ではなく、追加順（古い→新しい）で持つ。 */
export function getHistory() {
  const list = read(HISTORY_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function addSession(entry) {
  const list = getHistory();
  list.push(entry);
  // 端末の容量を圧迫しないよう、直近1000件だけ残す
  write(HISTORY_KEY, list.slice(-1000));
  return entry;
}

export function updateLastSession(patch) {
  const list = getHistory();
  if (!list.length) return null;
  list[list.length - 1] = { ...list[list.length - 1], ...patch };
  write(HISTORY_KEY, list);
  return list[list.length - 1];
}

/* ---------- 復習カード ---------- */

export function getCards() {
  const cards = read(CARDS_KEY, {});
  return cards && typeof cards === 'object' ? cards : {};
}

export function saveCards(cards) {
  write(CARDS_KEY, cards);
  return cards;
}

export function clearAll() {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(CARDS_KEY);
}

/* ---------- 日付ユーティリティ ---------- */

export function dateKey(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

/* ---------- 集計 ---------- */

/** 日付 -> その日の練習秒数 */
export function dailyTotals(history = getHistory()) {
  const map = new Map();
  for (const s of history) {
    map.set(s.date, (map.get(s.date) || 0) + (s.seconds || 0));
  }
  return map;
}

/** 日付 -> その日に描いた枚数 */
export function drawingsByDay(history = getHistory()) {
  const map = new Map();
  for (const s of history) {
    map.set(s.date, (map.get(s.date) || 0) + (s.drawingCount || 0));
  }
  return map;
}

/** 通算で描いた枚数。レベルの横に出す。 */
export function totalDrawings(history = getHistory()) {
  return history.reduce((sum, s) => sum + (s.drawingCount || 0), 0);
}

/** 今日そのメニューを何周したか。デイリーの「完了 / 1周」に使う。 */
export function roundsToday(menuId = 'daily', history = getHistory()) {
  const today = dateKey();
  return history.filter((s) => s.date === today && s.menuId === menuId).length;
}

/** 今日（まだ未練習なら昨日）から遡って連続日数を数える。 */
export function currentStreak(history = getHistory()) {
  const days = dailyTotals(history);
  const today = dateKey();
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function bestStreak(history = getHistory()) {
  const days = [...dailyTotals(history).keys()].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

export function stats(history = getHistory()) {
  const seconds = history.reduce((sum, s) => sum + (s.seconds || 0), 0);
  const byDrill = new Map();
  for (const s of history) {
    for (const [drillId, sec] of Object.entries(s.byDrill || {})) {
      byDrill.set(drillId, (byDrill.get(drillId) || 0) + sec);
    }
  }
  return {
    sessions: history.length,
    seconds,
    minutes: Math.round(seconds / 60),
    streak: currentStreak(history),
    best: bestStreak(history),
    byDrill,
  };
}
