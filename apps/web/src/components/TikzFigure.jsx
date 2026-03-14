'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * TikzFigure — TikZ コードをバックエンドでコンパイルし、画像として表示するコンポーネント
 *
 * @param {string} tikzCode - TikZ コード（\begin{tikzpicture}...\end{tikzpicture} 等）
 * @param {string} className - 追加の CSS クラス
 */
export default function TikzFigure({ tikzCode, className = '' }) {
  const [src, setSrc] = useState(null);
  const [mediaType, setMediaType] = useState('image/png');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef(null);
  const prevSrc = useRef(null);

  const isMobile = typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.innerWidth <= 768));

  const doFetch = useCallback(async (code, signal) => {
    setLoading(true);
    setError(null);
    setSrc(null);

    // タイムアウト: 45秒（クラウドコンパイルを待つ）
    const timeoutId = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
    }, 45000);

    try {
      const res = await fetch('/api/render_tikz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tikz: code }),
        signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.hint || body.error || `HTTP ${res.status}`);
      }
      const ct = res.headers.get('Content-Type') || 'image/png';
      setMediaType(ct);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // 前のURLを解放
      if (prevSrc.current) {
        URL.revokeObjectURL(prevSrc.current);
      }
      prevSrc.current = url;
      setSrc(url);
      setLoading(false);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') return;
      console.error('TikzFigure render failed:', err);
      setError(err.message || '図のレンダリングに失敗しました');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tikzCode || !tikzCode.trim()) {
      setLoading(false);
      setError('No TikZ code');
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    doFetch(tikzCode, controller.signal);

    return () => {
      controller.abort();
    };
  }, [tikzCode, retryCount, doFetch]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (prevSrc.current) {
        URL.revokeObjectURL(prevSrc.current);
      }
    };
  }, []);

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
  };

  if (error) {
    return (
      <div className={`flex items-center gap-3 py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-200 ${className}`}>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-400 italic">図の読み込みに失敗しました</p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all duration-200 active:scale-[0.95] flex-shrink-0"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          再読込
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 py-3 ${className}`}>
        <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin flex-shrink-0" />
        <span className="text-[11px] text-slate-400">図をレンダリング中…</span>
      </div>
    );
  }

  if (!src) return null;

  if (mediaType.includes('pdf')) {
    return (
      <div className={`my-3 ${className}`}>
        {isMobile ? (
          <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-400">図をPDFで表示できません</p>
            <button type="button" onClick={handleRetry}
              className="px-2 py-1 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-500">
              再試行
            </button>
          </div>
        ) : (
          <object data={src} type="application/pdf" className="w-full" style={{ minHeight: 240 }}>
            <p className="text-xs text-slate-400">PDF を表示できません</p>
          </object>
        )}
      </div>
    );
  }

  return (
    <div className={`my-3 flex justify-center ${className}`}>
      <img
        src={src}
        alt="図"
        className="max-w-full rounded-xl border border-slate-200 bg-white shadow-sm"
        style={{ maxHeight: isMobile ? 'none' : 320 }}
      />
    </div>
  );
}
