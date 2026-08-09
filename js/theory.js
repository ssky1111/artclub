/**
 * theory.js — 練習メニューの中身と、その根拠。
 *
 * このアプリは「毎日やる気を出す」ことではなく、
 * 「やる気が無い日でも1分で始められて、始めたら勝手に効く練習になっている」ことを狙っている。
 * ドリルの選定と時間配分は下の考えに基づく。
 *
 * en: {...} は英語モード用。中身のある文章は辞書（i18n.js）ではなく
 * 定義の隣に置いてある。離れたところに置くと、片方だけ直して食い違うので。
 */

export const PRINCIPLES = [
  {
    id: 'deliberate',
    title: '意図的な練習（deliberate practice）',
    body: 'ただ枚数を描いても伸びない。狙いを1つに絞って描き、直後にふりかえる。' +
          'だから終わりに20秒の自己レビューが入る。',
    source: 'K. Anders Ericsson『Peak』',
    en: {
      title: 'Deliberate practice',
      body: 'Volume alone does not make you better. Draw with one specific aim, then look back at it ' +
            'immediately — which is why every session ends with a twenty-second review.',
    },
  },
  {
    id: 'habit',
    title: '小さく始める（habit formation）',
    body: '習慣は「開始の摩擦」で死ぬ。最短メニューを3分にし、ワンタップで画像が出てタイマーが走る。' +
          '連続日数と積み上げは、続けること自体を報酬にするため。',
    source: 'BJ Fogg『Tiny Habits』/ James Clear『Atomic Habits』',
    en: {
      title: 'Start small',
      body: 'Habits die at the friction of starting. The shortest menu is three minutes, and one tap ' +
            'puts a photo on screen with the timer already running.',
    },
  },
  {
    id: 'perception',
    title: '観察を5つの技能に分解する',
    body: '「絵が下手」は1つの問題ではなく、輪郭・空間（ネガティブスペース）・比率と角度・明暗・全体の把握、' +
          'という別々の技能の集合。ドリルはこの5つに1対1で対応している。',
    source: 'Betty Edwards『Drawing on the Right Side of the Brain』',
    en: {
      title: 'Seeing is five separate skills',
      body: '"Bad at drawing" is not one problem. Edges, negative space, proportion and angle, value, ' +
            'and the whole — the drills map one to one onto those five.',
    },
  },
  {
    id: 'gesture',
    title: '形より先に、動きと重心',
    body: '短時間のジェスチャードローイングは「速く描く練習」ではなく、細部を諦めさせて' +
          '全体の流れ・重心・シルエットを先に掴ませるための制約。だから最初は必ず1分から入る。',
    source: 'Michael Hampton / Mike Mattesi『FORCE』',
    en: {
      title: 'Motion and weight before shape',
      body: 'A one-minute gesture is not a speed exercise. The clock is there to make you give up on ' +
            'detail so that flow, weight and silhouette land first.',
    },
  },
  {
    id: 'construct',
    title: '観察だけでは描けない部位がある',
    body: '手や脚が描けないのは、観察力ではなく知識の問題。表面の下に何が入っているかを知らないと、' +
          '目は見ているのに「いつもの下手な手」という記号に翻訳してしまう。',
    source: 'George B. Bridgman『Constructive Anatomy』(1920)',
    en: {
      title: 'Some parts cannot be solved by looking',
      body: 'Hands and legs fail on knowledge, not eyesight. Without knowing what sits under the skin, ' +
            'your eye sees the truth and your hand writes the same old symbol.',
    },
  },
  {
    id: 'spacing',
    title: '間隔をあけて戻す',
    body: '一度できたことは必ず抜ける。抜けかけた頃にもう一度やると、そこで初めて定着する。' +
          '復習を別のタスクにすると誰もやらないので、期限の来た項目をふだんのメニューに混ぜている。',
    source: '間隔効果（Ebbinghaus, Cepeda et al. 2006, Roediger & Karpicke 2006）',
    en: {
      title: 'Come back after a gap',
      body: 'Whatever you got right will fade. Repeating it just as it fades is what makes it stick, so ' +
            'due items are folded into the normal menu instead of living in a separate revision screen.',
    },
  },
  {
    id: 'interleave',
    title: '混ぜる',
    body: '同じドリルだけを続けると上達が頭打ちになる（ブロック練習の罠）。' +
          '1セッションに性質の違うドリルを混ぜる。',
    source: 'interleaving / progressive overload',
    en: {
      title: 'Interleave',
      body: 'Repeating one drill plateaus (the blocked-practice trap). A session mixes drills that ask ' +
            'for different things.',
    },
  },
];

