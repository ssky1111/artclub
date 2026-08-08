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
 * という線を引いている。XPもバッジも「やったことの言い換え」でしかなく、
 * 全部が履歴から計算で出る（別腹の残高を持たない）。
 *
 * 自己決定理論でいう「有能感」と「自律性」だけを狙い、「関係性」（＝他人と比べる）
 * には手を出さない。1人で描く練習に競争を持ち込むと、下手な日にやめる理由になるため。
 */

import { getHistory, dailyTotals, dateKey, addDays, stats } from './storage.js';
import { getCards } from './storage.js';
import { dueCards } from './review.js';
import { DRILLS } from './theory.js';
import { LESSONS } from './anatomy.js';

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

/* ==================== バッジ ==================== */

const BADGE_DEFS = [
  { id: 'first',     icon: '🌱', name: 'はじめの1枚',   desc: '最初のセッションを終えた',
    test: (c) => c.sessions >= 1 },
  { id: 'streak3',   icon: '🔥', name: '3日続いた',      desc: '3日連続で練習した',
    test: (c) => c.streak >= 3 },
  { id: 'streak7',   icon: '🔥', name: '1週間続いた',    desc: '7日連続で練習した',
    test: (c) => c.streak >= 7 },
  { id: 'streak30',  icon: '👑', name: '1か月続いた',    desc: '30日連続で練習した',
    test: (c) => c.streak >= 30 },
  { id: 'hour1',     icon: '⏳', name: '通算1時間',      desc: '合計60分描いた',
    test: (c) => c.minutes >= 60 },
  { id: 'hour10',    icon: '🏆', name: '通算10時間',     desc: '合計600分描いた',
    test: (c) => c.minutes >= 600 },
  { id: 'allDrills', icon: '🎲', name: 'ぜんぶ試した',   desc: '全ドリルを1回ずつやった',
    test: (c) => c.drillsTried >= Object.keys(DRILLS).length },
  { id: 'lesson1',   icon: '🦴', name: '構造を知った',   desc: '解剖レッスンの練習を1つ終えた',
    test: (c) => c.lessonsDone >= 1 },
  { id: 'lessonAll', icon: '🧠', name: '3部位を回した',  desc: '全部位のレッスンを練習した',
    test: (c) => c.lessonsDone >= LESSONS.length },
  { id: 'graduate',  icon: '🎓', name: 'はじめての卒業', desc: '復習カードを1枚卒業させた',
    test: (c) => c.graduated >= 1 },
  { id: 'comeback',  icon: '🌤', name: 'おかえり',       desc: '3日以上あけてから再開した',
    test: (c) => c.comeback },
  { id: 'night',     icon: '🌙', name: '夜ふかし',       desc: '0時〜4時に練習した',
    test: (c) => c.lateNight },
];

function collectContext(history = getHistory()) {
  const s = stats(history);
  const cards = Object.values(getCards());
  const drillsTried = new Set(history.flatMap((h) => Object.keys(h.byDrill || {})));
  const lessons = new Set(history.filter((h) => h.lessonMode === 'lesson').map((h) => h.lessonId));

  // 3日以上あいてから再開した形跡があるか
  const days = [...dailyTotals(history).keys()].sort();
  let comeback = false;
  for (let i = 1; i < days.length; i++) {
    const gap = (new Date(days[i]) - new Date(days[i - 1])) / 86400000;
    if (gap >= 4) { comeback = true; break; }
  }

  const lateNight = history.some((h) => {
    const hour = new Date(h.ts || 0).getHours();
    return hour >= 0 && hour < 4;
  });

  return {
    sessions: s.sessions,
    minutes: s.minutes,
    streak: graceStreak(history).streak,
    drillsTried: drillsTried.size,
    lessonsDone: lessons.size,
    graduated: cards.filter((c) => c.box > 5).length,
    comeback,
    lateNight,
  };
}

export function badges(history = getHistory()) {
  const ctx = collectContext(history);
  return BADGE_DEFS.map((b) => ({ ...b, earned: !!b.test(ctx) }));
}

function readGame() {
  try { return JSON.parse(localStorage.getItem(GAME_KEY) || '{}') || {}; } catch { return {}; }
}

function writeGame(value) {
  try { localStorage.setItem(GAME_KEY, JSON.stringify(value)); } catch { /* 容量切れは無視 */ }
}

/**
 * まだ祝っていないバッジを返し、同時に「祝った」印をつける。
 * 見せる側は、返ってきたものを出すだけでいい。
 */
export function takeNewBadges(history = getHistory()) {
  const game = readGame();
  const seen = new Set(game.seenBadges || []);
  const fresh = badges(history).filter((b) => b.earned && !seen.has(b.id));
  if (fresh.length) {
    writeGame({ ...game, seenBadges: [...seen, ...fresh.map((b) => b.id)] });
  }
  return fresh;
}

/** 初回起動でいきなり全部お祝いが出ないよう、既存の達成は黙って既読にする。 */
export function primeBadges(history = getHistory()) {
  const game = readGame();
  if (game.seenBadges) return;
  writeGame({ ...game, seenBadges: badges(history).filter((b) => b.earned).map((b) => b.id) });
}

/** レベルアップの検知も同じやり方（前回見せたレベルを覚えておくだけ）。 */
export function takeLevelUp(xp = totalXp()) {
  const game = readGame();
  const level = levelFromXp(xp);
  if (game.seenLevel == null) { writeGame({ ...game, seenLevel: level }); return null; }
  if (level > game.seenLevel) { writeGame({ ...game, seenLevel: level }); return level; }
  return null;
}

/* ==================== 今日のクエスト ==================== */

/**
 * 今日やることを3つだけ。全部その日のうちに終わる大きさにしてある。
 * 終わらない目標を並べると、達成できないことに慣れてしまうので。
 */
export function dailyQuests(history = getHistory()) {
  const today = dateKey();
  const todaySeconds = dailyTotals(history).get(today) || 0;
  const cards = Object.values(getCards());
  const due = dueCards().length;

  return [
    {
      id: 'practice',
      icon: '✏️',
      title: '今日ひとセット',
      detail: '3分でもいい',
      done: todaySeconds > 0,
    },
    {
      id: 'ten',
      icon: '⏱',
      title: '10分ためる',
      detail: `${Math.min(10, Math.floor(todaySeconds / 60))} / 10 分`,
      done: todaySeconds >= 600,
      ratio: Math.min(1, todaySeconds / 600),
    },
    {
      // 中の仕組み（間隔をあけた再出題）は見せず、「にがてを直す」とだけ言う
      id: 'review',
      icon: '🎯',
      title: cards.length ? 'にがてに手をつける' : 'にがてな部位をえらぶ',
      detail: cards.length ? (due ? `あと ${due} か所` : 'きょうのぶんは完了') : '設定からえらべます',
      done: cards.length > 0 && due === 0,
    },
  ];
}

export function resetGame() {
  localStorage.removeItem(GAME_KEY);
}
