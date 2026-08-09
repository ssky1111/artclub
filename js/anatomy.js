/**
 * anatomy.js — 「見ても描けない部位」のための構造レッスン。
 *
 * 観察ドリル（theory.js）だけでは手や脚は描けるようにならない。
 * 目に見えているのは表面だけで、その下に何が入っているかを知らないと、
 * 見えたものを記号（＝いつもの下手な手）に翻訳してしまうため。
 *
 * ここに入っているのは「塊への置き換え」と「骨のでっぱり（ランドマーク）」だけ。
 * 筋肉の名前は覚えなくていい。形が決まるところしか書いていない。
 *
 * 図版はパブリックドメインの美術解剖書から Wikimedia Commons 経由で取ってくる
 * （commons.js）。図版の中身は英語だが、解説はすべてここに日本語で書いてある。
 */

export const PD_BOOKS = [
  {
    id: 'bridgman',
    title: 'Constructive Anatomy',
    titleJa: '『構成的解剖学』',
    author: 'George B. Bridgman',
    year: 1920,
    note: '人体を箱とくさびに置き換える描き方の元祖。手と脚の図版が特に多い。',
    en: { note: 'The origin of drawing the figure as boxes and wedges. Especially strong on hands and legs.' },
    queries: [
      'Bridgman Constructive Anatomy',
      'Bridgman anatomy hand drawing',
      'Bridgman anatomy leg drawing',
    ],
  },
  {
    id: 'gray',
    title: "Gray's Anatomy (1918)",
    titleJa: '『グレイ解剖学』1918年版',
    author: 'Henry Gray',
    year: 1918,
    note: '骨と筋肉の正確な図版。骨のでっぱりの位置を確かめるのに使う。',
    en: { note: 'Accurate bone and muscle plates. Use it to check where the bony landmarks sit.' },
    queries: [
      'Gray anatomy plate skeleton',
      'Gray anatomy muscles plate',
      'Gray anatomy bones of the hand',
    ],
  },
  {
    id: 'vanderpoel',
    title: 'The Human Figure',
    titleJa: '『人体』',
    author: 'John H. Vanderpoel',
    year: 1907,
    note: '面と陰影のとらえ方。手足の見え方の変化が丁寧。',
    en: { note: 'Planes and shading. Careful about how hands and feet change as they turn.' },
    queries: ['Vanderpoel Human Figure', 'human figure drawing plate 1907'],
  },
  {
    id: 'richer',
    title: 'Anatomie artistique',
    titleJa: '『美術解剖学』',
    author: 'Paul Richer',
    year: 1890,
    note: 'プロポーションと体表の解剖。フランス語だが図が主役。',
    en: { note: 'Proportion and surface anatomy. French text, but the plates carry it.' },
    queries: ['Paul Richer Anatomie artistique', 'Richer anatomie artistique plate'],
  },
];