/**
 * ドリル定義。
 * view: 画像の見せ方を変えることでその技能だけを強制的に使わせる。
 * about: 「そもそも何なのか」の説明。名前だけ見ても分からないもの用。
 */
export const DRILLS = {
  gesture: {
    id: 'gesture',
    name: 'ジェスチャードローイング',
    short: 'ジェスドロ',
    about:
      '短い時間で1枚ずつ、人の「動き」だけを描くやり方。輪郭をなぞらず、' +
      '頭からつま先へ流れる1本の線と、肩と腰の傾きだけを取る。' +
      '完成させるためではないので、うまく描けなくていい。' +
      '1分で終わるので、上手く描こうとする気持ちが働く前に次へ行ける。',
    steps: [
      '体重が乗っている足を決める',
      '頭からつま先へ1本の線',
      '肩と腰の傾きを2本',
    ],
    theory: '細部を描く時間を奪うことで、全体の流れと重心だけに注意を向けさせる。' +
            '完成させるためではなく、勢いと重心を掴むための1分。',
    cue: 'まず1本の線で「動きの流れ」を引く。輪郭は追わない。',
    view: {},
    en: {
      name: 'Gesture drawing',
      short: 'Gesture',
      about:
        'One short drawing at a time, capturing only the movement of the figure. Do not trace the ' +
        'outline: take the single line that runs from head to toe, plus the tilt of the shoulders and ' +
        'the hips. It is not meant to be finished, so it is fine if it looks bad. A minute is over ' +
        'before the urge to make it pretty can kick in.',
      steps: ['Find the leg carrying the weight', 'One line from head to toe', 'Two lines: shoulders and hips'],
      theory: 'Taking away the time for detail forces attention onto flow and weight.',
      cue: 'Draw the line of action first. Do not follow the outline.',
    },
  },
  croquis: {
    id: 'croquis',
    name: 'クロッキー',
    about:
      'ジェスチャードローイングで掴んだ流れの上に、実際の形を乗せていく短時間デッサン。' +
      '3分は「全部は描けないが、全体は入る」ちょうどの長さ。',
    steps: [
      'あたりで全体の入る枠を取る',
      '頭・胸・骨盤の位置を決める',
      '手足をつないで、要所だけ描き込む',
    ],
    theory: 'ジェスチャードローイングで掴んだ流れの上に、実際の形を乗せていく。' +
            '3分は「全部は描けないが、全体は入る」ちょうどの長さ。',
    cue: '全体が紙に入る大きさで。細部は最後の30秒だけ。',
    view: {},
    en: {
      name: 'Croquis',
      about:
        'A short study that lays real shape on top of the flow you found in the gesture. Three minutes ' +
        'is long enough for the whole figure and too short for all of it.',
      steps: ['Block in a frame that fits the whole figure', 'Place head, ribcage, pelvis',
              'Connect the limbs; render only the key spots'],
      theory: 'Real shape goes on top of the gesture. Three minutes fits the whole figure, not all of it.',
      cue: 'Size it so the whole figure fits. Detail only in the last thirty seconds.',
    },
  },
  squint: {
    id: 'squint',
    name: 'シルエット（目を細める）',
    about: '写真をぼかして見せる。細部が消えて、大きな形の塊だけが残る。',
    steps: ['外形だけをぐるっと囲む', '中は一色で塗る', 'へこみと出っぱりを直す'],
    theory: 'ぼかして見ると細部が消え、大きな形の塊だけが残る。画家が目を細める動作の代わり。',
    cue: '外形だけを一気に塗る。中の線は描かない。',
    view: { blur: 6, contrast: 1.3 },
    en: {
      name: 'Silhouette (squint)',
      about: 'The photo is blurred so detail disappears and only the big shape is left.',
      steps: ['Wrap the outer shape', 'Fill it flat', 'Fix the dents and bumps'],
      theory: 'Blurring removes detail and leaves the large masses — the digital version of squinting.',
      cue: 'Fill the outer shape in one go. No interior lines.',
    },
  },
  negative: {
    id: 'negative',
    name: 'ネガティブスペース',
    about: '物ではなく、まわりの「空いている形」を描く。すき間には名前が無いので記号化できない。',
    steps: ['すき間を1つ選ぶ', 'その形だけを塗る', '残りのすき間も塗る'],
    theory: '「腕」だと思った瞬間、脳は記号を描き始める。すき間の形には名前が無いので、目で見たまま描くしかない。',
    cue: '物体ではなく、まわりの空いている形を描く。',
    view: { posterize: 2, invert: true },
    en: {
      name: 'Negative space',
      about: 'Draw the gaps around the figure rather than the figure. Gaps have no names, so you cannot ' +
             'replace them with a symbol.',
      steps: ['Pick one gap', 'Fill that shape only', 'Fill the remaining gaps'],
      theory: 'The moment you think "arm", your brain starts drawing a symbol. Gaps have no name.',
      cue: 'Draw the empty shapes around the subject, not the subject.',
    },
  },
  contour: {
    id: 'contour',
    name: '輪郭線（コンター）',
    about: '輪郭を目でゆっくり追いながら、同じ速さで手を動かす。',
    steps: ['端から輪郭を追う', 'ペンを離さない', '戻らずに進む'],
    theory: '輪郭を目でゆっくり追う練習。手の速度を目の速度に合わせる。',
    cue: 'ペンを紙から離さず、目と手を同じ速さで動かす。',
    view: {},
    en: {
      name: 'Contour',
      about: 'Follow the edge slowly with your eye and move your hand at the same speed.',
      steps: ['Start at one end of the edge', 'Do not lift the pen', 'Never go back'],
      theory: 'Matches the speed of the hand to the speed of the eye.',
      cue: 'Keep the pen down; eye and hand at the same speed.',
    },
  },
  blind: {
    id: 'blind',
    name: 'ブラインド・コンター',
    about: '紙を見ずに輪郭だけを追う。形が崩れても正解。',
    steps: ['紙は見ない', 'ゆっくり進む', '崩れても直さない'],
    theory: '紙を見ないことで「上手く描こうとする補正」を切り、純粋な観察だけを残す。形が崩れても正解。',
    cue: '紙は見ない。目は写真だけ。ゆっくり。',
    view: {},
    en: {
      name: 'Blind contour',
      about: 'Follow the edge without looking at the paper. A mangled result is the correct result.',
      steps: ['Do not look at the paper', 'Go slowly', 'Never correct it'],
      theory: 'Not looking switches off the urge to fix things, leaving pure observation.',
      cue: 'Eyes on the photo only. Slowly.',
    },
  },
  proportion: {
    id: 'proportion',
    name: '比率と角度',
    about: '描く前に、頭何個分かと主要な線の傾きを測る。',
    steps: ['頭の大きさを測る', '全体が頭何個分か', '肩と腰の傾きを見る'],
    theory: 'グリッドは答えではなく物差し。縦横の比と傾きを「測ってから」描く癖をつける。',
    cue: '先に縦横の比率を測る。次に主要な線の傾きを確認。',
    view: { grid: true },
    en: {
      name: 'Proportion and angle',
      about: 'Measure how many heads tall it is, and the tilt of the main lines, before drawing.',
      steps: ['Measure the head', 'How many heads tall is it?', 'Check the shoulder and hip tilt'],
      theory: 'The grid is a ruler, not an answer. Measure, then draw.',
      cue: 'Measure the ratios first, then the angles.',
    },
  },
  notan: {
    id: 'notan',
    name: '明暗3段階（ノタン）',
    about: '写真を3階調に潰して見せる。暗・中・明だけに仕分ける。',
    steps: ['いちばん暗い所を塗る', '中間の灰色を塗る', '白は塗らずに残す'],
    theory: '写真を3階調に潰して見せる。実際の絵でも明暗を3つに整理できると、一気に立体に見える。',
    cue: '暗・中・明の3つだけ。中間を作らない。',
    view: { posterize: 3 },
    en: {
      name: 'Three values (notan)',
      about: 'The photo is crushed to three tones. Sort everything into dark, mid, light.',
      steps: ['Fill the darkest areas', 'Fill the mid grey', 'Leave the lights as paper'],
      theory: 'Sorting a subject into three values is what makes it read as solid.',
      cue: 'Dark, mid, light. No in-between.',
    },
  },
  upsideDown: {
    id: 'upsideDown',
    name: '逆さ模写',
    about: '写真を上下逆に出す。「顔」「手」という記号認識が働かなくなる。',
    steps: ['逆さのまま見る', 'いちばん長い線から', '何の絵かは考えない'],
    theory: '上下逆だと「顔」「手」といった記号認識が働かなくなり、線と角度そのものを見るようになる。',
    cue: '何の絵かは考えない。線の長さと角度だけを写す。',
    view: { rotate: 180 },
    en: {
      name: 'Upside down',
      about: 'The photo is flipped so your brain stops recognising "face" or "hand".',
      steps: ['Keep it upside down', 'Start from the longest line', 'Do not ask what it is'],
      theory: 'Upside down, symbol recognition switches off and you see lines and angles.',
      cue: 'Copy lengths and angles. Do not name anything.',
    },
  },
  mass: {
    id: 'mass',
    name: '塊取り（構造模写）',
    about: '見えた輪郭をなぞらず、箱・円柱・くさびに置き換えてから描く。',
    steps: ['胸を箱、骨盤を箱で置く', '手足を円柱でつなぐ', '最後に輪郭をかぶせる'],
    theory: '見えた輪郭をなぞるのではなく、箱・円柱・くさびに置き換えてから描く。' +
            '知らない形は観察できないので、まず「何でできているか」を手に覚えさせる。',
    cue: '立方体・円柱・くさびに置き換える。輪郭は最後。',
    view: {},
    en: {
      name: 'Masses (constructive)',
      about: 'Replace what you see with boxes, cylinders and wedges before you draw the outline.',
      steps: ['Ribcage box, pelvis box', 'Cylinders for the limbs', 'Outline last'],
      theory: 'You cannot observe a shape you do not know. Learn what it is built from first.',
      cue: 'Boxes, cylinders, wedges. Outline last.',
    },
  },
  memory: {
    id: 'memory',
    name: '記憶ドロー',
    about: '最初の10秒だけ見て、あとは隠れる。頭の中に形を保持する練習。',
    steps: ['10秒で覚える', '隠れたら箱から描く', '出てこない所は飛ばす'],
    theory: '見ながら描くと目と手の往復だけで済む。一度隠すことで、頭の中に形を保持する力が鍛えられる。',
    cue: '最初の10秒で覚える。隠れたら記憶だけで描く。',
    view: { hideAfter: 10, peeks: 2 },
    en: {
      name: 'From memory',
      about: 'You see it for ten seconds, then it hides. Trains holding a shape in your head.',
      steps: ['Ten seconds to memorise', 'Start from the boxes once it hides', 'Skip what will not come'],
      theory: 'Drawing while looking is just eye-hand ping-pong. Hiding the subject builds retention.',
      cue: 'Memorise in ten seconds, then draw from memory.',
    },
  },
};

