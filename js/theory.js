/**
 * theory.js — 練習メニューの中身と、その根拠。
 *
 * このアプリは「毎日やる気を出す」ことではなく、
 * 「やる気が無い日でも1分で始められて、始めたら勝手に効く練習になっている」ことを狙っている。
 * ドリルの選定と時間配分は下の 5 つの考えに基づく。
 */

export const PRINCIPLES = [
  {
    id: 'deliberate',
    title: '意図的な練習（deliberate practice）',
    body: 'ただ枚数を描いても伸びない。「今日はこれを見る」という具体的な狙いを1つに絞り、直後にふりかえる。' +
          'だから毎セッションに観察テーマが1つだけ付き、終わりに20秒の自己レビューが入る。',
    source: 'K. Anders Ericsson『Peak』',
  },
  {
    id: 'habit',
    title: '小さく始める（habit formation）',
    body: '習慣は「開始の摩擦」で死ぬ。最短メニューを3分にし、ワンタップで画像が出てタイマーが走る。' +
          '連続日数と積み上げグラフは、続けること自体を報酬にするため。',
    source: 'BJ Fogg『Tiny Habits』/ James Clear『Atomic Habits』',
  },
  {
    id: 'perception',
    title: '観察を5つの技能に分解する',
    body: '「絵が下手」は1つの問題ではなく、輪郭・空間（ネガティブスペース）・比率と角度・明暗・全体の把握、' +
          'という別々の技能の集合。ドリルはこの5つに1対1で対応している。',
    source: 'Betty Edwards『Drawing on the Right Side of the Brain』',
  },
  {
    id: 'gesture',
    title: '形より先に、動きと重心',
    body: '短時間のジェスチャーは「速く描く練習」ではなく、細部を諦めさせて全体の流れ・重心・シルエットを' +
          '先に掴ませるための制約。だからウォームアップは必ず30秒前後から入る。',
    source: 'Michael Hampton / Mike Mattesi『FORCE』',
  },
  {
    id: 'construct',
    title: '観察だけでは描けない部位がある',
    body: '手や脚が描けないのは、観察力ではなく知識の問題。表面の下に何が入っているかを知らないと、' +
          '目は見ているのに「いつもの下手な手」という記号に翻訳してしまう。' +
          'だから解剖レッスンでは、筋肉の名前ではなく「塊への置き換え」と「骨のでっぱり」だけを扱う。',
    source: 'George B. Bridgman『Constructive Anatomy』(1920)',
  },
  {
    id: 'spacing',
    title: '間隔をあけて戻す',
    body: '一度できたことは必ず抜ける。抜けかけた頃にもう一度やると、そこで初めて定着する。' +
          'ただし復習を別のタスクにすると誰もやらないので、期限の来た項目をふだんのメニューに混ぜている。' +
          '間隔をあける単位は「ドリル」ではなく「チェック項目」。抜けるのは手ではなく判断のルールだから。',
    source: '間隔効果 / 分散練習・テスト効果（Ebbinghaus, Cepeda et al. 2006, Roediger & Karpicke 2006）',
  },
  {
    id: 'interleave',
    title: '混ぜる・少しずつ重くする',
    body: '同じドリルだけを続けると上達が頭打ちになる（ブロック練習の罠）。1セッションに性質の違うドリルを' +
          '混ぜ、回数に応じて時間と難度が自動で上がる。',
    source: 'interleaving / progressive overload',
  },
];

/** 今日の観察テーマ。日付で決まるので、同じ日は何回やっても同じテーマ。 */
export const FOCUSES = [
  { id: 'gravity', title: '重心はどこにあるか', desc: '足元・お尻・接地点に体重が乗っている場所を、線を引く前に決める。' },
  { id: 'silhouette', title: 'シルエットで判別できるか', desc: '塗りつぶしても何か分かる形になっているか。輪郭の凹凸を意識する。' },
  { id: 'ratio', title: '大きさの比率', desc: '頭1個分を単位にして、全体が何個分かを先に測る。細部はその後。' },
  { id: 'angle', title: '線の傾き', desc: '肩・腰・机の縁——水平だと思い込んだ線は、たいてい傾いている。' },
  { id: 'value', title: '明暗は3段階', desc: '暗・中・明のどれかに全部を仕分ける。中間色を増やさない。' },
  { id: 'rhythm', title: '直線と曲線の交代', desc: '片側が曲がっていたら反対側は直線気味に。全部を曲げない。' },
  { id: 'negative', title: 'すき間の形', desc: '腕と胴の間、脚と脚の間。「物」ではなく「空いている形」を見る。' },
];

