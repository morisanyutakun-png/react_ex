'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MobileNavLinks } from '@/components/ui';

/* ═══════════════════════════════════════════════════════════════
   REM — 教師のためのAI物理問題ジェネレーター
   Editorial × Apple Music × Aurora Forest Night
   ═══════════════════════════════════════════════════════════════ */

/* ─── Scroll Reveal ─── */
function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('revealed');
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    el.querySelectorAll('.scroll-reveal').forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ─── Tilt parallax for hero artwork ─── */
function useTilt() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1100px) rotateX(${-y * 6}deg) rotateY(${x * 8}deg) translateZ(0)`;
    };
    const reset = () => { el.style.transform = 'perspective(1100px) rotateX(0) rotateY(0)'; };
    el.addEventListener('pointermove', handle);
    el.addEventListener('pointerleave', reset);
    return () => {
      el.removeEventListener('pointermove', handle);
      el.removeEventListener('pointerleave', reset);
    };
  }, []);
  return ref;
}

/* ─── Aurora background field ─── */
function AuroraField() {
  return (
    <div className="aurora-field" aria-hidden="true">
      <div className="aurora-veil aurora-veil-1" />
      <div className="aurora-veil aurora-veil-2" />
      <div className="aurora-veil aurora-veil-3" />
      <div className="aurora-grain" />
    </div>
  );
}

/* ─── Kinetic letters for the wordmark ─── */
function Wordmark({ text = 'REM' }) {
  return (
    <span className="kinetic-mark" aria-label={text}>
      {text.split('').map((ch, i) => (
        <span key={i} style={{ animationDelay: `${i * 90}ms` }}>{ch}</span>
      ))}
    </span>
  );
}

/* ─── Editorial PDF artwork (hero centerpiece) ─── */
function EditorialArtwork() {
  const tiltRef = useTilt();
  return (
    <div className="editorial-art-stage">
      <div className="editorial-art-glow" aria-hidden="true" />
      <div ref={tiltRef} className="editorial-art-card" style={{ transition: 'transform 0.55s var(--ease-spring)' }}>
        {/* Top meta bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-black/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ff375f] shadow-[0_0_10px_rgba(255,55,95,0.55)]" />
            <span className="text-[9px] font-bold tracking-[0.32em] text-[#ff375f] uppercase">REM · Physics</span>
          </div>
          <span className="text-[9px] font-mono text-[#86868b] tracking-wider">A4 · 25pt</span>
        </div>

        {/* Title */}
        <div className="px-5 pt-5 pb-4">
          <div className="text-[7px] font-bold tracking-[0.28em] text-[#ff375f]/80 uppercase mb-2">Mechanics — Conservation</div>
          <div className="space-y-1.5">
            <div className="h-[6px] w-[88%] rounded-full bg-[#1d1d1f]/40" />
            <div className="h-[6px] w-[64%] rounded-full bg-[#1d1d1f]/22" />
          </div>
        </div>

        {/* Problem 1 */}
        <div className="px-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#ff375f] to-[#ff9966] flex items-center justify-center text-[9px] font-black text-white shadow-md shadow-[#ff375f]/30 flex-shrink-0">1</div>
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-[4px] w-full rounded-full bg-[#1d1d1f]/20 art-line" style={{ animationDelay: '0ms' }} />
              <div className="h-[4px] w-[92%] rounded-full bg-[#1d1d1f]/14 art-line" style={{ animationDelay: '120ms' }} />
              <div className="h-[4px] w-[55%] rounded-full bg-[#1d1d1f]/10 art-line" style={{ animationDelay: '240ms' }} />
            </div>
          </div>
        </div>

        {/* TikZ figure block */}
        <div className="mx-5 mb-4 p-3 rounded-xl border border-dashed border-[#ff375f]/30 bg-[#fff5f7]">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-3 h-3 text-[#ff375f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M3 17l4-4 4 4 6-6 4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[8px] font-bold tracking-[0.22em] text-[#ff375f] uppercase">TikZ Diagram</span>
          </div>
          <svg viewBox="0 0 100 28" className="w-full h-7">
            <path d="M5 22 L25 22 L40 12 L55 12 L75 22 L95 22" stroke="rgba(29,29,31,0.55)" strokeWidth="0.6" fill="none" strokeLinecap="round" />
            <circle cx="40" cy="12" r="1.5" fill="#ff375f" />
            <circle cx="55" cy="12" r="1.5" fill="#ff375f" />
            <text x="46" y="9" fontSize="3" fill="rgba(29,29,31,0.6)" fontFamily="serif" fontStyle="italic">m</text>
          </svg>
        </div>

        {/* Problem 2 */}
        <div className="px-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#ff375f] to-[#ff9966] flex items-center justify-center text-[9px] font-black text-white shadow-md shadow-[#ff375f]/30 flex-shrink-0">2</div>
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-[4px] w-full rounded-full bg-[#1d1d1f]/20 art-line" style={{ animationDelay: '360ms' }} />
              <div className="h-[4px] w-[78%] rounded-full bg-[#1d1d1f]/14 art-line" style={{ animationDelay: '480ms' }} />
            </div>
          </div>
        </div>

        {/* Scoring rubric */}
        <div className="mx-5 mb-5 p-3 rounded-xl bg-[#fff5f7] border border-[#ff375f]/18">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3 rounded-full bg-[#ff375f]" />
              <span className="text-[7px] font-bold tracking-[0.24em] text-[#ff375f] uppercase">配点基準</span>
            </div>
            <span className="text-[8px] font-black text-[#ff375f]">+10</span>
          </div>
          <div className="space-y-1">
            <div className="h-[3px] w-[92%] rounded-full bg-[#ff375f]/55" />
            <div className="h-[3px] w-[70%] rounded-full bg-[#ff375f]/35" />
            <div className="h-[3px] w-[48%] rounded-full bg-[#ff375f]/20" />
          </div>
        </div>

        {/* Floating badge */}
        <div className="absolute -top-3 -right-3 art-badge-pulse">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff5c7c] to-[#ff375f] flex items-center justify-center shadow-[0_8px_24px_rgba(255,55,95,0.42)]">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* floating typography accents */}
      <span className="art-float-symbol art-float-symbol-1" aria-hidden="true">∮</span>
      <span className="art-float-symbol art-float-symbol-2" aria-hidden="true">∇</span>
      <span className="art-float-symbol art-float-symbol-3" aria-hidden="true">F=ma</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const containerRef = useScrollReveal();
  const [scrolled, setScrolled] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden">
      <AuroraField />

      <div className="relative z-10">

        {/* ════════════════════════════════════════════════
            CHAPTER 00 — HERO (Editorial cinematic)
            ════════════════════════════════════════════════ */}
        <section className="hero-stage">
          <div className="hero-shell">
            {/* eyebrow */}
            <div className="hero-eyebrow" style={{ animationDelay: '0ms' }}>
              <span className="hero-eyebrow-dot" />
              <span>For Educators · 2026</span>
            </div>

            {/* wordmark */}
            <div className="hero-wordmark-wrap" style={{ animationDelay: '120ms' }}>
              <Wordmark text="REM" />
            </div>

            {/* headline */}
            <h1 className="hero-headline" style={{ animationDelay: '260ms' }}>
              <span className="hero-line">教材作成の、</span>
              <span className="hero-line hero-line-accent">終わり方を、変える。</span>
            </h1>

            {/* subhead */}
            <p className="hero-sub" style={{ animationDelay: '420ms' }}>
              AI × LaTeX × TikZ。<br className="sm:hidden" />
              入試品質の物理問題を、<strong className="text-[#ff375f]">60秒で印刷可能なPDF</strong>に。
            </p>

            {/* CTA */}
            <div className="hero-cta-row" style={{ animationDelay: '560ms' }}>
              <Link href="/user" className="btn-editorial-primary group">
                <span className="btn-editorial-label">問題を作成する</span>
                <span className="btn-editorial-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-7l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            </div>

            {/* spec strip */}
            <div className="hero-spec-strip" style={{ animationDelay: '720ms' }}>
              {[
                { k: '60s', v: '即時生成' },
                { k: '25pt', v: '配点付き' },
                { k: 'TeX', v: '組版品質' },
                { k: 'A4', v: '即印刷' },
              ].map(({ k, v }, i) => (
                <div key={k} className="hero-spec-item">
                  <div className="hero-spec-key">{k}</div>
                  <div className="hero-spec-val">{v}</div>
                  {i < 3 && <span className="hero-spec-sep" />}
                </div>
              ))}
            </div>

            {/* artwork */}
            <div className="hero-art-mount" style={{ animationDelay: '880ms' }}>
              <EditorialArtwork />
            </div>
          </div>

          {/* scroll cue */}
          <div className="hero-scroll-cue" style={{ opacity: Math.max(0, 1 - scrolled / 240) }}>
            <span className="hero-scroll-line" />
            <span className="hero-scroll-label">scroll</span>
          </div>
        </section>


        {/* ════════════════════════════════════════════════
            CHAPTER 01 — MANIFESTO (Editorial pull-quote)
            ════════════════════════════════════════════════ */}
        <section className="editorial-chapter scroll-reveal">
          <div className="editorial-shell">
            <div className="chapter-tag">
              <span className="chapter-num">I</span>
              <span className="chapter-name">Manifesto</span>
            </div>
            <blockquote className="manifesto-quote">
              <span className="manifesto-line">教師の時間は、</span>
              <span className="manifesto-line manifesto-accent">生徒の未来。</span>
            </blockquote>
            <p className="manifesto-body">
              テスト作成に費やす<strong className="text-[#ff375f]">夜中の3時間</strong>を、<br className="hidden sm:block" />
              生徒一人ひとりに向き合う時間へ。<br className="hidden sm:block" />
              REMは、教材づくりを<strong className="text-[#ff375f]">芸術</strong>に変える。
            </p>
          </div>
        </section>


        {/* ════════════════════════════════════════════════
            CHAPTER 02 — FEATURES (Apple Music browse cards)
            ════════════════════════════════════════════════ */}
        <section className="editorial-chapter scroll-reveal">
          <div className="editorial-shell">
            <div className="chapter-tag">
              <span className="chapter-num">II</span>
              <span className="chapter-name">Features</span>
            </div>
            <h2 className="editorial-heading">
              プロ品質を、<br />標準装備で。
            </h2>
          </div>

          <div className="browse-grid editorial-shell-wide">
            {[
              {
                kicker: 'Typography',
                title: 'LaTeX組版',
                body: '美しい数式・記号配置をプロ印刷品質で。教科書と並べても見劣りしない。',
                gradient: 'linear-gradient(135deg, #ff375f 0%, #ff5c7c 100%)',
                accent: '#ffffff',
                icon: (
                  <path d="M4 6h16M4 12h10M4 18h16" strokeLinecap="round" strokeWidth={2} />
                ),
              },
              {
                kicker: 'Diagrams',
                title: 'TikZ物理図',
                body: '回路・力の図・斜面・ばね — 全てベクター描画。再生成も瞬時。',
                gradient: 'linear-gradient(135deg, #ff5c7c 0%, #ff8094 100%)',
                accent: '#ffffff',
                icon: (
                  <>
                    <circle cx="6" cy="18" r="2" strokeWidth={1.8} />
                    <circle cx="18" cy="6" r="2" strokeWidth={1.8} />
                    <path d="M7.5 16.5L16.5 7.5" strokeWidth={1.8} strokeLinecap="round" />
                  </>
                ),
              },
              {
                kicker: 'Scoring',
                title: '配点・部分点基準',
                body: '小問ごとの配点と「式で+5点／計算で+3点」の部分点ルーブリックを自動生成。',
                gradient: 'linear-gradient(135deg, #ff8094 0%, #ff375f 100%)',
                accent: '#ffffff',
                icon: (
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
                ),
              },
              {
                kicker: 'Coverage',
                title: '工学系を横断',
                body: '電気電子・情報・機械系の主要分野を網羅。基礎から技術士・院試レベルまで6段階。',
                gradient: 'linear-gradient(135deg, #ff9966 0%, #ff5c7c 100%)',
                accent: '#ffffff',
                icon: (
                  <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" strokeWidth={2} />
                ),
              },
              {
                kicker: 'Workflow',
                title: 'テンプレート',
                body: '学校のロゴ・問題スタイル・採点欄を保存。次回からワンクリック呼び出し。',
                gradient: 'linear-gradient(135deg, #ff375f 0%, #ff9966 100%)',
                accent: '#ffffff',
                icon: (
                  <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l7-3 7 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
                ),
              },
              {
                kicker: 'Output',
                title: 'PDF即出力',
                body: '生成完了と同時にA4 PDF。生徒の人数分、即印刷・即配布。',
                gradient: 'linear-gradient(135deg, #ff5c7c 0%, #ff9966 100%)',
                accent: '#ffffff',
                icon: (
                  <path d="M12 4v12m0 0l-4-4m4 4l4-4m-9 8h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
                ),
              },
            ].map(({ kicker, title, body, gradient, accent, icon }, i) => (
              <article key={title} className="browse-card scroll-reveal" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="browse-card-art" style={{ background: gradient }}>
                  <div className="browse-card-noise" aria-hidden="true" />
                  <div className="browse-card-icon" style={{ color: accent }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">{icon}</svg>
                  </div>
                  <div className="browse-card-glow" style={{ background: `radial-gradient(circle at 30% 20%, ${accent}33, transparent 60%)` }} />
                </div>
                <div className="browse-card-meta">
                  <div className="browse-card-kicker" style={{ color: accent }}>{kicker}</div>
                  <h3 className="browse-card-title">{title}</h3>
                  <p className="browse-card-body">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>


        {/* ════════════════════════════════════════════════
            CHAPTER 03 — WORKFLOW (Eddivom editorial numerals)
            ════════════════════════════════════════════════ */}
        <section className="editorial-chapter scroll-reveal">
          <div className="editorial-shell">
            <div className="chapter-tag">
              <span className="chapter-num">III</span>
              <span className="chapter-name">Workflow</span>
            </div>
            <h2 className="editorial-heading">
              三つの動作で、<br />一つの教材。
            </h2>
          </div>

          <div className="workflow-track editorial-shell-wide">
            {[
              { n: '01', t: '設定する', d: '単元・難易度・問題数を選ぶ。学校のテンプレートも呼び出せる。' },
              { n: '02', t: 'AIが組み上げる', d: '入試品質の小問を、配点・部分点・TikZ図まで一気に生成。' },
              { n: '03', t: '配布する', d: 'PDFを印刷、もしくはタブレット配信。即、授業に投入できる。' },
            ].map(({ n, t, d }, i) => (
              <div key={n} className="workflow-step scroll-reveal" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="workflow-num">{n}</div>
                <div className="workflow-content">
                  <div className="workflow-rule" />
                  <h3 className="workflow-title">{t}</h3>
                  <p className="workflow-desc">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* ════════════════════════════════════════════════
            CHAPTER 04 — COVERAGE
            ════════════════════════════════════════════════ */}
        <section className="editorial-chapter scroll-reveal">
          <div className="editorial-shell">
            <div className="chapter-tag">
              <span className="chapter-num">IV</span>
              <span className="chapter-name">Coverage</span>
            </div>
            <h2 className="editorial-heading">
              工学系を、横断的に。
            </h2>
            <p className="editorial-sub">電気電子・情報・機械系の主要分野を、基礎から院試レベルまで6段階で。</p>
          </div>

          <div className="coverage-grid editorial-shell-wide">
            {[
              { jp: '物理 / 数学', en: 'Physics & Math', desc: '力学・電磁気・微積・線形代数・微分方程式・フーリエ・ラプラス', tone: '#ff375f' },
              { jp: '電気・電子', en: 'EE / Electronics', desc: '電気回路・電子回路・電磁気学・ディジタル回路', tone: '#0ea5e9' },
              { jp: '制御・通信', en: 'Control & Comm.', desc: '制御工学・信号処理・通信工学・FFT・変調', tone: '#22d3ee' },
              { jp: '情報', en: 'Informatics', desc: 'アルゴリズム・プログラミング・応用情報・DB・ネットワーク', tone: '#ff9966' },
            ].map(({ jp, en, desc, tone }, i) => (
              <div key={jp} className="coverage-card scroll-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="coverage-tone-bar" style={{ background: tone }} />
                <div className="coverage-en" style={{ color: tone }}>{en}</div>
                <h3 className="coverage-jp">{jp}</h3>
                <p className="coverage-desc">{desc}</p>
              </div>
            ))}
          </div>
        </section>


        {/* ════════════════════════════════════════════════
            CHAPTER 05 — SHOWCASE (Apple Music spotlight card)
            ════════════════════════════════════════════════ */}
        <section className="editorial-chapter scroll-reveal">
          <div className="editorial-shell-wide">
            <div className="spotlight-card">
              <div className="spotlight-text">
                <div className="chapter-tag chapter-tag-light">
                  <span className="chapter-num">V</span>
                  <span className="chapter-name">Showcase</span>
                </div>
                <h2 className="spotlight-heading">
                  教師の手元に、<br />
                  <span className="spotlight-heading-accent">アート作品のような教材</span>を。
                </h2>
                <p className="spotlight-body">
                  数式は活字で美しく、図はベクターで精密に。<br />
                  生徒に「これをやりたい」と思わせる、視覚的な質量がある。
                </p>
                <Link href="/user" className="btn-editorial-primary mt-2 inline-flex">
                  <span className="btn-editorial-label">いま作ってみる</span>
                  <span className="btn-editorial-arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-7l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              </div>
              <div className="spotlight-art">
                <EditorialArtwork />
              </div>
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════════
            CHAPTER 06 — TOOLS (Quiet links)
            ════════════════════════════════════════════════ */}
        <section className="editorial-chapter scroll-reveal pb-2">
          <div className="editorial-shell">
            <div className="chapter-tag">
              <span className="chapter-num">VI</span>
              <span className="chapter-name">More</span>
            </div>
            <h2 className="editorial-heading editorial-heading-sm">補助ツール</h2>

            <div className="tool-row mt-7">
              {[
                { href: '/help', label: 'はじめてガイド', desc: '使い方・ワークフロー・用語集', },
                { href: '/settings', label: '設定', desc: 'ブランドカラー・表示名の調整', },
              ].map(({ href, label, desc }) => (
                <Link key={href} href={href} className="tool-row-item group">
                  <div className="tool-row-meta">
                    <div className="tool-row-label">{label}</div>
                    <div className="tool-row-desc">{desc}</div>
                  </div>
                  <span className="tool-row-arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-7l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════════
            FINAL CTA
            ════════════════════════════════════════════════ */}
        <section className="final-cta scroll-reveal">
          <div className="editorial-shell text-center">
            <div className="final-cta-eyebrow">
              <span className="final-cta-dot" />
              <span>Ready when you are</span>
            </div>
            <h2 className="final-cta-headline">
              次の授業は、<br />
              <span className="final-cta-accent">REMで作ろう。</span>
            </h2>
            <Link href="/user" className="btn-editorial-primary btn-editorial-xl group">
              <span className="btn-editorial-label">問題を作成する</span>
              <span className="btn-editorial-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-7l7 7-7 7" />
                </svg>
              </span>
            </Link>
            <div className="final-cta-foot">
              <span>無料 · ログイン不要 · 60秒で初稿</span>
            </div>
          </div>
        </section>


        {/* footer */}
        <div className="editorial-shell pb-10">
          <div className="text-center">
            <div className="status-pill press-scale inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ff375f]"></span>
              </span>
              <span className="text-[11px] font-medium text-[#86868b] tracking-[0.02em]">REM — Built for educators</span>
            </div>
          </div>
          <MobileNavLinks currentPath="/" />
        </div>
      </div>
    </div>
  );
}
