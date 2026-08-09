/**
 * glossary.js — 解剖図版に出てくる英語の対訳。
 *
 * 「英語は読めない」という前提でこのアプリを作っている。
 * 図版そのものは英語（かフランス語やラテン語）のままだが、
 *   ・図版のタイトルを、辞書で置き換えて日本語にする
 *   ・その図版に出てくる用語だけを対訳表にして下に出す
 * の2つで、読まなくても何の図か分かるようにする。
 *
 * 機械翻訳のAPIは使わない。外に通信を増やしたくないのと、
 * 解剖用語は一般の翻訳だと妙な訳（"palm" が「ヤシ」）になるため。
 * 長い語から順に当てるので、'metacarpal bone' は 'bone' より先に一致する。
 */

export const TERMS = [
  /* 部位 */
  ['upper extremity', '上肢'], ['lower extremity', '下肢'],
  ['pectoral girdle', '肩甲帯'], ['pelvic girdle', '骨盤帯'],
  ['shoulder blade', '肩甲骨'], ['collar bone', '鎖骨'],
  ['thoracic cage', '胸郭'], ['rib cage', '胸郭'],
  ['vertebral column', '脊柱'], ['spinal column', '脊柱'],
  ['skeleton', '骨格'], ['skull', '頭蓋骨'], ['cranium', '頭蓋'],
  ['mandible', '下顎骨'], ['maxilla', '上顎骨'],
  ['clavicle', '鎖骨'], ['scapula', '肩甲骨'], ['sternum', '胸骨'],
  ['humerus', '上腕骨'], ['radius', '橈骨'], ['ulna', '尺骨'],
  ['carpus', '手根骨'], ['metacarpal', '中手骨'], ['phalanx', '指骨'], ['phalanges', '指骨'],
  ['pelvis', '骨盤'], ['ilium', '腸骨'], ['ischium', '坐骨'], ['pubis', '恥骨'],
  ['sacrum', '仙骨'], ['coccyx', '尾骨'],
  ['femur', '大腿骨'], ['patella', '膝蓋骨'], ['tibia', '脛骨'], ['fibula', '腓骨'],
  ['tarsus', '足根骨'], ['metatarsal', '中足骨'], ['calcaneus', '踵骨'],
  ['vertebra', '椎骨'], ['vertebrae', '椎骨'], ['rib', '肋骨'],
  ['trochanter', '転子'], ['condyle', '顆'], ['tuberosity', '粗面'],
  ['malleolus', 'くるぶし'], ['crest', '稜'], ['spine', '棘・脊柱'],
  ['process', '突起'], ['joint', '関節'], ['articulation', '関節'],
  ['ligament', '靭帯'], ['tendon', '腱'], ['aponeurosis', '腱膜'],
  ['cartilage', '軟骨'], ['bones', '骨'], ['bone', '骨'],
  ['muscles', '筋'], ['muscle', '筋'], ['tendons', '腱'], ['ligaments', '靭帯'],
  ['view', '図'], ['views', '図'],

  /* 表層の部位名 */
  ['forearm', '前腕'], ['upper arm', '上腕'], ['arm', '腕'],
  ['thigh', '大腿'], ['leg', '下肢・脚'], ['calf', 'ふくらはぎ'],
  ['knee', '膝'], ['ankle', '足首'], ['foot', '足'], ['feet', '足'],
  ['hand', '手'], ['palm', '手のひら'], ['wrist', '手首'],
  ['finger', '指'], ['thumb', '親指'], ['toe', '足の指'], ['heel', '踵'],
  ['shoulder', '肩'], ['elbow', '肘'], ['hip', '腰・股関節'],
  ['neck', '首'], ['head', '頭部'], ['face', '顔'], ['trunk', '体幹'],
  ['torso', '胴'], ['back', '背'], ['chest', '胸'], ['abdomen', '腹部'],
  ['buttock', '臀部'], ['groin', '鼠径部'],

  /* 主要な筋 */
  ['sternocleidomastoid', '胸鎖乳突筋'], ['trapezius', '僧帽筋'],
  ['deltoid', '三角筋'], ['pectoralis', '大胸筋'],
  ['latissimus dorsi', '広背筋'], ['serratus', '前鋸筋'],
  ['biceps', '上腕二頭筋'], ['triceps', '上腕三頭筋'],
  ['brachioradialis', '腕橈骨筋'], ['rectus abdominis', '腹直筋'],
  ['external oblique', '外腹斜筋'], ['gluteus', '殿筋'],
  ['sartorius', '縫工筋'], ['quadriceps', '大腿四頭筋'],
  ['rectus femoris', '大腿直筋'], ['vastus', '広筋'],
  ['biceps femoris', '大腿二頭筋'], ['gastrocnemius', '腓腹筋'],
  ['soleus', 'ヒラメ筋'], ['tibialis', '前脛骨筋'],
  ['flexor', '屈筋'], ['extensor', '伸筋'], ['abductor', '外転筋'], ['adductor', '内転筋'],

  /* 向き・位置 */
  ['anterior', '前面'], ['posterior', '後面'], ['lateral', '外側'], ['medial', '内側'],
  ['superior', '上'], ['inferior', '下'], ['dorsal', '背側'], ['ventral', '腹側'],
  ['palmar', '掌側'], ['plantar', '足底'], ['proximal', '近位'], ['distal', '遠位'],
  ['superficial', '浅層'], ['deep', '深層'], ['transverse', '横断'], ['sagittal', '矢状'],
  ['front view', '正面'], ['side view', '側面'], ['back view', '背面'],
  ['seen from', '〜から見た'], ['view of', '〜の図'],

  /* 図版まわり */
  ['plate', '図版'], ['figure', '図'], ['fig', '図'], ['diagram', '図解'],
  ['illustration', '挿図'], ['drawing', '素描'], ['study', '習作'],
  ['anatomy', '解剖学'], ['anatomical', '解剖の'], ['artistic anatomy', '美術解剖学'],
  ['proportion', '比率'], ['proportions', '比率'],
  ['male', '男性'], ['female', '女性'], ['human', '人体'], ['body', '身体'],
  ['surface', '体表'], ['section', '断面'], ['flexion', '屈曲'], ['extension', '伸展'],
];

