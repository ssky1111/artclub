/**
 * storage.js — 設定・練習履歴・復習カード・ゲーム状態。
 *
 * 端末には残さない。メモリ上で持ち、ログイン中は Supabase に書き通す。
 * （認証トークンなど技術必須の保存は auth.js 側）
 */

import { getUser } from './auth.js';
import {
  fetchUserPrefs,
  upsertUserPrefs,
  fetchPracticeSessions,
  upsertPracticeSession,
  upsertPracticeSessions,
} from './usercloud.js';

const LEGACY_SETTINGS = 'croqui.settings.v1';
const LEGACY_HISTORY = 'croqui.history.v1';
const LEGACY_CARDS = 'croqui.cards.v1';
const LEGACY_GAME = 'croqui.game.v1';
const LEGACY_LANG = 'drawpamine.lang';

const DEFAULT_SETTINGS = {
  source: 'picsum',          // 'unsplash' | 'picsum' | 'local'
  unsplashKey: '',
  categories: ['pose', 'dance', 'sitting', 'hands'],
  weakParts: [],
  theme: 'light',
  skin: 'default',
  sound: true,
  sfx: true,
  autoFlip: false,
  keepAwake: true,
  orientation: 'any',
  penAlpha: 0.9,
  hintOpen: true,
  skinDefaultV2: 1,
  skinDefaultV3: 1,
  /** 公開時の「全て模写OK」初期値（ログイン後は prefs に保存） */
  defaultAllowCopy: true,
};

let settingsCache = { ...DEFAULT_SETTINGS };
let historyCache = [];
let cardsCache = {};
let gameCache = {};
let hydratePromise = null;
let prefsTimer = 0;
let pendingPrefs = null;

function readLegacy(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function clearLegacyKeys() {
  try {
    localStorage.removeItem(LEGACY_SETTINGS);
    localStorage.removeItem(LEGACY_HISTORY);
    localStorage.removeItem(LEGACY_CARDS);
    localStorage.removeItem(LEGACY_GAME);
    localStorage.removeItem(LEGACY_LANG);
    localStorage.removeItem('artclub.username');
  } catch { /* */ }
}

/** 旧端末データを一度だけメモリへ取り込み（クラウド未整備時の救済）。 */
function absorbLegacyLocal() {
  const rawSettings = readLegacy(LEGACY_SETTINGS, null);
  if (rawSettings && typeof rawSettings === 'object') {
    settingsCache = { ...DEFAULT_SETTINGS, ...rawSettings, skinDefaultV2: 1, skinDefaultV3: 1 };
  }
  const hist = readLegacy(LEGACY_HISTORY, null);
  if (Array.isArray(hist) && hist.length) historyCache = hist.slice(-1000);
  const cards = readLegacy(LEGACY_CARDS, null);
  if (cards && typeof cards === 'object') cardsCache = cards;
  const game = readLegacy(LEGACY_GAME, null);
  if (game && typeof game === 'object') gameCache = game;
  try {
    const lang = localStorage.getItem(LEGACY_LANG);
    if (lang === 'ja' || lang === 'en') return lang;
  } catch { /* */ }
  return null;
}

function flushPrefs() {
  prefsTimer = 0;
  const patch = pendingPrefs;
  pendingPrefs = null;
  if (!patch || !getUser()) return;
  upsertUserPrefs(patch).catch((err) => console.error('[prefs sync]', err));
}

function schedulePrefsSync(patch) {
  pendingPrefs = { ...(pendingPrefs || {}), ...patch };
  if (!getUser()) return;
  clearTimeout(prefsTimer);
  prefsTimer = setTimeout(flushPrefs, 350);
}

function syncSession(entry) {
  if (!entry?.id || !getUser()) return Promise.resolve();
  return upsertPracticeSession(entry).catch((err) => {
    console.error('[session sync]', err);
  });
}

/** 練習終了直後など、クラウド反映を待ちたいとき用 */
export async function syncSessionNow(entry) {
  if (!entry?.id || !getUser()) return;
  await upsertPracticeSession(entry);
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...settingsCache };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  settingsCache = next;
  schedulePrefsSync({ settings: next });
  return next;
}

export function getHistory() {
  return Array.isArray(historyCache) ? historyCache : [];
}

export function addSession(entry) {
  const list = getHistory();
  list.push(entry);
  historyCache = list.slice(-1000);
  void syncSession(entry);
  return entry;
}

export function updateLastSession(patch) {
  const list = getHistory();
  if (!list.length) return null;
  list[list.length - 1] = { ...list[list.length - 1], ...patch };
  historyCache = list;
  syncSession(list[list.length - 1]);
  return list[list.length - 1];
}

export function getCards() {
  return cardsCache && typeof cardsCache === 'object' ? { ...cardsCache } : {};
}

export function saveCards(cards) {
  cardsCache = cards && typeof cards === 'object' ? cards : {};
  schedulePrefsSync({ cards: cardsCache });
  return cardsCache;
}

export function getGameState() {
  return gameCache && typeof gameCache === 'object' ? { ...gameCache } : {};
}

