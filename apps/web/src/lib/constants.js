/**
 * 共通の定数定義
 */

// 工学系（電気電子・情報・機械の横断）に最適化した科目セット。
// 新規分野を追加する場合はここに足し、SUBJECT_TOPICS と
// backend/main.py の _STEM_SUBJECTS / _SUBJECT_TIER_MAP も併せて更新する。
export const SUBJECTS = [
  '物理',
  '数学',
  '電気回路',
  '電子回路',
  '電磁気学',
  '制御工学',
  '信号処理',
  '通信工学',
  'ディジタル回路',
  'アルゴリズム',
  'プログラミング',
  '応用情報',
];

/**
 * AI モデルティア定義
 * subject_hint: このティアが自動選択される教科パターン（auto モード用）
 */
export const MODEL_TIERS = [
  {
    id: 'lite',
    label: 'ライト',
    model: 'gpt-4o',
    description: '高速・低コスト。短答・暗記系向き',
    badge: '⚡',
    color: 'emerald',
    subject_hint: ['応用情報'],
  },
  {
    id: 'standard',
    label: 'スタンダード',
    model: 'gpt-5.2',
    description: '高精度。物理・数学・回路の図表問題に最適',
    badge: '🎯',
    color: 'blue',
    subject_hint: ['物理', '数学', '電気回路'],
  },
  {
    id: 'premium',
    label: 'プレミアム',
    model: 'gpt-5.4',
    description: '最高品質。難関問題・複雑な回路図・力学解析',
    badge: '🏆',
    color: 'purple',
    subject_hint: [],
  },
];
export const DIFFICULTIES = [
  { value: '基礎', label: '基礎', description: '教科書の例題・公式の直接適用', numeric: 0.1 },
  { value: '標準', label: '標準', description: '大学初年度の演習・章末問題レベル', numeric: 0.3 },
  { value: '応用', label: '応用', description: '専門課程の演習・応用情報技術者試験レベル', numeric: 0.5 },
  { value: '発展', label: '発展', description: '院試・電験三種・高度試験の基本レベル', numeric: 0.7 },
  { value: '難関', label: '難関', description: '難関院試・電験二種・技術士一次レベル', numeric: 0.85 },
  { value: '最難関', label: '最難関', description: '技術士二次・電験一種・難関院試の最難問', numeric: 0.95 },
];
export const DIFFICULTY_MAP = Object.fromEntries(DIFFICULTIES.map(d => [d.value, d.numeric]));

/**
 * 教科 → 分野（トピック） マッピング
 * テンプレート選択やDB登録で利用。
 */
