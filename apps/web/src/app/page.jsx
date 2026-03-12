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
   PAGE BODY — 物理受験生特化ランディングページ
   ═══════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const containerRef = useScrollReveal();
  const [historyCount, setHistoryCount] = useState(0);

  // localStorage から学習履歴件数を取得
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rem_practice_history');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) setHistoryCount(data.length);
      }
    } catch {}
  }, []);

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
             ABOVE THE FOLD — ヒーローセクション (物理特化)
             ══════════════════════════════════════════════════════════ */}
          <section className="pt-10 sm:pt-16 pb-10 sm:pb-16">

            {/* Brand Mark */}
            <div className="text-center mb-6 stagger-item" style={{ animationDelay: '0ms' }}>
              <div className="inline-flex flex-col items-center gap-1">
                <span className="text-[32px] sm:text-[40px] font-black tracking-[-0.06em] leading-none gradient-text-hero-animated">REM</span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-[#94a3b8] tracking-[0.18em] uppercase">Rapid Exam Maker</span>
              </div>
            </div>

            {/* ヘッドライン — 物理受験生にフォーカス */}
            <div className="text-center stagger-item" style={{ animationDelay: '80ms' }}>
              <h1 className="text-[28px] sm:text-[40px] font-black tracking-[-0.04em] leading-[1.15] text-[#0f172a] mb-3">
                物理の得点力を、<span className="gradient-text-hero-animated">AIで伸ばす。</span>
              </h1>
            </div>

            {/* サブコピー */}
            <div className="text-center stagger-item" style={{ animationDelay: '160ms' }}>
              <p className="text-[15px] sm:text-[17px] text-[#475569] leading-[1.7] max-w-[400px] mx-auto mb-2" style={{ fontFeatureSettings: '"palt"' }}>
                単元と難易度を選ぶだけで、<br />
                力学・電磁気・波動・熱力学の<br />
                <strong className="text-[#1e293b] font-bold">入試レベルの類題</strong>がすぐ解ける。
              </p>
            </div>

            {/* ソーシャルプルーフ — 物理特化 */}
            <div className="stagger-item" style={{ animationDelay: '240ms' }}>
              <div className="flex items-center justify-center gap-4 sm:gap-7 my-7 sm:my-9">
                <TrustMetric
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L10.5 21.75 12 13.5H3.75z" /></svg>}
                  value="物理" label="AI演習" />
                <div className="w-[1px] h-8 bg-[#e2e8f0]" />
                <TrustMetric
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  value="1分" label="で類題生成" />
                <div className="w-[1px] h-8 bg-[#e2e8f0]" />
                <TrustMetric
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84" /></svg>}
                  value="配点付" label="自己採点" />
              </div>
            </div>

            {/* メインCTA */}
            <div className="stagger-item" style={{ animationDelay: '320ms' }}>
              <div className="max-w-[400px] mx-auto">
                <Link href="/practice" className="landing-cta-primary group block mb-3">
                  <span className="relative z-10 flex flex-col items-center gap-1.5">
                    <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                    </svg>
                    <span className="text-[15px] sm:text-[16px] font-bold">物理の類題を練習する</span>
                    <span className="text-[10px] font-medium opacity-70">単元・難易度を選ぶだけ → 即スタート</span>
                  </span>
                </Link>

                {/* 学習履歴カード */}
                {historyCount > 0 && (
                  <Link href="/history" className="block mb-3 px-4 py-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 hover:shadow-md transition-all duration-200 active:scale-[0.98]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4.5 h-4.5 text-violet-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-black text-violet-800">学習履歴を見る</div>
                        <div className="text-[10px] text-violet-500 font-medium mt-0.5">{historyCount}回の演習記録あり</div>
                      </div>
                      <svg className="w-4 h-4 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </Link>
                )}

                {/* 履歴がない場合のリンク */}
                {historyCount === 0 && (
                  <Link href="/history" className="block mb-3 text-center text-[11px] text-violet-500 hover:text-violet-700 transition-colors">
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
                      </svg>
                      学習履歴
                    </span>
                  </Link>
                )}

                <Link href="/user" className="landing-cta-tune group block">
                  <span className="relative z-10 flex flex-col items-center gap-1.5">
                    <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="text-[14px] sm:text-[15px] font-bold">PDF問題を作成する</span>
                    <span className="text-[10px] font-medium opacity-70">教員・詳細設定モード</span>
                  </span>
                </Link>
              </div>
              <p className="text-center text-[11px] text-[#94a3b8] font-medium mt-3">
                無料で始められます — アカウント作成不要
              </p>
            </div>

            {/* PDF Mockup */}
            <div className="mt-8 sm:mt-10 stagger-item" style={{ animationDelay: '400ms' }}>
              <AnimatedPdfMockup />
            </div>
          </section>


          {/* ══════════════════════════════════════════════════════════
             こんな受験生におすすめ — ターゲティング
             ══════════════════════════════════════════════════════════ */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-8">
              <span className="section-label">For you</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                こんな受験生におすすめ
              </h2>
            </div>
            <div className="space-y-3">
              {[
                { emoji: '😤', text: '物理の過去問を解き切ったけど、もっと類題が欲しい' },
                { emoji: '📉', text: '模試で物理だけ偏差値が伸びない…' },
                { emoji: '🤯', text: '力学は分かるのに電磁気で毎回落とす' },
                { emoji: '⏰', text: '試験直前、苦手単元だけ集中的に演習したい' },
              ].map(({ emoji, text }) => (
                <div key={text} className="flex items-center gap-3 bg-white/80 backdrop-blur rounded-2xl border border-[#e2e8f0] px-4 py-3.5 shadow-sm">
                  <span className="text-[22px] flex-shrink-0">{emoji}</span>
                  <span className="text-[13px] font-semibold text-[#334155] leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </section>


          {/* ── HOW IT WORKS — 3ステップ ── */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-8">
              <span className="section-label">How it works</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                たった3ステップで演習開始
              </h2>
            </div>

            <div className="landing-steps-track">
              {/* Step 1 */}
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
                  <p className="text-[12px] text-[#64748b] leading-relaxed">力学・電磁気・波動・熱力学から選択。共通テスト〜東大レベルまで6段階</p>
                </div>
              </div>

              {/* Step 2 */}
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
                  <p className="text-[12px] text-[#64748b] leading-relaxed">過去問データベースを元に、配点付きの類題を自動作成。TikZ図付き</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="landing-step-item">
                <div className="landing-step-number landing-step-number-last">3</div>
                <div className="landing-step-content">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-[14px] font-bold text-[#1e293b]">解いて自己採点</h3>
                  </div>
                  <p className="text-[12px] text-[#64748b] leading-relaxed">解答・解説をチェック → 得点入力で自己採点。弱点単元を自動抽出</p>
                </div>
              </div>
            </div>
          </section>


          {/* ── 物理の全分野をカバー ── */}
          <section className="pb-12 sm:pb-16">
            <div className="text-center mb-8 scroll-reveal" style={{ transitionDelay: '0ms' }}>
              <span className="section-label">Coverage</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                物理の全分野をAIでカバー
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <BenefitCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  </svg>
                }
                title="力学"
                desc="運動方程式・エネルギー保存・衝突・円運動・万有引力"
                delay={0}
              />
              <BenefitCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L10.5 21.75 12 13.5H3.75z" />
                  </svg>
                }
                title="電磁気"
                desc="クーロン力・回路・電磁誘導・交流・コンデンサー"
                delay={60}
              />
              <BenefitCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                }
                title="波動"
                desc="ドップラー効果・干渉・回折・レンズ・光波"
                delay={120}
              />
              <BenefitCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
                  </svg>
                }
                title="熱力学"
                desc="気体の法則・熱サイクル・エントロピー・状態変化"
                delay={180}
              />
            </div>
          </section>


          {/* ── シェア＆拡散 CTA ── */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="landing-mid-cta">
              <div className="text-center mb-5">
                <div className="text-[36px] mb-2">🔥</div>
                <h3 className="text-[18px] sm:text-[20px] font-black text-[#0f172a] tracking-[-0.02em] mb-2">
                  友だちにも教えてあげよう
                </h3>
                <p className="text-[13px] text-[#64748b] leading-relaxed">
                  一緒に演習する仲間がいると、続けやすくなる。<br />
                  物理で困ってる友だちにシェアしよう。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const text = '物理の入試対策にめっちゃ使える！AIが類題を無限に出してくれるサービス見つけた 🔥\n#REM #物理 #受験勉強';
                    if (navigator.share) { navigator.share({ title: 'REM', text }).catch(() => {}); }
                    else { navigator.clipboard.writeText(text + '\n' + window.location.href).catch(() => {}); }
                  }}
                  className="landing-cta-secondary group"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                    <span className="text-[13px] font-bold">シェアする</span>
                  </span>
                </button>
                <Link href="/practice" className="landing-cta-secondary-alt group">
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                    </svg>
                    <span className="text-[13px] font-bold">演習する</span>
                    <svg className="w-3.5 h-3.5 opacity-50 group-hover:translate-x-0.5 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </Link>
              </div>
            </div>
          </section>


          {/* ── TOOLS ── */}
          <section className="pb-16 sm:pb-20">
            <div className="text-center mb-6 scroll-reveal" style={{ transitionDelay: '0ms' }}>
              <span className="section-label">Tools</span>
              <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1e293b] tracking-[-0.02em] mt-3">
                その他の機能
              </h2>
            </div>

            <div className="space-y-2.5 scroll-reveal" style={{ transitionDelay: '60ms' }}>
              <ToolLink
                href="/history"
                icon={
                  <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                }
                label="学習履歴"
                desc="過去の演習結果・成長グラフを確認"
              />
              <ToolLink
                href="/search"
                icon={
                  <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none">
                    <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                    <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                }
                label="問題をさがす"
                desc="登録済みの過去問をキーワード検索"
              />
              <ToolLink
                href="/help"
                icon={
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                }
                label="はじめてガイド"
                desc="使い方・ワークフロー・用語集"
              />
            </div>
          </section>

          {/* ── Footer pill ── */}
          <div className="text-center pb-10 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="status-pill press-scale">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2563eb]"></span>
              </span>
              <span className="text-[11px] font-medium text-[#94a3b8] tracking-[0.02em]">REM — 物理受験生のためのAI演習</span>
            </div>
          </div>
          <MobileNavLinks currentPath="/" />
        </div>
      </div>
    </div>
  );
}
