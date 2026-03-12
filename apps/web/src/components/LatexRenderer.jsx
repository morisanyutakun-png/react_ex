'use client';

import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * LatexRenderer — LaTeX数式を含むテキストをレンダリングする
 *
 * 対応パターン (優先順位順):
 *   $$...$$ — ディスプレイ数式 (block)
 *   $...$   — インライン数式
 *   \[...\] — ディスプレイ数式 (block)
 *   \(...\) — インライン数式
 *
 * 非数式テキストはそのままレンダリングされる。
 *
 * physics / siunitx パッケージ互換マクロを内蔵しているため、
 * AI が生成した LaTeX 数式もほぼそのまま描画できる。
 */

/* ─── KaTeX に渡す追加マクロ定義 ─────────────────────────────────── */
// physics パッケージ・siunitx パッケージ・その他よく使われるコマンドを KaTeX で使えるようにする
const KATEX_MACROS = {
  // ─── physics package: ベクトル ───
  '\\vb': '\\boldsymbol{#1}',           // \vb{F}  → ボールド体
  '\\va': '\\vec{#1}',                   // \va{F}  → ベクトル矢印
  '\\vu': '\\hat{#1}',                   // \vu{e}  → 単位ベクトル
  '\\vdot': '\\boldsymbol{\\cdot}',

  // ─── physics package: 微分 ───
  '\\dd': '\\mathrm{d}',                 // \dd → d（立体）
  '\\dv': '\\dfrac{\\mathrm{d}#1}{\\mathrm{d}#2}',   // \dv{f}{x}
  '\\pdv': '\\dfrac{\\partial #1}{\\partial #2}',     // \pdv{f}{x}
  '\\fdv': '\\dfrac{\\delta #1}{\\delta #2}',         // \fdv{F}{f}

  // ─── physics package: 括弧 ───
  '\\pqty': '\\left(#1\\right)',          // \pqty{...} → (...)
  '\\bqty': '\\left[#1\\right]',          // \bqty{...} → [...]
  '\\Bqty': '\\left\\{#1\\right\\}',      // \Bqty{...} → {...}
  '\\vqty': '\\left|#1\\right|',          // \vqty{...} → |...|
  '\\abs': '\\left|#1\\right|',           // \abs{x}
  '\\norm': '\\left\\|#1\\right\\|',      // \norm{x}

  // ─── physics package: 演算子 ───
  '\\grad': '\\nabla',
  '\\curl': '\\nabla\\times',
  '\\laplacian': '\\nabla^{2}',
  '\\order': '\\mathcal{O}\\!\\left(#1\\right)',  // \order{n}
  '\\eval': '\\left.#1\\right|',

  // ─── physics package: ブラケット記法 ───
  '\\bra': '\\left\\langle #1\\right|',
  '\\ket': '\\left|#1\\right\\rangle',
  '\\braket': '\\left\\langle #1\\middle|#2\\right\\rangle',
  '\\mel': '\\left\\langle #1\\middle|#2\\middle|#3\\right\\rangle',
  '\\ev': '\\left\\langle #1\\right\\rangle',
  '\\expval': '\\left\\langle #1\\right\\rangle',

  // ─── physics package: トレース ───
  '\\Tr': '\\operatorname{Tr}',
  '\\tr': '\\operatorname{tr}',
  '\\rank': '\\operatorname{rank}',

  // ─── siunitx パッケージ ───
  '\\SI': '#1\\,\\mathrm{#2}',           // \SI{9.8}{m/s^2}
  '\\si': '\\mathrm{#1}',                // \si{m/s^2}
  '\\num': '#1',                          // \num{1.23e-4}
  '\\ang': '#1^{\\circ}',                // \ang{45}
  '\\unit': '\\mathrm{#1}',              // siunitx 3.x
  '\\qty': '#1\\,\\mathrm{#2}',          // siunitx 3.x \qty{val}{unit}

  // ─── その他よく使うマクロ ───
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\e': '\\mathrm{e}',                  // ネイピア数 e
  '\\ii': '\\mathrm{i}',                 // 虚数単位 i
  '\\defeq': '\\coloneqq',               // 定義等号
  '\\half': '\\dfrac{1}{2}',
  '\\third': '\\dfrac{1}{3}',
  '\\inv': '^{-1}',
};

/* ─── KaTeX オプション ──────────────────────────────────────────────── */
const KATEX_OPTS_BASE = {
  throwOnError: false,
  trust: true,
  strict: false,
  macros: KATEX_MACROS,
};

/* ─── テキストを math/non-math セグメントに分割 ───────────────────── */
function renderLatexToHtml(text) {
  if (!text) return '';

  // 全マッチを収集
  const matches = [];

  // ── ブロック数式環境: \begin{equation/align/gather/...}...\end{...} ──
  // KaTeX に環境全体を渡す（displayMode: true で描画）
  const ENV_NAMES = 'equation|align|gather|multline|eqnarray';
  const envRe = new RegExp(
    `\\\\begin\\{(${ENV_NAMES})(\\*?)\\}[\\s\\S]*?\\\\end\\{\\1\\2\\}`,
    'g'
  );
  let em;
  while ((em = envRe.exec(text)) !== null) {
    matches.push({
      start: em.index,
      end: em.index + em[0].length,
      latex: em[0],   // 環境全体を KaTeX に渡す
      display: true,
    });
  }

  // ── その他の数式パターン ──
  const patterns = [
    { regex: /\$\$([\s\S]*?)\$\$/g, display: true },
    { regex: /\\\[([\s\S]*?)\\\]/g, display: true },
    { regex: /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)*?)\$/g, display: false },
    { regex: /\\\(([\s\S]*?)\\\)/g, display: false },
  ];

  for (const { regex, display } of patterns) {
    const re = new RegExp(regex.source, regex.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, latex: m[1], display });
    }
  }

  // 位置順にソート、重複除去
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const filtered = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  // HTML 構築
  let pos = 0;
  const parts = [];
  for (const m of filtered) {
    if (m.start > pos) {
      parts.push(escapeHtml(text.slice(pos, m.start)));
    }
    try {
      const html = katex.renderToString(m.latex, {
        ...KATEX_OPTS_BASE,
        displayMode: m.display,
      });
      if (m.display) {
        parts.push(`<div class="katex-display-block my-3 overflow-x-auto">${html}</div>`);
      } else {
        parts.push(html);
      }
    } catch {
      // KaTeX が失敗した場合はグレーの code タグで表示（生LaTeX は見せない）
      parts.push(`<code class="text-[#94a3b8] text-xs bg-slate-50 px-1 rounded">${escapeHtml(m.latex)}</code>`);
    }
    pos = m.end;
  }
  if (pos < text.length) {
    parts.push(escapeHtml(text.slice(pos)));
  }

  return parts.join('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

/**
 * LatexText — インラインLaTeX数式を含むテキスト表示用コンポーネント
 */
export function LatexText({ children, className = '', as: Tag = 'span' }) {
  const html = useMemo(() => renderLatexToHtml(children || ''), [children]);
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * LatexBlock — ブロックレベルのLaTeX数式テキスト表示
 */
export function LatexBlock({ children, className = '' }) {
  const html = useMemo(() => renderLatexToHtml(children || ''), [children]);
  return (
    <div
      className={`text-sm text-[#1e293b] leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default LatexText;
