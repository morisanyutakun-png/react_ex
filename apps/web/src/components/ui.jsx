'use client';

/* ─────────────────────────────────────────────────
   共通UIコンポーネント群 (Apple Music Light)
   Clean whites • Confident typography • Warm accent
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
        <nav className="flex items-center gap-1.5 mb-5 sm:mb-6 text-[12px] font-medium tracking-wide">
          {breadcrumbs.map((bc, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {bc.href ? (
                <a href={bc.href} className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200">
                  <span>{bc.label}</span>
                </a>
              ) : (
                <span className="text-[#1d1d1f] font-semibold">{bc.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                <svg className="w-3 h-3 text-[#c7c7cc]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {icon && (
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl icon-premium text-white flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-[24px] sm:text-[30px] font-black text-[#1d1d1f] tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-[#86868b] mt-1.5 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── StatusBar ── */
export function StatusBar({ message }) {
  if (!message) return null;
  const isError = message.includes('失敗') || message.includes('エラー') || message.includes('Error');
  const isSuccess = message.includes('完了') || message.includes('成功') || message.includes('取得') || message.includes('作成') || message.includes('開きました') || /\d+件/.test(message);

  const styles = isError
    ? 'bg-[#ff3b30]/[0.06] text-[#ff3b30] border-[#ff3b30]/[0.10]'
    : isSuccess
    ? 'bg-[#34c759]/[0.06] text-[#248a3d] border-[#34c759]/[0.10]'
    : 'bg-black/[0.03] text-[#86868b] border-black/[0.06]';

  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-[13px] font-semibold mb-4 border backdrop-blur-sm transition-all duration-500 animate-in ${styles}`}>
      <span className="flex-shrink-0">
        {isError ? <Icons.Error /> : isSuccess ? <Icons.Success /> : <Icons.Info />}
      </span>
      <span>{message}</span>
    </div>
  );
}

/* ── SelectField (Apple Music Frosted) ── */
export function SelectField({ label, value, onChange, options, className = '' }) {
  const selectedLabel = (() => {
    const opt = options.find(o => (typeof o === 'string' ? o : o.value) === value);
    if (!opt) return '';
    return typeof opt === 'string' ? opt : opt.label;
  })();
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
                    text-[#1d1d1f] transition-all duration-300 cursor-pointer appearance-none
                    hover:border-black/[0.10] hover:shadow-md
                    focus:border-black/[0.15] focus:ring-2 focus:ring-black/[0.05] focus:shadow-md
                    outline-none font-semibold
                    shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.80)]"
        >
          {options.map((opt) =>
            typeof opt === 'string' ? (
              <option key={opt} value={opt}>{opt}</option>
            ) : (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            )
          )}
        </select>
        {/* Animated chevron */}
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none transition-all duration-300 group-hover:text-[#86868b] text-[#c7c7cc]">
          <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {/* Active indicator dot */}
        {hasValue && (
          <div className="absolute top-2 right-8 w-1.5 h-1.5 rounded-full bg-[#1d1d1f] opacity-40" />
        )}
      </div>
    </div>
  );
}

/* ── NumberField (Apple Music Stepper) ── */
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
      <div className="inline-flex items-stretch rounded-2xl border border-black/[0.06] bg-white
                      shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.80)]
                      hover:shadow-md hover:border-black/[0.10] transition-all duration-300 overflow-hidden">
        {/* Minus button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={atMin}
          className="flex items-center justify-center w-11 border-r border-black/[0.06] text-[#6e6e73]
                     hover:bg-black/[0.04] hover:text-[#1d1d1f] active:bg-black/[0.08]
                     disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-[#6e6e73]
                     transition-all duration-200 active:scale-90"
          aria-label="減らす"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
          </svg>
        </button>
        {/* Value display */}
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
        {/* Plus button */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={atMax}
          className="flex items-center justify-center w-11 border-l border-black/[0.06] text-[#6e6e73]
                     hover:bg-black/[0.04] hover:text-[#1d1d1f] active:bg-black/[0.08]
                     disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-[#6e6e73]
                     transition-all duration-200 active:scale-90"
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
                   leading-relaxed resize-y text-[#1d1d1f] transition-all duration-300
                   hover:border-black/[0.10] hover:shadow-md
                   focus:border-black/[0.15] focus:ring-2 focus:ring-black/[0.05] focus:shadow-md
                   outline-none placeholder:text-[#c7c7cc]
                   shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.80)]
                   read-only:bg-[#f2f2f7] read-only:text-[#86868b] read-only:border-black/[0.04]"
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
                   transition-all duration-300 hover:border-black/[0.10] hover:shadow-md
                   focus:border-black/[0.15] focus:ring-2 focus:ring-black/[0.05] focus:shadow-md
                   outline-none placeholder:text-[#c7c7cc] font-medium
                   shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.80)]"
      />
    </div>
  );
}

/* ── Button (Premium) ── */
export function Button({ children, onClick, variant = 'primary', disabled, className = '', size = 'md' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]';
  const sizes = { sm: 'px-3.5 py-1.5 text-xs', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-sm' };
  const variants = {
    primary: 'btn-premium',
    secondary: 'bg-white text-[#1d1d1f] border border-black/[0.08] hover:bg-[#f2f2f7] hover:border-black/[0.12] shadow-sm hover:shadow-md',
    success: 'bg-gradient-to-b from-[#34c759] to-[#248a3d] text-white border-0.5 border-white/10 shadow-sm hover:shadow-md hover:brightness-110',
    danger: 'bg-gradient-to-b from-[#ff5c5c] to-[#ff453a] text-white border-0.5 border-white/10 shadow-sm hover:shadow-md hover:brightness-110',
    warning: 'bg-gradient-to-b from-[#ffaa33] to-[#ff9f0a] text-white border-0.5 border-white/10 shadow-sm hover:shadow-md hover:brightness-110',
    ghost: 'bg-transparent text-[#6e6e73] hover:bg-black/[0.04] hover:text-[#1d1d1f]',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${className}`}>
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
      <span className="min-w-[5rem] text-[12px] font-bold text-[#1d1d1f] tracking-tight">{label}</span>
      <div className="flex-1 relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-[6px] rounded-full bg-black/[0.05]" />
        {/* Active fill */}
        <div className="absolute left-0 h-[6px] rounded-full transition-all duration-150"
             style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-[6px] rounded-full appearance-none cursor-pointer bg-transparent z-10
                     [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.15),0_0_0_0.5px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]
                     [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200
                     [&::-webkit-slider-thumb]:hover:scale-125
                     [&::-webkit-slider-thumb]:active:scale-110"
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
    try { await navigator.clipboard.writeText(text); onCopied?.('成功：クリップボードにコピーしました'); }
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
        <div className="mb-5">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentColor || '#1d1d1f'}10, ${accentColor || '#1d1d1f'}18)`,
                      color: accentColor || '#1d1d1f',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.50)'
                    }}>
                {icon}
              </span>
            )}
            {title && <h2 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">{title}</h2>}
          </div>
          {subtitle && <p className="text-[12px] text-[#aeaeb2] mt-1 ml-[42px]">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── EmptyState ── */
export function EmptyState({ icon, title, description }) {
  return (
    <div className="text-center py-20 card-premium border-dashed !border-black/[0.08]">
      <div className="flex justify-center mb-5 text-[#c7c7cc]">{icon || <Icons.Empty />}</div>
      {title && <div className="text-[15px] font-bold text-[#86868b] mb-1.5">{title}</div>}
      {description && <div className="text-[13px] text-[#aeaeb2] leading-relaxed max-w-sm mx-auto">{description}</div>}
    </div>
  );
}

/* ── Tabs (Premium) ── */
export function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex gap-0.5 p-[3px] bg-black/[0.04] rounded-[14px] border border-black/[0.04]"
         style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)' }}>
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-3.5 py-[8px] rounded-[11px] text-[13px] font-bold transition-all duration-300
            ${activeTab === tab.id
              ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.80)]'
              : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-white/50'
            }`}>
          {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ── ProgressSteps ── */
export function ProgressSteps({ steps, current }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-300
                ${i + 1 <= current
                  ? 'text-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : i + 1 === current + 1
                  ? 'bg-black/[0.06] text-[#1d1d1f] border border-black/[0.08]'
                  : 'bg-black/[0.03] text-[#c7c7cc] border border-black/[0.04]'
                }`}
              style={i + 1 <= current ? { background: 'linear-gradient(180deg, #2c2c2e 0%, #1d1d1f 100%)' } : {}}>
              {i + 1 < current ? <Icons.Success className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : i + 1}
            </div>
            <span className={`text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap
                ${i + 1 <= current ? 'text-[#1d1d1f]' : i + 1 === current + 1 ? 'text-[#6e6e73]' : 'text-[#c7c7cc]'}`}>
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-4 sm:w-8 h-[1.5px] rounded-full transition-colors ${i + 1 < current ? 'bg-[#1d1d1f]' : 'bg-black/[0.06]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
