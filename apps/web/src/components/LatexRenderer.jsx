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
 */

function renderLatexToHtml(text) {
  if (!text) return '';

  // Split text into math and non-math segments
  // Order matters: match display math first ($$ and \[...\]), then inline ($ and \(...\))
  const segments = [];
  let remaining = text;

  // Process the text by finding math delimiters
  const patterns = [
    // Display math: $$...$$
    { regex: /\$\$([\s\S]*?)\$\$/g, display: true },
    // Display math: \[...\]
    { regex: /\\\[([\s\S]*?)\\\]/g, display: true },
    // Inline math: $...$  (but not $$)
    { regex: /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)*?)\$/g, display: false },
    // Inline math: \(...\)
    { regex: /\\\(([\s\S]*?)\\\)/g, display: false },
  ];

  // Collect all math matches with their positions
  const matches = [];
  for (const { regex, display } of patterns) {
    let m;
    const re = new RegExp(regex.source, regex.flags);
    while ((m = re.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        latex: m[1],
        display,
      });
    }
  }

  // Sort by position and remove overlapping matches (keep earlier/longer ones)
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const filtered = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  // Build HTML from segments
  let pos = 0;
  const parts = [];
  for (const m of filtered) {
    // Text before this math
    if (m.start > pos) {
      parts.push(escapeHtml(text.slice(pos, m.start)));
    }
    // Render math
    try {
      const html = katex.renderToString(m.latex, {
        displayMode: m.display,
        throwOnError: false,
        trust: true,
        strict: false,
        macros: {
          '\\R': '\\mathbb{R}',
          '\\N': '\\mathbb{N}',
          '\\Z': '\\mathbb{Z}',
          '\\Q': '\\mathbb{Q}',
          '\\C': '\\mathbb{C}',
        },
      });
      if (m.display) {
        parts.push(`<div class="katex-display-block my-2">${html}</div>`);
      } else {
        parts.push(html);
      }
    } catch {
      // If KaTeX fails, show original text
      parts.push(`<code class="text-[#1e293b] text-xs">${escapeHtml(m.latex)}</code>`);
    }
    pos = m.end;
  }
  // Remaining text after last math
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
 *
 * @param {string} children - LaTeX数式を含むテキスト
 * @param {string} className - 追加のCSSクラス
 * @param {string} as - レンダリングするHTML要素 (default: 'span')
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
 * pre/code風のスタイリングではなく、数式をきれいにレンダリング
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
