'use client';

/* ─────────────────────────────────────────────────
   共通UIコンポーネント群 (Apple HIG · Refined)
   Glossy surfaces · Confident typography · Warm accent
   ───────────────────────────────────────────────── */

export const Icons = {
  Success: (props) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Error: (props) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Info: (props) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  User: (props) => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Dev: (props) => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  Data: (props) => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7zM4 7c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3M4 12c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3" />
    </svg>
  ),
  Search: (props) => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Copy: (props) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  ),
  Empty: (props) => (
    <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  Prompt: (props) => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Pdf: (props) => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  ArrowRight: (props) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
  Home: (props) => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Book: (props) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  Chart: (props) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14" />
    </svg>
  ),
  Target: (props) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  File: (props) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  Table: (props) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18M8 6v12M16 6v12" />
    </svg>
  )
};

/* ── PageHeader (Premium) ── */
export function PageHeader({ title, description, icon, breadcrumbs }) {
  return (
    <div className="mb-8 sm:mb-10 animate-fade-in-up">
      {breadcrumbs && (
        <nav className="flex items-center gap-1.5 mb-4 sm:mb-5 text-[12px] font-medium tracking-wide">
          {breadcrumbs.map((bc, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {bc.href ? (
                <a href={bc.href} className="text-[#aeaeb2] hover:text-[#1d1d1f] transition-colors duration-200">
                  <span>{bc.label}</span>
                </a>
              ) : (
                <span className="text-[#1d1d1f] font-semibold">{bc.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                <svg className="w-3 h-3 text-[#d2d2d7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {icon && (
          <div className="flex-shrink-0 w-11 h-11 rounded-[13px] icon-premium text-white flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-[24px] sm:text-[30px] font-black text-[#1d1d1f] tracking-[-0.03em] leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-[#aeaeb2] mt-1.5 max-w-2xl leading-relaxed tracking-[-0.01em]">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── StatusBar — Refined with subtle gradient ── */
export function StatusBar({ message }) {
  if (!message) return null;
  const isError = message.includes('失敗') || message.includes('エラー') || message.includes('Error');
  const isSuccess = message.includes('完了') || message.includes('成功') || message.includes('取得') || message.includes('作成') || message.includes('開きました') || message.includes('コピー') || /\d+件/.test(message);

  const styles = isError
    ? 'bg-gradient-to-r from-[#ff3b30]/[0.05] to-[#ff3b30]/[0.02] text-[#ff3b30] border-[#ff3b30]/[0.1]'
    : isSuccess
    ? 'bg-gradient-to-r from-[#34c759]/[0.05] to-[#34c759]/[0.02] text-[#248a3d] border-[#34c759]/[0.1]'
    : 'bg-gradient-to-r from-black/[0.02] to-transparent text-[#86868b] border-black/[0.04]';

  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-[13px] font-medium mb-4 border ${styles}`}
         style={{ animation: 'stagger-in 0.5s var(--ease-out-expo) both' }}>
      <span className="flex-shrink-0">
        {isError ? <Icons.Error /> : isSuccess ? <Icons.Success /> : <Icons.Info />}
      </span>
      <span>{message}</span>
    </div>
  );
}

/* ── SelectField ── */
export function SelectField({ label, value, onChange, options, className = '' }) {
  const hasValue = value !== '' && value !== undefined;
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-2">{label}</label>
      )}
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-4 pr-10 py-3 rounded-2xl border border-black/[0.06] bg-white text-sm
                    text-[#1d1d1f] cursor-pointer appearance-none
                    focus:ring-2 focus:ring-black/[0.05]
                    outline-none font-semibold"
          style={{ transition: 'all 0.4s var(--ease-spring)', boxShadow: 'var(--shadow-card)' }}
        >
          {options.map((opt) =>
            typeof opt === 'string' ? (
              <option key={opt} value={opt}>{opt}</option>
            ) : (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            )
          )}
        </select>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[#c7c7cc]"
             style={{ transition: 'color 0.35s var(--ease-spring)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
               style={{ transition: 'transform 0.4s var(--ease-spring)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {hasValue && (
          <div className="absolute top-2 right-8 w-1.5 h-1.5 rounded-full bg-[#1d1d1f] opacity-40" />
        )}
      </div>
    </div>
  );
}

/* ── NumberField (Apple Stepper) ── */
export function NumberField({ label, value, onChange, min = 1, max, step = 1, className = '' }) {
  const handleDecrement = () => {
    const next = value - step;
    if (min !== undefined && next < min) return;
    onChange(next);
  };
  const handleIncrement = () => {
    const next = value + step;
    if (max !== undefined && next > max) return;
    onChange(next);
  };
  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-2">{label}</label>
      )}
      <div className="inline-flex items-stretch rounded-2xl border border-black/[0.06] bg-white overflow-hidden"
           style={{ transition: 'all 0.4s var(--ease-spring)', boxShadow: 'var(--shadow-card)' }}>
        <button
          type="button"
          onClick={handleDecrement}
          disabled={atMin}
          className="flex items-center justify-center w-11 border-r border-black/[0.06] text-[#6e6e73]
                     hover:bg-black/[0.03] hover:text-[#1d1d1f] active:bg-black/[0.06]
                     disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-[#6e6e73]
                     active:scale-90"
          style={{ transition: 'all 0.3s var(--ease-spring)' }}
          aria-label="減らす"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
          </svg>
        </button>
        <div className="flex items-center justify-center min-w-[3.5rem] px-3 py-2.5">
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (min !== undefined && v < min) return;
              if (max !== undefined && v > max) return;
              onChange(v);
            }}
            min={min}
            max={max}
            step={step}
            className="w-12 text-center text-[17px] font-bold text-[#1d1d1f] bg-transparent outline-none tabular-nums
                       [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden
                       [-moz-appearance:textfield]"
          />
        </div>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={atMax}
          className="flex items-center justify-center w-11 border-l border-black/[0.06] text-[#6e6e73]
                     hover:bg-black/[0.03] hover:text-[#1d1d1f] active:bg-black/[0.06]
                     disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-[#6e6e73]
                     active:scale-90"
          style={{ transition: 'all 0.3s var(--ease-spring)' }}
          aria-label="増やす"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── TextArea ── */
export function TextArea({ label, value, onChange, rows = 6, placeholder, readOnly, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-2">{label}</label>}
      <textarea
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        rows={rows} placeholder={placeholder} readOnly={readOnly}
        className="w-full px-4 py-3.5 rounded-2xl border border-black/[0.06] bg-white font-mono text-sm
                   leading-relaxed resize-y text-[#1d1d1f]
                   focus:ring-2 focus:ring-black/[0.05]
                   outline-none placeholder:text-[#c7c7cc]
                   read-only:bg-[#f2f2f7] read-only:text-[#86868b] read-only:border-black/[0.04]"
        style={{ transition: 'all 0.4s var(--ease-spring)', boxShadow: 'var(--shadow-card)' }}
      />
    </div>
  );
}

/* ── TextField ── */
export function TextField({ label, value, onChange, placeholder, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-2">{label}</label>}
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-4 pr-4 py-3 rounded-2xl border border-black/[0.06] bg-white text-sm text-[#1d1d1f]
                   focus:ring-2 focus:ring-black/[0.05]
                   outline-none placeholder:text-[#c7c7cc] font-medium"
        style={{ transition: 'all 0.4s var(--ease-spring)', boxShadow: 'var(--shadow-card)' }}
      />
    </div>
  );
}

/* ── Button (Premium) — Glossy with inner highlight ── */
export function Button({ children, onClick, variant = 'primary', disabled, className = '', size = 'md' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden';
  const sizes = { sm: 'px-3.5 py-1.5 text-xs', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-sm' };
  const variants = {
    primary: 'btn-premium',
    secondary: 'bg-white text-[#1d1d1f] border border-black/[0.08] shadow-sm hover:shadow-md',
    success: 'bg-gradient-to-b from-[#36d15c] to-[#34c759] text-white shadow-sm',
    danger: 'bg-gradient-to-b from-[#ff4f44] to-[#ff3b30] text-white shadow-sm',
    warning: 'bg-gradient-to-b from-[#ffa514] to-[#ff9f0a] text-white shadow-sm',
    ghost: 'bg-transparent text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.03]',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${className}`}
      style={{ transition: 'all 0.35s var(--ease-spring)', transitionProperty: 'transform, box-shadow, background, border-color, opacity, color' }}>
      {children}
    </button>
  );
}

/* ── MetaTag ── */
export function MetaTag({ icon, label, value, color = 'slate' }) {
  if (!value) return null;
  const colorMap = {
    slate: 'bg-black/[0.04] text-[#86868b]',
    neutral: 'bg-black/[0.04] text-[#86868b]',
    indigo: 'bg-black/[0.06] text-[#1d1d1f]',
    emerald: 'bg-[#34c759]/[0.08] text-[#248a3d]',
    amber: 'bg-[#ff9500]/[0.08] text-[#c77c00]',
    rose: 'bg-[#ff3b30]/[0.08] text-[#ff3b30]',
  };
  return (
    <span className={`badge ${colorMap[color] || colorMap.slate}`}>
      {icon && <span>{icon}</span>}
      {label && <span className="text-[10px] opacity-60">{label}</span>}
      <strong>{value}</strong>
    </span>
  );
}

/* ── Slider ── */
export function Slider({ label, value, onChange, min = 0, max = 2, step = 0.1, color = '#1d1d1f' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex items-center gap-4 py-2 group cursor-pointer">
      <span className="min-w-[5rem] text-[12px] font-bold text-[#1d1d1f] tracking-[-0.01em]">{label}</span>
      <div className="flex-1 relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-[5px] rounded-full bg-black/[0.05]" />
        <div className="absolute left-0 h-[5px] rounded-full transition-all duration-150"
             style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-[5px] rounded-full appearance-none cursor-pointer bg-transparent z-10
                     [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.15),0_0_0_0.5px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]
                     [&::-webkit-slider-thumb]:transition-all
                     [&::-webkit-slider-thumb]:hover:scale-125
                     [&::-webkit-slider-thumb]:active:scale-110"
          style={{ '--webkit-slider-thumb-transition-timing-function': 'var(--ease-spring)' }}
        />
      </div>
      <span className="min-w-[2.5rem] text-right text-[13px] font-bold tabular-nums px-2 py-0.5 rounded-lg"
            style={{ color, background: `${color}10` }}>
        {Number(value).toFixed(1)}
      </span>
    </label>
  );
}

/* ── CopyButton ── */
export function CopyButton({ text, onCopied, label = 'コピー' }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); onCopied?.('クリップボードにコピーしました'); }
    catch (e) { onCopied?.('コピー失敗: ' + e.message); }
  };
  return (
    <Button variant="secondary" size="sm" onClick={copy} disabled={!text}>
      <Icons.Copy /> {label}
    </Button>
  );
}

/* ── SectionCard (Premium) ── */
export function SectionCard({ title, subtitle, icon, children, className = '', accentColor }) {
  return (
    <div className={`card-premium p-5 sm:p-6 ${className}`}>
      {(title || icon) && (
        <div className="mb-4">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="icon-premium w-8 h-8 text-white flex-shrink-0"
                    style={{ transition: 'transform 0.4s var(--ease-spring)' }}>
                {icon}
              </span>
            )}
            {title && <h2 className="text-[15px] font-bold text-[#1d1d1f] tracking-[-0.01em]">{title}</h2>}
          </div>
          {subtitle && <p className="text-[11px] text-[#aeaeb2] mt-1 ml-[42px]">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── EmptyState ── */
export function EmptyState({ icon, title, description }) {
  return (
    <div className="text-center py-16 card-premium border-dashed !border-black/[0.06]">
      <div className="flex justify-center mb-4 text-[#d2d2d7]">{icon || <Icons.Empty />}</div>
      {title && <div className="text-[15px] font-bold text-[#86868b] mb-1.5 tracking-[-0.01em]">{title}</div>}
      {description && <div className="text-[13px] text-[#aeaeb2] leading-relaxed max-w-sm mx-auto">{description}</div>}
    </div>
  );
}

/* ── Tabs (Premium) ── */
export function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex gap-0.5 p-[3px] bg-black/[0.04] rounded-[14px]"
         style={{ boxShadow: 'inset 0 0.5px 1px rgba(0,0,0,0.04)' }}>
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-3 py-[7px] rounded-[11px] text-[13px] font-semibold
            ${activeTab === tab.id
              ? 'bg-white text-[#1d1d1f]'
              : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-white/40'
            }`}
          style={{
            transition: 'all 0.4s var(--ease-spring)',
            ...(activeTab === tab.id ? {
              boxShadow: '0 0.5px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04), inset 0 0.5px 0 rgba(255,255,255,0.8)',
            } : {}),
          }}>
          {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ── ProgressSteps — Refined with gradient fills ── */
export function ProgressSteps({ steps, current }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-[9px] text-[10px] sm:text-[11px] font-bold
                ${i + 1 <= current
                  ? 'text-white'
                  : i + 1 === current + 1
                  ? 'bg-black/[0.05] text-[#1d1d1f]'
                  : 'bg-black/[0.03] text-[#d2d2d7]'
                }`}
              style={{
                transition: 'all 0.5s var(--ease-spring)',
                ...(i + 1 <= current ? {
                  background: 'linear-gradient(145deg, #48484a 0%, #1d1d1f 100%)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1), inset 0 0.5px 0 rgba(255,255,255,0.06)',
                } : {}),
              }}>
              {i + 1 < current ? <Icons.Success className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : i + 1}
            </div>
            <span className={`text-[11px] sm:text-[12px] font-medium transition-colors whitespace-nowrap
                ${i + 1 <= current ? 'text-[#1d1d1f]' : i + 1 === current + 1 ? 'text-[#86868b]' : 'text-[#d2d2d7]'}`}>
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-3 sm:w-6 h-[1px] rounded-full transition-colors ${i + 1 < current ? 'bg-[#1d1d1f]/40' : 'bg-black/[0.05]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
