'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MobileNavLinks } from '@/components/ui';

/* ═══════════════════════════════════════════════════════════════
   REM — Landing Page (物理受験生特化)
   ═══════════════════════════════════════════════════════════════ */

/* ─── Stripe-style Gradient Mesh Background ─── */
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

/* ─── Animated PDF Mockup (Pre-attentive: 出力物の視覚的証明) ─── */
function AnimatedPdfMockup() {
  return (
    <div className="landing-pdf-mockup-container">
      {/* 浮遊する紙のエフェクト */}
      <div className="landing-pdf-float" aria-hidden="true">
        {/* 背面の影ページ */}
        <div className="absolute -right-2 -bottom-2 w-full h-full rounded-2xl bg-[#1e293b]/[0.04] blur-sm" />
        <div className="absolute -right-1 -bottom-1 w-full h-full rounded-xl bg-white/80 border border-[#e2e8f0]/60" />
        
        {/* メインの PDF ページ */}
        <div className="relative bg-white rounded-xl border border-[#e2e8f0] shadow-xl shadow-blue-900/[0.04] p-4 sm:p-5 w-[220px] sm:w-[260px]">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-3">
            <div className="h-2.5 w-20 rounded-full bg-[#1e293b]/25" />
            <div className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100">
              <span className="text-[7px] font-bold text-blue-600">100点</span>
            </div>
          </div>
          <div className="h-[0.5px] w-full bg-[#e2e8f0] mb-3" />
          
          {/* 問題1 */}
          <div className="landing-pdf-line-group mb-3">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 shadow-sm">1</div>
              <div className="flex-1 space-y-1.5 pt-0.5">
                <div className="h-[5px] w-full rounded-full bg-[#94a3b8]/20 landing-line-shimmer" style={{ animationDelay: '0ms' }} />
                <div className="h-[5px] w-[85%] rounded-full bg-[#94a3b8]/15 landing-line-shimmer" style={{ animationDelay: '150ms' }} />
                <div className="h-[5px] w-[60%] rounded-full bg-[#94a3b8]/10 landing-line-shimmer" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
          
          {/* 図の挿入エリア */}
          <div className="mb-3 mx-2 p-2 rounded-lg border border-dashed border-blue-200/60 bg-blue-50/30">
            <div className="flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91" />
              </svg>
              <span className="text-[7px] font-medium text-blue-400">TikZ図</span>
            </div>
          </div>
          
          {/* 問題2 */}
          <div className="landing-pdf-line-group">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 shadow-sm">2</div>
              <div className="flex-1 space-y-1.5 pt-0.5">
                <div className="h-[5px] w-full rounded-full bg-[#94a3b8]/20 landing-line-shimmer" style={{ animationDelay: '450ms' }} />
                <div className="h-[5px] w-[75%] rounded-full bg-[#94a3b8]/15 landing-line-shimmer" style={{ animationDelay: '600ms' }} />
              </div>
            </div>
          </div>
          
          {/* 完成バッジ */}
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

/* ─── Trust Metric (Social Proof — SVGアイコン + 数字カプセル) ─── */
function TrustMetric({ icon, value, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-[10px] bg-[#f1f5f9] border border-[#e2e8f0]/60 flex items-center justify-center text-[#475569]">{icon}</div>
      <div>
        <div className="text-[16px] sm:text-[18px] font-black text-[#0f172a] tracking-tight leading-none">{value}</div>
        <div className="text-[10px] text-[#94a3b8] font-medium mt-0.5 tracking-[0.01em]">{label}</div>
      </div>
    </div>
  );
}

/* ─── Benefit Card (Visual chunking for scanning) ─── */
function BenefitCard({ icon, title, desc, delay }) {
  return (
    <div className="scroll-reveal landing-benefit-card" style={{ transitionDelay: `${delay}ms` }}>
      <div className="landing-benefit-icon">{icon}</div>
      <h3 className="text-[13px] font-bold text-[#1e293b] tracking-[-0.01em] mt-3 mb-1">{title}</h3>
      <p className="text-[11px] text-[#64748b] leading-[1.6]">{desc}</p>
    </div>
  );
}

/* ─── Output Format Card (emoji廃止 → SVGアイコンで高級感) ─── */
function OutputCard({ icon, title, desc, lines }) {
  return (
    <div className="landing-output-card group">
      <div className="bg-white rounded-lg border border-[#e2e8f0]/70 p-2.5 h-[100px] flex flex-col gap-1 mb-2.5 overflow-hidden transition-all duration-500 group-hover:border-blue-200/60 group-hover:shadow-sm">
        {lines}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-[#f1f5f9] border border-[#e2e8f0]/50 flex items-center justify-center text-[#475569]">{icon}</div>
        <div>
          <div className="text-[12px] font-bold text-[#1e293b]">{title}</div>
          <div className="text-[10px] text-[#94a3b8]">{desc}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tool Link (Secondary actions, minimal footprint) ─── */
function ToolLink({ href, icon, label, desc }) {
  return (
    <Link href={href} className="group block">
      <div className="tool-card-wrap">
        <div className="tool-card-icon text-[#64748b] group-hover:text-[#1e293b]"
             style={{ transition: 'color 0.4s var(--ease-spring)' }}>
          <div className="group-hover:scale-110" style={{ transition: 'transform 0.45s var(--ease-spring)' }}>{icon}</div>
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
  );
}


/* ═══════════════════════════════════════════════════════════════
   PAGE BODY — 物理受験生特化 ToC SaaS ランディングページ
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

      {/* ── Gradient mesh background ── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <GradientMeshBackground />
      </div>

      {/* ── Content layer ── */}
      <div className="relative z-20 flex flex-col items-center px-5 sm:px-6 min-h-screen">
        <div className="max-w-[560px] w-full mx-auto">

          {/* ══════════════════════════════════════════════════════════
             HERO — Above the fold
             ══════════════════════════════════════════════════════════ */}
          <section className="pt-10 sm:pt-16 pb-8 sm:pb-12">

            {/* Brand */}
            <div className="text-center mb-5 stagger-item" style={{ animationDelay: '0ms' }}>
              <div className="inline-flex flex-col items-center gap-1">
                <span className="text-[36px] sm:text-[44px] font-black tracking-[-0.06em] leading-none gradient-text-hero-animated">REM</span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-[#94a3b8] tracking-[0.2em] uppercase">Rapid Exam Maker</span>
              </div>
            </div>

            {/* ヘッドライン */}
            <div className="text-center stagger-item" style={{ animationDelay: '80ms' }}>
              <h1 className="text-[26px] sm:text-[38px] font-black tracking-[-0.04em] leading-[1.12] text-[#0f172a] mb-3">
                物理の得点力を、<br className="sm:hidden" /><span className="gradient-text-hero-animated">AIで伸ばす。</span>
              </h1>
            </div>

            {/* サブコピー */}
            <div className="text-center stagger-item" style={{ animationDelay: '150ms' }}>
              <p className="text-[14px] sm:text-[16px] text-[#475569] leading-[1.75] max-w-[380px] mx-auto" style={{ fontFeatureSettings: '"palt"' }}>
                単元・難易度を選ぶだけ。<br />
                <strong className="text-[#1e293b] font-bold">入試レベルの類題</strong>をAIが即生成。<br />
                <span className="text-[#6366f1] font-semibold">配点・部分点基準付き</span>で自己採点。
              </p>
            </div>

            {/* メトリクス — 信頼感 */}
            <div className="stagger-item" style={{ animationDelay: '220ms' }}>
              <div className="flex items-center justify-center gap-3 sm:gap-6 my-7">
                <TrustMetric
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L10.5 21.75 12 13.5H3.75z" /></svg>}
                  value="25点×N問" label="配点付き出題" />
                <div className="w-[1px] h-8 bg-[#e2e8f0]/80" />
                <TrustMetric
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  value="約60秒" label="で生成完了" />
                <div className="w-[1px] h-8 bg-[#e2e8f0]/80" />
                <TrustMetric
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  value="部分点" label="基準で採点" />
              </div>
            </div>

            {/* メインCTA */}
            <div className="stagger-item" style={{ animationDelay: '300ms' }}>
              <div className="max-w-[400px] mx-auto space-y-3">
                <Link href="/practice" className="landing-cta-primary group block">
                  <span className="relative z-10 flex flex-col items-center gap-1">
                    <span className="text-[15px] sm:text-[16px] font-bold">物理の演習を始める</span>
                    <span className="text-[10px] font-medium opacity-70">無料 · アカウント不要 · 即スタート</span>
                  </span>
                </Link>

                {/* 学習履歴 */}
                {historyCount > 0 && (
                  <Link href="/history" className="block px-4 py-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50/80 to-purple-50/80 hover:shadow-md transition-all duration-200 active:scale-[0.98]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4.5 h-4.5 text-violet-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-black text-violet-800">学習履歴 — {historyCount}回演習済み</div>
                        <div className="text-[10px] text-violet-500 font-medium mt-0.5">
                          {avgScore > 0 ? `平均正答率 ${avgScore}% · ` : ''}タップして詳細を確認
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
            <div className="mt-8 sm:mt-10 stagger-item" style={{ animationDelay: '380ms' }}>
              <AnimatedPdfMockup />
            </div>
          </section>


          {/* ══════════════════════════════════════════════════════════
             USP — 他サービスとの差別化
             ══════════════════════════════════════════════════════════ */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-8">
              <span className="section-label">Why REM</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                REMが選ばれる理由
              </h2>
            </div>

            <div className="space-y-3">
              {/* USP 1: 配点・部分点 */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-[#e2e8f0] p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-black text-[#0f172a] mb-1">配点＋部分点基準で自己採点</h3>
                    <p className="text-[12px] text-[#64748b] leading-[1.7]">
                      各小問に配点（合計25点）。解答ごとに「この式で+5点、計算結果で+3点」のように<strong className="text-[#334155]">部分点の基準</strong>まで出力。自分の解答のどこまでが正しかったかが分かる。
                    </p>
                  </div>
                </div>
              </div>

              {/* USP 2: 入試レベルの類題 */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-[#e2e8f0] p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-black text-[#0f172a] mb-1">入試問題と同等品質の類題</h3>
                    <p className="text-[12px] text-[#64748b] leading-[1.7]">
                      共通テスト・国公立二次・早慶の過去問を元に、<strong className="text-[#334155]">誘導形式の小問構成</strong>で出題。設定条件・数値・単位まで本番そっくり。
                    </p>
                  </div>
                </div>
              </div>

              {/* USP 3: LaTeX PDF */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-[#e2e8f0] p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-black text-[#0f172a] mb-1">LaTeX組版の美しいPDF出力</h3>
                    <p className="text-[12px] text-[#64748b] leading-[1.7]">
                      TikZ図・数式をLaTeXで組版。<strong className="text-[#334155]">印刷して演習</strong>にも<strong className="text-[#334155]">タブレットで閲覧</strong>にも最適。自己採点表付き。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>


          {/* ══════════════════════════════════════════════════════════
             ターゲティング — 共感セクション
             ══════════════════════════════════════════════════════════ */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-7">
              <span className="section-label">For you</span>
              <h2 className="text-[20px] sm:text-[24px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                こんな経験、ない？
              </h2>
            </div>
            <div className="space-y-2.5">
              {[
                { icon: '😤', text: '過去問10年分やったけど、もう解く問題がない', sub: '→ AIが無限に類題を出せます' },
                { icon: '📉', text: '模試で物理だけ毎回足を引っ張る…', sub: '→ 苦手単元を集中演習' },
                { icon: '🤯', text: '力学はできるけど電磁気で毎回落とす', sub: '→ 分野別に出題レベルを調整' },
                { icon: '⏰', text: '試験まであと2週間、何をやればいいか分からない', sub: '→ 弱点の自動分析で優先順位がつく' },
                { icon: '😢', text: '部分点もらえたはずなのに、基準が分からない', sub: '→ 部分点基準付きで自己採点できる' },
              ].map(({ icon, text, sub }) => (
                <div key={text} className="bg-white/85 backdrop-blur-sm rounded-2xl border border-[#e2e8f0] px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-start gap-3">
                    <span className="text-[20px] flex-shrink-0 mt-0.5">{icon}</span>
                    <div>
                      <span className="text-[13px] font-bold text-[#1e293b] leading-snug block">{text}</span>
                      <span className="text-[11px] font-semibold text-[#6366f1] mt-1 block">{sub}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>


          {/* ── HOW IT WORKS — 3ステップ ── */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-8">
              <span className="section-label">How it works</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                たった3ステップ
              </h2>
            </div>

            <div className="landing-steps-track">
              <div className="landing-step-item">
                <div className="landing-step-number">1</div>
                <div className="landing-step-connector" />
                <div className="landing-step-content">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                    </svg>
                    <h3 className="text-[14px] font-bold text-[#1e293b]">単元・難易度を選ぶ</h3>
                  </div>
                  <p className="text-[12px] text-[#64748b] leading-relaxed">
                    力学・電磁気・波動・熱力学から選択。共通テスト〜東大レベルまで6段階。
                  </p>
                </div>
              </div>
              <div className="landing-step-item">
                <div className="landing-step-number">2</div>
                <div className="landing-step-connector" />
                <div className="landing-step-content">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <h3 className="text-[14px] font-bold text-[#1e293b]">AIが入試問題を生成</h3>
                  </div>
                  <p className="text-[12px] text-[#64748b] leading-relaxed">
                    約60秒で配点付き類題を自動作成。TikZ図・誘導小問・部分点基準まで完備。
                  </p>
                </div>
              </div>
              <div className="landing-step-item">
                <div className="landing-step-number landing-step-number-last">3</div>
                <div className="landing-step-content">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-[14px] font-bold text-[#1e293b]">解いて、得点入力で自己採点</h3>
                  </div>
                  <p className="text-[12px] text-[#64748b] leading-relaxed">
                    解答・解説・配点基準を確認 → 実際の得点を入力。弱点単元を自動分析。
                  </p>
                </div>
              </div>
            </div>
          </section>


          {/* ── 物理の全分野をカバー ── */}
          <section className="pb-12 sm:pb-16">
            <div className="text-center mb-8 scroll-reveal" style={{ transitionDelay: '0ms' }}>
              <span className="section-label">Coverage</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                全4分野をAIでカバー
              </h2>
              <p className="text-[12px] text-[#94a3b8] mt-2">共通テスト〜東大二次まで対応</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <BenefitCard
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>}
                title="力学"
                desc="運動方程式・エネルギー保存・衝突・円運動・万有引力"
                delay={0}
              />
              <BenefitCard
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L10.5 21.75 12 13.5H3.75z" /></svg>}
                title="電磁気"
                desc="クーロン力・回路・電磁誘導・交流・コンデンサー"
                delay={60}
              />
              <BenefitCard
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>}
                title="波動"
                desc="ドップラー効果・干渉・回折・レンズ・光波"
                delay={120}
              />
              <BenefitCard
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" /></svg>}
                title="熱力学"
                desc="気体の法則・熱サイクル・エントロピー・状態変化"
                delay={180}
              />
            </div>
          </section>


          {/* ══════════════════════════════════════════════════════════
             配点基準プレビュー — USP強化
             ══════════════════════════════════════════════════════════ */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-7">
              <span className="section-label">Scoring</span>
              <h2 className="text-[20px] sm:text-[24px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                部分点の基準まで分かる
              </h2>
              <p className="text-[12px] text-[#94a3b8] mt-2">自分の解答のどこまでが正しいか、一目でチェック</p>
            </div>

            {/* 模擬的な配点基準カード */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-sm">
              <div className="px-5 pt-4 pb-3 border-b border-[#f1f5f9]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm">1</div>
                  <span className="text-[12px] font-bold text-[#64748b]">(1) エネルギー保存則</span>
                  <span className="ml-auto text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">10点</span>
                </div>
              </div>
              <div className="px-5 py-4 bg-blue-50/30 space-y-2">
                <div className="flex items-center gap-1 text-[11px] text-[#334155]">
                  <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>エネルギー保存則の式を正しく立てた: <strong className="text-blue-600">+5点</strong></span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#334155]">
                  <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>v について正しく解いた: <strong className="text-blue-600">+3点</strong></span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#334155]">
                  <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>正しい数値を得た: <strong className="text-blue-600">+2点</strong></span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#94a3b8]">
                  <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                  <span>式は正しいが計算ミスの場合: <strong className="text-amber-600">−1点</strong></span>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-[#f1f5f9] bg-[#fafbff] text-center">
                <span className="text-[10px] font-semibold text-[#94a3b8]">この基準がすべての小問に自動生成されます</span>
              </div>
            </div>
          </section>


          {/* ══════════════════════════════════════════════════════════
             拡散 CTA — バイラル最適化
             ══════════════════════════════════════════════════════════ */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="landing-mid-cta">
              {/* 上部のソーシャルプルーフ */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <div className="flex -space-x-2">
                  {['bg-blue-400', 'bg-violet-400', 'bg-emerald-400', 'bg-amber-400'].map((bg, i) => (
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
                  一緒に演習する仲間がいると、継続率が2倍に。<br />
                  「これ使ってみ」の一言で、友だちの点数も上がる。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={handleShare} className="landing-cta-secondary group">
                  <span className="flex items-center justify-center gap-2">
                    {shared ? (
                      <>
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        <span className="text-[13px] font-bold text-emerald-600">コピー完了！</span>
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

              {/* 拡散ハッシュタグ */}
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {['#REM', '#物理', '#受験勉強', '#共通テスト', '#二次試験'].map((tag) => (
                  <span key={tag} className="text-[10px] font-semibold text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          </section>


          {/* ── TOOLS ── */}
          <section className="pb-14 sm:pb-18">
            <div className="text-center mb-6 scroll-reveal" style={{ transitionDelay: '0ms' }}>
              <span className="section-label">More</span>
              <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1e293b] tracking-[-0.02em] mt-3">
                その他の機能
              </h2>
            </div>

            <div className="space-y-2.5 scroll-reveal" style={{ transitionDelay: '60ms' }}>
              <ToolLink
                href="/history"
                icon={<svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
                label="学習履歴"
                desc="過去の演習結果と弱点分析"
              />
              <ToolLink
                href="/search"
                icon={<svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                label="問題をさがす"
                desc="登録済みの過去問をキーワード検索"
              />
              <ToolLink
                href="/help"
                icon={<svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
                label="はじめてガイド"
                desc="使い方・ワークフロー・用語集"
              />
            </div>
          </section>

          {/* ── 最終CTA ── */}
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
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2563eb]"></span>
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
