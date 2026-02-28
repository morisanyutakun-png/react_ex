'use client';

/* ─────────────────────────────────────────────────
   共通UIコンポーネント群 (Apple Music Dark Premium)
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
    <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
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

/* ── PageHeader ── */
export function PageHeader({ title, description, icon, breadcrumbs }) {
  return (
    <div className="mb-8 sm:mb-10">
      {breadcrumbs && (
        <nav className="flex items-center gap-1.5 mb-5 sm:mb-6 text-[12px] font-medium tracking-wide">
          {breadcrumbs.map((bc, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {bc.href ? (
                <a href={bc.href} className="flex items-center gap-1 text-[#636366] hover:text-[#fa2d48] transition-colors duration-300">
                  {i === 0 && bc.label === 'Home' && <Icons.Home className="w-3.5 h-3.5" />}
                  <span>{bc.label}</span>
                </a>
              ) : (
                <span className="text-[#f5f5f7] font-semibold">{bc.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                <svg className="w-3 h-3 text-[#48484a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {icon && (
          <div className="relative flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fa2d48] to-[#c0162b] text-white flex items-center justify-center shadow-lg shadow-[#fa2d48]/20">
            {icon}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-[24px] sm:text-[30px] font-extrabold text-[#f5f5f7] tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-[#636366] mt-1.5 max-w-2xl leading-relaxed">
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
    ? 'bg-[#ff453a]/[0.08] text-[#ff6961] border-[#ff453a]/[0.12]'
    : isSuccess
    ? 'bg-[#30d158]/[0.08] text-[#30d158] border-[#30d158]/[0.12]'
    : 'bg-white/[0.04] text-[#a1a1a6] border-white/[0.06]';

  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-[13px] font-semibold mb-4 border backdrop-blur-sm transition-all duration-500 animate-in ${styles}`}>
      <span className="flex-shrink-0">
        {isError ? <Icons.Error /> : isSuccess ? <Icons.Success /> : <Icons.Info />}
      </span>
      <span>{message}</span>
    </div>
  );
}

/* ── SelectField ── */
export function SelectField({ label, value, onChange, options, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-[#a1a1a6] mb-1.5">{label}</label>}
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm text-sm
                    text-[#f5f5f7] transition-all duration-200 cursor-pointer appearance-none
                    hover:border-white/[0.14] focus:border-[#fa2d48]/50 focus:ring-2 focus:ring-[#fa2d48]/20
                    outline-none pr-9"
        >
          {options.map((opt) =>
            typeof opt === 'string' ? (
              <option key={opt} value={opt}>{opt}</option>
            ) : (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            )
          )}
        </select>
        <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-[#636366]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ── NumberField ── */
export function NumberField({ label, value, onChange, min = 1, max, step, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-[#a1a1a6] mb-1.5">{label}</label>}
      <input
        type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
        min={min} max={max} step={step}
        className="w-24 px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm text-sm text-[#f5f5f7]
                   transition-all duration-200 hover:border-white/[0.14] focus:border-[#fa2d48]/50 focus:ring-2 focus:ring-[#fa2d48]/20
                   outline-none [&::-webkit-inner-spin-button]:opacity-100"
      />
    </div>
  );
}

/* ── TextArea ── */
export function TextArea({ label, value, onChange, rows = 6, placeholder, readOnly, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-[#a1a1a6] mb-1.5">{label}</label>}
      <textarea
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        rows={rows} placeholder={placeholder} readOnly={readOnly}
        className="w-full px-3.5 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm font-mono text-sm
                   leading-relaxed resize-y text-[#f5f5f7] transition-all duration-200
                   hover:border-white/[0.14] focus:border-[#fa2d48]/50 focus:ring-2 focus:ring-[#fa2d48]/20
                   outline-none placeholder:text-[#48484a]
                   read-only:bg-white/[0.02] read-only:text-[#636366] read-only:border-white/[0.04]"
      />
    </div>
  );
}

/* ── TextField ── */
export function TextField({ label, value, onChange, placeholder, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-[#a1a1a6] mb-1.5">{label}</label>}
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm text-sm text-[#f5f5f7]
                   transition-all duration-200 hover:border-white/[0.14] focus:border-[#fa2d48]/50 focus:ring-2 focus:ring-[#fa2d48]/20
                   outline-none placeholder:text-[#48484a]"
      />
    </div>
  );
}

/* ── Button ── */
export function Button({ children, onClick, variant = 'primary', disabled, className = '', size = 'md' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-sm' };
  const variants = {
    primary: 'btn-glow bg-gradient-to-b from-[#fa2d48] to-[#c0162b] text-white hover:from-[#ff4d63] hover:to-[#d42535] shadow-lg shadow-[#fa2d48]/20 hover:shadow-xl hover:shadow-[#fa2d48]/30',
    secondary: 'bg-white/[0.06] backdrop-blur-sm text-[#f5f5f7] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.14]',
    success: 'btn-glow bg-gradient-to-b from-[#30d158] to-[#28a745] text-white hover:from-[#3de066] hover:to-[#2db84e] shadow-lg shadow-[#30d158]/15',
    danger: 'btn-glow bg-gradient-to-b from-[#ff453a] to-[#c0162b] text-white hover:from-[#ff6961] hover:to-[#d42535] shadow-lg shadow-[#ff453a]/15',
    warning: 'btn-glow bg-gradient-to-b from-[#ff9f0a] to-[#e8890a] text-white hover:from-[#ffb340] hover:to-[#f59e0b] shadow-lg shadow-[#ff9f0a]/15',
    ghost: 'bg-transparent text-[#a1a1a6] hover:bg-white/[0.06] hover:text-[#f5f5f7]',
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
    slate: 'bg-white/[0.06] text-[#a1a1a6]',
    neutral: 'bg-white/[0.06] text-[#a1a1a6]',
    indigo: 'bg-[#fa2d48]/[0.1] text-[#ff6b81]',
    emerald: 'bg-[#30d158]/[0.1] text-[#30d158]',
    amber: 'bg-[#ffd60a]/[0.1] text-[#ffd60a]',
    rose: 'bg-[#ff453a]/[0.1] text-[#ff6961]',
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
export function Slider({ label, value, onChange, min = 0, max = 2, step = 0.1 }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex items-center gap-3 text-xs text-[#a1a1a6] py-1 group">
      <span className="min-w-[5rem] font-semibold">{label}</span>
      <div className="flex-1 relative">
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/[0.06]
                     [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#fa2d48]
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md
                     [&::-webkit-slider-thumb]:shadow-[#fa2d48]/30
                     [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
          style={{ background: `linear-gradient(to right, #fa2d48 0%, #fa2d48 ${pct}%, rgba(255,255,255,0.06) ${pct}%, rgba(255,255,255,0.06) 100%)` }}
        />
      </div>
      <span className="font-semibold text-[#fa2d48] w-10 text-right tabular-nums">{Number(value).toFixed(1)}</span>
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

/* ── SectionCard ── */
export function SectionCard({ title, subtitle, icon, children, className = '' }) {
  return (
    <div className={`card-premium p-5 sm:p-6 ${className}`}>
      {(title || icon) && (
        <div className="mb-5">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-[#fa2d48]">{icon}</span>}
            {title && <h2 className="text-[15px] font-bold text-[#f5f5f7] tracking-tight">{title}</h2>}
          </div>
          {subtitle && <p className="text-[12px] text-[#636366] mt-1 ml-[26px]">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── EmptyState ── */
export function EmptyState({ icon, title, description }) {
  return (
    <div className="text-center py-20 card-premium border-dashed !border-white/[0.08]">
      <div className="flex justify-center mb-5 text-[#48484a]">{icon || <Icons.Empty />}</div>
      {title && <div className="text-[15px] font-bold text-[#636366] mb-1.5">{title}</div>}
      {description && <div className="text-[13px] text-[#48484a] leading-relaxed max-w-sm mx-auto">{description}</div>}
    </div>
  );
}

/* ── Tabs ── */
export function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex gap-0.5 p-[3px] bg-white/[0.04] rounded-[14px] backdrop-blur-sm border border-white/[0.06]">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-3.5 py-[8px] rounded-[11px] text-[13px] font-bold transition-all duration-300
            ${activeTab === tab.id
              ? 'bg-white/[0.1] text-[#f5f5f7] shadow-sm'
              : 'text-[#636366] hover:text-[#a1a1a6]'
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
    <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-[10px] sm:text-xs font-bold transition-all
                ${i + 1 <= current
                  ? 'bg-gradient-to-b from-[#fa2d48] to-[#c0162b] text-white shadow-sm shadow-[#fa2d48]/20'
                  : i + 1 === current + 1
                  ? 'bg-white/[0.06] text-[#fa2d48] border border-[#fa2d48]/30'
                  : 'bg-white/[0.04] text-[#48484a]'
                }`}>
              {i + 1 < current ? <Icons.Success className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : i + 1}
            </div>
            <span className={`text-[10px] sm:text-xs font-semibold transition-colors whitespace-nowrap
                ${i + 1 <= current ? 'text-[#f5f5f7]' : 'text-[#48484a]'}`}>
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-3 sm:w-6 h-px ${i + 1 < current ? 'bg-[#fa2d48]' : 'bg-white/[0.06]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