export function saveGameState(patch) {
  gameCache = { ...getGameState(), ...patch };
  schedulePrefsSync({ game: gameCache });
  return gameCache;
}

export function clearAll() {
  settingsCache = { ...DEFAULT_SETTINGS };
  historyCache = [];
  cardsCache = {};
  gameCache = {};
  pendingPrefs = null;
  clearTimeout(prefsTimer);
}

/** ログアウト時：別アカウントのデータを画面に残さない */
export function resetUserCaches() {
  clearAll();
}

/**
 * ログイン後にクラウドから復元。旧 localStorage があれば一度だけ吸い上げて上げる。
 * @returns {{ lang: string|null }}
 */
export async function hydrateUserData() {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    // ログアウト中はアカウントデータをメモリに載せない（周回数などが残って見えるのを防ぐ）
    // 旧 localStorage はログイン時に移行するので、ここでは消さない
    if (!getUser()) {
      clearAll();
      return { lang: null };
    }

    const legacyLang = absorbLegacyLocal();
    const hadLegacy = !!(
      readLegacy(LEGACY_HISTORY, null)?.length
      || readLegacy(LEGACY_SETTINGS, null)
      || readLegacy(LEGACY_CARDS, null)
      || readLegacy(LEGACY_GAME, null)
      || legacyLang
    );

    const [prefs, sessions] = await Promise.all([
      fetchUserPrefs().catch(() => null),
      fetchPracticeSessions().catch((err) => {
        console.error('[sessions fetch]', err);
        return null;
      }),
    ]);

    if (!getUser()) return { lang: null };

    if (prefs?.settings && typeof prefs.settings === 'object') {
      settingsCache = { ...DEFAULT_SETTINGS, ...prefs.settings };
    }
    if (prefs?.cards && typeof prefs.cards === 'object') {
      cardsCache = prefs.cards;
    }
    if (prefs?.game && typeof prefs.game === 'object') {
      gameCache = prefs.game;
    }

    if (Array.isArray(sessions)) {
      if (sessions.length) {
        const byId = new Map(historyCache.map((e) => [e.id, e]));
        for (const s of sessions) {
          if (!s?.id) continue;
          const prev = byId.get(s.id);
          byId.set(s.id, prev ? { ...prev, ...s } : s);
        }
        historyCache = [...byId.values()]
          .sort((a, b) => (a.ts || 0) - (b.ts || 0))
          .slice(-1000);
      }
    } else if (getUser() && !historyCache.length) {
      console.warn('[hydrate] practice_sessions fetch failed; keeping empty history');
    }

    // 初回ログイン or 移行分をクラウドへ（prefs 行が無ければ必ず作る）
    if (!prefs || hadLegacy || historyCache.length) {
      try {
        await upsertUserPrefs({
          settings: getSettings(),
          cards: getCards(),
          game: getGameState(),
          lang: prefs?.lang || legacyLang || 'ja',
        });
      } catch (err) {
        console.error('[prefs migrate]', err);
      }
      if (historyCache.length) {
        try {
          await upsertPracticeSessions(historyCache);
        } catch (err) {
          console.error('[sessions migrate]', err);
        }
      }
    }

    clearLegacyKeys();
    return { lang: prefs?.lang || legacyLang || null };
  })().finally(() => { hydratePromise = null; });
  return hydratePromise;
}

export function dateKey(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

export function recentReviewNotes(days = 7, history = getHistory()) {
  const today = dateKey();
  const from = addDays(today, -(days - 1));
  return history
    .filter((h) => h?.note && typeof h.note === 'string' && h.note.trim()
      && h.date && h.date >= from && h.date <= today)
    .map((h) => ({
      date: h.date,
      note: h.note.trim(),
      title: h.menuTitle || null,
    }))
    .reverse();
}

export function dailyTotals(history = getHistory()) {
  const map = new Map();
  for (const s of history) {
    map.set(s.date, (map.get(s.date) || 0) + (s.seconds || 0));
  }
  return map;
}

export function drawingsByDay(history = getHistory()) {
  const map = new Map();
  for (const s of history) {
    map.set(s.date, (map.get(s.date) || 0) + (s.drawingCount || 0));
  }
  return map;
}

export function totalDrawings(history = getHistory()) {
  return history.reduce((sum, s) => sum + (s.drawingCount || 0), 0);
}

function sessionHasDrawing(s) {
  return !!(s && (s.hasDrawing || Number(s.drawingCount) > 0));
}

export function roundsToday(menuId = 'daily', history = getHistory()) {
  const today = dateKey();
  // 1枚でも保存したら1周。1枚目の途中やめ（0枚）は数えない
  return history.filter((s) => s.date === today && s.menuId === menuId && sessionHasDrawing(s)).length;
}

/** これまでに描いたお題写真の id 集合（未実施優先キュー用）。 */
export function seenPhotoIds(history = getHistory()) {
  const ids = new Set();
  for (const entry of history || []) {
    for (const shot of entry.shots || []) {
      if (shot?.photoId) ids.add(shot.photoId);
    }
  }
  return ids;
}

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
