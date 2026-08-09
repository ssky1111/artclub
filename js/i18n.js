/**
 * i18n.js — 日本語／英語の切り替え。
 *
 * 辞書は1か所にまとめて持つ。画面の文字は index.html の data-i18n に付けておき、
 * JS で作る文字だけ t() を通す。翻訳ファイルを別に読みに行かないのは、
 * オフラインでも起動直後に正しい言語で出したいから。
 *
 * ドリルやレッスンのような「中身のある文章」は、その定義の隣に en: {...} を
 * 置いてある（theory.js / anatomy.js）。それを拾うのが tr()。
 */

const LANG_KEY = 'drawpamine.lang';

const DICT = {
  /* ---------- 共通 ---------- */
  'app.name':            { ja: 'ARTCLUB',           en: 'ARTCLUB' },
  'app.beta':            { ja: 'テスト公開中',        en: 'beta' },
  'app.tagline':         { ja: '毎日3分の絵の練習',  en: 'Three minutes of drawing, every day' },
  'common.close':        { ja: '閉じる',             en: 'Close' },
  'common.back':         { ja: 'もどる',             en: 'Back' },
  'common.cancel':       { ja: 'やめる',             en: 'Cancel' },
  'common.save':         { ja: '保存',               en: 'Save' },
  'common.delete':       { ja: '消す',               en: 'Delete' },
  'common.download':     { ja: 'ダウンロード',       en: 'Download' },
  'common.sheets':       { ja: '枚',                 en: '' },
  'common.settings':     { ja: '設定',               en: 'Settings' },
  'common.language':     { ja: '言語',               en: 'Language' },
  'common.none':         { ja: 'なし',               en: 'None' },
  'common.min':          { ja: '分',                 en: 'min' },
  'common.sec':          { ja: '秒',                 en: 's' },
  'common.hour':         { ja: '時間',               en: 'h' },

  /* ---------- ログイン ---------- */
  'auth.login':           { ja: 'ログイン',             en: 'Log in' },
  'auth.logout':          { ja: 'ログアウト',           en: 'Log out' },
  'auth.loginTitle':      { ja: 'ログイン',             en: 'Log in' },
  'auth.loginNote':       { ja: 'ログインすると、ジェスチャードローイングやクロッキーなどすべての練習メニューが使えるようになります。練習の記録やスケッチの保存もできます。',
                            en: 'Log in to unlock all practice modes — gesture drawing, croquis, and more. You can also save your records and sketches.' },
  'auth.withX':           { ja: 'X（Twitter）でログイン', en: 'Log in with X (Twitter)' },
  'auth.withGoogle':      { ja: 'Google でログイン',      en: 'Log in with Google' },
  'auth.loggedIn':        { ja: 'ログイン中',            en: 'Logged in' },
  'auth.privacyNote':     { ja: '勝手に投稿したり情報を取得したりしません。ログインのためだけに使います。',
                            en: 'We will not post or access your data. Login is used for authentication only.' },
  'auth.setUsername':      { ja: 'ユーザーネームを決めてください',  en: 'Choose a username' },
  'auth.usernamePh':       { ja: 'ユーザーネーム',        en: 'Username' },
  'auth.usernameOk':       { ja: '決定',                 en: 'OK' },
  'auth.profile':          { ja: 'プロフィール',          en: 'Profile' },
  'auth.changeUsername':   { ja: 'ユーザーネームを変更',  en: 'Change username' },
  'auth.saved':            { ja: '保存しました',          en: 'Saved' },

  /* ---------- ギャラリー ---------- */
  'gal.showAll':          { ja: 'みんなの作品を見る',     en: 'See what others drew' },
  'gal.title':            { ja: 'みんなの作品',           en: "Everyone's Work" },
  'gal.empty':            { ja: 'まだ誰も描いていません。最初の1人になろう！',
                            en: 'No one has drawn this yet. Be the first!' },
  'gal.upload':           { ja: '作品を投稿する',         en: 'Share your drawing' },
  'gal.uploading':        { ja: '投稿中…',               en: 'Uploading…' },
  'gal.uploaded':         { ja: '投稿しました！',         en: 'Shared!' },
  'gal.uploadFail':       { ja: '投稿に失敗しました',     en: 'Upload failed' },
  'gal.loginToShare':     { ja: 'ログインして作品を保存',  en: 'Log in to save your work' },
  'gal.delete':           { ja: 'この作品を消す',         en: 'Delete this artwork' },
  'gal.deleteConfirm':    { ja: 'この作品を消しますか？', en: 'Delete this artwork?' },
  'gal.close':            { ja: '閉じる',                en: 'Close' },
  'gal.count':            { ja: '{n}人が描きました',      en: '{n} people drew this' },
  'gal.loading':          { ja: '読み込み中…',           en: 'Loading…' },
  'gal.public':           { ja: 'みんなに公開する',       en: 'Share publicly' },
  'gal.private':          { ja: '自分だけに保存',         en: 'Keep private' },

  /* ---------- タブ ---------- */
  'tab.home':            { ja: 'ホーム',   en: 'Home' },
  'tab.library':         { ja: 'しゃしん', en: 'Photos' },
  'tab.log':             { ja: 'きろく',   en: 'Log' },

  /* ---------- ホーム ---------- */
  'home.streakUnit':     { ja: '日',                     en: 'days' },
  'home.todayYet':       { ja: '今日はまだ',             en: 'Not yet today' },
  'home.todayDone':      { ja: '今日は完了',             en: 'Done today' },
  'home.totalDrawings':  { ja: '通算 {n} 枚',            en: '{n} drawings total' },
  'home.totalLabel':     { ja: '枚',                     en: 'drawings' },
  'home.totalTimeLabel': { ja: '分',                     en: 'min' },
  'home.week':           { ja: 'この1週間',              en: 'This week' },
  'home.weekNote':       { ja: '1日に描いた枚数。',      en: 'Drawings per day.' },
  'home.todayLabel':     { ja: '今日の練習',              en: "Today's Practice" },
  'home.modes':          { ja: 'モード',                 en: 'Modes' },
  'home.more':           { ja: 'そのほか',               en: 'More' },
  'home.custom':         { ja: 'じぶんで決めて描く',      en: 'Custom session' },
  'home.customSub':      { ja: '何分・何枚・タグ',        en: 'Time, count, tags' },
  'home.library':        { ja: '写真をいれる・タグをつける', en: 'Add photos & tag them' },
  'home.books':          { ja: '解剖学の本を読む',        en: 'Read the anatomy books' },
  'home.booksSub':       { ja: '図版と日本語訳',          en: 'Plates with translation' },
  'home.start':          { ja: 'はじめる（約{d}）',       en: 'Start ({d})' },
  'home.startPlain':     { ja: 'はじめる',               en: 'Start' },
  'home.roundDone':      { ja: '完了 / 1周',             en: 'Done · 1 round' },
  'home.roundN':         { ja: '完了 / {n}周',           en: 'Done · {n} rounds' },
  'home.freeNow':        { ja: '無料開放中',             en: 'Free for now' },
  'home.paywallTitle':   { ja: '今日のデイリーはあと少し',      en: 'Almost done for today' },
  'home.paywallBody':    { ja: 'デイリーは1日4回まで。モードはいつでも自由に練習できます。',
                           en: 'Daily is available up to 4 times a day. Modes are always free.' },
  'home.paywallCta':     { ja: 'このまま続ける（無料）', en: 'Continue (free)' },
  'home.unsplash':       { ja: 'お題の写真は Unsplash（unsplash.com）のものを使っています。',
                           en: 'Reference photos come from Unsplash (unsplash.com).' },

  /* ---------- セッション ---------- */
  'sess.loading':        { ja: '写真を読み込み中…',   en: 'Loading photo…' },
  'sess.loadingPlate':   { ja: '図版を読み込み中…',   en: 'Loading plate…' },
  'sess.loadFail':       { ja: '絵を取得できませんでした。設定の取得元を確認してください。',
                           en: 'Could not load an image. Check the source in Settings.' },
  'sess.next':           { ja: '次のドリル',           en: 'Next drill' },
  'sess.first':          { ja: 'はじめのドリル',       en: 'First drill' },
  'sess.begin':          { ja: 'はじめる',             en: 'Start' },
  'sess.why':            { ja: 'なぜこれをやるの？',   en: 'Why this drill?' },
  'sess.skipDrill':      { ja: 'これは飛ばす',         en: 'Skip this drill' },
  'sess.left':           { ja: 'のこり',               en: 'left' },
  'sess.paused':         { ja: '（とめ中）',           en: '(paused)' },
  'sess.saveNext':       { ja: '保存してつぎへ',       en: 'Save & next' },
  'sess.hint':           { ja: 'ヒント',               en: 'Hint' },
  'sess.saved':          { ja: '{n}枚目を保存しました', en: 'Saved drawing {n}' },
  'sess.pen':            { ja: 'ペン',                 en: 'Pen' },
  'sess.eraser':         { ja: '消しゴム',             en: 'Eraser' },
  'sess.undo':           { ja: '元に戻す',             en: 'Undo' },
  'sess.clear':          { ja: '全部消す',             en: 'Clear' },
  'sess.opacity':        { ja: '線の濃さ',             en: 'Opacity' },
  'sess.memory':         { ja: '記憶で描く時間',       en: 'Draw from memory' },
  'sess.peek':           { ja: '3秒だけ見る',          en: 'Peek 3s' },
  'sess.sheetsBy':       { ja: '{n}枚 × {t}',          en: '{n} × {t}' },

  /* ---------- ふりかえり ---------- */
  'rev.title':           { ja: 'おつかれさま',         en: 'Nice work' },
  'rev.selfCheck':       { ja: 'セルフチェック',       en: 'Self-check' },
  'rev.selfCheckNote':   { ja: '描いたものを見ながら、できているものだけ押してください。',
                           en: 'Look at what you drew and tap only the ones you managed.' },
  'rev.howWas':          { ja: '今日はどうだった？',   en: 'How did it go?' },
  'rev.reflectNote':     { ja: '意図的練習は「直後のふりかえり」で伸びます。20秒だけ。',
                           en: 'Deliberate practice needs a review right after. Twenty seconds.' },
  'rev.rate1':           { ja: 'むずかしかった',       en: 'Tough' },
  'rev.rate2':           { ja: 'まあまあ',             en: 'OK' },
  'rev.rate3':           { ja: 'つかめた',             en: 'Got it' },
  'rev.notePh':          { ja: '気づいたことを一言（例：肩のラインをいつも水平に描いてしまう）',
                           en: 'One thing you noticed (e.g. I always draw the shoulder line level)' },
  'rev.drawn':           { ja: 'きょう描いたもの',     en: 'What you drew today' },
  'rev.drawnNote':       { ja: '押すと大きく見られます。端末のなかにだけ保存されます。',
                           en: 'Tap to enlarge. Everything stays on this device.' },
  'rev.addPhoto':        { ja: '写真を追加',           en: 'Add a photo' },
  'rev.downloadAll':     { ja: '全部ダウンロード',     en: 'Download all' },
  'rev.sheet':           { ja: '1枚にまとめて出力',    en: 'Export as one sheet' },
  'rev.share':           { ja: 'シェアする',           en: 'Share' },
  'rev.shareX':          { ja: 'X に投稿する',         en: 'Post on X' },
  'rev.shareNote':       { ja: '画像は自動では付きません。ダウンロードしてから貼ってください。',
                           en: 'The image is not attached automatically — download it and attach it.' },
  'rev.shareText':       { ja: '今日は {n}枚 / {d} 描きました。#ARTCLUB',
                           en: 'Drew {n} sketches in {d} today. #ARTCLUB' },
  'rev.save':            { ja: '保存して終わる',       en: 'Save & finish' },
  'rev.again':           { ja: 'もう1セットやる',      en: 'One more round' },
  'rev.streakLine':      { ja: '連続 {s} 日 / 通算 {n} 回', en: '{s}-day streak · {n} sessions' },
  'rev.sheetDone':       { ja: 'まとめ画像を作りました', en: 'Contact sheet ready' },

  /* ---------- 写真の管理 ---------- */
  'lib.title':           { ja: '写真',                 en: 'Photos' },
  'lib.note':            { ja: 'アンスプラッシュなどで集めた写真をいれて、タグを付けておくと、' +
                               'そのタグでお題を出せます。写真は端末のなかにだけ残ります。',
                           en: 'Add the photos you collected (from Unsplash and elsewhere) and tag them. ' +
                               'Sessions then draw from those tags. Photos stay on this device.' },
  'lib.filter':          { ja: 'しぼりこみ',           en: 'Filter' },
  'lib.empty':           { ja: 'まだ1枚もありません。右上の＋から入れてください。',
                           en: 'Nothing here yet. Use + at the top right.' },
  'lib.tags':            { ja: 'タグ',                 en: 'Tags' },
  'lib.pastWork':        { ja: 'この写真で描いたもの', en: 'Your drawings from this photo' },
  'lib.deleteOne':       { ja: 'この写真を消す',       en: 'Delete this photo' },
  'lib.deleteConfirm':   { ja: 'この写真を消します。よろしいですか？', en: 'Delete this photo?' },
  'lib.noneYet':         { ja: 'まだこの写真では描いていません。', en: "You haven't drawn this one yet." },
  'lib.importing':       { ja: '{n}枚を取り込んでいます…', en: 'Importing {n} photos…' },
  'lib.imported':        { ja: '{n}枚いれました。タップしてタグを付けてください',
                           en: 'Added {n}. Tap one to tag it.' },
  'lib.builtin':         { ja: '同梱',                 en: 'Bundled' },

  /* ---------- 管理画面 ---------- */
  'admin.title':         { ja: '管理',                 en: 'Admin' },
  'admin.lock':          { ja: 'パスワード',           en: 'Password' },
  'admin.setPass':       { ja: 'この端末の管理パスワードを決めてください（初回だけ）',
                           en: 'Set an admin password for this device (first time only)' },
  'admin.enterPass':     { ja: 'パスワードを入れてください', en: 'Enter the password' },
  'admin.wrong':         { ja: 'ちがいます',           en: 'Wrong password' },
  'admin.unlock':        { ja: 'ひらく',               en: 'Unlock' },
  'admin.lockAgain':     { ja: 'ロックする',           en: 'Lock' },
  'admin.passNote':      { ja: '管理画面のパスワードです。',
                           en: 'Admin password.' },
  'admin.repo':          { ja: 'リポジトリに入れる',   en: 'Publish to the repository' },
  'admin.repoNote':      { ja: '端末の写真とタグを、そのままリポジトリの photos/ に置きます。' +
                               '置いたものは、この端末以外でもお題として出ます。',
                           en: 'Copies the photos and tags on this device into photos/ in the repository. ' +
                               'Anything published there shows up as a prompt on every device.' },
  'admin.token':         { ja: 'GitHub のトークン（repo 権限）', en: 'GitHub token (repo scope)' },
  'admin.tokenNote':     { ja: 'トークンはこの端末のブラウザにだけ保存され、GitHub 以外には送られません。' +
                               'リポジトリには絶対に書き込みません。',
                           en: 'The token is kept in this browser only and is sent to GitHub alone. ' +
                               'It is never written into the repository.' },
  'admin.repoPath':      { ja: 'owner/repo',           en: 'owner/repo' },
  'admin.branch':        { ja: 'ブランチ',             en: 'Branch' },
  'admin.push':          { ja: 'プッシュする（{n}枚）', en: 'Push ({n} photos)' },
  'admin.pushing':       { ja: 'プッシュ中… {i}/{n}',  en: 'Pushing… {i}/{n}' },
  'admin.pushed':        { ja: '{n}枚をプッシュしました', en: 'Pushed {n} photos' },
  'admin.pushFail':      { ja: 'プッシュに失敗しました：{m}', en: 'Push failed: {m}' },
  'admin.exportZip':     { ja: '書き出す（手で commit する用）', en: 'Export files (commit by hand)' },
  'admin.exportNote':    { ja: 'トークンを使いたくないときは、ここから画像と manifest.json を' +
                               'ダウンロードして、photos/ に置いて commit してください。',
                           en: "If you'd rather not use a token, download the images and manifest.json " +
                               'here, drop them into photos/ and commit.' },
  'admin.needTag':       { ja: 'タグが付いていない写真が {n} 枚あります', en: '{n} photos have no tags' },
  'admin.published':     { ja: 'リポジトリに入っている写真', en: 'Photos in the repository' },
  'admin.localOnly':     { ja: 'この端末だけにある写真', en: 'Photos only on this device' },

  /* ---------- 解剖学の本 ---------- */
  'books.title':         { ja: '解剖学の本',           en: 'Anatomy books' },
  'books.note':          { ja: '著作権の切れた美術解剖書の図版を Wikimedia Commons から読み込みます。' +
                               '図版の中の文字は英語ですが、下に用語の日本語訳を付けてあります。',
                           en: 'Plates from public-domain artistic anatomy books, loaded from Wikimedia Commons.' },
  'books.load':          { ja: '図版を読み込む',       en: 'Load plates' },
  'books.loading':       { ja: '図版を探しています…',  en: 'Looking for plates…' },
  'books.none':          { ja: '図版が見つかりませんでした（通信環境か Commons 側の問題かもしれません）。',
                           en: 'No plates found (network or Commons may be at fault).' },
  'books.glossary':      { ja: '図版に出てくる用語',   en: 'Terms on the plates' },
  'books.translated':    { ja: '日本語訳',             en: 'Translation' },
  'books.original':      { ja: '原題',                 en: 'Original title' },
  'books.plates':        { ja: '図版',                 en: 'Plates' },

  /* ---------- レッスン ---------- */
  'lesson.masses':       { ja: '塊に置き換える順番',   en: 'Order of the masses' },
  'lesson.proportions':  { ja: '比率',                 en: 'Proportions' },
  'lesson.mistakes':     { ja: 'よくある失敗と直し方', en: 'Common mistakes and fixes' },
  'lesson.plates':       { ja: '参考図版',             en: 'Reference plates' },
  'lesson.practice':     { ja: 'この部位を練習する',   en: 'Practise this part' },
  'lesson.review':       { ja: '前にできなかったところをやる', en: 'Redo what you missed' },
  'lesson.sources':      { ja: '出典（すべて著作権保護期間が満了した書籍）',
                           en: 'Sources (all out of copyright)' },

  /* ---------- 記録 ---------- */
  'log.title':           { ja: 'きろく',               en: 'Log' },
  'log.streak':          { ja: '連続日数',             en: 'Streak' },
  'log.best':            { ja: '最長記録',             en: 'Best' },
  'log.minutes':         { ja: '合計(分)',             en: 'Minutes' },
  'log.drawings':        { ja: '描いた枚数',           en: 'Drawings' },
  'log.calNote':         { ja: '描いた絵は、その日のマスに貼られます。',
                           en: 'Your drawings appear on the day you made them.' },
  'log.whatPractised':   { ja: 'なにを練習したか',     en: 'What you practised' },
  'log.notes':           { ja: 'ふりかえりノート',     en: 'Review notes' },
  'log.noNotes':         { ja: 'ふりかえりのメモがここに並びます。', en: 'Your notes will show up here.' },
  'log.noRecord':        { ja: 'まだ記録がありません。', en: 'Nothing recorded yet.' },
  'log.restDay':         { ja: 'この日は休み',         en: 'Rest day' },
  'log.drew':            { ja: '{d} 描いた',           en: 'Drew for {d}' },

  /* ---------- 設定 ---------- */
  'set.title':           { ja: '設定',                 en: 'Settings' },
  'set.genres':          { ja: 'お題のジャンル',       en: 'Prompt genres' },
  'set.genresNote':      { ja: '選んだジャンルからランダムに出題します。',
                           en: 'Prompts are picked at random from the genres you choose.' },
  'set.source':          { ja: 'お題をどこから持ってくるか', en: 'Where prompts come from' },
  'set.srcUnsplash':     { ja: 'アンスプラッシュ（ジャンルを選べる・キーが必要）',
                           en: 'Unsplash (choose a genre; needs a key)' },
  'set.srcPicsum':       { ja: 'おためし（キー不要。ただし写真はランダムで、人物は出ません）',
                           en: 'Demo (no key, but random photos — no people)' },
  'set.srcLocal':        { ja: '端末のなかの画像',     en: 'Images on this device' },
  'set.key':             { ja: 'アンスプラッシュのキー', en: 'Unsplash access key' },
  'set.keyTest':         { ja: '接続テスト',           en: 'Test' },
  'set.keyHow':          { ja: 'キーの取り方',         en: 'How to get a key' },
  'set.pick':            { ja: '画像を選ぶ',           en: 'Choose images' },
  'set.practice':        { ja: '練習の設定',           en: 'Practice' },
  'set.look':            { ja: '見た目',               en: 'Appearance' },
  'set.themeLight':      { ja: 'ライト（デフォルト）', en: 'Light (default)' },
  'set.themeDark':       { ja: 'ダーク（夜向け）',     en: 'Dark' },
  'set.themePaper':      { ja: 'ペーパー',             en: 'Paper' },
  'set.tick':            { ja: '残り3秒でカチッと鳴らす', en: 'Tick in the last three seconds' },
  'set.sfx':             { ja: '効果音を鳴らす',       en: 'Play sound effects' },
  'set.autoflip':        { ja: '毎回ランダムに左右反転する', en: 'Randomly mirror the reference' },
  'set.keepawake':       { ja: '練習中に画面を消さない', en: 'Keep the screen on while practising' },
  'set.orientation':     { ja: '写真の向き',           en: 'Photo orientation' },
  'set.orAny':           { ja: 'おまかせ',             en: 'Either' },
  'set.orPortrait':      { ja: '縦',                   en: 'Portrait' },
  'set.orLandscape':     { ja: '横',                   en: 'Landscape' },
  'set.penAlpha':        { ja: '線の透明度',           en: 'Line opacity' },
  'set.penAlphaNote':    { ja: 'あたりを薄く描いてから上に重ねたいときに下げます。',
                           en: 'Turn it down to rough things in lightly before committing.' },
  'set.data':            { ja: 'データ',               en: 'Data' },
  'set.export':          { ja: '記録を書き出す',       en: 'Export records' },
  'set.reset':           { ja: 'すべて消す',           en: 'Erase everything' },
  'set.resetConfirm':    { ja: '練習記録と設定をすべて消します。元に戻せません。',
                           en: 'This erases all records and settings. It cannot be undone.' },
  'set.erased':          { ja: '消しました',           en: 'Erased' },
  'set.basis':           { ja: 'この練習メニューの根拠', en: 'Why the menu looks like this' },
  'set.admin':           { ja: '管理画面をひらく',     en: 'Open admin' },
  'set.credits':         { ja: 'クレジット',           en: 'Credits' },
  'set.creditsBody':     { ja: 'お題の写真は Unsplash（unsplash.com）の写真家によるものです。' +
                               '解剖図版は Wikimedia Commons 経由で、著作権保護期間が満了した書籍から取得しています。',
                           en: 'Reference photos are by Unsplash photographers (unsplash.com). ' +
                               'Anatomy plates come via Wikimedia Commons from books out of copyright.' },

  /* ---------- 設定シート（じぶんで決めて描く） ---------- */
  'setup.what':          { ja: 'なにを描く',           en: 'What to draw' },
  'setup.howLong':       { ja: '1まい何分',            en: 'Time per drawing' },
  'setup.howMany':       { ja: '何まい',               en: 'How many' },
  'setup.how':           { ja: '描きかた',             en: 'Drill' },
  'setup.start':         { ja: 'はじめる（{d}）',      en: 'Start ({d})' },
  'setup.part':          { ja: 'どこを練習する？',     en: 'Which part?' },

  /* ---------- トースト ---------- */
  'toast.pickGenre':     { ja: 'ジャンルは1つ以上えらんでください', en: 'Pick at least one genre' },
  'toast.noPhoto':       { ja: 'その条件の写真がありません。写真の管理から追加してください',
                           en: 'No photos match. Add some in Photos.' },
  'toast.imgFail':       { ja: '画像を読み込めませんでした', en: 'Could not read that image' },
  'toast.partial':       { ja: '途中まででも記録しました（{m}分）', en: 'Recorded what you did ({m} min)' },
  'toast.saveFail':      { ja: '絵の保存に失敗しました（記録は残ります）',
                           en: 'Could not store the drawings (the session is still recorded)' },
};

