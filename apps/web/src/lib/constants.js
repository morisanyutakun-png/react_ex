/**
 * 共通の定数定義
 */

export const SUBJECTS = ['数学', '物理', '英語', '化学', '生物', '情報'];
export const DIFFICULTIES = [
  { value: '基礎', label: '基礎', description: '教科書の例題レベル', numeric: 0.1 },
  { value: '標準', label: '標準', description: '教科書の章末問題・定期テストレベル', numeric: 0.3 },
  { value: '応用', label: '応用', description: '入試基礎・共通テストレベル', numeric: 0.5 },
  { value: '発展', label: '発展', description: '一般入試・中堅大レベル', numeric: 0.7 },
  { value: '難関', label: '難関', description: '難関大・旧帝大レベル', numeric: 0.85 },
  { value: '最難関', label: '最難関', description: '東大・京大・数学オリンピックレベル', numeric: 0.95 },
];
export const DIFFICULTY_MAP = Object.fromEntries(DIFFICULTIES.map(d => [d.value, d.numeric]));

/**
 * 教科 → 分野（トピック） マッピング
 * テンプレート選択やDB登録で利用。
 */
export const SUBJECT_TOPICS = {
  '数学': [
    '数と式', '二次関数', '三角比', 'データの分析',
    '場合の数・確率', '整数の性質', '図形の性質',
    '式と証明', '複素数と方程式', '図形と方程式',
    '三角関数', '指数・対数関数', '微分法', '積分法',
    '数列', 'ベクトル', '確率分布と統計',
    '極限', '微分法の応用', '積分法の応用',
    '複素数平面', '式と曲線', '行列',
  ],
  '物理': [
    '力学', '熱力学', '波動', '電磁気学',
    '原子物理', '運動とエネルギー', '電気回路',
    '磁場', '光', '音',
  ],
  '化学': [
    '物質の構成', '物質の変化', '無機化学', '有機化学',
    '高分子化合物', '化学反応と熱', '酸と塩基',
    '酸化還元', '電池・電気分解', '気体の性質',
    '化学平衡', '溶液の性質',
  ],
  '生物': [
    '細胞', '遺伝', '代謝', '生態系',
    '動物の反応', '植物の反応', '進化と系統',
    '生殖と発生', 'バイオテクノロジー',
  ],
  '英語': [
    '文法', '長文読解', 'リスニング', '英作文',
    '語彙・イディオム', '会話表現', '発音・アクセント',
  ],
  '情報': [
    'プログラミング基礎', 'アルゴリズム', 'データ構造',
    'ネットワーク', 'セキュリティ', 'データベース',
    'JavaScript', 'Python', 'HTML/CSS',
    '情報モラル', '情報デザイン',
  ],
  '国語': [
    '現代文', '古文', '漢文', '小論文',
    '文学史', '語彙・文法',
  ],
  '理科': [
    '物理分野', '化学分野', '生物分野', '地学分野',
  ],
  '社会': [
    '日本史', '世界史', '地理', '公民',
    '政治・経済', '倫理',
  ],
  '地学': [
    '地球の構造', '大気と海洋', '宇宙',
    '地質と岩石', '自然災害',
  ],
};

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
 * テンプレート追加用のプロンプト本文を自動生成
 */
export function buildTemplatePrompt(subject, field, options = {}) {
  const { questionFormat, theme } = options;
  const label = field ? `${subject}（${field}）` : subject;
  const formatDef = QUESTION_FORMATS.find(f => f.value === questionFormat);
  const formatLabel = formatDef ? formatDef.label : null;

  const lines = [
    '科目: {subject}',
    field ? `分野: ${field}` : null,
    theme ? `テーマ: ${theme}` : null,
    '難易度: {difficulty}',
    '出題数: {num_questions}',
    formatLabel ? `問題形式: ${formatLabel}` : null,
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
  "subject": "科目名（例: 数学, 英語, 物理）",
  "field": "分野名（例: 微分積分, 長文読解, 力学）",
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
  * 数学以外の問題（英語・暗記系など）では省略可。
- checks: 必ず2件以上。各項目は {"desc": "説明文", "ok": true/false} の形式。
  * 少なくとも1件は verification_code の実行結果に基づく検算を含めること。
- subject（必須）: 科目名（例: 数学, 英語, 物理）
- field（必須）: 分野名（例: 微分積分, 長文読解, 力学）
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
