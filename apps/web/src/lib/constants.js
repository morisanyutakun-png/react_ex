/**
 * 共通の定数定義
 */

export const SUBJECTS = ['数学', '物理', '英語', '化学', '生物', '情報'];
export const DIFFICULTIES = ['易', '普通', '難'];
export const DIFFICULTY_MAP = { '易': 0.2, '普通': 0.5, '難': 0.8 };

/**
 * 難易度数値 → 日本語ラベル変換
 */
export function difficultyLabel(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  if (n < 0.18) return '非常に易い';
  if (n < 0.36) return '易い';
  if (n < 0.55) return '普通';
  if (n < 0.75) return '難しい';
  return '非常に難しい';
}

/**
 * テンプレート追加用のプロンプト本文を自動生成
 */
export function buildTemplatePrompt(subject, field) {
  const label = field ? `${subject}（${field}）` : subject;
  const lines = [
    '科目: {subject}',
    field ? `分野: ${field}` : null,
    '難易度: {difficulty}',
    '出題数: {num_questions}',
    '',
    '指示:',
    `以下の条件で${label}の問題を出題してください。`,
    field ? `特に「${field}」の範囲を重点的に扱ってください。` : null,
    '',
    '- 問題と解答・解説を必ず含めること',
    '- 問題数は {num_questions} 問とする',
    '- 難易度は「{difficulty}」レベルに合わせること',
  ].filter((l) => l !== null);
  return lines.join('\n');
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
  "stem": "問題文（プレーンテキスト。LaTeX数式は$...$で囲む）",
  "stem_latex": "問題文のLaTeX表現（\\\\documentclassから\\\\end{document}まで完全な文書、または数式のみ）",
  "solution_outline": "解法の手順・方針を簡潔に記述",
  "explanation": "詳しい解説（途中式や考え方を含む）",
  "answer_brief": "最終的な答えの要約（1〜2文）",
  "final_answer": "-4",
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
- checks: 必ず2件以上。各項目は {"desc": "説明文", "ok": true/false} の形式。
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
  return (
    base
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\u3040-\u9fff\-]/g, '') || `tpl_${Date.now()}`
  );
}