export const LESSONS = [
  /* ============================== 手 ============================== */
  {
    id: 'hand',
    name: '手',
    tagline: '指5本の集合だと思っている限り、一生描けない',
    problem:
      '手が描けないのは、指を5本生やそうとするから。実際の手は「手のひらの箱」「親指の三角」' +
      '「4本指の階段」という3つの塊でできていて、この3つは向いている方向が全部ちがう。' +
      'まず塊を置いて、指はいちばん最後に足す。',

    steps: [
      {
        title: '① 手のひらを「厚みのある箱」で置く',
        body:
          '手のひらは平らな板ではない。厚みがあり、少しねじれたくさび形の箱。' +
          '小指側は薄く、親指側（母指球）は厚い。まずこの箱を1つ描く。指はまだ描かない。',
      },
      {
        title: '② 指の付け根を「弧」で引く',
        body:
          '人差し指から小指までの付け根（拳の山）は直線に並ばない。中指の付け根を頂点にした弧を描く。' +
          'ここを直線で並べた瞬間、手はミトンになる。',
      },
      {
        title: '③ 親指は「側面から」生やす',
        body:
          '親指は手のひらの正面ではなく、側面から生えている。しかも他の4本と約90°ちがう平面を向いている。' +
          '親指の付け根の肉の塊（母指球）は、手のひらの面積の3分の1くらいを占める大きな三角。',
      },
      {
        title: '④ 指は「3つの箱の階段」',
        body:
          '指は1本の棒でも円柱でもなく、3つの節（親指だけ2つ）が関節でつながった箱の連なり。' +
          '曲げると階段状になり、それぞれの箱の面が見える。関節以外では絶対に曲がらない。',
      },
      {
        title: '⑤ 指先を結ぶともう一度「弧」',
        body:
          '中指が最も長く、人差し指と薬指がほぼ同じ、小指が最も短い。指先を結ぶと弧になる。' +
          '節の長さは根元から先へ短くなる（おおよそ 1 : 0.6 : 0.4）。',
      },
    ],

    landmarks: [
      '手首の小指側にある丸いでっぱり（尺骨頭）— 手首の向きはここで決まる',
      '拳の山（中手骨の頭）— 中指の山がいちばん高い',
      '母指球 — 親指の付け根の三角の肉',
      '小指球 — 手のひらの小指側の細長い肉',
      '手の甲の腱 — 指を伸ばすと扇状に浮き出る',
    ],

    proportions: [
      '手全体の長さ ≒ 顔の長さ（あご先から生え際まで）',
      '手のひら : 指 ≒ 1 : 1',
      '親指の先は、人差し指の第一関節あたりまでしか届かない',
    ],

    mistakes: [
      { bad: '手のひらを平らな板にする', fix: '先に側面を描いて厚みを作る' },
      { bad: '5本とも同じ向きに扇状に生やす', fix: '親指だけ別グループ。90°ちがう面から生やす' },
      { bad: '拳の山を一直線に並べる', fix: '中指を頂点にした弧にする' },
      { bad: '指の節を全部同じ長さにする', fix: '根元から先へ短くしていく' },
      { bad: '指を円柱で描く', fix: '断面は四角に近い。特に第一関節から先は箱' },
    ],

    checks: [
      '手のひらの箱に厚みがあるか',
      '親指が側面から、別の向きに生えているか',
      '拳の山が弧になっているか',
      '節が根元から先へ短くなっているか',
    ],

    en: {
      name: 'Hands',
      tagline: 'While you think of it as five fingers, you will never draw it',
      problem:
        'Hands fail because you try to grow five fingers. A real hand is three masses — the box of the ' +
        'palm, the triangle of the thumb, the staircase of the four fingers — and all three face ' +
        'different directions. Place the masses first; the fingers come last.',
      steps: [
        { title: '1. Place the palm as a box with thickness',
          body: 'The palm is not a flat board. It is a slightly twisted wedge, thin on the little-finger ' +
                'side and thick on the thumb side. Draw that one box. No fingers yet.' },
        { title: '2. The knuckles sit on an arc',
          body: 'The knuckles from index to little finger do not line up straight. They arc, peaking at ' +
                'the middle finger. Line them up and the hand becomes a mitten.' },
        { title: '3. The thumb grows from the side',
          body: 'The thumb comes off the side of the palm, not the front, and faces a plane about 90° ' +
                'from the other four. Its base pad takes up roughly a third of the palm.' },
        { title: '4. Fingers are a staircase of three boxes',
          body: 'A finger is not a rod. It is three segments (two for the thumb) joined at hinges. Bent, ' +
                'it steps down and you see each box face. It never bends anywhere else.' },
        { title: '5. The fingertips make another arc',
          body: 'Middle longest, index and ring about equal, little finger shortest. Segment lengths ' +
                'shorten from base to tip, roughly 1 : 0.6 : 0.4.' },
      ],
      landmarks: [
        'The round bump on the little-finger side of the wrist (ulnar head) — it sets the wrist angle',
        'The knuckles (metacarpal heads) — the middle one is highest',
        'The thenar pad — the triangle of muscle at the base of the thumb',
        'The hypothenar pad — the long strip on the little-finger side',
        'The extensor tendons — they fan out on the back of the hand when the fingers straighten',
      ],
      proportions: [
        'Whole hand ≈ the length of the face (chin to hairline)',
        'Palm : fingers ≈ 1 : 1',
        'The thumb tip only reaches about the first joint of the index finger',
      ],
      mistakes: [
        { bad: 'Making the palm a flat board', fix: 'Draw the side plane first to give it thickness' },
        { bad: 'Fanning all five from the same plane', fix: 'The thumb is its own group, 90° away' },
        { bad: 'Lining the knuckles up straight', fix: 'Arc them, peaking at the middle finger' },
        { bad: 'Equal-length finger segments', fix: 'They shorten from base to tip' },
        { bad: 'Drawing fingers as cylinders', fix: 'The section is nearly square, especially past the first joint' },
      ],
      checks: [
        'Does the palm box have thickness?',
        'Does the thumb come off the side, facing a different way?',
        'Do the knuckles arc?',
        'Do the segments shorten toward the tip?',
      ],
    },

    refQueries: [
      'Bridgman Constructive Anatomy hand',
      'Gray anatomy bones of the hand',
      'hand muscles anatomical plate',
      'artistic anatomy hand drawing',
    ],
    photoQuery: 'hands close up',

    practice: {
      id: 'lesson-hand',
      title: '手をつぶす',
      en: { title: 'Crack the hand' },
      steps: [
        { drill: 'mass',    source: 'plate', count: 2, seconds: 180 },
        { drill: 'mass',    source: 'photo', count: 2, seconds: 60 },
        { drill: 'gesture', source: 'photo', count: 4, seconds: 30 },
        { drill: 'memory',  source: 'photo', count: 1, seconds: 120 },
      ],
    },
  },

  /* ========================== 骨盤と脚 ========================== */
  {
    id: 'pelvisLeg',
    name: '骨盤と脚',
    tagline: '脚が棒になるのは、骨盤を描いていないから',
    problem:
      '下半身が描けない原因はほぼ骨盤。脚を2本の円柱として腰から生やすと、必ず棒になる。' +
      '正しい順番は「骨盤の箱の傾きを決める → 大腿骨を斜めに降ろす → 膝の箱 → すね」。' +
      '脚の形は、脚そのものより先に骨盤で決まっている。',

    steps: [
      {
        title: '① 骨盤を「下がすぼまった箱」で置く',
        body:
          '最初に描くのは脚ではなく骨盤。前に傾いているか後ろに傾いているか、' +
          'そして左右どちらが高いかを決める。体重が乗っている側の腰が上がり、肩は逆に下がる' +
          '（片脚立ちのときの、あの傾き）。ここが決まらないと下半身は全部ずれる。',
      },
      {
        title: '② 大腿骨は「外から内へ」斜めに降りる',
        body:
          '太ももの骨は、腰の横のいちばん出っぱったところ（大転子・ちょうどズボンのポケットの位置）' +
          'から始まり、内側に向かって斜めに膝へ降りる。左右そろえるとハの字（上が広く下が狭い）。' +
          '骨盤が広い人ほどこの角度は急になる。脚を垂直に2本降ろした時点で間違い。',
      },
      {
        title: '③ 膝は丸ではなく「横長の箱」',
        body:
          '正面から見た膝は横長の箱。膝の皿はその前面に乗っている板で、箱そのものではない。' +
          '膝から下は、太ももとは少し違う方向（やや外向き）に進む。ここに角度の変化があるから' +
          '脚は棒に見えない。',
      },
      {
        title: '④ すねに「1本の直線」を通す',
        body:
          '下腿の前面には脛骨の稜が通っている。骨が皮膚のすぐ下にあるので、' +
          'ここだけは硬い直線として見える。この直線を1本引くと、下腿が一気に「骨のあるもの」になる。' +
          '外側にはもう1本（腓骨）があり、その下端が外くるぶしになる。',
      },
      {
        title: '⑤ ふくらはぎは左右非対称',
        body:
          'ふくらはぎは2つの塊でできていて、内側の塊が高くて大きく、外側の塊が低くて小さい。' +
          'だから外形線は左右で高さがずれる。紡錘形（左右対称の膨らみ）で描くと、必ず作り物に見える。',
      },
    ],

    landmarks: [
      '腸骨稜 — 腰に手を当てたときに触れる骨の上の縁',
      '上前腸骨棘（ASIS）— 骨盤の前の左右2つのでっぱり。骨盤の傾きはこの2点で描く',
      '大転子 — 腰の横のでっぱり。脚の始点',
      '膝の皿と、その下のでっぱり（脛骨粗面）',
      'すねの稜 — 膝から足首まで通る直線',
      '内くるぶし（高い・前寄り）／外くるぶし（低い・後ろ寄り）',
    ],

    proportions: [
      '8頭身のとき、股間はちょうど全身の真ん中',
      '膝は股間と足の裏のちょうど中間',
      '大転子の高さは、ほぼ股間と同じ',
      '足の長さ ≒ 頭の長さ',
    ],

    mistakes: [
      { bad: '骨盤を描かず腰から下を棒にする', fix: '最初に骨盤の箱と傾きだけを描く' },
      { bad: '左右の脚を平行に降ろす', fix: '大転子から内側へ、ハの字に降ろす' },
      { bad: '膝を丸で描く', fix: '横長の箱にして、皿はその前面に乗せる' },
      { bad: 'ふくらはぎを左右対称にする', fix: '内側を高く、外側を低く' },
      { bad: 'くるぶしを同じ高さにする', fix: '内が高く外が低い。足首は必ず傾いて見える' },
    ],

    checks: [
      '骨盤の傾き（左右の高さの差）を最初に決めたか',
      '大腿骨が斜めに降りているか',
      '膝が箱になっているか',
      'すねに硬い直線が1本通っているか',
      'ふくらはぎの内と外で高さがずれているか',
    ],

    en: {
      name: 'Pelvis and legs',
      tagline: 'Legs turn into sticks because you skipped the pelvis',
      problem:
        'Almost every failed lower body is a missing pelvis. Grow two cylinders out of the waist and you ' +
        'get sticks. The order is: set the tilt of the pelvic box, run the femur down and inward, box the ' +
        'knee, then the shin. The leg is decided by the pelvis before the leg is drawn.',
      steps: [
        { title: '1. Place the pelvis as a box that narrows downward',
          body: 'Draw the pelvis before the legs. Decide whether it tilts forward or back, and which side ' +
                'is higher. The hip on the weight-bearing side rises and the shoulders drop the other way. ' +
                'Get this wrong and everything below is wrong.' },
        { title: '2. The femur runs from outside to inside',
          body: 'The thigh bone starts at the widest point of the hip (the greater trochanter, right at ' +
                'the trouser pocket) and slopes inward to the knee. Both together form a narrow V. Two ' +
                'vertical legs are already a mistake.' },
        { title: '3. The knee is a wide box, not a circle',
          body: 'From the front the knee is a box wider than it is tall. The kneecap is a plate lying on ' +
                'its front. Below the knee the direction changes slightly outward — that change is why a ' +
                'leg does not read as a stick.' },
        { title: '4. Run one straight line down the shin',
          body: 'The crest of the tibia sits right under the skin, so it reads as a hard straight line. ' +
                'Draw it and the lower leg suddenly has a bone in it. The fibula runs outside it and ends ' +
                'as the outer ankle bone.' },
        { title: '5. The calf is asymmetric',
          body: 'The calf is two masses: the inner one higher and larger, the outer lower and smaller. So ' +
                'the two outlines peak at different heights. A symmetrical spindle always looks fake.' },
      ],
      landmarks: [
        'Iliac crest — the rim of bone you feel with your hands on your hips',
        'ASIS — the two front points of the pelvis; draw the pelvic tilt through them',
        'Greater trochanter — the bump at the side of the hip, where the leg starts',
        'The kneecap and the bump below it (tibial tuberosity)',
        'The shin crest — a straight line from knee to ankle',
        'Inner ankle (higher, further forward) / outer ankle (lower, further back)',
      ],
      proportions: [
        'At eight heads tall, the crotch is exactly halfway',
        'The knee is halfway between crotch and sole',
        'The greater trochanter sits at about crotch height',
        'Foot length ≈ head length',
      ],
      mistakes: [
        { bad: 'Sticks below the waist, no pelvis', fix: 'Draw the pelvic box and its tilt first' },
        { bad: 'Parallel legs', fix: 'Slope them inward from the trochanters' },
        { bad: 'A circle for the knee', fix: 'A wide box with the cap on the front' },
        { bad: 'A symmetrical calf', fix: 'Inner mass high, outer mass low' },
        { bad: 'Ankles at the same height', fix: 'Inner high, outer low — the ankle always looks tilted' },
      ],
      checks: [
        'Did you set the pelvic tilt before anything else?',
        'Does the femur slope inward?',
        'Is the knee a box?',
        'Is there one hard straight line down the shin?',
        'Do the two calf masses peak at different heights?',
      ],
    },

    refQueries: [
      'Bridgman Constructive Anatomy leg',
      'Gray anatomy pelvis bones plate',
      'femur tibia anatomical illustration',
      'muscles of the thigh anatomical plate',
    ],
    photoQuery: 'legs walking barefoot dancer',

    practice: {
      id: 'lesson-leg',
      title: '下半身をつぶす',
      en: { title: 'Crack the lower body' },
      steps: [
        { drill: 'mass',       source: 'plate', count: 2, seconds: 180 },
        { drill: 'mass',       source: 'photo', count: 2, seconds: 60 },
        { drill: 'proportion', source: 'photo', count: 1, seconds: 180 },
        { drill: 'gesture',    source: 'photo', count: 4, seconds: 30 },
      ],
    },
  },

  /* ========================== 足首と足 ========================== */
  {
    id: 'foot',
    name: '足首と足',
    tagline: '靴の形で覚えているから、裸足になると崩れる',
    problem:
      '足は「くさび形の塊」と「アーチ」でできている。平べったいヘラとして描くと、' +
      '接地しているのか浮いているのか分からない絵になる。足首のねじれも、' +
      '内と外のくるぶしの高さの差を知っているかどうかだけで決まる。',

    steps: [
      {
        title: '① 横から見て「三角のくさび」',
        body:
          '踵は狭くて高く、つま先は広くて低い。横から見ると直角三角形に近い。' +
          'まずこのくさびを置く。指はまだ描かない。',
      },
      {
        title: '② 接地は3点',
        body:
          '踵・親指の付け根（母趾球）・小指の付け根（小趾球）の3点で立っている。' +
          'この3点をまず地面に置くと、足が地面に着く。内側はアーチで浮き、外側は接地する。',
      },
      {
        title: '③ くるぶしは「内が高く、外が低い」',
        body:
          '内くるぶしは高くて前寄り、外くるぶしは低くて後ろ寄り。' +
          'この左右差があるから足首はねじれて見える。同じ高さに描くと、足首だけプラモデルになる。',
      },
      {
        title: '④ 甲は盛り上がる',
        body:
          '足の甲はアーチの頂点なので、平らではなく盛り上がっている。' +
          '足首から指の付け根まではゆるい下り坂。',
      },
      {
        title: '⑤ 指は「親指」と「残り4本」',
        body:
          '手と同じで、親指だけ別グループ。母趾は大きく独立した塊として置き、' +
          '残りの4本はまとめて1つの塊にしてから分ける。',
      },
    ],

    landmarks: [
      '内くるぶし（高い・前）／外くるぶし（低い・後ろ）',
      'アキレス腱 — 踵からふくらはぎへ伸びる細い板。横から見ると足首の後ろが凹む',
      '踵の骨の後ろの丸み',
      '母趾球・小趾球（接地する2つのふくらみ）',
    ],

    proportions: [
      '足の長さ ≒ 頭の長さ ≒ 前腕の長さ',
      '足首の高さは、足の長さの約4分の1',
    ],

    mistakes: [
      { bad: 'くるぶしを左右同じ高さにする', fix: '内を高く、外を低く。足首を傾ける' },
      { bad: '土踏まずを描かない', fix: '内側を浮かせ、外側を接地させる' },
      { bad: '甲を平らにする', fix: 'アーチの頂点として盛り上げる' },
      { bad: '指を全部同じ大きさで並べる', fix: '母趾を大きく別扱い、残り4本は1つの塊から分ける' },
    ],

    checks: [
      '横から見てくさび形になっているか',
      '3点で接地しているか',
      'くるぶしの高さがずれているか',
      '甲が盛り上がっているか',
    ],

    en: {
      name: 'Ankles and feet',
      tagline: 'You memorised the shoe, so barefoot falls apart',
      problem:
        'A foot is a wedge plus an arch. Drawn as a flat spatula, you cannot tell whether it is standing ' +
        'on the ground or floating above it. The twist at the ankle comes down entirely to knowing that ' +
        'the two ankle bones sit at different heights.',
      steps: [
        { title: '1. From the side it is a triangular wedge',
          body: 'The heel is narrow and tall, the toes wide and low. In profile it is close to a right ' +
                'triangle. Place that wedge first. No toes yet.' },
        { title: '2. It stands on three points',
          body: 'Heel, ball of the big toe, ball of the little toe. Put those three on the ground and the ' +
                'foot lands. The inside lifts into the arch; the outside stays down.' },
        { title: '3. Inner ankle high, outer ankle low',
          body: 'The inner ankle is higher and further forward, the outer lower and further back. That ' +
                'difference is the twist. Level them and the ankle turns into a plastic model part.' },
        { title: '4. The instep humps up',
          body: 'The top of the foot is the crown of the arch, so it is not flat. From ankle to toes it ' +
                'is a gentle downhill.' },
        { title: '5. Big toe, then the other four',
          body: 'Like the hand, the big one is its own group. Place it as a large independent mass, then ' +
                'take the remaining four as one mass and divide it.' },
      ],
      landmarks: [
        'Inner ankle (high, forward) / outer ankle (low, back)',
        'Achilles tendon — a thin plate from heel to calf; in profile the back of the ankle dips',
        'The round back of the heel bone',
        'The two balls of the foot that take the weight',
      ],
      proportions: [
        'Foot length ≈ head length ≈ forearm length',
        'Ankle height is about a quarter of the foot length',
      ],
      mistakes: [
        { bad: 'Ankle bones at the same height', fix: 'Inner high, outer low — tilt the ankle' },
        { bad: 'No arch', fix: 'Lift the inside, plant the outside' },
        { bad: 'A flat instep', fix: 'Hump it as the crown of the arch' },
        { bad: 'Five equal toes in a row', fix: 'Big toe separate, the other four split off one mass' },
      ],
      checks: [
        'Is it a wedge in profile?',
        'Is it standing on three points?',
        'Are the ankle bones at different heights?',
        'Does the instep hump up?',
      ],
    },

    refQueries: [
      'Bridgman Constructive Anatomy foot',
      'Gray anatomy bones of the foot',
      'ankle anatomical illustration',
      'foot muscles anatomical plate',
    ],
    photoQuery: 'bare feet',

    practice: {
      id: 'lesson-foot',
      title: '足をつぶす',
      en: { title: 'Crack the foot' },
      steps: [
        { drill: 'mass',    source: 'plate', count: 2, seconds: 180 },
        { drill: 'mass',    source: 'photo', count: 2, seconds: 60 },
        { drill: 'contour', source: 'photo', count: 1, seconds: 120 },
        { drill: 'memory',  source: 'photo', count: 1, seconds: 120 },
      ],
    },
  },
];

export function lessonById(id) {
  return LESSONS.find((l) => l.id === id) || null;
}