let lang = read();

function read() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ja' || saved === 'en') return saved;
  } catch { /* プライベートモードなど */ }
  return (navigator.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function getLang() { return lang; }

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'ja';
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* 保存できなくても続ける */ }
  document.documentElement.lang = lang;
  return lang;
}

/** t('home.start', { d: '12分' }) */
export function t(key, vars) {
  const entry = DICT[key];
  let text = entry ? (entry[lang] ?? entry.ja) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
  return text;
}

/**
 * 定義オブジェクトの中の英訳を拾う。en が無ければ日本語のまま返す。
 * tr(DRILLS.gesture, 'name')
 */
export function tr(obj, field) {
  if (!obj) return '';
  if (lang === 'en' && obj.en && obj.en[field] != null) return obj.en[field];
  return obj[field];
}

/** 秒数を今の言語で読める形に。 */
export function fmtDur(seconds) {
  if (seconds < 60) return lang === 'ja' ? `${Math.round(seconds)}秒` : `${Math.round(seconds)}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return lang === 'ja' ? `${m}分` : `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return lang === 'ja' ? `${h}時間${rest}分` : `${h}h ${rest}m`;
}

/** 「3枚」/「3」。英語では枚数に単位を付けない。 */
export function fmtCount(n) {
  return lang === 'ja' ? `${n}枚` : String(n);
}

/**
 * data-i18n が付いている要素の文字を差し替える。
 *   data-i18n       … textContent
 *   data-i18n-ph    … placeholder
 *   data-i18n-title … title
 *   data-i18n-label … data-icon-label（アイコン付きボタン）
 */
export function applyI18n(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-i18n-ph]')) {
    node.placeholder = t(node.dataset.i18nPh);
  }
  for (const node of root.querySelectorAll('[data-i18n-title]')) {
    node.title = t(node.dataset.i18nTitle);
  }
  for (const node of root.querySelectorAll('[data-i18n-label]')) {
    node.dataset.iconLabel = t(node.dataset.i18nLabel);
  }
  document.documentElement.lang = lang;
}

setLang(lang);
