'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MobileNavLinks } from '@/components/ui';

const SUBJECT_COLOR = {
  '物理': { accent: '#f97316', bg: 'bg-orange-950/20', text: 'text-orange-400' },
  '数学': { accent: '#f59e0b', bg: 'bg-amber-950/20',  text: 'text-amber-400' },
  '化学': { accent: '#fb923c', bg: 'bg-orange-950/20', text: 'text-orange-300' },
};

export default function HistoryPage() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('rem_practice_history');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) setHistory(data.slice().reverse()); // newest first
      }
    } catch {}
  }, []);

  const handleClear = () => {
    if (!confirm('学習履歴をすべて削除しますか？')) return;
    localStorage.removeItem('rem_practice_history');
    setHistory([]);
  };

  // 統計
  const totalSessions = history.length;
  const totalScore = history.reduce((s, h) => s + (h.earnedPoints || 0), 0);
  const totalMax = history.reduce((s, h) => s + (h.maxPoints || 0), 0);
  const avgPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  // 科目別集計
  const subjectStats = {};
  history.forEach((h) => {
    const key = h.subject || '不明';
    if (!subjectStats[key]) subjectStats[key] = { count: 0, earned: 0, max: 0 };
    subjectStats[key].count++;
    subjectStats[key].earned += h.earnedPoints || 0;
    subjectStats[key].max += h.maxPoints || 0;
  });

  return (
    <div className="max-w-[560px] mx-auto px-5 pt-8 pb-20 min-h-screen">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="flex items-center gap-1.5 text-[13px] font-medium text-[#9dc8b0] hover:text-[#6aaa7c] transition-colors group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          ホーム
        </Link>
        <h1 className="text-[18px] font-black text-[#e8f5ed] tracking-[-0.02em]">学習履歴</h1>
        <div className="w-16" />
      </div>

      {totalSessions === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1a2035] flex items-center justify-center">
            <svg className="w-7 h-7 text-[#9dc8b0]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
            </svg>
          </div>
          <h2 className="text-[16px] font-bold text-[#6aaa7c] mb-2">まだ履歴がありません</h2>
          <p className="text-[13px] text-[#9dc8b0] mb-6">練習モードで演習すると、結果がここに記録されます。</p>
          <Link href="/practice" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-[14px] font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-lg hover:shadow-xl transition-all active:scale-[0.97]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
            練習を始める
          </Link>
        </div>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <div className="bg-[#122a1c] rounded-2xl border border-emerald-800/40 p-4 text-center shadow-sm">
              <div className="text-[28px] font-black text-[#e8f5ed] leading-none">{totalSessions}</div>
              <div className="text-[10px] font-bold text-[#9dc8b0] mt-1.5">演習回数</div>
            </div>
            <div className="bg-[#122a1c] rounded-2xl border border-emerald-800/40 p-4 text-center shadow-sm">
              <div className="text-[28px] font-black leading-none" style={{ color: avgPct >= 70 ? '#16a34a' : avgPct >= 40 ? '#d97706' : '#dc2626' }}>{avgPct}%</div>
              <div className="text-[10px] font-bold text-[#9dc8b0] mt-1.5">平均得点率</div>
            </div>
            <div className="bg-[#122a1c] rounded-2xl border border-emerald-800/40 p-4 text-center shadow-sm">
              <div className="text-[28px] font-black text-[#e8f5ed] leading-none">{totalScore}</div>
              <div className="text-[10px] font-bold text-[#9dc8b0] mt-1.5">累計得点</div>
            </div>
          </div>

          {/* 科目別 */}
          {Object.keys(subjectStats).length > 0 && (
            <div className="mb-6">
              <div className="text-[11px] font-extrabold text-[#7ab896] tracking-[0.1em] uppercase mb-3">科目別</div>
              <div className="space-y-2">
                {Object.entries(subjectStats).map(([subj, st]) => {
                  const c = SUBJECT_COLOR[subj] || { accent: '#64748b', bg: 'bg-gray-50', text: 'text-gray-700' };
                  const pct = st.max > 0 ? Math.round((st.earned / st.max) * 100) : 0;
                  return (
                    <div key={subj} className="bg-[#122a1c] rounded-xl border border-emerald-800/40 px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black text-white flex-shrink-0" style={{ background: c.accent }}>
                        {subj[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[#e8f5ed]">{subj}</div>
                        <div className="w-full h-1.5 bg-[#1a2035] rounded-full mt-1 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.accent }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[16px] font-black" style={{ color: c.accent }}>{pct}%</div>
                        <div className="text-[9px] text-[#9dc8b0]">{st.count}回</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 履歴一覧 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-extrabold text-[#7ab896] tracking-[0.1em] uppercase">演習ログ</div>
              <button type="button" onClick={handleClear} className="text-[10px] text-red-400 hover:text-red-600 font-medium transition-colors">
                履歴をクリア
              </button>
            </div>
            <div className="space-y-2">
              {history.map((h, i) => {
                const c = SUBJECT_COLOR[h.subject] || { accent: '#64748b' };
                const pct = h.maxPoints > 0 ? Math.round((h.earnedPoints / h.maxPoints) * 100) : 0;
                const d = h.date ? new Date(h.date) : null;
                const dateStr = d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
                return (
                  <div key={i} className="bg-[#122a1c] rounded-xl border border-emerald-800/40 px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px] font-black flex-shrink-0"
                         style={{ background: pct >= 70 ? '#f0fdf4' : pct >= 40 ? '#fffbeb' : '#fef2f2', color: pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626' }}>
                      {pct}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.accent + '14', color: c.accent }}>{h.subject}</span>
                        {h.difficulty && <span className="text-[10px] text-[#9dc8b0]">{h.difficulty}</span>}
                      </div>
                      <div className="text-[11px] text-[#9dc8b0] mt-0.5">
                        {h.earnedPoints}/{h.maxPoints}点 · {h.numProblems || '?'}問 {dateStr && `· ${dateStr}`}
                      </div>
                      {h.weakTopics && h.weakTopics.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {h.weakTopics.map((t) => (
                            <span key={t} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-100">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Link href="/practice" className="block w-full py-4 rounded-2xl text-center text-[15px] font-black text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-xl hover:shadow-2xl transition-all active:scale-[0.97]">
              もっと練習する
            </Link>
          </div>
        </>
      )}

      <MobileNavLinks currentPath="/history" />
    </div>
  );
}
