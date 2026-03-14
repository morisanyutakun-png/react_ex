'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MobileNavLinks } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getPracticeHistory, getPracticeStats } from '@/lib/api';

const SUBJECT_COLOR = {
  '物理': { accent: '#f97316', bg: 'bg-orange-950/20', text: 'text-orange-400' },
  '数学': { accent: '#f59e0b', bg: 'bg-amber-950/20',  text: 'text-amber-400' },
  '化学': { accent: '#fb923c', bg: 'bg-orange-950/20', text: 'text-orange-300' },
};

export default function HistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const userId = user?.id;

      // 認証ユーザー: APIから取得
      if (userId && userId !== 'guest') {
        try {
          const [histData, statsData] = await Promise.all([
            getPracticeHistory(userId, 50),
            getPracticeStats(userId),
          ]);
          if (histData?.sessions?.length > 0) {
            setHistory(histData.sessions);
          }
          if (statsData?.stats) {
            setStats(statsData.stats);
          }
        } catch {
          // API失敗時はlocalStorageフォールバック
        }
      }

      // localStorage フォールバック（ゲスト or API失敗時）
      if (history.length === 0) {
        try {
          const raw = localStorage.getItem('rem_practice_history');
          if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data) && data.length > 0) {
              setHistory(data.slice().reverse().map((h, i) => ({
                session_id: `local-${i}`,
                subject: h.subject,
                difficulty: h.difficulty,
                date: h.date,
                num_problems: h.numProblems || 0,
                correct: h.earnedPoints || 0,
                wrong: 0,
                earned_points: h.earnedPoints || 0,
                max_points: h.maxPoints || 0,
                score_pct: h.maxPoints > 0 ? Math.round((h.earnedPoints / h.maxPoints) * 100) : 0,
                _weakTopics: h.weakTopics,
                _local: true,
              })));
            }
          }
        } catch {}
      }
      setLoading(false);
    }
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClear = () => {
    if (!confirm('学習履歴をすべて削除しますか？')) return;
    localStorage.removeItem('rem_practice_history');
    setHistory([]);
    setStats(null);
  };

  // ローカル統計（API統計がない場合のフォールバック）
  const totalSessions = stats?.overall?.total_sessions || history.length;
  const overallAccuracy = stats?.overall?.accuracy_pct ?? (
    history.length > 0
      ? Math.round(history.reduce((s, h) => s + (h.score_pct || 0), 0) / history.length)
      : 0
  );
  const totalProblems = stats?.overall?.total_problems || history.reduce((s, h) => s + (h.num_problems || 0), 0);

  // 科目別統計
  const subjectStats = stats?.by_subject || {};
  if (Object.keys(subjectStats).length === 0) {
    history.forEach((h) => {
      const key = h.subject || '不明';
      if (!subjectStats[key]) subjectStats[key] = { count: 0, correct: 0, accuracy_pct: 0, earned: 0, max: 0 };
      subjectStats[key].count++;
      subjectStats[key].earned += h.earned_points || 0;
      subjectStats[key].max += h.max_points || 0;
    });
    Object.values(subjectStats).forEach((st) => {
      st.accuracy_pct = st.max > 0 ? Math.round((st.earned / st.max) * 100) : 0;
    });
  }

  const weakTopics = stats?.weak_topics || [];
  const trend = stats?.trend || null;

  if (loading) {
    return (
      <div className="max-w-[560px] mx-auto px-5 pt-8 pb-20 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-emerald-700 rounded-full animate-spin mx-auto mb-3" style={{ borderTopColor: '#f97316' }} />
          <p className="text-[13px] text-[#9dc8b0]">履歴を読み込み中...</p>
        </div>
      </div>
    );
  }

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

      {totalSessions === 0 && history.length === 0 ? (
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
              <div className="text-[28px] font-black leading-none" style={{ color: overallAccuracy >= 70 ? '#16a34a' : overallAccuracy >= 40 ? '#d97706' : '#dc2626' }}>{overallAccuracy}%</div>
              <div className="text-[10px] font-bold text-[#9dc8b0] mt-1.5">平均正答率</div>
            </div>
            <div className="bg-[#122a1c] rounded-2xl border border-emerald-800/40 p-4 text-center shadow-sm">
              <div className="text-[28px] font-black text-[#e8f5ed] leading-none">{totalProblems}</div>
              <div className="text-[10px] font-bold text-[#9dc8b0] mt-1.5">総問題数</div>
            </div>
          </div>

          {/* トレンド（API統計がある場合） */}
          {trend && trend.recent_7d?.count > 0 && (
            <div className="bg-[#122a1c] rounded-2xl border border-emerald-800/40 px-4 py-3 mb-4 shadow-sm">
              <div className="text-[10px] font-extrabold text-[#7ab896] tracking-[0.1em] uppercase mb-2">直近7日間のトレンド</div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[18px] font-black" style={{ color: trend.recent_7d.accuracy_pct >= 60 ? '#16a34a' : '#d97706' }}>
                      {trend.recent_7d.accuracy_pct}%
                    </span>
                    {trend.improving !== null && (
                      <span className={`text-[11px] font-bold ${trend.improving ? 'text-green-400' : 'text-red-400'}`}>
                        {trend.improving ? '↑' : '↓'}
                        {trend.prev_7d?.accuracy_pct != null && ` (前週${trend.prev_7d.accuracy_pct}%)`}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#9dc8b0]">{trend.recent_7d.count}問解答</div>
                </div>
              </div>
            </div>
          )}

          {/* 苦手分野 */}
          {weakTopics.length > 0 && (
            <div className="mb-6">
              <div className="text-[11px] font-extrabold text-[#7ab896] tracking-[0.1em] uppercase mb-3">苦手分野</div>
              <div className="space-y-1.5">
                {weakTopics.slice(0, 8).map((w) => {
                  const c = SUBJECT_COLOR[w.subject] || { accent: '#64748b' };
                  return (
                    <div key={`${w.subject}-${w.topic}`} className="bg-[#122a1c] rounded-xl border border-emerald-800/40 px-3 py-2.5 flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{ background: c.accent }}>
                        {w.subject?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold text-[#e8f5ed] truncate">{w.topic}</div>
                        <div className="w-full h-1 bg-[#1a2035] rounded-full mt-1 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${w.accuracy_pct}%`, background: w.accuracy_pct < 40 ? '#dc2626' : w.accuracy_pct < 60 ? '#d97706' : '#16a34a' }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[14px] font-black" style={{ color: w.accuracy_pct < 40 ? '#dc2626' : w.accuracy_pct < 60 ? '#d97706' : '#16a34a' }}>
                          {w.accuracy_pct}%
                        </div>
                        <div className="text-[8px] text-[#9dc8b0]">{w.count}問</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 科目別 */}
          {Object.keys(subjectStats).length > 0 && (
            <div className="mb-6">
              <div className="text-[11px] font-extrabold text-[#7ab896] tracking-[0.1em] uppercase mb-3">科目別</div>
              <div className="space-y-2">
                {Object.entries(subjectStats).map(([subj, st]) => {
                  const c = SUBJECT_COLOR[subj] || { accent: '#64748b', bg: 'bg-gray-50', text: 'text-gray-700' };
                  const pct = st.accuracy_pct || (st.max > 0 ? Math.round((st.earned / st.max) * 100) : 0);
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

          {/* 演習ログ */}
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
                const pct = h.score_pct || 0;
                const d = h.date ? new Date(h.date) : null;
                const dateStr = d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
                return (
                  <div key={h.session_id || i} className="bg-[#122a1c] rounded-xl border border-emerald-800/40 px-4 py-3 flex items-center gap-3 shadow-sm">
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
                        {h.earned_points != null && h.max_points ? `${h.earned_points}/${h.max_points}点 · ` : ''}{h.num_problems || '?'}問 {dateStr && `· ${dateStr}`}
                      </div>
                      {h._weakTopics && h._weakTopics.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {h._weakTopics.map((t) => (
                            <span key={t} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-red-950/30 text-red-400 border border-red-800/30">{t}</span>
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
