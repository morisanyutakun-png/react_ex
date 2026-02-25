'use client';

/* ─────────────────────────────────────────────────
   共通UIコンポーネント群 (Apple-inspired White/Red テーマ)
   ───────────────────────────────────────────────── */

/**
 * 汎用SVGアイコン
 */
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

/**
 * ページヘッダー（Apple HIG Premium）
 */
export function PageHeader({ title, description, icon, breadcrumbs }) {
  return (
    <div className="mb-8 sm:mb-10">
      {breadcrumbs ? (
        <nav className="flex items-center gap-1.5 mb-5 sm:mb-6 text-[12px] font-medium tracking-wide">
          {breadcrumbs.map((bc, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {bc.href ? (
                <a href={bc.href} className="flex items-center gap-1 text-[#aeaeb2] hover:text-[#fc3c44] transition-colors duration-300">
                  {i === 0 && bc.label === 'Home' && <Icons.Home className="w-3.5 h-3.5" />}
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
      ) : null}
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {icon && (
          <div className="relative flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fc3c44] to-[#d42d34] text-white flex items-center justify-center shadow-lg shadow-[#fc3c44]/20">
            {icon}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-[24px] sm:text-[30px] font-extrabold text-[#1d1d1f] tracking-tight leading-tight">
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

/**
 * ステータスバー — 操作結果を表示
 */
export function StatusBar({ message }) {
  if (!message) return null;
  const isError =
    message.includes('失敗') || message.includes('エラー') || message.includes('Error');
  const isSuccess =
    message.includes('完了') || message.includes('成功') ||
    message.includes('取得') || message.includes('作成') || message.includes('開きました') ||
    /\d+件/.test(message);

  const styles = isError
    ? 'bg-red-500/[0.06] text-[#ff3b30] border-red-500/[0.1]'
    : isSuccess
    ? 'bg-[#34c759]/[0.06] text-[#34c759] border-[#34c759]/[0.1]'
    : 'bg-black/[0.03] text-[#6e6e73] border-black/[0.04]';

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-[13px] font-semibold mb-4 border backdrop-blur-sm transition-all duration-500 animate-in ${styles}`}
    >
      <span className="flex-shrink-0">
        {isError ? <Icons.Error /> : isSuccess ? <Icons.Success /> : <Icons.Info />}
      </span>
      <span>{message}</span>
    </div>
  );
}

/**
 * セレクトフィールド
 */
export function SelectField({ label, value, onChange, options, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-[#6e6e73] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-black/[0.06] bg-white/80 backdrop-blur-sm text-sm
                    text-[#1d1d1f] transition-all duration-200 cursor-pointer appearance-none
                    hover:border-black/[0.1] focus:border-[#fc3c44] focus:ring-4 focus:ring-[#fc3c44]/10
                    outline-none pr-9"
        >
          {options.map((opt) =>
            typeof opt === 'string' ? (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ) : (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            )
          )}
        </select>
        <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-[#aeaeb2]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * 数値入力
 */
export function NumberField({ label, value, onChange, min = 1, max, step, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-[#6e6e73] mb-1.5">
          {label}
        </label>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-24 px-3 py-2.5 rounded-xl border border-black/[0.06] bg-white/80 backdrop-blur-sm text-sm text-[#1d1d1f]
                   transition-all duration-200 hover:border-black/[0.1] focus:border-[#fc3c44] focus:ring-4 focus:ring-[#fc3c44]/10
                   outline-none [&::-webkit-inner-spin-button]:opacity-100"
      />
    </div>
  );
}

/**
 * テキストエリア
 */
export function TextArea({ label, value, onChange, rows = 6, placeholder, readOnly, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-[#6e6e73] mb-1.5">
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        rows={rows}
        placeholder={placeholder}
        readOnly={readOnly}
          className="w-full px-3.5 py-3 rounded-xl border border-black/[0.06] bg-white/80 backdrop-blur-sm font-mono text-sm
                   leading-relaxed resize-y text-[#1d1d1f] transition-all duration-200
                   hover:border-black/[0.1] focus:border-[#fc3c44] focus:ring-4 focus:ring-[#fc3c44]/10
                   outline-none placeholder:text-[#aeaeb2]
                   read-only:bg-[#f5f5f7] read-only:text-[#6e6e73] read-only:border-black/[0.04]"
      />
    </div>
  );
}

/**
 * テキスト入力
 */
export function TextField({ label, value, onChange, placeholder, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-[#6e6e73] mb-1.5">
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-black/[0.06] bg-white/80 backdrop-blur-sm text-sm text-[#1d1d1f]
                   transition-all duration-200 hover:border-black/[0.1] focus:border-[#fc3c44] focus:ring-4 focus:ring-[#fc3c44]/10
                   outline-none placeholder:text-[#aeaeb2]"
      />
    </div>
  );
}

/**
 * ボタン
 */
export function Button({ children, onClick, variant = 'primary', disabled, className = '', size = 'md' }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-sm',
  };

  const variants = {
    primary:
      'bg-gradient-to-b from-[#fc3c44] to-[#d42d34] text-white hover:from-[#e0353c] hover:to-[#c02830] shadow-sm shadow-[#fc3c44]/25 hover:shadow-md hover:shadow-[#fc3c44]/30',
    secondary:
      'bg-white/80 backdrop-blur-sm text-[#1d1d1f] border border-black/[0.06] hover:bg-white hover:border-black/[0.1] shadow-sm hover:shadow-md',
    success:
      'bg-gradient-to-b from-[#34c759] to-[#28a745] text-white hover:from-[#2db84e] hover:to-[#239a3c] shadow-sm shadow-[#34c759]/20',
    danger:
      'bg-gradient-to-b from-[#ff3b30] to-[#d42d34] text-white hover:from-[#e6352b] hover:to-[#bf282f] shadow-sm shadow-[#ff3b30]/20',
    warning:
      'bg-gradient-to-b from-[#ff9f0a] to-[#f59e0b] text-white hover:from-[#e89009] hover:to-[#d48e0a] shadow-sm shadow-[#ff9f0a]/20',
    ghost:
      'bg-transparent text-[#86868b] hover:bg-black/[0.04] hover:text-[#1d1d1f]',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * メタデータタグ
 */
export function MetaTag({ icon, label, value, color = 'slate' }) {
  if (!value) return null;
  const colorMap = {
    slate: 'bg-black/[0.04] text-[#86868b]',
    neutral: 'bg-black/[0.04] text-[#86868b]',
    indigo: 'bg-[#fc3c44]/[0.08] text-[#fc3c44]',
    emerald: 'bg-emerald-500/[0.08] text-emerald-600',
    amber: 'bg-amber-500/[0.08] text-amber-600',
    rose: 'bg-rose-500/[0.08] text-rose-600',
  };
  return (
    <span className={`badge ${colorMap[color] || colorMap.slate}`}>
      {icon && <span>{icon}</span>}
      {label && <span className="text-[10px] opacity-60">{label}</span>}
      <strong>{value}</strong>
    </span>
  );
}

/**
 * スライダー（重み調整用）
 */
export function Slider({ label, value, onChange, min = 0, max = 2, step = 0.1 }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex items-center gap-3 text-xs text-[#6e6e73] py-1 group">
      <span className="min-w-[5rem] font-semibold text-[#6e6e73]">{label}</span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                     bg-[#e5e5ea] accent-[#fc3c44]
                     [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-[#fc3c44]
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:transition-transform
                     [&::-webkit-slider-thumb]:hover:scale-110"
          style={{
            background: `linear-gradient(to right, #fc3c44 0%, #fc3c44 ${pct}%, #e5e5ea ${pct}%, #e5e5ea 100%)`,
          }}
        />
      </div>
      <span className="font-semibold text-[#fc3c44] w-10 text-right tabular-nums">
        {Number(value).toFixed(1)}
      </span>
    </label>
  );
}

/**
 * コピーボタン
 */
export function CopyButton({ text, onCopied, label = 'コピー' }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied?.('成功：クリップボードにコピーしました');
    } catch (e) {
      onCopied?.('コピー失敗: ' + e.message);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={copy} disabled={!text}>
      <Icons.Copy />
      {label}
    </Button>
  );
}

/**
 * セクションカード — 汎用の白カード
 */
export function SectionCard({ title, subtitle, icon, children, className = '' }) {
  return (
    <div className={`card-premium p-5 sm:p-6 ${className}`}>
      {(title || icon) && (
        <div className="mb-5">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-[#fc3c44]">{icon}</span>}
            {title && <h2 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">{title}</h2>}
          </div>
          {subtitle && <p className="text-[12px] text-[#86868b] mt-1 ml-[26px]">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * 空状態の表示
 */
export function EmptyState({ icon, title, description }) {
  return (
    <div className="text-center py-20 card-premium border-dashed !border-black/[0.06]">
      <div className="flex justify-center mb-5 text-[#d2d2d7]">
        {icon || <Icons.Empty />}
      </div>
      {title && <div className="text-[15px] font-bold text-[#86868b] mb-1.5">{title}</div>}
      {description && <div className="text-[13px] text-[#aeaeb2] leading-relaxed max-w-sm mx-auto">{description}</div>}
    </div>
  );
}

/**
 * タブコンポーネント
 */
export function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex gap-0.5 p-[3px] bg-black/[0.04] rounded-[14px] backdrop-blur-sm">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-3.5 py-[8px] rounded-[11px] text-[13px] font-bold transition-all duration-300
            ${activeTab === tab.id
              ? 'bg-white text-[#1d1d1f] shadow-sm shadow-black/[0.06]'
              : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
        >
          {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * プログレスインジケーター
 */
export function ProgressSteps({ steps, current }) {
  return (
    <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <div
              className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-[10px] sm:text-xs font-bold transition-all
                ${i + 1 <= current
                  ? 'bg-gradient-to-b from-[#fc3c44] to-[#d42d34] text-white shadow-sm shadow-[#fc3c44]/20'
                  : i + 1 === current + 1
                  ? 'bg-white text-[#fc3c44] border-2 border-[#fc3c44]/20'
                  : 'bg-black/[0.04] text-[#aeaeb2]'
                }`}
            >
              {i + 1 < current ? <Icons.Success className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : i + 1}
            </div>
            <span
              className={`text-[10px] sm:text-xs font-semibold transition-colors whitespace-nowrap
                ${i + 1 <= current ? 'text-[#1d1d1f]' : 'text-[#aeaeb2]'}
              `}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-3 sm:w-6 h-px ${
                i + 1 < current ? 'bg-[#fc3c44]' : 'bg-[#e5e5ea]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}