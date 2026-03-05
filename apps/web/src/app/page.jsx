'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

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
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    const targets = el.querySelectorAll('.scroll-reveal, .scroll-reveal-scale');
    targets.forEach((t) => observer.observe(t));

    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ─── Feature Icons (SF Symbols precision) ─── */

function CreateIcon() {
  return (
    <svg className="w-[26px] h-[26px]" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="2" width="16" height="21" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="7" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      <line x1="7" y1="10.5" x2="13" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35"/>
      <line x1="7" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.25"/>
      <circle cx="20.5" cy="7.5" r="5" fill="currentColor" opacity="0.12"/>
      <line x1="18" y1="7.5" x2="23" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20.5" y1="5" x2="20.5" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function TuneIcon() {
  return (
    <svg className="w-[26px] h-[26px]" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
      <circle cx="14" cy="14" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="14" cy="14" r="1.8" fill="currentColor"/>
      <line x1="14" y1="2" x2="14" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
      <line x1="14" y1="22" x2="14" y2="26" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
      <line x1="2" y1="14" x2="6" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
      <line x1="22" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
    </svg>
  );
}

function SearchIconSvg() {
  return (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function DbIcon() {
  return (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="6.5" rx="8" ry="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 6.5v11c0 1.66 3.58 3 8 3s8-1.34 8-3v-11" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 12.5c0 1.66 3.58 3 8 3s8-1.34 8-3" stroke="currentColor" strokeWidth="1.2" opacity="0.35"/>
    </svg>
  );
}

/* ─── PDF出力プレビュー（ミニチュア） ─── */
function PdfPreviewMini({ type = 'exam' }) {
  const presets = {
    exam: {
      title: '試験問題',
      desc: '定期テスト・入試形式',
      preview: (
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-3 h-[140px] flex flex-col gap-1 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="h-2 w-14 rounded bg-[#1e293b]/20" />
            <div className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">100点</div>
          </div>
          <div className="h-[0.5px] w-full bg-[#e2e8f0] mb-1" />
          <div className="flex items-start gap-1.5 mb-1">
            <div className="w-3.5 h-3.5 rounded-full bg-[#2563eb]/15 flex items-center justify-center text-[6px] font-bold text-[#2563eb] flex-shrink-0 mt-0.5">1</div>
            <div className="flex-1 space-y-0.5">
              <div className="h-1.5 w-full rounded bg-[#94a3b8]/20" />
              <div className="h-1.5 w-4/5 rounded bg-[#94a3b8]/15" />
            </div>
          </div>
          <div className="flex items-start gap-1.5 mb-1">
            <div className="w-3.5 h-3.5 rounded-full bg-[#2563eb]/15 flex items-center justify-center text-[6px] font-bold text-[#2563eb] flex-shrink-0 mt-0.5">2</div>
            <div className="flex-1 space-y-0.5">
              <div className="h-1.5 w-full rounded bg-[#94a3b8]/20" />
              <div className="h-1.5 w-3/5 rounded bg-[#94a3b8]/15" />
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-[#2563eb]/15 flex items-center justify-center text-[6px] font-bold text-[#2563eb] flex-shrink-0 mt-0.5">3</div>
            <div className="flex-1 space-y-0.5">
              <div className="h-1.5 w-full rounded bg-[#94a3b8]/20" />
              <div className="h-1.5 w-2/3 rounded bg-[#94a3b8]/15" />
            </div>
          </div>
        </div>
      ),
    },
    worksheet: {
      title: '学習プリント',
      desc: '演習用ワークシート',
      preview: (
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-3 h-[140px] flex flex-col gap-1.5 shadow-sm">
          <div className="h-2.5 w-20 rounded bg-[#1e293b]/20 mb-1" />
          <div className="flex-1 grid grid-cols-2 gap-1.5">
            {[1,2,3,4].map(n => (
              <div key={n} className="bg-[#f8fafc] rounded border border-dashed border-[#cbd5e1] p-1.5 flex flex-col gap-0.5">
                <div className="text-[6px] font-bold text-[#64748b]">({n})</div>
                <div className="h-1 w-full rounded bg-[#94a3b8]/15" />
                <div className="h-3 w-full rounded border border-[#e2e8f0] mt-auto" />
              </div>
            ))}
          </div>
        </div>
      ),
    },
    flashcard: {
      title: '一問一答',
      desc: 'フラッシュカード形式',
      preview: (
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-3 h-[140px] flex flex-col gap-1.5 shadow-sm">
          <div className="h-2 w-16 rounded bg-[#1e293b]/20 mb-1" />
          {[1,2,3].map(n => (
            <div key={n} className="flex items-center gap-2 py-1 border-b border-[#f1f5f9]">
              <div className="text-[7px] font-bold text-[#2563eb] w-3">{n}.</div>
              <div className="flex-1 h-1.5 rounded bg-[#94a3b8]/15" />
              <div className="w-[1px] h-4 bg-[#e2e8f0]" />
              <div className="w-10 h-1.5 rounded bg-emerald-200/50" />
            </div>
          ))}
        </div>
      ),
    },
  };
  const p = presets[type];
  return (
    <div className="flex flex-col items-center gap-2">
      {p.preview}
      <div className="text-center">
        <div className="text-[12px] font-semibold text-[#1e293b]">{p.title}</div>
        <div className="text-[10px] text-[#94a3b8]">{p.desc}</div>
      </div>
    </div>
  );
}

/* ─── ワークフローステップ ─── */
function WorkflowStep({ number, icon, title, description, isLast }) {
  return (
    <div className="flex items-start gap-3 relative">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#1e40af] text-white flex items-center justify-center text-[14px] font-bold shadow-md shadow-blue-200/50 flex-shrink-0">
          {number}
        </div>
        {!isLast && <div className="w-[2px] h-10 bg-gradient-to-b from-[#2563eb]/30 to-transparent mt-1" />}
      </div>
      <div className="pt-1 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[#64748b]">{icon}</span>
          <h4 className="text-[15px] font-bold text-[#1e293b] tracking-[-0.01em]">{title}</h4>
        </div>
        <p className="text-[13px] text-[#94a3b8] leading-[1.6]">{description}</p>
      </div>
    </div>
  );
}

/* ─── メインActionCard ─── */
function ActionCard({ href, icon, label, description, outcome, gradientFrom, gradientTo, accentColor, delay }) {
  return (
    <Link href={href} className="group block scroll-reveal" style={{ transitionDelay: `${delay}ms` }}>
      <div className="action-card-wrap p-7 sm:p-8">
        <div className="relative z-10">
          <div className={`action-card-icon w-12 h-12 flex items-center justify-center mb-5 bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white`}
               style={{ '--icon-shadow': `${accentColor}30` }}>
            <div style={{ transition: 'transform 0.6s var(--ease-spring)' }} className="group-hover:scale-[1.08]">{icon}</div>
          </div>
          <h3 className="text-[18px] font-bold text-[#1e293b] mb-1.5 tracking-[-0.02em]">{label}</h3>
          <p className="text-[13px] text-[#64748b] leading-[1.6] tracking-[-0.01em]">{description}</p>
          {outcome && (
            <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50/80 border border-emerald-100">
              <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[11px] font-medium text-emerald-700">{outcome}</span>
            </div>
          )}

          {/* Hover CTA */}
          <div className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0"
               style={{ color: accentColor, transition: 'opacity 0.5s var(--ease-out-expo), transform 0.5s var(--ease-spring)' }}>
            <span>はじめる</span>
            <svg className="w-3.5 h-3.5 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                 style={{ transition: 'transform 0.4s var(--ease-spring)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── ツールカード ─── */
function ToolCard({ href, icon, label, description, delay }) {
  return (
    <Link href={href} className="group block scroll-reveal" style={{ transitionDelay: `${delay}ms` }}>
      <div className="tool-card-wrap">
        <div className="tool-card-icon text-[#64748b] group-hover:text-[#1e293b]"
             style={{ transition: 'color 0.4s var(--ease-spring)' }}>
          <div className="group-hover:scale-110" style={{ transition: 'transform 0.45s var(--ease-spring)' }}>{icon}</div>
        </div>
        <div className="flex-1 min-w-0 relative z-10">
          <div className="text-[15px] font-semibold text-[#1e293b] tracking-[-0.01em]">{label}</div>
          <div className="text-[12px] text-[#94a3b8] mt-0.5 tracking-[-0.01em]">{description}</div>
        </div>
        <svg className="flex-shrink-0 w-4 h-4 text-[#d2d2d7] group-hover:text-[#64748b] group-hover:translate-x-1 relative z-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
             style={{ transition: 'all 0.4s var(--ease-spring)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

/* ─── ページ本体 ─── */
export default function HomePage() {
  const containerRef = useScrollReveal();

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden">

      {/* ── Gradient mesh background ── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <GradientMeshBackground />
      </div>

      {/* ── Content layer ── */}
      <div className="relative z-20 flex flex-col items-center px-5 py-16 sm:px-6 sm:py-24 pb-32 sm:pb-24 min-h-screen">
        <div className="max-w-[520px] w-full mx-auto">

          {/* ── Hero Section ── */}
          <div className="text-center mb-14 sm:mb-18 stagger-item" style={{ animationDelay: '0ms' }}>
            {/* Logo */}
            <div className="hero-hex-assembly mb-8 sm:mb-10">
              <div className="hero-hex-logo">
                <div className="hero-hex-inner">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#1e293b] relative z-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
            </div>

            <h1 className="text-[64px] sm:text-[80px] font-black tracking-[-0.05em] leading-[0.9] mb-3 gradient-text-hero-animated hero-title-hex">
              REM
            </h1>
            <p className="text-[15px] sm:text-[17px] text-[#64748b] font-medium mb-5 tracking-[-0.01em]"
               style={{ fontFeatureSettings: '"palt"' }}>
              Rapid Exam Maker
            </p>
            <p className="text-[16px] sm:text-[18px] font-bold text-[#1e293b] leading-[1.5] max-w-[340px] mx-auto tracking-[-0.02em] mb-2">
              テンプレートを選ぶだけで、<br />本格的な試験問題PDFを自動生成
            </p>
            <p className="text-[13px] text-[#94a3b8] leading-[1.7] max-w-[300px] mx-auto tracking-[-0.01em]">
              過去問データをAIが分析し、新しい問題を作成。<br />そのまま印刷・配布できるPDFが完成します。
            </p>
          </div>

          {/* ── ワークフロー可視化 ── */}
          <div className="mb-14 scroll-reveal" style={{ transitionDelay: '100ms' }}>
            <div className="mb-5">
              <span className="section-label">3ステップで完成</span>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-[#e2e8f0]/80 p-5 sm:p-6 shadow-sm">
              <WorkflowStep
                number={1}
                icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>}
                title="パターンを選ぶ"
                description="教科・分野・難易度を選択するだけ。テンプレートがAIへの指示を自動構築します。"
              />
              <WorkflowStep
                number={2}
                icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>}
                title="AIが問題を生成"
                description="過去問データを参考に、AIが新しい問題・解答・解説をLaTeX形式で作成します。"
              />
              <WorkflowStep
                number={3}
                icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
                title="PDFで完成"
                description="そのまま印刷・配布できる高品質なPDFが出力されます。ダウンロードもワンクリック。"
                isLast
              />
            </div>
          </div>

          {/* ── 出力プレビューショーケース ── */}
          <div className="mb-14 scroll-reveal" style={{ transitionDelay: '200ms' }}>
            <div className="mb-5">
              <span className="section-label">こんなPDFが手に入ります</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <PdfPreviewMini type="exam" />
              <PdfPreviewMini type="worksheet" />
              <PdfPreviewMini type="flashcard" />
            </div>
          </div>

          {/* ── Main Features Section ── */}
          <div className="mb-10">
            <div className="scroll-reveal mb-5" style={{ transitionDelay: '0ms' }}>
              <span className="section-label">Main Features</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <ActionCard
                href="/user"
                icon={<CreateIcon />}
                label="試験問題をつくる"
                description="教科・分野・難易度を選ぶだけで、本格的な試験問題PDFを自動生成"
                outcome="印刷可能なPDFが完成"
                gradientFrom="from-[#1e40af]"
                gradientTo="to-[#1e40af]"
                accentColor="#2563eb"
                delay={60}
              />
              <ActionCard
                href="/dev"
                icon={<TuneIcon />}
                label="品質を磨く"
                description="生成した問題の精度を分析し、フィードバックで品質を向上"
                outcome="より良い問題に改善"
                gradientFrom="from-[#3b82f6]"
                gradientTo="to-[#1e40af]"
                accentColor="#1e40af"
                delay={120}
              />
            </div>
          </div>

          {/* ── Tools Section ── */}
          <div className="mb-16">
            <div className="scroll-reveal mb-5" style={{ transitionDelay: '0ms' }}>
              <span className="section-label">Tools</span>
            </div>
            <div className="space-y-2.5">
              <ToolCard
                href="/search"
                icon={<SearchIconSvg />}
                label="問題をさがす"
                description="登録済みの過去問をキーワード・科目で検索"
                delay={60}
              />
              <ToolCard
                href="/db-editor"
                icon={<DbIcon />}
                label="データ管理"
                description="過去問データベースの確認・編集・追加"
                delay={120}
              />
              <ToolCard
                href="/settings"
                icon={<svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                label="ブランド設定"
                description="サービス名・テーマカラーをカスタマイズ"
                delay={180}
              />
              <ToolCard
                href="/help"
                icon={<svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
                label="はじめてガイド"
                description="使い方・ワークフロー・用語集"
                delay={240}
              />
            </div>
          </div>

          {/* ── Status Pill ── */}
          <div className="text-center scroll-reveal" style={{ transitionDelay: '100ms' }}>
            <div className="status-pill press-scale">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2563eb]"></span>
              </span>
              <span className="text-[11px] font-medium text-[#94a3b8] tracking-[0.02em]">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