/** じぶんで決めて描くときに選べるドリル。 */
export const PICKABLE_DRILLS = [
  'gesture', 'croquis', 'mass', 'contour', 'negative', 'squint', 'notan', 'memory', 'proportion',
];

/** 出題ジャンル → Unsplash 検索クエリ */
export const CATEGORIES = [
  { id: 'pose',      label: '全身ポーズ',   en: 'Full body',    query: 'full body standing pose studio portrait' },
  { id: 'dance',     label: '動き・ダンス', en: 'Movement',     query: 'dancer mid movement full body' },
  { id: 'sitting',   label: '座り・寝そべり', en: 'Seated',     query: 'person sitting floor full body' },
  { id: 'portrait',  label: '顔・頭部',     en: 'Head',         query: 'portrait head shoulders natural light' },
  { id: 'hands',     label: '手',           en: 'Hands',        query: 'hands close up gesture' },
  { id: 'feet',      label: '足',           en: 'Feet',         query: 'bare feet legs close up' },
  { id: 'drapery',   label: '服のしわ',     en: 'Drapery',      query: 'fabric drapery cloth folds' },
  { id: 'animal',    label: '動物',         en: 'Animals',      query: 'animal wildlife full body' },
  { id: 'still',     label: '静物',         en: 'Still life',   query: 'still life objects table' },
  { id: 'nature',    label: '風景・植物',   en: 'Landscape',    query: 'tree landscape plant' },
];

