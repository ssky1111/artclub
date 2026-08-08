/**
 * review.js — 間隔をあけた復習（Leitner の箱方式）。
 *
 * 復習する単位は「ドリル」ではなく「チェック項目」にしている。
 *   ✕「手のレッスンを7日後にもう一度」
 *   ○「"親指が側面から生えているか" を7日後にもう一度」
 * 描く行為そのものより先に、判断のルールが抜ける。抜けるものを直接ぶつけるほうが早い。
 *
 * 間隔は 1 / 3 / 7 / 14 / 30 日の粗い5箱。
 * Anki のような細かい計算をしないのは、あの間隔が語彙学習から出てきた数字で、
 * 描く技能でそのまま成立する根拠が無いため。粗い箱なら外しても害が小さい。
 *
 * 失敗したら箱1に戻す（間隔をリセットする）のが Leitner の要点。
 */

import { LESSONS, lessonById } from './anatomy.js';
import { getCards, saveCards, dateKey, addDays } from './storage.js';

/** 箱ごとの「次に出るまでの日数」 */
export const BOX_DAYS = [1, 3, 7, 14, 30];
export const GRADUATED = BOX_DAYS.length + 1;   // 箱5を正解したら卒業

export function cardId(lessonId, index) {
  return `${lessonId}:${index}`;
}

/**
 * レッスンのチェック項目をカードにして登録する（すでにあるものは触らない）。
 * due を today にすると「今日から復習対象」になる。
 */
export function ensureLessonCards(lessonId, { due = dateKey() } = {}) {
  const lesson = lessonById(lessonId);
  if (!lesson) return [];
  const cards = getCards();
  let changed = false;

  lesson.checks.forEach((text, index) => {
    const id = cardId(lessonId, index);
    if (cards[id]) {
      // 文言を後から直したときのために本文だけ追従させる
      if (cards[id].text !== text) { cards[id].text = text; changed = true; }
      return;
    }
    cards[id] = { id, lessonId, text, box: 1, due, correct: 0, wrong: 0, lastSeen: null };
    changed = true;
  });

  if (changed) saveCards(cards);
  return lesson.checks.map((_, i) => getCards()[cardId(lessonId, i)]);
}

export function cardsForLesson(lessonId) {
  return Object.values(getCards()).filter((c) => c.lessonId === lessonId);
}

/** 期限が来ている（＝due が今日以前の）カード。卒業したものは出さない。 */
export function dueCards(today = dateKey()) {
  return Object.values(getCards())
    .filter((c) => c.box <= BOX_DAYS.length && c.due <= today)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.box - b.box));
}

/** 部位ごとの期限切れ枚数。多い順。 */
export function dueByLesson(today = dateKey()) {
  const counts = new Map();
  for (const card of dueCards(today)) {
    counts.set(card.lessonId, (counts.get(card.lessonId) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([lessonId, count]) => ({ lesson: lessonById(lessonId), count }))
    .filter((row) => row.lesson)
    .sort((a, b) => b.count - a.count);
}

/** いま最も溜まっている部位。無ければ null。 */
export function weakestLesson(today = dateKey()) {
  return dueByLesson(today)[0]?.lesson || null;
}

/**
 * 採点。できていれば次の箱へ、落としたら箱1に戻して翌日また出す。
 */
export function grade(id, ok, today = dateKey()) {
  const cards = getCards();
  const card = cards[id];
  if (!card) return null;

  if (ok) {
    card.box = Math.min(card.box + 1, GRADUATED);
    card.correct++;
  } else {
    card.box = 1;
    card.wrong++;
  }
  card.lastSeen = today;
  card.due = card.box > BOX_DAYS.length
    ? addDays(today, 365)                       // 卒業したものは実質出さない
    : addDays(today, BOX_DAYS[card.box - 1]);

  saveCards(cards);
  return card;
}

/** 練習前に1行だけ出す「前回の宿題」。いちばん多く落としている項目を選ぶ。 */
export function reminderFor(lessonId, today = dateKey()) {
  const due = dueCards(today).filter((c) => !lessonId || c.lessonId === lessonId);
  if (!due.length) return null;
  const worst = due.reduce((a, b) => (b.wrong > a.wrong ? b : a));
  return worst.wrong > 0 ? `前回できなかった：${worst.text}` : `今日の狙い：${worst.text}`;
}

/**
 * 期限が来ている部位のドリルを、いつものメニューに1本だけ差し込む。
 * 「復習」という別画面のタスクにすると、まずやらなくなるので、
 * ふだんのメニューを押しただけで苦手が混ざってくるようにする。
 */
export function injectWeakStep(menu, lesson) {
  if (!lesson) return menu;
  const step = { drill: 'landmark', source: `weak:${lesson.id}`, count: 2, seconds: 60 };
  // ウォームアップの直後に入れる（手が温まる前に苦手をやっても崩れるだけなので）
  const steps = [...menu.steps];
  const insertAt = Math.min(1, steps.length);
  steps.splice(insertAt, 0, step);
  return { ...menu, steps, weakLessonId: lesson.id };
}

/** 復習だけをやるメニュー。 */
export function buildReviewMenu(lesson) {
  return {
    id: `review-${lesson.id}`,
    title: `${lesson.name}の復習`,
    weakLessonId: lesson.id,
    steps: [
      { drill: 'landmark', source: `weak:${lesson.id}`, count: 2, seconds: 60 },
      { drill: 'gesture',  source: `weak:${lesson.id}`, count: 3, seconds: 30 },
      { drill: 'memory',   source: `weak:${lesson.id}`, count: 1, seconds: 120 },
    ],
  };
}

/** 今後2週間、どの日に何枚出るか。記録画面用。 */
export function upcoming(days = 14, today = dateKey()) {
  const cards = Object.values(getCards()).filter((c) => c.box <= BOX_DAYS.length);
  const rows = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const count = cards.filter((c) => (i === 0 ? c.due <= day : c.due === day)).length;
    rows.push({ day, count });
  }
  return rows;
}

export function cardStats() {
  const cards = Object.values(getCards());
  return {
    total: cards.length,
    due: dueCards().length,
    graduated: cards.filter((c) => c.box > BOX_DAYS.length).length,
    byBox: BOX_DAYS.map((_, i) => cards.filter((c) => c.box === i + 1).length),
  };
}

/** 設定で「苦手」に選ばれた部位のカードを、今日から出るように用意する。 */
export function syncWeakParts(weakParts = []) {
  for (const lessonId of weakParts) ensureLessonCards(lessonId, { due: dateKey() });
  return dueCards();
}

export const ALL_LESSONS = LESSONS;
