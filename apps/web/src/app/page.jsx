'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

/* ─── Endroll Data ─── */
const ENDROLL_COLS = [
  ['Calculus', 'Linear Algebra', 'Probability', 'Trigonometry', 'Vector Analysis', 'Matrix Theory', 'Sequences', 'Limits', 'Complex Numbers', 'Statistics', 'Differential Eq.', 'Set Theory', 'Topology', 'Number Theory'],
  ['Mechanics', 'Electromagnetism', 'Wave Theory', 'Optics', 'Thermodynamics', 'Quantum Physics', 'Fluid Dynamics', 'Relativity', 'Atomic Physics', 'Particle Physics', 'Acoustics', 'Conservation Laws', 'Kinematics', 'Rotational Inertia'],
  ['Organic Chemistry', 'Inorganic Chemistry', 'Equilibrium', 'Reaction Kinetics', 'Electrochemistry', 'Polymers', 'Redox Reactions', 'Solution Chemistry', 'Crystal Structures', 'Chemical Bonding', 'Gas Laws', 'Thermochemistry', 'Colloids', 'Analytical Chemistry'],
  ['Reading', 'Grammar', 'Composition', 'Vocabulary', 'Listening', 'Syntax', 'Semantics', 'Phonetics', 'Rhetoric', 'Creative Writing', 'Literature', 'Translation', 'Idioms', 'Etymology'],
  ['Genetics', 'Cell Biology', 'Ecology', 'Evolution', 'Neuroscience', 'Immunology', 'Embryology', 'Molecular Biology', 'Botany', 'Ethology', 'Microbiology', 'Anatomy', 'Physiology', 'Biochemistry'],
  ['Information Theory', 'Algorithms', 'Data Structures', 'Networks', 'Cryptography', 'Machine Learning', 'Operating Systems', 'Databases', 'Compilers', 'Complexity Theory', 'Deep Learning', 'Parallel Computing', 'Signal Processing', 'Robotics'],
];

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

/* ─── Endroll Column Component ─── */
function EndrollColumn({ items, speed, direction = 'up', opacity = 0.08 }) {
  const doubled = [...items, ...items];
  return (
    <div className="endroll-col flex-1 overflow-hidden relative" style={{ opacity }}>
      <div
        className={direction === 'up' ? 'endroll-scroll-up' : 'endroll-scroll-down'}
        style={{ animationDuration: `${speed}s` }}
      >
        {doubled.map((text, i) => (
          <div key={i} className="py-[22px] sm:py-[26px] text-center">
            <span className="text-[8px] sm:text-[9px] tracking-[0.25em] text-[#c7c7cc] whitespace-nowrap uppercase"
                  style={{ fontFamily: '"SF Pro Display", -apple-system, "Helvetica Neue", Arial, sans-serif', fontWeight: 300 }}>
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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
      <div className="action-card-wrap p-7 sm:p-8"
           style={{ '--card-glow-color': `${accentColor}0a` }}>
        <div className="relative z-10">
          <div className={`action-card-icon w-12 h-12 flex items-center justify-center mb-5 bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white`}
               style={{ '--icon-shadow': `${accentColor}30` }}>
            <div style={{ transition: 'transform 0.6s var(--ease-spring)' }} className="group-hover:scale-[1.08]">{icon}</div>
          </div>
          <h3 className="text-[18px] font-bold text-[#1d1d1f] mb-1.5 tracking-[-0.02em]">{label}</h3>
          <p className="text-[13px] text-[#86868b] leading-[1.6] tracking-[-0.01em]">{description}</p>

          {/* Hover CTA */}
          <div className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0"
               style={{ color: accentColor, transition: 'opacity 0.5s var(--ease-out-expo), transform 0.5s var(--ease-spring)' }}>
            <span>はじめる</span>
            <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
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
        <div className="tool-card-icon text-[#86868b] group-hover:text-[#1d1d1f]"
             style={{ transition: 'color 0.4s var(--ease-spring)' }}>
          <div className="group-hover:scale-110" style={{ transition: 'transform 0.45s var(--ease-spring)' }}>{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.01em]">{label}</div>
          <div className="text-[12px] text-[#aeaeb2] mt-0.5 tracking-[-0.01em]">{description}</div>
        </div>
        <svg className="flex-shrink-0 w-4 h-4 text-[#d2d2d7] group-hover:text-[#aeaeb2] group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
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

      {/* ── Clean light background with subtle ambient color ── */}
      <div className="absolute inset-0 bg-[#fbfbfd]">
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 45% at 50% -5%, rgba(29,29,31,0.025) 0%, transparent 50%),
              radial-gradient(ellipse 50% 35% at 85% 15%, rgba(142,142,147,0.02) 0%, transparent 40%),
              radial-gradient(ellipse 60% 35% at 10% 85%, rgba(174,174,178,0.015) 0%, transparent 45%)
            `
          }}
        />
      </div>

      {/* ── Endroll background ── */}
      <div className="absolute inset-0 flex pointer-events-none select-none" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#fbfbfd] via-[#fbfbfd]/98 to-transparent z-10" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#fbfbfd] via-[#fbfbfd]/98 to-transparent z-10" />

        {ENDROLL_COLS.map((items, i) => (
          <EndrollColumn
            key={i}
            items={items}
            speed={80 + i * 12}
            direction={i % 2 === 0 ? 'up' : 'down'}
            opacity={0.15 + (i % 3) * 0.04}
          />
        ))}
      </div>

      {/* ── Content layer ── */}
      <div className="relative z-20 flex flex-col items-center px-5 py-16 sm:px-6 sm:py-24 pb-32 sm:pb-24 min-h-screen">
        <div className="max-w-[520px] w-full mx-auto">

          {/* ── Hero Section ── */}
          <div className="text-center mb-20 sm:mb-24 stagger-item" style={{ animationDelay: '0ms' }}>
            {/* Logo mark — glossy floating orb */}
            <div className="relative inline-flex items-center justify-center w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] rounded-[16px] sm:rounded-[18px] mb-7 sm:mb-8 float-slow hero-logo">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#1d1d1f] relative z-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>

            <h1 className="text-[64px] sm:text-[80px] font-black tracking-[-0.05em] leading-[0.9] mb-3 text-glossy-hero">
              REM
            </h1>
            <p className="text-[15px] sm:text-[17px] text-[#86868b] font-medium mb-5 tracking-[-0.01em]"
               style={{ fontFeatureSettings: '"palt"' }}>
              Rapid Exam Maker
            </p>
            <p className="text-[14px] text-[#aeaeb2] leading-[1.7] max-w-[300px] mx-auto tracking-[-0.01em]">
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
                description="出題パターンを選んで、AIが試験問題を自動生成"
                gradientFrom="from-[#2c2c2e]"
                gradientTo="to-[#1d1d1f]"
                accentColor="#1d1d1f"
                delay={60}
              />
              <ActionCard
                href="/dev"
                icon={<TuneIcon />}
                label="品質を磨く"
                description="出題の精度を分析し、さらに向上させる"
                gradientFrom="from-[#48484a]"
                gradientTo="to-[#2c2c2e]"
                accentColor="#2c2c2e"
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
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1d1d1f] opacity-40"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#1d1d1f]"></span>
              </span>
              <span className="text-[11px] font-medium text-[#aeaeb2] tracking-[0.02em]">AI Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
