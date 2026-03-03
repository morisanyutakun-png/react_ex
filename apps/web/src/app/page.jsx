'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

/* ─── Artistic Background SVG ─── */
function ArtisticBackground() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        {/* Gradient definitions */}
        <linearGradient id="grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="grad-indigo" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="grad-cyan" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="grad-violet" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="line-blue" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="line-indigo" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
          <stop offset="50%" stopColor="#6366f1" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="line-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
          <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow-center" cx="50%" cy="40%" r="40%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── Large geometric shapes ── */}
      {/* Big circle — top right */}
      <circle cx="1050" cy="120" r="280" fill="none" stroke="#3b82f6" strokeWidth="0.8" opacity="0.08" />
      <circle cx="1050" cy="120" r="220" fill="none" stroke="#6366f1" strokeWidth="0.5" opacity="0.06" />
      <circle cx="1050" cy="120" r="160" fill="url(#grad-indigo)" />

      {/* Big circle — bottom left */}
      <circle cx="100" cy="750" r="320" fill="none" stroke="#06b6d4" strokeWidth="0.8" opacity="0.07" />
      <circle cx="100" cy="750" r="250" fill="none" stroke="#3b82f6" strokeWidth="0.5" opacity="0.05" />
      <circle cx="100" cy="750" r="180" fill="url(#grad-cyan)" />

      {/* Medium circle — center left */}
      <circle cx="200" cy="300" r="120" fill="none" stroke="#8b5cf6" strokeWidth="0.6" opacity="0.06" />
      <circle cx="200" cy="300" r="80" fill="url(#grad-violet)" />

      {/* Center glow */}
      <ellipse cx="600" cy="360" rx="500" ry="350" fill="url(#glow-center)" />

      {/* ── Triangular shapes ── */}
      <polygon points="950,350 1100,650 800,650" fill="none" stroke="#3b82f6" strokeWidth="0.6" opacity="0.06" />
      <polygon points="970,390 1070,600 870,600" fill="url(#grad-blue)" />

      <polygon points="300,50 420,250 180,250" fill="none" stroke="#6366f1" strokeWidth="0.5" opacity="0.05" />
      <polygon points="310,80 400,230 220,230" fill="url(#grad-indigo)" />

      {/* ── Diamond / rotated square ── */}
      <rect x="520" y="650" width="100" height="100" rx="4" fill="none" stroke="#06b6d4" strokeWidth="0.6" opacity="0.07" transform="rotate(45 570 700)" />
      <rect x="535" y="665" width="70" height="70" rx="3" fill="url(#grad-cyan)" transform="rotate(45 570 700)" />

      {/* ── Horizontal accent lines ── */}
      <line x1="0" y1="180" x2="1200" y2="180" stroke="url(#line-blue)" strokeWidth="0.5" />
      <line x1="0" y1="420" x2="1200" y2="420" stroke="url(#line-indigo)" strokeWidth="0.4" />
      <line x1="0" y1="680" x2="1200" y2="680" stroke="url(#line-blue)" strokeWidth="0.5" />

      {/* ── Vertical accent lines ── */}
      <line x1="300" y1="0" x2="300" y2="900" stroke="url(#line-cyan)" strokeWidth="0.4" />
      <line x1="900" y1="0" x2="900" y2="900" stroke="url(#line-cyan)" strokeWidth="0.4" />

      {/* ── Diagonal accent lines ── */}
      <line x1="0" y1="0" x2="600" y2="900" stroke="#3b82f6" strokeWidth="0.3" opacity="0.04" />
      <line x1="600" y1="0" x2="1200" y2="900" stroke="#6366f1" strokeWidth="0.3" opacity="0.03" />
      <line x1="1200" y1="0" x2="600" y2="900" stroke="#06b6d4" strokeWidth="0.3" opacity="0.03" />

      {/* ── Scattered dots / nodes ── */}
      <g opacity="0.15">
        <circle cx="150" cy="150" r="3" fill="#3b82f6" />
        <circle cx="450" cy="80" r="2.5" fill="#6366f1" />
        <circle cx="750" cy="200" r="3.5" fill="#06b6d4" />
        <circle cx="1000" cy="400" r="2" fill="#8b5cf6" />
        <circle cx="350" cy="500" r="3" fill="#3b82f6" />
        <circle cx="850" cy="600" r="2.5" fill="#6366f1" />
        <circle cx="600" cy="800" r="3" fill="#06b6d4" />
        <circle cx="100" cy="450" r="2" fill="#8b5cf6" />
        <circle cx="1100" cy="700" r="2.5" fill="#3b82f6" />
        <circle cx="500" cy="300" r="2" fill="#06b6d4" />
      </g>

      {/* ── Concentric arcs — top left ── */}
      <path d="M0,0 Q0,200 200,200" fill="none" stroke="#3b82f6" strokeWidth="0.6" opacity="0.07" />
      <path d="M0,0 Q0,300 300,300" fill="none" stroke="#6366f1" strokeWidth="0.5" opacity="0.05" />
      <path d="M0,0 Q0,400 400,400" fill="none" stroke="#06b6d4" strokeWidth="0.4" opacity="0.04" />

      {/* ── Concentric arcs — bottom right ── */}
      <path d="M1200,900 Q1200,700 1000,700" fill="none" stroke="#3b82f6" strokeWidth="0.6" opacity="0.07" />
      <path d="M1200,900 Q1200,600 900,600" fill="none" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.05" />
      <path d="M1200,900 Q1200,500 800,500" fill="none" stroke="#06b6d4" strokeWidth="0.4" opacity="0.04" />

      {/* ── Hexagon ── */}
      <polygon points="600,100 660,135 660,195 600,230 540,195 540,135" fill="none" stroke="#3b82f6" strokeWidth="0.6" opacity="0.06" />
      <polygon points="600,115 648,142 648,188 600,215 552,188 552,142" fill="url(#grad-blue)" />

      {/* ── Small cross marks ── */}
      <g stroke="#6366f1" strokeWidth="0.8" opacity="0.08">
        <line x1="780" y1="85" x2="800" y2="85" /><line x1="790" y1="75" x2="790" y2="95" />
        <line x1="380" y1="700" x2="400" y2="700" /><line x1="390" y1="690" x2="390" y2="710" />
        <line x1="1050" y1="500" x2="1070" y2="500" /><line x1="1060" y1="490" x2="1060" y2="510" />
      </g>

      {/* ── Small squares ── */}
      <rect x="680" y="380" width="16" height="16" fill="none" stroke="#3b82f6" strokeWidth="0.6" opacity="0.08" rx="2" />
      <rect x="160" y="580" width="12" height="12" fill="none" stroke="#06b6d4" strokeWidth="0.6" opacity="0.07" rx="1" />
      <rect x="1020" y="280" width="14" height="14" fill="none" stroke="#8b5cf6" strokeWidth="0.6" opacity="0.06" rx="2" />

      {/* ── Flowing curves ── */}
      <path d="M0,500 C200,450 400,550 600,480 C800,410 1000,520 1200,460" fill="none" stroke="#3b82f6" strokeWidth="0.6" opacity="0.06" />
      <path d="M0,520 C200,470 400,570 600,500 C800,430 1000,540 1200,480" fill="none" stroke="#6366f1" strokeWidth="0.4" opacity="0.04" />

      <path d="M0,200 C300,250 500,150 700,220 C900,290 1100,180 1200,230" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.05" />
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
      <div className="action-card-wrap shine-on-hover p-7 sm:p-8"
           style={{ '--card-glow-color': `${accentColor}0a` }}>
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

      {/* ── Artistic background layers ── */}
      <div className="absolute inset-0 bg-[#f8faff]">
        {/* Base aurora gradient */}
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 90% 50% at 50% -5%, rgba(37,99,235,0.06) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 90% 15%, rgba(99,102,241,0.04) 0%, transparent 40%),
              radial-gradient(ellipse 70% 40% at 5% 80%, rgba(6,182,212,0.035) 0%, transparent 45%),
              radial-gradient(ellipse 50% 30% at 70% 60%, rgba(139,92,246,0.025) 0%, transparent 40%)
            `
          }}
        />
        {/* Topographic contour lines */}
        <div className="home-topo-lines" />
        {/* Flowing connection network */}
        <svg className="home-network-svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="net-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(37,99,235,0.12)" />
              <stop offset="100%" stopColor="rgba(99,102,241,0.06)" />
            </linearGradient>
            <linearGradient id="net-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(6,182,212,0.10)" />
              <stop offset="100%" stopColor="rgba(37,99,235,0.04)" />
            </linearGradient>
          </defs>
          {/* Node network constellation */}
          <g className="home-net-nodes">
            <circle cx="120" cy="80" r="2" fill="rgba(37,99,235,0.15)"><animate attributeName="r" values="2;3;2" dur="4s" repeatCount="indefinite" /></circle>
            <circle cx="680" cy="120" r="1.5" fill="rgba(99,102,241,0.12)"><animate attributeName="r" values="1.5;2.5;1.5" dur="5s" repeatCount="indefinite" /></circle>
            <circle cx="400" cy="50" r="2.5" fill="rgba(6,182,212,0.10)"><animate attributeName="r" values="2.5;3.5;2.5" dur="3.5s" repeatCount="indefinite" /></circle>
            <circle cx="200" cy="350" r="1.8" fill="rgba(139,92,246,0.10)"><animate attributeName="r" values="1.8;2.8;1.8" dur="4.5s" repeatCount="indefinite" /></circle>
            <circle cx="600" cy="400" r="2" fill="rgba(37,99,235,0.12)"><animate attributeName="r" values="2;3;2" dur="3.8s" repeatCount="indefinite" /></circle>
            <circle cx="50" cy="500" r="1.5" fill="rgba(6,182,212,0.08)"><animate attributeName="r" values="1.5;2.5;1.5" dur="5.2s" repeatCount="indefinite" /></circle>
            <circle cx="750" cy="500" r="2" fill="rgba(99,102,241,0.10)"><animate attributeName="r" values="2;3;2" dur="4.2s" repeatCount="indefinite" /></circle>
            <circle cx="350" cy="550" r="1.8" fill="rgba(37,99,235,0.08)"><animate attributeName="r" values="1.8;2.8;1.8" dur="3.6s" repeatCount="indefinite" /></circle>
          </g>
          {/* Connection paths */}
          <g className="home-net-lines" strokeWidth="0.5" fill="none">
            <path d="M120,80 Q260,30 400,50" stroke="url(#net-grad-1)"><animate attributeName="stroke-dashoffset" from="200" to="0" dur="8s" repeatCount="indefinite" /></path>
            <path d="M400,50 Q540,70 680,120" stroke="url(#net-grad-2)" strokeDasharray="4 6"><animate attributeName="stroke-dashoffset" from="200" to="0" dur="10s" repeatCount="indefinite" /></path>
            <path d="M120,80 Q160,210 200,350" stroke="url(#net-grad-1)" strokeDasharray="3 5"><animate attributeName="stroke-dashoffset" from="150" to="0" dur="9s" repeatCount="indefinite" /></path>
            <path d="M680,120 Q640,260 600,400" stroke="url(#net-grad-2)" strokeDasharray="4 6"><animate attributeName="stroke-dashoffset" from="180" to="0" dur="11s" repeatCount="indefinite" /></path>
            <path d="M200,350 Q300,450 350,550" stroke="url(#net-grad-1)" strokeDasharray="3 4"><animate attributeName="stroke-dashoffset" from="120" to="0" dur="7s" repeatCount="indefinite" /></path>
            <path d="M600,400 Q675,450 750,500" stroke="url(#net-grad-2)" strokeDasharray="4 5"><animate attributeName="stroke-dashoffset" from="100" to="0" dur="8s" repeatCount="indefinite" /></path>
            <path d="M200,350 Q400,370 600,400" stroke="url(#net-grad-1)" strokeDasharray="5 8" opacity="0.6"><animate attributeName="stroke-dashoffset" from="250" to="0" dur="12s" repeatCount="indefinite" /></path>
          </g>
          {/* Orbiting particles */}
          <circle r="1.2" fill="rgba(37,99,235,0.25)">
            <animateMotion dur="15s" repeatCount="indefinite" path="M120,80 Q260,30 400,50 Q540,70 680,120" />
          </circle>
          <circle r="1" fill="rgba(6,182,212,0.20)">
            <animateMotion dur="18s" repeatCount="indefinite" path="M200,350 Q400,370 600,400 Q675,450 750,500" />
          </circle>
          <circle r="1.2" fill="rgba(99,102,241,0.22)">
            <animateMotion dur="20s" repeatCount="indefinite" path="M120,80 Q160,210 200,350 Q300,450 350,550" />
          </circle>
        </svg>
        {/* Prismatic light streaks */}
        <div className="home-light-streaks" />
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
            {/* Logo mark — glossy floating orb */}
            <div className="relative inline-flex items-center justify-center w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] rounded-[16px] sm:rounded-[18px] mb-7 sm:mb-8 float-slow hero-logo">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#1e293b] relative z-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>

            <h1 className="text-[64px] sm:text-[80px] font-black tracking-[-0.05em] leading-[0.9] mb-3 gradient-text-hero-animated">
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
                description="出題パターンを選んで、AIが試験問題を自動生成"
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
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2563eb] opacity-40"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2563eb]"></span>
              </span>
              <span className="text-[11px] font-medium text-[#94a3b8] tracking-[0.02em]">AI Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
