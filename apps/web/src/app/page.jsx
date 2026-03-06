'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════════
   REM — Landing Page
   
   Design Principles Applied:
   ─────────────────────────────────────────────────────────────
   1. Pre-attentive Processing  → 1秒で価値が伝わるVisual Hierarchy
   2. Hick's Law               → 選択肢を1つに（CTA一本化）
   3. F-Pattern Scanning        → 左上→右→左下の自然な視線導線
   4. Von Restorff Effect       → CTA を孤立・強調で記憶定着
   5. Miller's Law              → Above-the-fold 情報を5±2チャンクに
   6. Fitts' Law                → CTA は大きく、親指到達域に配置
   7. Social Proof / Anchoring  → 数字で信頼性を先行呈示
   8. Zeigarnik Effect          → ステップを見せて完了欲求を喚起
   9. Aesthetic-Usability       → 美しい＝信頼できるの認知バイアス活用
  10. Progressive Disclosure     → 詳細は fold 以降で段階的に開示
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
   PAGE BODY
   ═══════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const containerRef = useScrollReveal();

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
             ABOVE THE FOLD — 1秒で伝わるヒーローセクション
             
             心理学: Pre-attentive Processing
             → 色・サイズ・位置の3つの視覚チャネルで瞬時に情報を伝達
             
             構造:
               [1] 信頼シグナル（カテゴリーラベル）
               [2] メインヘッドライン（何ができるか）
               [3] サブコピー（どうやるか + 何が得られるか）
               [4] 社会的証明（具体的数字）
               [5] CTA ボタン（行動誘導）
               [6] 視覚的証明（PDF モックアップ）
             ══════════════════════════════════════════════════════════ */}
          <section className="pt-10 sm:pt-16 pb-10 sm:pb-16">
            
            {/* [1] REM Brand Mark — ブランド認知の定着 */}
            <div className="text-center mb-6 stagger-item" style={{ animationDelay: '0ms' }}>
              <div className="inline-flex flex-col items-center gap-1">
                <span className="text-[32px] sm:text-[40px] font-black tracking-[-0.06em] leading-none gradient-text-hero-animated">REM</span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-[#94a3b8] tracking-[0.18em] uppercase">Rapid Exam Maker</span>
              </div>
            </div>

            {/* [2] メインヘッドライン — 具体の法則: 抽象語を排除し、行動/結果を明示 */}
            <div className="text-center stagger-item" style={{ animationDelay: '80ms' }}>
              <h1 className="text-[30px] sm:text-[42px] font-black tracking-[-0.04em] leading-[1.15] text-[#0f172a] mb-3">
                試験問題を、<span className="gradient-text-hero-animated">1分で完成。</span>
              </h1>
            </div>

            {/* [3] サブコピー — Processing Fluency: 短文で処理速度を最大化 */}
            <div className="text-center stagger-item" style={{ animationDelay: '160ms' }}>
              <p className="text-[15px] sm:text-[17px] text-[#475569] leading-[1.7] max-w-[400px] mx-auto mb-2" style={{ fontFeatureSettings: '"palt"' }}>
                教科と難易度を選ぶだけ。<br />
                AIが問題・解答・解説を作成し、<br />
                <strong className="text-[#1e293b] font-bold">印刷可能なPDF</strong>がそのまま完成します。
              </p>
            </div>

            {/* [4] 社会的証明 — Social Proof & Anchoring: SVGアイコン + 数字 */}
            <div className="stagger-item" style={{ animationDelay: '240ms' }}>
              <div className="flex items-center justify-center gap-4 sm:gap-7 my-7 sm:my-9">
                <TrustMetric
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84" /></svg>}
                  value="9教科" label="対応" />
                <div className="w-[1px] h-8 bg-[#e2e8f0]" />
                <TrustMetric
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
                  value="PDF" label="即時出力" />
                <div className="w-[1px] h-8 bg-[#e2e8f0]" />
                <TrustMetric
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>}
                  value="過去問" label="AI分析" />
              </div>
            </div>

            {/* [5] Dual CTA — つくる / 磨く を並列配置（等価重み付け） */}
            <div className="stagger-item" style={{ animationDelay: '320ms' }}>
              <div className="grid grid-cols-2 gap-3 max-w-[400px] mx-auto">
                <Link href="/user" className="landing-cta-primary group">
                  <span className="relative z-10 flex flex-col items-center gap-1.5">
                    <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="text-[14px] sm:text-[15px] font-bold">問題をつくる</span>
                    <span className="text-[10px] font-medium opacity-70">AI自動生成</span>
                  </span>
                </Link>
                <Link href="/dev" className="landing-cta-tune group">
                  <span className="relative z-10 flex flex-col items-center gap-1.5">
                    <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                    </svg>
                    <span className="text-[14px] sm:text-[15px] font-bold">品質を磨く</span>
                    <span className="text-[10px] font-medium opacity-70">精度分析・改善</span>
                  </span>
                </Link>
              </div>
              <p className="text-center text-[11px] text-[#94a3b8] font-medium mt-3">
                無料で始められます — アカウント作成不要
              </p>
            </div>

            {/* [6] 視覚的証明 — Picture Superiority Effect: テキストより画像は6倍記憶される */}
            <div className="mt-8 sm:mt-10 stagger-item" style={{ animationDelay: '400ms' }}>
              <AnimatedPdfMockup />
            </div>
          </section>


          {/* ══════════════════════════════════════════════════════════
             BELOW THE FOLD — Progressive Disclosure
             ══════════════════════════════════════════════════════════ */}

          {/* ── HOW IT WORKS — Zeigarnik Effect: ステップを見せて完了欲求を喚起 ── */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-8">
              <span className="section-label">How it works</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                たった3ステップで完成
              </h2>
            </div>

            <div className="landing-steps-track">
              {/* Step 1 */}
              <div className="landing-step-item">
                <div className="landing-step-number">1</div>
                <div className="landing-step-connector" />
                <div className="landing-step-content">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                    </svg>
                    <h3 className="text-[14px] font-bold text-[#1e293b]">選ぶ</h3>
                  </div>
                  <p className="text-[12px] text-[#64748b] leading-relaxed">教科・難易度・問題数を選択。出題パターンのテンプレートが指示を自動構築</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="landing-step-item">
                <div className="landing-step-number">2</div>
                <div className="landing-step-connector" />
                <div className="landing-step-content">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <h3 className="text-[14px] font-bold text-[#1e293b]">AIが生成</h3>
                  </div>
                  <p className="text-[12px] text-[#64748b] leading-relaxed">過去問データを参考に、問題・解答・解説をLaTeX形式で自動作成。図表も挿入可能</p>
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
                    <h3 className="text-[14px] font-bold text-[#1e293b]">PDF完成</h3>
                  </div>
                  <p className="text-[12px] text-[#64748b] leading-relaxed">そのまま印刷・配布できる高品質PDFを出力。ダウンロードもワンクリック</p>
                </div>
              </div>
            </div>
          </section>


          {/* ── WHAT YOU GET — 具体的な約束事を4つのチャンクで提示 ── */}
          <section className="pb-12 sm:pb-16">
            <div className="text-center mb-8 scroll-reveal" style={{ transitionDelay: '0ms' }}>
              <span className="section-label">What you get</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                このアプリが約束すること
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <BenefitCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                title="作成時間 1/10"
                desc="手作業なら数時間かかる問題作成を、1分以内に完了"
                delay={0}
              />
              <BenefitCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                }
                title="PDF即出力"
                desc="印刷してそのまま配布できる、学術品質のPDFが完成"
                delay={60}
              />
              <BenefitCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                  </svg>
                }
                title="9教科対応"
                desc="数学・物理・化学・生物・英語・国語・社会・情報・医学"
                delay={120}
              />
              <BenefitCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z" />
                  </svg>
                }
                title="図表も自動"
                desc="TikZ図・化学構造式・回路図・グラフを自動挿入"
                delay={180}
              />
            </div>
          </section>


          {/* ── OUTPUT SHOWCASE — 出力物の3パターン提示 ── */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="text-center mb-8">
              <span className="section-label">Output formats</span>
              <h2 className="text-[22px] sm:text-[26px] font-black text-[#0f172a] tracking-[-0.03em] mt-3">
                こんなPDFが手に入ります
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              <OutputCard
                icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
                title="試験問題"
                desc="テスト・入試形式"
                lines={
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <div className="h-1.5 w-10 rounded bg-[#1e293b]/20" />
                      <div className="text-[6px] font-bold px-1 py-0.5 rounded bg-blue-50 text-blue-600">100点</div>
                    </div>
                    <div className="h-[0.5px] w-full bg-[#e2e8f0]" />
                    {[1,2,3].map(n => (
                      <div key={n} className="flex items-center gap-1 mt-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-100 flex items-center justify-center text-[5px] font-bold text-blue-600 flex-shrink-0">{n}</div>
                        <div className="flex-1 h-1 rounded bg-[#94a3b8]/15" />
                      </div>
                    ))}
                  </>
                }
              />
              <OutputCard
                icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" /></svg>}
                title="演習プリント"
                desc="ワークシート形式"
                lines={
                  <>
                    <div className="h-1.5 w-12 rounded bg-[#1e293b]/20 mb-1" />
                    <div className="grid grid-cols-2 gap-1 flex-1">
                      {[1,2,3,4].map(n => (
                        <div key={n} className="bg-[#f8fafc] rounded border border-dashed border-[#e2e8f0] p-1">
                          <div className="text-[5px] text-[#94a3b8]">({n})</div>
                          <div className="h-2 border-b border-[#e2e8f0] mt-0.5" />
                        </div>
                      ))}
                    </div>
                  </>
                }
              />
              <OutputCard
                icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" /></svg>}
                title="一問一答"
                desc="暗記カード形式"
                lines={
                  <>
                    <div className="h-1.5 w-10 rounded bg-[#1e293b]/20 mb-1" />
                    {[1,2,3].map(n => (
                      <div key={n} className="flex items-center gap-1 py-0.5 border-b border-[#f1f5f9]">
                        <div className="text-[5px] font-bold text-blue-500 w-2">{n}.</div>
                        <div className="flex-1 h-1 rounded bg-[#94a3b8]/15" />
                        <div className="w-[0.5px] h-2.5 bg-[#e2e8f0]" />
                        <div className="w-5 h-1 rounded bg-emerald-200/50" />
                      </div>
                    ))}
                  </>
                }
              />
            </div>
          </section>


          {/* ── SECOND CTA — 中盤での行動喚起（Dual 並列CTA再掲） ── */}
          <section className="pb-12 sm:pb-16 scroll-reveal" style={{ transitionDelay: '0ms' }}>
            <div className="landing-mid-cta">
              <div className="text-center mb-5">
                <h3 className="text-[18px] sm:text-[20px] font-black text-[#0f172a] tracking-[-0.02em] mb-2">
                  今すぐ始めませんか？
                </h3>
                <p className="text-[13px] text-[#64748b]">登録不要。選ぶだけで、1分後にはPDFが手元に届きます。</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Link href="/user" className="landing-cta-secondary group">
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    <span className="text-[13px] font-bold">問題をつくる</span>
                    <svg className="w-3.5 h-3.5 opacity-50 group-hover:translate-x-0.5 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </Link>
                <Link href="/dev" className="landing-cta-secondary-alt group">
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
                    <span className="text-[13px] font-bold">品質を磨く</span>
                    <svg className="w-3.5 h-3.5 opacity-50 group-hover:translate-x-0.5 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </Link>
              </div>
            </div>
          </section>


          {/* ── TOOLS — Secondary features (Progressive Disclosure) ── */}
          <section className="pb-16 sm:pb-20">
            <div className="text-center mb-6 scroll-reveal" style={{ transitionDelay: '0ms' }}>
              <span className="section-label">Tools</span>
              <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1e293b] tracking-[-0.02em] mt-3">
                その他の機能
              </h2>
            </div>

            <div className="space-y-2.5 scroll-reveal" style={{ transitionDelay: '60ms' }}>
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
                href="/db-editor"
                icon={
                  <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none">
                    <ellipse cx="12" cy="6.5" rx="8" ry="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4 6.5v11c0 1.66 3.58 3 8 3s8-1.34 8-3v-11" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4 12.5c0 1.66 3.58 3 8 3s8-1.34 8-3" stroke="currentColor" strokeWidth="1.2" opacity="0.35"/>
                  </svg>
                }
                label="データ管理"
                desc="過去問データベースの編集・追加"
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
              <span className="text-[11px] font-medium text-[#94a3b8] tracking-[0.02em]">REM — Rapid Exam Maker</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