export const SUBJECT_TOPICS = {
  '物理': [
    '力学', '熱力学', '波動', '電磁気学', '原子物理',
    '解析力学', '連続体力学', '流体力学', '材料力学',
  ],
  '数学': [
    '微分積分', '線形代数', '微分方程式', 'ベクトル解析',
    '複素関数論', 'フーリエ解析', 'ラプラス変換',
    '確率・統計', '離散数学', '数値解析', '最適化',
  ],
  '電気回路': [
    '直流回路', '交流回路（フェーザ）', '過渡現象',
    '三相交流', 'キルヒホッフの法則', '重ね合わせの理',
    'テブナン・ノートン等価回路', '二端子対回路（F・Z・Yパラメータ）',
    '共振回路（RLC）', 'フィルタ（LPF/HPF/BPF）',
  ],
  '電子回路': [
    'ダイオード回路', 'トランジスタ（バイアス・小信号）',
    'FET（MOSFET・JFET）', '増幅回路（CE・CC・CB）',
    '差動増幅回路', 'オペアンプ（反転・非反転・積分・微分）',
    '電源回路（整流・平滑・安定化）', '発振回路', 'PLL・ミキサ',
  ],
  '電磁気学': [
    '静電場（クーロン・ガウスの法則）', '電位・電気双極子',
    '誘電体・分極', '静磁場（ビオ・サバール・アンペールの法則）',
    '電磁誘導（ファラデー・レンツ）', '相互誘導・自己インダクタンス',
    'マクスウェル方程式', '電磁波の伝搬', '導波管・伝送線路',
  ],
  '制御工学': [
    '伝達関数', 'ブロック線図', 'ラプラス変換による解法',
    '極・零点・安定性', 'ボード線図・ナイキスト線図',
    'PID制御', '状態空間表現', '可制御性・可観測性',
    '現代制御（LQR・カルマンフィルタ）', '離散時間制御',
  ],
  '信号処理': [
    '連続時間信号・離散時間信号', 'フーリエ変換・DFT・FFT',
    'z変換', 'サンプリング定理', 'ディジタルフィルタ（FIR・IIR）',
    'たたみ込み・相関', 'スペクトル解析', 'ウィンドウ関数',
    '適応フィルタ', '画像処理基礎',
  ],
  '通信工学': [
    '変調方式（AM・FM・PM）', 'ディジタル変調（PSK・QAM・FSK）',
    '標本化・量子化・符号化', '誤り検出・訂正符号',
    '情報理論（エントロピー・通信路容量）',
    '多重化（FDM・TDM・OFDM）', '通信路モデル', '無線伝搬',
  ],
  'ディジタル回路': [
    '論理代数（ブール代数）', '組合せ論理回路（加算器・デコーダ）',
    '順序論理回路（フリップフロップ・カウンタ）',
    'カルノー図・最小化', 'FSM（有限状態機械）',
    'HDL基礎（Verilog・VHDL）', 'メモリ素子（SRAM・DRAM・ROM）',
    'タイミング解析',
  ],
  'アルゴリズム': [
    '計算量（Big-O）', 'ソート（クイック・マージ・ヒープ）',
    '探索（二分・ハッシュ）', 'グラフ探索（BFS・DFS）',
    '最短経路（Dijkstra・Bellman-Ford）', '動的計画法',
    '貪欲法', '分割統治法', 'データ構造（スタック・キュー・木・ヒープ）',
    'ハッシュテーブル', '文字列照合',
  ],
  'プログラミング': [
    '基本構文（変数・型・制御）', '関数・スコープ・再帰',
    'オブジェクト指向（クラス・継承・多態）', '例外処理',
    'ファイル入出力', 'モジュール化・ライブラリ',
    'メモリ管理（C/C++ ポインタ・スマートポインタ）',
    '並行・並列処理（スレッド・非同期）',
    'テスト・デバッグ', 'バージョン管理（Git）',
  ],
  '応用情報': [
    'システム戦略・経営戦略', 'プロジェクトマネジメント',
    'サービスマネジメント', 'システム監査',
    'ハードウェア（CPU・パイプライン）', 'メモリ階層（キャッシュ・仮想記憶）',
    'OS（プロセス・スケジューリング）', 'データベース（SQL・正規化・トランザクション）',
    'ネットワーク（OSI・TCP/IP・サブネット）', 'セキュリティ（暗号・認証・脆弱性）',
    'システム開発（要件・設計・テスト）',
  ],
};

/**
 * 物理の階層的カリキュラム（大分野 → 中分野 → トピック）
 * 練習モードのトピック選択UIで使用
 */