/**
 * 語より先に当てるフレーズ。
 * 単語だけ置き換えると「bones of the 手」のような読めない行になるので、
 * 図版タイトルによく出る言い回しは、丸ごと日本語の語順にしてしまう。
 */
const PHRASES = [
  [/\bbones? of (?:the )?([a-z]+)\b/gi, (_, x) => `${word(x)}の骨`],
  [/\bmuscles? of (?:the )?([a-z]+)\b/gi, (_, x) => `${word(x)}の筋`],
  [/\bligaments? of (?:the )?([a-z]+)\b/gi, (_, x) => `${word(x)}の靭帯`],
  [/\btendons? of (?:the )?([a-z]+)\b/gi, (_, x) => `${word(x)}の腱`],
  [/\banterior view\b/gi, () => '前面から見た図'],
  [/\bposterior view\b/gi, () => '後面から見た図'],
  [/\blateral view\b/gi, () => '外側から見た図'],
  [/\bmedial view\b/gi, () => '内側から見た図'],
  [/\bside view\b/gi, () => '側面から見た図'],
  [/\bfront view\b/gi, () => '正面から見た図'],
  [/\bback view\b/gi, () => '背面から見た図'],
  [/\bseen from (?:the )?([a-z]+)\b/gi, (_, x) => `${word(x)}から見た図`],
  [/\bplate (\d+)\b/gi, (_, n) => `図版${n}`],
  [/\bfig(?:ure)?\.? ?(\d+)\b/gi, (_, n) => `図${n}`],
];

// 長い語から当てる。'rectus femoris' を 'rectus' より先に見つけるため。
const SORTED = [...TERMS].sort((a, b) => b[0].length - a[0].length);

/** 1語だけ引く。見つからなければ英語のまま返す。 */
function word(text) {
  const key = String(text).trim().toLowerCase().replace(/s$/, '');
  for (const [en, ja] of SORTED) if (en === key || `${en}s` === key) return ja;
  return String(text).trim();
}

/** 図版のタイトルに出てくる用語だけを拾う。対訳表に出す用。 */
export function termsIn(text) {
  const lower = String(text || '').toLowerCase();
  const found = [];
  const used = [];
  for (const [en, ja] of SORTED) {
    if (!lower.includes(en)) continue;
    // すでに拾った長い語の一部なら飛ばす（'bone' が 'metacarpal bone' の中にある場合）
    if (used.some((prev) => prev.includes(en))) continue;
    used.push(en);
    found.push({ en, ja });
  }
  return found;
}

/**
 * タイトルを日本語寄りに置き換える。完全な翻訳ではなく「何の図か分かる」ところまで。
 * 置き換えられなかった部分（人名やファイル名の記号）はそのまま残す。
 */
export function translateTitle(text) {
  let out = String(text || '').replace(/\.(jpg|jpeg|png|gif|tif|svg)$/i, '').replace(/_/g, ' ');
  for (const [re, fn] of PHRASES) out = out.replace(re, fn);
  for (const [en, ja] of SORTED) {
    const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    out = out.replace(re, ja);
  }
  // 訳せた語が1つでもあるなら、残った英語の助詞は読む邪魔にしかならないので落とす
  if (/[぀-ヿ一-鿿]/.test(out)) {
    out = out.replace(/\b(the|of|a|an|and|in|on|from|with|showing|seen)\b/gi, ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}