/**
 * 部位練習で選べる部位。tags は写真のタグ、lessonId があれば構造レッスンに繋がる。
 */
export const PARTS = [
  { id: 'hand',   label: '手',       en: 'Hands',      tags: ['手'],   lessonId: 'hand',      query: 'hands close up gesture' },
  { id: 'upper',  label: '上半身',   en: 'Upper body', tags: ['半身'], lessonId: null,        query: 'torso upper body pose' },
  { id: 'lower',  label: '下半身',   en: 'Lower body', tags: ['全身'], lessonId: 'pelvisLeg', query: 'legs walking barefoot dancer' },
  { id: 'face',   label: '顔',       en: 'Head',       tags: ['顔'],   lessonId: null,        query: 'portrait head shoulders natural light' },
  { id: 'foot',   label: '足',       en: 'Feet',       tags: ['足'],   lessonId: 'foot',      query: 'bare feet' },
  { id: 'full',   label: '全身',     en: 'Full body',  tags: ['全身'], lessonId: null,        query: 'full body standing pose' },
];

export function buildDaily() {
  return {
    id: 'daily',
    title: 'DAILY',
    steps: [
      { drill: 'gesture', count: 2, seconds: 30 },
      { drill: 'croquis', count: 3, seconds: 180 },
    ],
    en: { title: 'DAILY' },
  };
}