export const PHYSICS_CURRICULUM = [
  {
    id: 'basics', label: '物理の基礎', icon: '📐',
    sections: [
      { label: '物理の基礎', topics: ['物理量', 'SI単位系', '次元解析', '有効数字', '測定誤差', 'グラフ解析'] },
    ],
  },
  {
    id: 'mechanics', label: '力学', icon: '⚙️',
    sections: [
      { label: '運動', topics: ['位置・変位', '速度', '加速度', '等速直線運動', '等加速度直線運動', '相対速度'] },
      { label: '落体・投射', topics: ['自由落下', '鉛直投射', '水平投射', '斜方投射'] },
      { label: '力', topics: ['力の概念', 'ベクトル', '力の合成', '力の分解', '力のつり合い'] },
      { label: 'ニュートン力学', topics: ['ニュートンの運動の三法則', '慣性', '質量'] },
      { label: '力の種類', topics: ['重力', '万有引力', '垂直抗力', '張力', '静止摩擦', '動摩擦', '弾性力（フックの法則）'] },
      { label: '運動方程式', topics: ['運動方程式', '摩擦を含む運動', '斜面運動', '連結系', '滑車・アトウッド'] },
      { label: '円運動', topics: ['等速円運動', '向心加速度', '向心力', '遠心力'] },
      { label: '振動', topics: ['単振動', 'ばね振動', '単振り子'] },
      { label: 'エネルギー', topics: ['仕事', '仕事率', '運動エネルギー', '位置エネルギー', '弾性エネルギー', '力学的エネルギー保存'] },
      { label: '運動量', topics: ['運動量', '力積', '運動量保存則', '弾性衝突', '非弾性衝突', '反発係数'] },
      { label: '剛体', topics: ['力のモーメント', 'トルク', '剛体のつり合い', '重心', '慣性モーメント'] },
      { label: '流体', topics: ['圧力', '浮力', 'パスカルの原理'] },
    ],
  },
  {
    id: 'thermo', label: '熱力学', icon: '🔥',
    sections: [
      { label: '温度・熱量', topics: ['温度', '熱平衡', '熱量', '比熱', '熱容量', '熱量保存'] },
      { label: '熱の移動', topics: ['熱伝導', '対流', '放射'] },
      { label: '気体', topics: ['ボイルの法則', 'シャルルの法則', 'ボイル・シャルル', '気体の状態方程式'] },
      { label: '分子運動論', topics: ['分子運動', '圧力の起源', '平均運動エネルギー'] },
      { label: '熱力学法則', topics: ['熱力学第一法則', '等温変化', '等圧変化', '等積変化', '断熱変化', '熱機関・熱効率'] },
    ],
  },
  {
    id: 'waves', label: '波動', icon: '🌊',
    sections: [
      { label: '波の基本', topics: ['波', '波長', '周期', '振動数', '波速'] },
      { label: '波の現象', topics: ['重ね合わせの原理', '反射', '屈折', '回折', '干渉'] },
      { label: '定常波', topics: ['定常波（腹・節）'] },
      { label: '音', topics: ['音波', '共鳴', 'ドップラー効果'] },
      { label: '幾何光学', topics: ['光の反射', '光の屈折', '全反射', 'レンズ・像'] },
      { label: '波動光学', topics: ['光の干渉', '光の回折', '回折格子'] },
    ],
  },
  {
    id: 'em', label: '電磁気', icon: '⚡',
    sections: [
      { label: '電荷・電場', topics: ['クーロンの法則', '電場', '電気力線', '静電誘導'] },
      { label: '電位', topics: ['電位', '電位差', '電位エネルギー'] },
      { label: 'コンデンサー', topics: ['電気容量', '誘電体', 'コンデンサーのエネルギー'] },
      { label: '電流・回路', topics: ['電流', '電圧', '抵抗', 'オームの法則', '直列回路', '並列回路', 'キルヒホッフの法則'] },
      { label: '電力', topics: ['電力', 'ジュール熱'] },
      { label: '磁場', topics: ['電流の作る磁場', '磁束'] },
      { label: '電磁力', topics: ['ローレンツ力', 'フレミング左手の法則'] },
      { label: '電磁誘導', topics: ['ファラデーの法則', 'レンツの法則', '誘導起電力', '交流'] },
      { label: '電磁波', topics: ['電磁波の性質', '電磁波スペクトル'] },
    ],
  },
  {
    id: 'modern', label: '原子・量子', icon: '⚛️',
    sections: [
      { label: '光量子', topics: ['光子', '光電効果'] },
      { label: '量子現象', topics: ['コンプトン効果', 'ド・ブロイ波', '波動粒子二重性'] },
      { label: '原子構造', topics: ['原子スペクトル', 'ボーア模型', 'エネルギー準位'] },
      { label: '原子核', topics: ['α線', 'β線', 'γ線', '核反応', '核分裂', '核融合'] },
    ],
  },
];

/**
 * 難易度数値 → 日本語ラベル変換
 */
export function difficultyLabel(v) {
  if (v === null || v === undefined || v === '') return '—';
  // 文字列ラベルがそのまま渡された場合
  const found = DIFFICULTIES.find(d => d.value === v);
  if (found) return found.label;
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  if (n < 0.15) return '基礎';
  if (n < 0.25) return '標準';
  if (n < 0.45) return '応用';
  if (n < 0.65) return '発展';
  if (n < 0.9) return '難関';
  return '最難関';
}

/**
 * 問題形式の定義
 */
export const QUESTION_FORMATS = [
  { value: 'standard', label: '通常形式', description: '記述式の問題と解答' },
  { value: 'fill_in_blank', label: '穴埋め形式', description: '空欄補充・穴埋め問題' },
  { value: 'choice', label: '選択肢形式', description: '四択・多肢選択問題' },
  { value: 'true_false', label: '正誤判定', description: '正しいか誤りか判定する問題' },
];

/**
 * 解答スタイルの定義（工学系では文字式回答がデフォルト）
 */