/**
 * ドリル定義。
 * view: 画像の見せ方を変えることでその技能だけを強制的に使わせる。
 */
export const DRILLS = {
  gesture: {
    id: 'gesture',
    name: 'ジェスチャー',
    theory: '細部を描く時間を奪うことで、全体の流れと重心だけに注意を向けさせる。',
    cue: 'まず1本の線で「動きの流れ」を引く。輪郭は追わない。',
    view: {},
    weight: 'warmup',
  },
  squint: {
    id: 'squint',
    name: 'シルエット（目を細める）',
    theory: 'ぼかして見ると細部が消え、大きな形の塊だけが残る。画家が目を細める動作の代わり。',
    cue: '外形だけを一気に塗る。中の線は描かない。',
    view: { blur: 6, contrast: 1.3 },
  },
  negative: {
    id: 'negative',
    name: 'ネガティブスペース',
    theory: '「腕」だと思った瞬間、脳は記号を描き始める。すき間の形には名前が無いので、目で見たまま描くしかない。',
    cue: '物体ではなく、まわりの空いている形を描く。',
    view: { posterize: 2, invert: true },
  },
  contour: {
    id: 'contour',
    name: '輪郭線（コンター）',
    theory: '輪郭を目でゆっくり追う練習。手の速度を目の速度に合わせる。',
    cue: 'ペンを紙から離さず、目と手を同じ速さで動かす。',
    view: {},
  },
  blind: {
    id: 'blind',
    name: 'ブラインド・コンター',
    theory: '紙を見ないことで「上手く描こうとする補正」を切り、純粋な観察だけを残す。形が崩れても正解。',
    cue: '紙は見ない。目は写真だけ。ゆっくり。',
    view: {},
  },
  proportion: {
    id: 'proportion',
    name: '比率と角度',
    theory: 'グリッドは答えではなく物差し。縦横の比と傾きを「測ってから」描く癖をつける。',
    cue: '先に縦横の比率を測る。次に主要な線の傾きを鉛筆で確認。',
    view: { grid: true },
  },
  notan: {
    id: 'notan',
    name: '明暗3段階（ノタン）',
    theory: '写真を3階調に潰して見せる。実際の絵でも明暗を3つに整理できると、一気に立体に見える。',
    cue: '暗・中・明の3つだけ。中間を作らない。',
    view: { posterize: 3 },
  },
  upsideDown: {
    id: 'upsideDown',
    name: '逆さ模写',
    theory: '上下逆だと「顔」「手」といった記号認識が働かなくなり、線と角度そのものを見るようになる。',
    cue: '何の絵かは考えない。線の長さと角度だけを写す。',
    view: { rotate: 180 },
  },
  mass: {
    id: 'mass',
    name: '塊取り（構造模写）',
    theory: '見えた輪郭をなぞるのではなく、箱・円柱・くさびに置き換えてから描く。' +
            '知らない形は観察できないので、まず「何でできているか」を手に覚えさせる。',
    cue: '立方体・円柱・くさびに置き換える。輪郭は最後。',
    view: {},
  },
  landmark: {
    id: 'landmark',
    name: 'ランドマーク打ち',
    theory: '骨が皮膚のすぐ下にある場所（でっぱり）だけが、体型や角度に関係なく必ず同じ位置にある。' +
            'そこを先に点で押さえると、形が破綻しなくなる。',
    cue: 'まず骨のでっぱりを点で打つ。線を引くのはその後。',
    view: {},
  },
  memory: {
    id: 'memory',
    name: '記憶ドロー',
    theory: '見ながら描くと目と手の往復だけで済む。一度隠すことで、頭の中に形を保持する力が鍛えられる。',
    cue: '最初の10秒で覚える。隠れたら記憶だけで描く。',
    view: { hideAfter: 10, peeks: 2 },
  },
};

