'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * TikzFigure — TikZ コードをバックエンドでコンパイルし、画像として表示するコンポーネント
 *
 * @param {string} tikzCode - TikZ コード（\\begin{tikzpicture}...\\end{tikzpicture} 等）
 * @param {string} className - 追加の CSS クラス
 */
export default function TikzFigure({ tikzCode, className = '' }) {
  const [src, setSrc] = useState(null);
  const [mediaType, setMediaType] = useState('image/png');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!tikzCode || !tikzCode.trim()) {
      setLoading(false);
      setError('No TikZ code');
      return;
    }

    // Abort previous request if tikzCode changes
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setSrc(null);

    fetch('/api/render_tikz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tikz: tikzCode }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const ct = res.headers.get('Content-Type') || 'image/png';
        setMediaType(ct);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setSrc(url);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('TikzFigure render failed:', err);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      controller.abort();
      if (src) URL.revokeObjectURL(src);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tikzCode]);

  // Revoke previous URL when src changes
  const prevSrc = useRef(null);
  useEffect(() => {
    if (prevSrc.current && prevSrc.current !== src) {
      URL.revokeObjectURL(prevSrc.current);
    }
    prevSrc.current = src;
  }, [src]);

  if (error) {
    return (
      <div className={`text-xs text-slate-400 italic py-2 ${className}`}>
        図の読み込みに失敗しました
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 py-3 ${className}`}>
        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
        <span className="text-xs text-slate-400">図をレンダリング中…</span>
      </div>
    );
  }

  if (!src) return null;

  if (mediaType.includes('pdf')) {
    return (
      <div className={`my-3 ${className}`}>
        <object data={src} type="application/pdf" className="w-full" style={{ minHeight: 240 }}>
          <p className="text-xs text-slate-400">PDF を表示できません</p>
        </object>
      </div>
    );
  }

  return (
    <div className={`my-3 flex justify-center ${className}`}>
      <img
        src={src}
        alt="図"
        className="max-w-full rounded-lg border border-slate-200 bg-white"
        style={{ maxHeight: 400 }}
      />
    </div>
  );
}