/**
 * その日の部位。日付で決まるので、同じ日に何回やっても同じ部位。
 * 自分で選ばせないのは、選ぶ時間が始めない理由になるのと、
 * 放っておくと得意なところばかり選ぶため（1周すると全部位を通る）。
 */
export function partForDate(dateStr) {
  const days = Math.floor(new Date(`${dateStr}T00:00:00`).getTime() / 86400000);
  return PARTS[((days % PARTS.length) + PARTS.length) % PARTS.length];
}

/**
 * モードは3つだけ。増やすと「どれを押すか」を考える時間ができて、それが始めない理由になる。
 */
export const MODES = [
  {
    id: 'gestureMode',
    title: 'ジェスチャードローイング',
    subtitle: '1分×10枚。動きと重心だけを取る',
    drillId: 'gesture',
    steps: [{ drill: 'gesture', count: 10, seconds: 60 }],
    en: { title: 'Gesture drawing', subtitle: '10 × 1 min. Movement and weight only' },
  },
  {
    id: 'partMode',
    title: '部位練習',
    subtitle: '手・上半身・下半身など、苦手なところだけ',
    picker: 'part',
    drillId: 'croquis',
    en: { title: 'Body part', subtitle: 'Hands, torso, legs — just the part you struggle with' },
  },
  {
    id: 'croquisMode',
    title: 'クロッキー',
    subtitle: '3分×5枚。形をきちんと乗せる',
    drillId: 'croquis',
    steps: [{ drill: 'croquis', count: 5, seconds: 180 }],
    en: { title: 'Croquis', subtitle: '5 × 3 min. Put the shape down properly' },
  },
];

/** 部位練習のメニュー。ジェスドロで温めてからクロッキー。 */
export function buildPartMenu(part) {
  return {
    id: `part-${part.id}`,
    title: `${part.label}の練習`,
    subtitle: `${part.label}だけを 1分×3 → 3分×2`,
    partId: part.id,
    steps: [
      { drill: 'gesture', count: 3, seconds: 60 },
      { drill: 'croquis', count: 2, seconds: 180 },
    ],
    en: { title: `${part.en} practice`, subtitle: `${part.en} only — 3 × 1 min, then 2 × 3 min` },
  };
}

/** 1枚あたりの時間の選択肢（秒）。 */
export const TIME_CHOICES = [30, 60, 120, 180, 300, 600];
export const COUNT_CHOICES = [1, 3, 5, 10, 20];

export function timeLabel(seconds) {
  return seconds < 60 ? `${seconds}秒` : `${seconds / 60}分`;
}

/** 設定シートから作る、1ドリルだけのメニュー。 */
export function buildCustomMenu({ drill, seconds, count }) {
  return {
    id: 'custom',
    title: DRILLS[drill]?.name || '練習',
    subtitle: `${timeLabel(seconds)} × ${count}枚`,
    steps: [{ drill, count, seconds }],
    custom: true,
    en: { title: DRILLS[drill]?.en?.name || 'Practice', subtitle: `${count} × ${timeLabel(seconds)}` },
  };
}

/** 通算セッション数からレベルを出す。 */
export function levelFor(totalSessions) {
  if (totalSessions >= 100) return 5;
  if (totalSessions >= 50) return 4;
  if (totalSessions >= 21) return 3;
  if (totalSessions >= 7) return 2;
  return 1;
}

const LEVEL_LABELS = {
  ja: ['', '入口', '慣れてきた', '観察が効く', '安定期', '職人'],
  en: ['', 'Starting', 'Warming up', 'Seeing it', 'Steady', 'Craftsman'],
};

export function levelLabel(level, lang = 'ja') {
  return (LEVEL_LABELS[lang] || LEVEL_LABELS.ja)[level] || '';
}

/**
 * 時間はメニューに書いてあるとおりに使う。
 * 以前はレベルで秒数を上下させていたが、表示と実物が食い違う原因にしかなっていなかった。
 */
export function scaleMenu(menu) {
  return menu;
}

export function menuDuration(menu) {
  return (menu.steps || []).reduce((sum, s) => sum + s.count * s.seconds, 0);
}

export function availableCategories() {
  return CATEGORIES;
}
