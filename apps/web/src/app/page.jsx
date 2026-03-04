'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

/* ─── Artistic Background SVG — "賢く作る" Blueprint Circuit ─── */
function ArtisticBackground() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        {/* Unified gradient system */}
        <linearGradient id="circuit-fade-h" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0" />
          <stop offset="20%" stopColor="#2563eb" stopOpacity="0.12" />
          <stop offset="80%" stopColor="#3b82f6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="circuit-fade-v" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0" />
          <stop offset="20%" stopColor="#2563eb" stopOpacity="0.10" />
          <stop offset="80%" stopColor="#3b82f6" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.30" />
          <stop offset="60%" stopColor="#2563eb" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="center-intelligence" cx="50%" cy="40%" r="45%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.08" />
          <stop offset="50%" stopColor="#6366f1" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="path-flow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
          <stop offset="30%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="70%" stopColor="#6366f1" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ── Central intelligence glow ── */}
      <ellipse cx="600" cy="380" rx="450" ry="320" fill="url(#center-intelligence)" />

      {/* ── Precision grid — blueprint foundation ── */}
      <g opacity="0.06" stroke="#2563eb" strokeWidth="0.5">
        {[0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200].map(x => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="900" />
        ))}
        {[0, 90, 180, 270, 360, 450, 540, 630, 720, 810, 900].map(y => (
          <line key={`h${y}`} x1="0" y1={y} x2="1200" y2={y} />
        ))}
      </g>

      {/* ── Circuit pathways — intelligent connections ── */}
      <g fill="none" strokeWidth="1" opacity="0.14">
        {/* Main horizontal data bus */}
        <path d="M0,360 L240,360 L280,320 L480,320 L520,360 L720,360 L760,400 L960,400 L1000,360 L1200,360" stroke="url(#circuit-fade-h)" />
        {/* Secondary pathways */}
        <path d="M0,180 L120,180 L160,220 L360,220 L400,180 L600,180" stroke="#2563eb" opacity="0.10" />
        <path d="M600,180 L840,180 L880,140 L1080,140 L1120,180 L1200,180" stroke="#3b82f6" opacity="0.08" />
        <path d="M0,630 L200,630 L240,670 L440,670 L480,630 L680,630" stroke="#2563eb" opacity="0.08" />
        <path d="M520,630 L760,630 L800,590 L1000,590 L1040,630 L1200,630" stroke="#3b82f6" opacity="0.10" />
      </g>

      {/* ── Vertical circuit traces ── */}
      <g fill="none" stroke="#2563eb" strokeWidth="0.8" opacity="0.10">
        <path d="M240,0 L240,180 L280,220 L280,360 L240,400 L240,630 L280,670 L280,900" />
        <path d="M960,0 L960,140 L1000,180 L1000,400 L960,440 L960,590 L1000,630 L1000,900" />
      </g>

      {/* ── Smart nodes — junction points ── */}
      <g>
        {/* Primary nodes (grid intersections with circuit paths) */}
        {[
          [240, 180], [480, 320], [720, 360], [960, 400],
          [240, 630], [480, 630], [600, 180], [1000, 360],
          [280, 360], [760, 400], [120, 180], [1080, 140],
          [840, 180], [200, 630], [680, 630], [1000, 630],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="12" fill="url(#node-glow)" />
            <circle cx={cx} cy={cy} r="3" fill="#3b82f6" opacity="0.25" />
            <circle cx={cx} cy={cy} r="1.5" fill="#2563eb" opacity="0.40" />
          </g>
        ))}
      </g>

      {/* ── Elegant corner brackets — precision framing ── */}
      <g stroke="#2563eb" strokeWidth="1" opacity="0.12" fill="none">
        {/* Top-left */}
        <path d="M40,40 L40,100" /><path d="M40,40 L100,40" />
        {/* Top-right */}
        <path d="M1160,40 L1160,100" /><path d="M1160,40 L1100,40" />
        {/* Bottom-left */}
        <path d="M40,860 L40,800" /><path d="M40,860 L100,860" />
        {/* Bottom-right */}
        <path d="M1160,860 L1160,800" /><path d="M1160,860 L1100,860" />
      </g>

      {/* ── Concentric rings — focal intelligence ── */}
      <g fill="none" opacity="0.08">
        <circle cx="600" cy="380" r="180" stroke="#2563eb" strokeWidth="0.8" strokeDasharray="8 12" />
        <circle cx="600" cy="380" r="260" stroke="#3b82f6" strokeWidth="0.6" strokeDasharray="4 16" />
        <circle cx="600" cy="380" r="340" stroke="#6366f1" strokeWidth="0.4" strokeDasharray="2 20" />
      </g>

      {/* ── Data flow paths — smooth intelligent curves ── */}
      <g fill="none" opacity="0.10">
        <path d="M0,280 C200,260 400,340 600,300 C800,260 1000,340 1200,280" stroke="url(#path-flow)" strokeWidth="1.2" />
        <path d="M0,520 C300,500 500,560 600,540 C700,520 900,580 1200,520" stroke="url(#path-flow)" strokeWidth="0.8" />
      </g>

      {/* ── Measurement ticks — precision markers ── */}
      <g stroke="#2563eb" strokeWidth="0.6" opacity="0.08">
        {[120, 240, 360, 480, 600, 720, 840, 960, 1080].map(x => (
          <line key={`t${x}`} x1={x} y1="0" x2={x} y2="8" />
        ))}
        {[90, 180, 270, 360, 450, 540, 630, 720, 810].map(y => (
          <line key={`l${y}`} x1="0" y1={y} x2="8" y2={y} />
        ))}
      </g>
    </svg>
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

/* ─── メインActionCard ─── */
function ActionCard({ href, icon, label, description, gradientFrom, gradientTo, accentColor, delay }) {
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

      {/* ── Background layer ── */}
      <div className="absolute inset-0 bg-[#f8faff]">
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 90% 50% at 50% -5%, rgba(37,99,235,0.04) 0%, transparent 50%)
            `
          }}
        />
      </div>

      {/* ── Static artistic background pattern ── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <ArtisticBackground />
      </div>

      {/* ── Content layer ── */}
      <div className="relative z-20 flex flex-col items-center px-5 py-16 sm:px-6 sm:py-24 pb-32 sm:pb-24 min-h-screen">
        <div className="max-w-[520px] w-full mx-auto">

          {/* ── Hero Section ── */}
          <div className="text-center mb-20 sm:mb-24 stagger-item" style={{ animationDelay: '0ms' }}>
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
            <p className="text-[14px] text-[#94a3b8] leading-[1.7] max-w-[300px] mx-auto tracking-[-0.01em]">
              過去問データとAIで、<br className="sm:hidden" />試験問題を賢くつくる。
            </p>
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
                label="問題をつくる"
                description="出題パターンを選んで、試験問題を自動生成"
                gradientFrom="from-[#1e40af]"
                gradientTo="to-[#1e40af]"
                accentColor="#2563eb"
                delay={60}
              />
              <ActionCard
                href="/dev"
                icon={<TuneIcon />}
                label="品質を磨く"
                description="出題の精度を分析し、さらに向上させる"
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
                description="キーワードや科目で検索"
                delay={60}
              />
              <ToolCard
                href="/db-editor"
                icon={<DbIcon />}
                label="データ管理"
                description="過去問データを確認・編集"
                delay={120}
              />
              <ToolCard
                href="/help"
                icon={<svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
                label="はじめてガイド"
                description="使い方・ワークフロー・用語集"
                delay={180}
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
