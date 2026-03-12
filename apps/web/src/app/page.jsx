'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { MobileNavLinks } from '@/components/ui';

/* ═══════════════════════════════════════════════════════════════
   REM — Landing Page  (物理 × 受験心理 × Premium)
   ═══════════════════════════════════════════════════════════════ */

/* ─── Gradient Mesh BG ─── */
function GradientMeshBackground() {
  return (
    <div className="gradient-mesh" aria-hidden="true">
      <div className="gradient-mesh-blob gradient-mesh-blob-1" />
      <div className="gradient-mesh-blob gradient-mesh-blob-2" />
      <div className="gradient-mesh-blob gradient-mesh-blob-3" />
      <div className="gradient-mesh-blob gradient-mesh-blob-4" />
      <div className="gradient-mesh-blob gradient-mesh-blob-5" />
      <div className="gradient-mesh-noise" />
    </div>
  );
}

/* ─── Scroll Reveal Hook ─── */
function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    );
    const targets = el.querySelectorAll('.scroll-reveal');
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─── Physics Equation Decoration ─── */
function PhysicsEquations() {
  const equations = ['F=ma', 'E=\\frac{1}{2}mv^2', 'V=IR', 'PV=nRT', 'T=2\\pi\\sqrt{\\frac{l}{g}}', 'f=\\frac{v}{\\lambda}'];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" aria-hidden="true">
      {equations.map((eq, i) => (
        <span key={i} className="absolute text-[11px] font-mono tracking-wider"
              style={{
                color: `rgba(99,102,241,${0.06 + (i % 3) * 0.02})`,
                top: `${12 + i * 14}%`,
                left: i % 2 === 0 ? `${3 + i * 4}%` : 'auto',
                right: i % 2 !== 0 ? `${2 + i * 3}%` : 'auto',
                transform: `rotate(${-8 + i * 5}deg)`,
              }}>
          {eq}
        </span>
      ))}
    </div>
  );
}