export const ANSWER_STYLES = [
  {
    value: 'symbolic',
    label: '文字式',
    description: '物理量を記号($E, R, V, I$ など)のまま扱い、文字式で答えさせる（デフォルト）',
    isDefault: true,
  },
  {
    value: 'numeric',
    label: '数値',
    description: '具体的な数値を与え、数値計算の結果を答えさせる',
  },
  {
    value: 'mixed',
    label: '混合',
    description: '一部は文字式、一部は数値代入で確認させる',
  },
];

/**
 * テンプレート追加用のプロンプト本文を自動生成
 */
export function buildTemplatePrompt(subject, field, options = {}) {
  const { questionFormat, answerStyle = 'symbolic', theme } = options;
  const label = field ? `${subject}（${field}）` : subject;
  const formatDef = QUESTION_FORMATS.find(f => f.value === questionFormat);
  const formatLabel = formatDef ? formatDef.label : null;
  const answerDef = ANSWER_STYLES.find(a => a.value === answerStyle) || ANSWER_STYLES[0];

  const lines = [
    '科目: {subject}',
    field ? `分野: ${field}` : null,
    theme ? `テーマ: ${theme}` : null,
    '難易度: {difficulty}',
    '出題数: {num_questions}',
    formatLabel ? `問題形式: ${formatLabel}` : null,
    `解答スタイル: ${answerDef.label}`,
    '',
    '指示:',
    `以下の条件で${label}の問題を出題してください。`,
    field ? `特に「${field}」の範囲を重点的に扱ってください。` : null,
    theme ? `テーマは「${theme}」に焦点を当ててください。` : null,
    '',
    '- 問題と解答・解説を必ず含めること',
    '- 問題数は {num_questions} 問とする',
    '- 難易度は「{difficulty}」レベルに合わせること',
  ];

  // 解答スタイル別の追加指示
  if (answerStyle === 'symbolic') {
    lines.push(
      '',
      '【解答スタイル: 文字式（デフォルト・工学系の基本）】',
      '- 物理量を表す変数は ★具体的な数値を与えず記号のまま★ で問題に登場させる',
      '  例: $E$ [V], $R_1, R_2$ [Ω], $\\omega$ [rad/s], $m$ [kg], $g$ [m/s²]',
      '- 解答は ★文字式（記号の代数演算結果）★ で表現させる',
      '  例: $I = \\dfrac{E}{R_1 + R_2}$,  $V_1 = \\dfrac{R_1}{R_1 + R_2} E$',
      '- 最終形は約分・通分済みの既約な形にする',
      '- 解説では文字式の物理的意味（なぜその形になるか）に必ず触れる',
    );
  } else if (answerStyle === 'numeric') {
    lines.push(
      '',
      '【解答スタイル: 数値】',
      '- 物理量に具体的な数値を与え、数値計算の結果を答えさせる',
      '- 計算過程を省略せず、各段階の数値を明示する',
      '- 有効数字 2〜3 桁で答え、単位を必ず付ける',
      '- 物理定数が必要な場合は問題文に明記する',
    );
  } else if (answerStyle === 'mixed') {
    lines.push(
      '',
      '【解答スタイル: 混合】',
      '- 前半の小問では文字式で一般解を導出',
      '- 後半の小問で具体的な数値を与え、数値結果を確認させる',
      '- 文字式 → 数値代入の流れを明示する',
    );
  }

  // 問題形式別の追加指示
  if (questionFormat === 'fill_in_blank') {
    lines.push(
      '',
      '【穴埋め形式の指示】',
      '- 問題文中の重要な語句・数式・用語を空欄（ \\\\fbox{\\\\phantom{ア}} 等 ）に置き換えてください',
      '- 空欄は ア, イ, ウ, ... で番号を振ってください',
      '- 各空欄の正答を解答欄にまとめてください',
      '- 文脈から答えが一意に定まるようにしてください',
    );
  } else if (questionFormat === 'choice') {
    lines.push(
      '',
      '【選択肢形式の指示】',
      '- 各問に4つの選択肢（① ② ③ ④）を用意してください',
      '- 紛らわしい誤答（ディストラクター）を含めてください',
      '- 正解は1つとし、解説で各選択肢が正誤である理由を説明してください',
    );
  } else if (questionFormat === 'true_false') {
    lines.push(
      '',
      '【正誤判定の指示】',
      '- 各問は文を提示し、正しいか誤りかを判定させてください',
      '- 誤りの場合は正しい内容も解説に含めてください',
    );
  }

  return lines.filter((l) => l !== null).join('\n');
}