/** 出題ジャンル → Unsplash 検索クエリ */
export const CATEGORIES = [
  // 人物を描きたい人がほとんどなので、人体を最初に置き、最初から全部ひらいてある。
  // 検索語に full body / standing などを混ぜているのは、
  // ただ 'person' で引くと顔のアップや後ろ姿ばかりになって、形が取れないため。
  { id: 'pose',      label: '全身ポーズ', levelMin: 1,
    query: 'full body standing pose studio portrait' },
  { id: 'dance',     label: '動き・ダンス', levelMin: 1,
    query: 'dancer mid movement full body' },
  { id: 'sitting',   label: '座り・寝そべり', levelMin: 1,
    query: 'person sitting floor full body' },
  { id: 'portrait',  label: '顔・頭部',   levelMin: 1,
    query: 'portrait head shoulders natural light' },
  { id: 'hands',     label: '手',         levelMin: 1,
    query: 'hands close up gesture' },
  { id: 'feet',      label: '足',         levelMin: 1,
    query: 'bare feet legs close up' },
  { id: 'drapery',   label: '服のしわ',   levelMin: 1,
    query: 'fabric drapery cloth folds' },
  { id: 'animal',    label: '動物',       levelMin: 2,
    query: 'animal wildlife full body' },
  { id: 'still',     label: '静物',       levelMin: 2,
    query: 'still life objects table' },
  { id: 'nature',    label: '風景・植物', levelMin: 3,
    query: 'tree landscape plant' },
];

/**
 * メニュー。step の seconds/count はレベルで調整される（scaleMenu 参照）。
 */
export const MENUS = [
  {
    id: 'quick',
    title: 'ウォームアップ',
    subtitle: 'とにかく手を動かす日に',
    steps: [
      { drill: 'gesture', count: 4, seconds: 30 },
      { drill: 'squint',  count: 1, seconds: 60 },
    ],
  },
  {
    id: 'daily',
    title: 'デイリー',
    subtitle: 'まずはこれ。手を温めてから、形と明暗まで',
    steps: [
      { drill: 'gesture',    count: 4, seconds: 30 },
      { drill: 'negative',   count: 1, seconds: 150 },
      { drill: 'proportion', count: 1, seconds: 180 },
      { drill: 'notan',      count: 1, seconds: 150 },
    ],
  },
  {
    id: 'deep',
    title: 'じっくり',
    subtitle: '時間がある日に。長めの模写と、記憶で描くところまで',
    steps: [
      { drill: 'gesture',    count: 6, seconds: 30 },
      { drill: 'blind',      count: 1, seconds: 120 },
      { drill: 'proportion', count: 1, seconds: 240 },
      { drill: 'notan',      count: 1, seconds: 240 },
      { drill: 'upsideDown', count: 1, seconds: 300 },
      { drill: 'memory',     count: 1, seconds: 120 },
    ],
  },
  {
    id: 'gestureOnly',
    title: 'クロッキー連続',
    subtitle: '30秒を何枚も。手が温まっている日に',
    steps: [
      { drill: 'gesture', count: 12, seconds: 30 },
    ],
  },
];

/** 通算セッション数からレベルを出す。 */
export function levelFor(totalSessions) {
  if (totalSessions >= 100) return 5;
  if (totalSessions >= 50) return 4;
  if (totalSessions >= 21) return 3;
  if (totalSessions >= 7) return 2;
  return 1;
}

export function levelLabel(level) {
  return ['', '入口', '慣れてきた', '観察が効く', '安定期', '職人'][level] || '';
}

/**
 * 段階的過負荷。レベルが上がるほどジェスチャーは短く（＝判断を速く）、
 * 長時間ドリルは少しだけ長く（＝観察の解像度を上げる）。
 */
export function scaleMenu(menu, level) {
  const gestureSeconds = [30, 30, 25, 20, 20, 15][level] ?? 30;
  const studyScale = [1, 1, 1.1, 1.2, 1.3, 1.4][level] ?? 1;
  const steps = menu.steps.map((step) => {
    const drill = DRILLS[step.drill];
    const isWarmup = drill.weight === 'warmup';
    const seconds = isWarmup
      ? gestureSeconds
      : Math.round((step.seconds * studyScale) / 15) * 15;
    const count = isWarmup && level >= 3 ? step.count + 2 : step.count;
    return { ...step, seconds, count };
  });
  return { ...menu, steps };
}

export function menuDuration(menu) {
  return menu.steps.reduce((sum, s) => sum + s.count * s.seconds, 0);
}

/** 日付文字列（YYYY-MM-DD）から今日のテーマを決める。 */
export function focusForDate(dateStr) {
  const days = Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 86400000);
  return FOCUSES[((days % FOCUSES.length) + FOCUSES.length) % FOCUSES.length];
}

/** そのレベルで解禁されているジャンル。 */
export function availableCategories(level) {
  return CATEGORIES.filter((c) => c.levelMin <= level);
}