/* ─── Animated Mini-PDF ─── */
function AnimatedPdfMockup() {
  return (
    <div className="landing-pdf-mockup-container">
      <div className="landing-pdf-float" aria-hidden="true">
        <div className="absolute -right-2 -bottom-2 w-full h-full rounded-2xl bg-[#1e293b]/[0.04] blur-sm" />
        <div className="absolute -right-1 -bottom-1 w-full h-full rounded-xl bg-white/80 border border-[#e2e8f0]/60" />
        <div className="relative bg-white rounded-xl border border-[#e2e8f0] shadow-xl shadow-indigo-900/[0.06] p-4 sm:p-5 w-[220px] sm:w-[260px]">
          <div className="flex items-center justify-between mb-3">
            <div className="h-2.5 w-20 rounded-full bg-[#1e293b]/25" />
            <div className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
              <span className="text-[7px] font-bold text-indigo-600">25点</span>
            </div>
          </div>
          <div className="h-[0.5px] w-full bg-[#e2e8f0] mb-3" />
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 shadow-sm">1</div>
              <div className="flex-1 space-y-1.5 pt-0.5">
                <div className="h-[5px] w-full rounded-full bg-[#94a3b8]/20 landing-line-shimmer" style={{ animationDelay: '0ms' }} />
                <div className="h-[5px] w-[85%] rounded-full bg-[#94a3b8]/15 landing-line-shimmer" style={{ animationDelay: '150ms' }} />
                <div className="h-[5px] w-[60%] rounded-full bg-[#94a3b8]/10 landing-line-shimmer" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
          <div className="mb-3 mx-2 p-2 rounded-lg border border-dashed border-indigo-200/60 bg-indigo-50/30">
            <div className="flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91" />
              </svg>
              <span className="text-[7px] font-medium text-indigo-400">TikZ図</span>
            </div>
          </div>
          <div className="mb-2">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 shadow-sm">2</div>
              <div className="flex-1 space-y-1.5 pt-0.5">
                <div className="h-[5px] w-full rounded-full bg-[#94a3b8]/20 landing-line-shimmer" style={{ animationDelay: '450ms' }} />
                <div className="h-[5px] w-[75%] rounded-full bg-[#94a3b8]/15 landing-line-shimmer" style={{ animationDelay: '600ms' }} />
              </div>
            </div>
          </div>
          {/* scoring block preview */}
          <div className="mt-2 p-2 rounded-md bg-emerald-50/60 border border-emerald-100/50">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-1 h-3 rounded-full bg-emerald-400"></div>
              <span className="text-[6px] font-bold text-emerald-600">配点基準</span>
            </div>
            <div className="space-y-0.5">
              <div className="h-[3px] w-[90%] rounded-full bg-emerald-200/60" />
              <div className="h-[3px] w-[70%] rounded-full bg-emerald-200/40" />
            </div>
          </div>
          <div className="absolute -top-2.5 -right-2.5 landing-badge-pulse">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Exam Countdown (urgency / Zeigarnik) ─── */
function ExamCountdown() {
  const daysLeft = useMemo(() => {
    const now = new Date();
    // 共通テスト: 翌年1月第3土曜 (近似)
    let targetYear = now.getMonth() >= 1 ? now.getFullYear() + 1 : now.getFullYear();
    const jan1 = new Date(targetYear, 0, 1);
    const dayOfWeek = jan1.getDay();
    const thirdSat = new Date(targetYear, 0, 1 + ((6 - dayOfWeek + 7) % 7) + 14);
    const diff = Math.ceil((thirdSat - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 365 + diff;
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900/[0.03] to-indigo-900/[0.04] border border-indigo-100/50">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        <span className="text-[10px] font-bold text-slate-500 tracking-wide uppercase">共通テストまで</span>
      </div>
      <span className="text-[18px] font-black text-indigo-600 tracking-tight tabular-nums">{daysLeft}</span>
      <span className="text-[10px] font-bold text-slate-400">日</span>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   PAGE — 物理受験生特化ランディング (心理学ベース)
   ═══════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const containerRef = useScrollReveal();
  const [historyCount, setHistoryCount] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('rem_practice_history');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          setHistoryCount(data.length);
          if (data.length > 0) {
            const total = data.reduce((s, d) => s + (d.maxPoints > 0 ? (d.earnedPoints / d.maxPoints) * 100 : 0), 0);
            setAvgScore(Math.round(total / data.length));
          }
        }
      }
    } catch {}
  }, []);

  const handleShare = async () => {
    const text = '物理の入試過去問レベルの類題をAIが無限に出してくれるやつ、ガチでヤバい。配点・部分点基準付きで自己採点までできる。\n\n#REM #物理 #受験勉強 #共通テスト';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'REM - AI物理演習', text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(text + '\n' + window.location.href);
      }
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch {}
  };

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden">

      {/* ── BG layers ── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <GradientMeshBackground />
      </div>
      <PhysicsEquations />

      {/* ── Content ── */}
      <div className="relative z-20 flex flex-col items-center px-5 sm:px-6 min-h-screen">
        <div className="max-w-[560px] w-full mx-auto">

          {/* ══════ HERO ══════ */}
          <section className="pt-10 sm:pt-16 pb-8 sm:pb-10">

            {/* Brand */}
            <div className="text-center mb-6 stagger-item" style={{ animationDelay: '0ms' }}>
              <div className="inline-flex flex-col items-center gap-1">
                <span className="text-[40px] sm:text-[48px] font-black tracking-[-0.06em] leading-none gradient-text-hero-animated">REM</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-[#94a3b8] tracking-[0.25em] uppercase">AI Physics Trainer</span>
              </div>
            </div>

            {/* Headline — 損失回避 + Urgency */}
            <div className="text-center stagger-item" style={{ animationDelay: '80ms' }}>
              <h1 className="text-[26px] sm:text-[38px] font-black tracking-[-0.04em] leading-[1.1] text-[#0f172a] mb-3">
                物理で<span className="text-red-500">落とす</span>のは、<br className="sm:hidden" /><span className="gradient-text-hero-animated">もう終わりにしよう。</span>
              </h1>
            </div>

            {/* Sub copy */}
            <div className="text-center stagger-item" style={{ animationDelay: '150ms' }}>
              <p className="text-[13px] sm:text-[15px] text-[#475569] leading-[1.8] max-w-[380px] mx-auto" style={{ fontFeatureSettings: '"palt"' }}>
                入試レベルの類題をAIが無限に生成。<br />
                <strong className="text-[#1e293b] font-bold">配点＋部分点基準</strong>付きだから、<br />
                <span className="text-indigo-600 font-semibold">自己採点で「本番力」が鍛えられる。</span>
              </p>
            </div>

            {/* Countdown — 緊迫感 */}
            <div className="flex justify-center mt-6 stagger-item" style={{ animationDelay: '200ms' }}>
              <ExamCountdown />
            </div>

            {/* Trust metrics */}
            <div className="stagger-item" style={{ animationDelay: '250ms' }}>
              <div className="flex items-center justify-center gap-4 sm:gap-6 mt-6 mb-7">
                {[
                  { value: '25点×N問', label: '配点付き', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
                  { value: '約60秒', label: '即生成', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /> },
                  { value: '部分点', label: '基準付き', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L10.5 21.75 12 13.5H3.75z" /> },
                ].map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100/60 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">{m.icon}</svg>
                    </div>
                    <div>
                      <div className="text-[14px] sm:text-[16px] font-black text-[#0f172a] leading-none tracking-tight">{m.value}</div>
                      <div className="text-[9px] text-[#94a3b8] font-semibold mt-0.5">{m.label}</div>
                    </div>
                    {i < 2 && <div className="w-[1px] h-7 bg-[#e2e8f0]/60 ml-2" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Primary CTA */}
            <div className="stagger-item" style={{ animationDelay: '320ms' }}>
              <div className="max-w-[400px] mx-auto space-y-3">
                <Link href="/practice" className="landing-cta-primary group block">
                  <span className="relative z-10 flex flex-col items-center gap-1">
                    <span className="text-[15px] sm:text-[16px] font-bold">演習を始める</span>
                    <span className="text-[10px] font-medium opacity-70">無料 · ログイン不要 · 60秒で出題</span>
                  </span>
                </Link>

                {/* 学習履歴バー */}
                {historyCount > 0 && (
                  <Link href="/history" className="block px-4 py-3 rounded-2xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 hover:shadow-md transition-all duration-200 active:scale-[0.98]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4.5 h-4.5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-black text-indigo-800">学習履歴 — {historyCount}回演習済み</div>
                        <div className="text-[10px] text-indigo-500 font-medium mt-0.5">
                          {avgScore > 0 ? `平均正答率 ${avgScore}% · ` : ''}タップして詳細を確認
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </Link>
                )}

                <Link href="/user" className="landing-cta-tune group block">
                  <span className="relative z-10 flex flex-col items-center gap-1">
                    <span className="text-[14px] sm:text-[15px] font-bold">PDF問題を作成する</span>
                    <span className="text-[10px] font-medium opacity-70">教員・詳細設定モード</span>
                  </span>
                </Link>
              </div>
            </div>

            {/* PDF Mockup */}
            <div className="mt-8 sm:mt-10 stagger-item" style={{ animationDelay: '400ms' }}>
              <AnimatedPdfMockup />
            </div>
          </section>


          {/* ══════ PAIN POINTS — 共感 (ミラーニューロン) ══════ */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-7">
              <span className="section-label">Your pain</span>
              <h2 className="text-[21px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                こんな状況、今すぐ変えられる
              </h2>
            </div>
            <div className="space-y-2.5">
              {[
                { text: '過去問10年分を解き切ったけど、もう新しい問題がない', solve: 'AIが入試レベルの新題を無限に生成', color: 'red' },
                { text: '模試で物理だけ毎回足を引っ張っている', solve: '苦手単元をピンポイントで集中演習', color: 'amber' },
                { text: '力学はできるのに、電磁気や波動で毎回つまずく', solve: '分野別に出題レベルを細かく調整', color: 'orange' },
                { text: '自己採点すると「合ってるか分からない」箇所が多い', solve: '部分点基準で「どこまで正しいか」が分かる', color: 'blue' },
                { text: '試験まで時間がないのに、何から手をつけるべきか迷う', solve: '弱点を自動分析して優先順位がつく', color: 'violet' },
              ].map(({ text, solve, color }) => (
                <div key={text} className="bg-white/85 backdrop-blur-sm rounded-2xl border border-[#e2e8f0] px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200 group">
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-lg bg-${color}-50 border border-${color}-100 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <svg className={`w-3.5 h-3.5 text-${color}-400`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[13px] font-bold text-[#1e293b] leading-snug block">{text}</span>
                      <span className="text-[11px] font-semibold text-indigo-600 mt-1 block flex items-center gap-1">
                        <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                        {solve}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>


          {/* ══════ WHY REM — 差別化 (Authority + Reciprocity) ══════ */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-8">
              <span className="section-label">Why REM</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                他と何が違うのか
              </h2>
            </div>

            <div className="space-y-3">
              {[
                {
                  gradient: 'from-indigo-500 to-blue-600',
                  shadow: 'shadow-indigo-500/20',
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
                  title: '配点＋部分点基準で自己採点',
                  desc: <>各小問に配点（合計25点）。「この式で+5点、計算結果で+3点」のように<strong className="text-[#1e293b]">部分点の基準</strong>まで自動生成。</>
                },
                {
                  gradient: 'from-violet-500 to-purple-600',
                  shadow: 'shadow-violet-500/20',
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84" />,
                  title: '入試本番と同じ品質の類題',
                  desc: <>共通テスト・国公立二次の過去問ベースで<strong className="text-[#1e293b]">誘導形式の小問構成</strong>。設定条件・数値・単位まで本番そっくり。</>
                },
                {
                  gradient: 'from-emerald-500 to-teal-600',
                  shadow: 'shadow-emerald-500/20',
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />,
                  title: 'LaTeX組版＋TikZ物理図',
                  desc: <>数式・回路図・力の図をLaTeXで美しく組版。<strong className="text-[#1e293b]">印刷演習</strong>にも<strong className="text-[#1e293b]">タブレット学習</strong>にも最適。</>
                },
              ].map(({ gradient, shadow, icon, title, desc }) => (
                <div key={title} className="bg-white/90 backdrop-blur-sm rounded-2xl border border-[#e2e8f0] p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-lg ${shadow}`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">{icon}</svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-black text-[#0f172a] mb-1">{title}</h3>
                      <p className="text-[12px] text-[#64748b] leading-[1.7]">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>


          {/* ══════ HOW IT WORKS — 3 Steps ══════ */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-8">
              <span className="section-label">How it works</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                たった3ステップ
              </h2>
            </div>

            <div className="landing-steps-track">
              {[
                {
                  num: '1',
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />,
                  title: '単元・難易度を選ぶ',
                  desc: '力学・電磁気・波動・熱力学から選択。基礎〜東大レベルまで6段階。',
                  last: false,
                },
                {
                  num: '2',
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />,
                  title: 'AIが入試問題を生成',
                  desc: '約60秒で配点付き類題を自動作成。TikZ図・部分点基準まで完備。',
                  last: false,
                },
                {
                  num: '3',
                  icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
                  title: '解いて、自己採点する',
                  desc: '解答・解説・配点基準を確認し得点入力。弱点単元を自動分析。',
                  last: true,
                },
              ].map(({ num, icon, title, desc, last }) => (
                <div key={num} className="landing-step-item">
                  <div className={`landing-step-number${last ? ' landing-step-number-last' : ''}`}>{num}</div>
                  {!last && <div className="landing-step-connector" />}
                  <div className="landing-step-content">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className={`w-4 h-4 ${last ? 'text-emerald-500' : 'text-indigo-500'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">{icon}</svg>
                      <h3 className="text-[14px] font-bold text-[#1e293b]">{title}</h3>
                    </div>
                    <p className="text-[12px] text-[#64748b] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>


          {/* ══════ COVERAGE — 4分野 ══════ */}
          <section className="pb-12 sm:pb-16">
            <div className="text-center mb-8 scroll-reveal" style={{ transitionDelay: '0ms' }}>
              <span className="section-label">Coverage</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                物理の全分野に対応
              </h2>
              <p className="text-[12px] text-[#94a3b8] mt-2">共通テスト〜東大二次まで</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { title: '力学', desc: '運動方程式・保存則・衝突・円運動・万有引力', gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                { title: '電磁気', desc: 'クーロン力・回路・電磁誘導・交流・コンデンサー', gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', border: 'border-amber-100' },
                { title: '波動', desc: 'ドップラー効果・干渉・回折・レンズ・光波', gradient: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', border: 'border-violet-100' },
                { title: '熱力学', desc: '気体の法則・熱サイクル・状態変化・エントロピー', gradient: 'from-rose-500 to-red-500', bg: 'bg-rose-50', border: 'border-rose-100' },
              ].map(({ title, desc, gradient, bg, border }, i) => (
                <div key={title} className={`scroll-reveal p-4 rounded-2xl ${bg} border ${border} transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
                     style={{ transitionDelay: `${i * 60}ms` }}>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-2.5 shadow-sm`}>
                    <span className="text-[11px] font-black text-white">{title[0]}</span>
                  </div>
                  <h3 className="text-[13px] font-bold text-[#1e293b] mb-1">{title}</h3>
                  <p className="text-[10px] text-[#64748b] leading-[1.6]">{desc}</p>
                </div>
              ))}
            </div>
          </section>


          {/* ══════ SCORING PREVIEW — USP (Endowed Progress) ══════ */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-7">
              <span className="section-label">Scoring</span>
              <h2 className="text-[20px] sm:text-[24px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                部分点の基準まで分かる
              </h2>
              <p className="text-[12px] text-[#94a3b8] mt-2">自分の解答のどこまでが正しいか、一目瞭然</p>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-sm">
              <div className="px-5 pt-4 pb-3 border-b border-[#f1f5f9]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm">1</div>
                  <span className="text-[12px] font-bold text-[#64748b]">(1) エネルギー保存則</span>
                  <span className="ml-auto text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">10点</span>
                </div>
              </div>
              <div className="px-5 py-4 bg-indigo-50/30 space-y-2">
                {[
                  { ok: true, text: 'エネルギー保存則の式を正しく立てた', pts: '+5点' },
                  { ok: true, text: 'v について正しく解いた', pts: '+3点' },
                  { ok: true, text: '正しい数値を得た', pts: '+2点' },
                ].map(({ ok, text, pts }) => (
                  <div key={text} className="flex items-center gap-1 text-[11px] text-[#334155]">
                    <svg className={`w-3.5 h-3.5 flex-shrink-0 ${ok ? 'text-indigo-500' : 'text-amber-400'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{text}: <strong className="text-indigo-600">{pts}</strong></span>
                  </div>
                ))}
                <div className="flex items-center gap-1 text-[11px] text-[#94a3b8]">
                  <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                  <span>式は正しいが計算ミスの場合: <strong className="text-amber-600">-1点</strong></span>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-[#f1f5f9] bg-[#fafbff] text-center">
                <span className="text-[10px] font-semibold text-[#94a3b8]">すべての小問に自動生成</span>
              </div>
            </div>
          </section>


          {/* ══════ SOCIAL SHARE — バイラル (Reciprocity) ══════ */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="landing-mid-cta">
              <div className="flex items-center justify-center gap-2 mb-5">
                <div className="flex -space-x-2">
                  {['bg-indigo-400', 'bg-violet-400', 'bg-emerald-400', 'bg-amber-400'].map((bg, i) => (
                    <div key={i} className={`w-7 h-7 rounded-full ${bg} border-2 border-white flex items-center justify-center text-[9px] font-bold text-white`}>
                      {['K', 'M', 'S', 'T'][i]}
                    </div>
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-[#64748b] ml-1">受験生が使い始めています</span>
              </div>

              <div className="text-center mb-5">
                <h3 className="text-[18px] sm:text-[20px] font-black text-[#0f172a] tracking-[-0.02em] mb-2">
                  物理で困ってる友だちに<br />教えてあげよう
                </h3>
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  同じ問題で一緒に演習すると定着率が上がる。<br />
                  「これ使ってみ」の一言が、友だちの合格を後押しする。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={handleShare} className="landing-cta-secondary group">
                  <span className="flex items-center justify-center gap-2">
                    {shared ? (
                      <>
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        <span className="text-[13px] font-bold text-emerald-400">コピー完了！</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
                        <span className="text-[13px] font-bold">シェアする</span>
                      </>
                    )}
                  </span>
                </button>
                <Link href="/practice" className="landing-cta-secondary-alt group">
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
                    <span className="text-[13px] font-bold">演習する</span>
                    <svg className="w-3.5 h-3.5 opacity-50 group-hover:translate-x-0.5 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </span>
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {['#REM', '#物理', '#受験勉強', '#共通テスト', '#二次試験'].map((tag) => (
                  <span key={tag} className="text-[10px] font-semibold text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          </section>


          {/* ══════ TOOLS ══════ */}
          <section className="pb-14 sm:pb-18">
            <div className="text-center mb-6 scroll-reveal" style={{ transitionDelay: '0ms' }}>
              <span className="section-label">More</span>
              <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1e293b] tracking-[-0.02em] mt-3">
                その他の機能
              </h2>
            </div>

            <div className="space-y-2.5 scroll-reveal" style={{ transitionDelay: '60ms' }}>
              {[
                { href: '/history', label: '学習履歴', desc: '演習結果の推移と弱点分析', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /> },
                { href: '/search', label: '問題をさがす', desc: '登録済み過去問をキーワード検索', icon: <><circle cx="10.5" cy="10.5" r="6.5" /><line x1="15.5" y1="15.5" x2="21" y2="21" strokeLinecap="round" /></> },
                { href: '/help', label: 'はじめてガイド', desc: '使い方・ワークフロー・用語集', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /> },
              ].map(({ href, label, desc, icon }) => (
                <Link key={href} href={href} className="group block">
                  <div className="tool-card-wrap">
                    <div className="tool-card-icon text-[#64748b] group-hover:text-[#1e293b]"
                         style={{ transition: 'color 0.4s var(--ease-spring)' }}>
                      <div className="group-hover:scale-110" style={{ transition: 'transform 0.45s var(--ease-spring)' }}>
                        <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{icon}</svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 relative z-10">
                      <div className="text-[14px] font-semibold text-[#1e293b] tracking-[-0.01em]">{label}</div>
                      <div className="text-[11px] text-[#94a3b8] mt-0.5">{desc}</div>
                    </div>
                    <svg className="flex-shrink-0 w-4 h-4 text-[#d2d2d7] group-hover:text-[#64748b] group-hover:translate-x-1 relative z-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                         style={{ transition: 'all 0.4s var(--ease-spring)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Final CTA ── */}
          <section className="pb-10 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="max-w-[400px] mx-auto text-center">
              <p className="text-[14px] font-bold text-[#334155] mb-4">
                物理の得点を上げる準備はできた？
              </p>
              <Link href="/practice" className="landing-cta-primary group block mb-3">
                <span className="relative z-10 flex flex-col items-center gap-1">
                  <span className="text-[15px] sm:text-[16px] font-bold">今すぐ演習を始める</span>
                  <span className="text-[10px] font-medium opacity-70">無料 · 60秒で最初の問題が届く</span>
                </span>
              </Link>
            </div>
          </section>

          {/* ── Footer ── */}
          <div className="text-center pb-10 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="status-pill press-scale">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
              </span>
              <span className="text-[11px] font-medium text-[#94a3b8] tracking-[0.02em]">REM — AI物理演習で合格を掴む</span>
            </div>
          </div>
          <MobileNavLinks currentPath="/" />
        </div>
      </div>
    </div>
  );
}