/**
 * DB 保存用の JSON 出力形式指示テキスト。
 * プロンプト末尾に付加して LLM に構造化出力を強制する。
 * problems テーブルのカラムと整合。
 */
export const OUTPUT_FORMAT_INSTRUCTION = `

--- 出力形式（厳守）---
必ず以下の JSON 形式のみで回答してください。JSON 以外のテキストは一切出力しないでください。
コードブロック(\`\`\`json ... \`\`\`)で囲んでも構いません。

\`\`\`json
{
  "subject": "科目名（例: 物理, 数学, 電気回路, 応用情報）",
  "field": "分野名（例: 力学, 微分積分, 交流回路, アルゴリズム）",
  "stem": "問題文（プレーンテキスト。LaTeX数式は$...$で囲む）",
  "stem_latex": "問題文のLaTeX表現（\\\\documentclassから\\\\end{document}まで完全な文書、または数式のみ）",
  "solution_outline": "解法の手順・方針を簡潔に記述",
  "explanation": "詳しい解説（途中式や考え方を含む）",
  "answer_brief": "最終的な答えの要約（1〜2文）",
  "final_answer": "-4",
  "verification_code": "from sympy import *\\nx = symbols('x')\\nf = x**2 + 4*x\\nresult = solve(diff(f, x), x)\\nmin_val = f.subs(x, result[0])\\nprint(min_val)  # => -4",
  "checks": [
    {"desc": "検算1の説明（日本語テキスト）", "ok": true},
    {"desc": "検算2の説明（日本語テキスト）", "ok": true}
  ],
  "difficulty": 0.5,
  "confidence": 0.9
}
\`\`\`

重要な制約:
- final_answer: 数値または短い文字列のみ（例: "-4", "3", "x=2", "A"）。説明文や括弧付き注釈は入れず、値のみにすること。
- verification_code（数学問題は必須）: final_answer を検算するための Python コード。
  * sympy を使って数式を定義し、計算結果を print() で出力すること。
  * コードの最終行の print() 出力が final_answer と一致すること。
  * 例: 微分→diff(), 積分→integrate(), 方程式→solve(), 極値→solve(diff(f,x),x) 等
  * コードは単独で実行可能であること（import文を含める）。
  * 数学・物理以外の問題（応用情報の暗記系など）では省略可。
- checks: 必ず2件以上。各項目は {"desc": "説明文", "ok": true/false} の形式。
  * 少なくとも1件は verification_code の実行結果に基づく検算を含めること。
- subject（必須）: 科目名（例: 物理, 数学, 電気回路, 応用情報）
- field（必須）: 分野名（例: 力学, 微分積分, 交流回路, アルゴリズム）
- stem（必須）: 問題文のプレーンテキスト
- stem_latex: LaTeX形式の問題文
- solution_outline: 解法の概要
- explanation: 詳細な解説
- answer_brief: 答えの短い要約
- difficulty: 難易度（0.0〜1.0）
- confidence: 回答の確信度（0.0〜1.0）
`;

/**
 * 基本問題（参考問題）をプロンプトに組み込むための指示テキストを生成。
 * referenceStem, referenceAnswer が入力されている場合に付加。
 */
export function buildReferencePromptSection(referenceStem, referenceAnswer) {
  if (!referenceStem?.trim()) return '';
  const lines = [
    '',
    '--- 参考問題（類題生成の基準）---',
    '以下の問題を参考に、同じ分野・同程度の難易度で類題を作成してください。',
    '問題の構造やパターンを踏襲しつつ、数値や設定を変えてください。',
    '',
    '【参考問題】',
    referenceStem.trim(),
  ];
  if (referenceAnswer?.trim()) {
    lines.push('', '【参考解答】', referenceAnswer.trim());
  }
  lines.push('', '---');
  return lines.join('\\n');
}

/**
 * テンプレート追加用の ID 生成
 */
export function buildTemplateId(subject, field) {
  const base = field ? `${subject}_${field}` : subject;
  const ts = Date.now().toString(36);
  const cleaned = base
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\u3040-\u9fff\-]/g, '');
  return cleaned ? `${cleaned}_${ts}` : `tpl_${ts}`;
}
