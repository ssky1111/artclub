/**
 * game.js — 続けたくなるための仕掛け。
 *
 * ゲーミフィケーションは入れ方を間違えると逆効果になる。
 * 外から報酬を与えると、もともとあった「描きたい」が報酬目当てに置き換わって、
 * 報酬を止めた瞬間にやらなくなる（アンダーマイニング効果 / Deci 1971）。
 *
 * なので、このアプリでは
 *   入れる  … 進捗の可視化・有能感（伸びているのが見える）・達成の記録
 *   入れない… ガチャ、ランダム報酬、他人との順位、通貨、失うと痛い資産
 * という線を引いている。XPも連続日数も「やったことの言い換え」でしかなく、
 * 全部が履歴から計算で出る（別腹の残高を持たない）。
 *
 * 自己決定理論でいう「有能感」と「自律性」だけを狙い、「関係性」（＝他人と比べる）
 * には手を出さない。1人で描く練習に競争を持ち込むと、下手な日にやめる理由になるため。
 */

import { getHistory, dailyTotals, dateKey, addDays, getCards } from './storage.js';

const GAME_KEY = 'croqui.game.v1';

/* ==================== XP ==================== */

/** レベルの境界。上に行くほど間隔が広がる。 */
export const LEVEL_XP = [0, 200, 600, 1400, 2800, 5000, 8000, 12000, 18000, 26000];

/**
 * XPは全部あとから計算で出す。どこかに残高を貯めないので、ズレようがない。
 *   練習1分 = 10XP / その日の最初の1回 = +20XP / 復習カード1枚正解 = +5XP
 */
export function totalXp(history = getHistory()) {
  const minutes = history.reduce((sum, s) => sum + (s.seconds || 0), 0) / 60;
  const days = dailyTotals(history).size;
  const correct = Object.values(getCards()).reduce((sum, c) => sum + (c.correct || 0), 0);
  return Math.round(minutes * 10 + days * 20 + correct * 5);
}

export function levelFromXp(xp) {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) level = i + 1;
  return level;
}

/** 次のレベルまでの進み具合。ホームのバー用。 */
export function levelProgress(xp = totalXp()) {
  const level = levelFromXp(xp);
  const floor = LEVEL_XP[level - 1] ?? 0;
  const ceil = LEVEL_XP[level] ?? floor + 10000;
  return {
    level,
    xp,
    into: xp - floor,
    need: ceil - floor,
    ratio: Math.min(1, (xp - floor) / (ceil - floor)),
    toNext: Math.max(0, ceil - xp),
  };
}

/* ==================== ストリーク ==================== */

/**
 * 週に1日は休んでも途切れないストリーク。
 *
 * 「1日でも休んだら0に戻る」は、続いている間は効くが、切れた瞬間に
 * 戻ってこなくなる（もう取り返せないので）。継続そのものが目的なら、
 * 途切れにくいほうが正しい。7日につき1日の空きまでは許す。
 */
export function graceStreak(history = getHistory()) {
  const days = dailyTotals(history);
  const today = dateKey();
  let cursor = days.has(today) ? today : addDays(today, -1);
  if (!days.has(cursor)) {
    // 昨日もやっていない。一昨日までやっていたなら「休み1日」として繋ぐ
    const before = addDays(cursor, -1);
    if (!days.has(before)) return { streak: 0, restDays: 0 };
    cursor = before;
  }

  let streak = 0;
  let restDays = 0;
  let sinceRest = 0;

  while (true) {
    if (days.has(cursor)) {
      streak++;
      sinceRest++;
      cursor = addDays(cursor, -1);
      continue;
    }
    // 空いている日。直近7日のうちまだ休みを使っていなければ繋ぐ
    const prev = addDays(cursor, -1);
    if (sinceRest >= 1 && days.has(prev) && restDays < Math.ceil(streak / 6)) {
      restDays++;
      sinceRest = 0;
      cursor = prev;
      continue;
    }
    break;
  }
  return { streak, restDays };
}

/** 最長記録も同じ「週1日は休んでいい」ルールで数える（現在より最長が短いと変なので）。 */
export function bestGraceStreak(history = getHistory()) {
  const days = [...dailyTotals(history).keys()].sort();
  let best = 0;
  let run = 0;
  let rests = 0;
  let prev = null;

  for (const day of days) {
    const gap = prev ? Math.round((new Date(day) - new Date(prev)) / 86400000) : null;
    if (gap === 1) {
      run++;
    } else if (gap === 2 && rests < Math.ceil(run / 6)) {
      rests++;               // 1日空いたが、休みとして繋ぐ
      run++;
    } else {
      run = 1;
      rests = 0;
    }
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

/* ==================== お祝いの記録 ==================== */

/*
 * バッジは外した。
 * 「3日続いた」「夜ふかし」のようなご褒美は、描いた内容と何の関係も無いので、
 * 集める対象が絵からバッジに移ってしまう（アンダーマイニング効果）。
 * 残したのは、やったことの言い換えでしかないレベルと連続日数だけ。
 */

function readGame() {
  try { return JSON.parse(localStorage.getItem(GAME_KEY) || '{}') || {}; } catch { return {}; }
}

function writeGame(value) {
  try { localStorage.setItem(GAME_KEY, JSON.stringify(value)); } catch { /* 容量切れは無視 */ }
}



/** レベルアップの検知も同じやり方（前回見せたレベルを覚えておくだけ）。 */
export function takeLevelUp(xp = totalXp()) {
  const game = readGame();
  const level = levelFromXp(xp);
  if (game.seenLevel == null) { writeGame({ ...game, seenLevel: level }); return null; }
  if (level > game.seenLevel) { writeGame({ ...game, seenLevel: level }); return level; }
  return null;
}

export function resetGame() {
  localStorage.removeItem(GAME_KEY);
}
