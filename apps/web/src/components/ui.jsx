'use client';

/* ─────────────────────────────────────────────────
   共通UIコンポーネント群 (Red/Black/White REM テーマ)
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
 * ページヘッダー
 */
export function PageHeader({ title, description, icon, breadcrumbs }) {
  return (
    <div className="mb-6 sm:mb-8">
      {breadcrumbs ? (
        <nav className="flex items-center gap-1.5 mb-4 sm:mb-5 text-xs font-semibold tracking-wide">
          {breadcrumbs.map((bc, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {bc.href ? (
                <a href={bc.href} className="flex items-center gap-1 text-neutral-500 hover:text-red-500 transition-colors">
                  {i === 0 && bc.label === 'Home' && <Icons.Home className="w-3.5 h-3.5" />}
                  <span>{bc.label}</span>
                </a>
              ) : (
                <span className="text-neutral-200 font-semibold">{bc.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                <svg className="w-3 h-3 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </nav>
      ) : null}
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-glow-sm">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-50 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-neutral-400 mt-0.5 max-w-2xl leading-relaxed">
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
    message.includes('取得') || message.includes('作成') || message.includes('開きました');

  const styles = isError
    ? 'bg-red-950/30 text-red-400 border-red-900'
    : isSuccess
    ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900'
    : 'bg-red-950/30 text-red-400 border-red-900';

  return (
    <div
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium mb-4 border transition-all duration-200 ${styles}`}
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
        <label className="block text-xs font-semibold text-neutral-400 mb-1.5 tracking-wide">
          {label}
        </label>
      )}
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-neutral-700 bg-neutral-900 text-sm
                    text-neutral-200 transition-all cursor-pointer appearance-none
                    hover:border-neutral-700 focus:border-red-600 focus:ring-2 focus:ring-red-600/40
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
        <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-neutral-500">
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
        <label className="block text-xs font-semibold text-neutral-400 mb-1.5 tracking-wide">
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
        className="w-24 px-3 py-2.5 rounded-lg border border-neutral-700 bg-neutral-900 text-sm text-neutral-200
                   transition-all hover:border-neutral-700 focus:border-red-600 focus:ring-2 focus:ring-red-600/40
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
        <label className="block text-xs font-semibold text-neutral-400 mb-1.5 tracking-wide">
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        rows={rows}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full px-3.5 py-3 rounded-lg border border-neutral-700 bg-neutral-900 font-mono text-sm
                   leading-relaxed resize-y text-neutral-200 transition-all
                   hover:border-neutral-700 focus:border-red-600 focus:ring-2 focus:ring-red-600/40
                   outline-none placeholder:text-neutral-600
                   read-only:bg-neutral-800/50 read-only:text-neutral-400 read-only:border-neutral-800"
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
        <label className="block text-xs font-semibold text-neutral-400 mb-1.5 tracking-wide">
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg border border-neutral-700 bg-neutral-900 text-sm text-neutral-200
                   transition-all hover:border-neutral-700 focus:border-red-600 focus:ring-2 focus:ring-red-600/40
                   outline-none placeholder:text-neutral-600"
      />
    </div>
  );
}

/**
 * ボタン
 */
export function Button({ children, onClick, variant = 'primary', disabled, className = '', size = 'md' }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]';

  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  const variants = {
    primary:
      'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600/30 shadow-glow-sm',
    secondary:
      'bg-neutral-900 text-neutral-200 border border-neutral-800 hover:bg-neutral-800/50 hover:border-neutral-700',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 shadow-glow-sm',
    danger:
      'bg-red-600 text-white hover:bg-red-700 shadow-glow-sm',
    warning:
      'bg-amber-500 text-white hover:bg-amber-600',
    ghost:
      'bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200',
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
    slate: 'bg-neutral-800 text-neutral-300',
    neutral: 'bg-neutral-800 text-neutral-300',
    indigo: 'bg-red-950/30 text-red-400',
    emerald: 'bg-emerald-950/30 text-emerald-400',
    amber: 'bg-amber-950/30 text-amber-400',
    rose: 'bg-rose-950/30 text-rose-400',
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
    <label className="flex items-center gap-3 text-xs text-neutral-300 py-1 group">
      <span className="min-w-[5rem] font-semibold text-neutral-400 tracking-wide">{label}</span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                     bg-neutral-800 accent-red-600
                     [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-red-600
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:shadow-glow-sm
                     [&::-webkit-slider-thumb]:transition-transform
                     [&::-webkit-slider-thumb]:hover:scale-110"
          style={{
            background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${pct}%, #262626 ${pct}%, #262626 100%)`,
          }}
        />
      </div>
      <span className="font-semibold text-red-500 w-10 text-right tabular-nums">
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
    <div className={`bg-neutral-900 rounded-lg border border-neutral-800 p-4 sm:p-5 shadow-card ${className}`}>
      {(title || icon) && (
        <div className="mb-4">
          <div className="flex items-center gap-2">
            {icon && <span className="text-red-500">{icon}</span>}
            {title && <h2 className="text-sm sm:text-base font-semibold text-neutral-50">{title}</h2>}
          </div>
          {subtitle && <p className="text-xs text-neutral-400 mt-0.5 ml-6">{subtitle}</p>}
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
    <div className="text-center py-12 bg-neutral-800/50 rounded-lg border border-dashed border-neutral-800">
      <div className="flex justify-center mb-3 text-neutral-700">
        {icon || <Icons.Empty />}
      </div>
      {title && <div className="text-sm font-semibold text-neutral-400 mb-0.5">{title}</div>}
      {description && <div className="text-xs text-neutral-500">{description}</div>}
    </div>
  );
}

/**
 * タブコンポーネント
 */
export function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex gap-0.5 p-0.5 bg-neutral-800 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold transition-all duration-150
            ${activeTab === tab.id
              ? 'bg-red-600 text-white shadow-glow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
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
              className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-md text-[10px] sm:text-xs font-bold transition-all
                ${i + 1 <= current
                  ? 'bg-red-600 text-white shadow-glow-sm'
                  : i + 1 === current + 1
                  ? 'bg-neutral-900 text-red-500 border-2 border-neutral-800'
                  : 'bg-neutral-800 text-neutral-500'
                }`}
            >
              {i + 1 < current ? <Icons.Success className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : i + 1}
            </div>
            <span
              className={`text-[10px] sm:text-xs font-semibold transition-colors whitespace-nowrap tracking-wide
                ${i + 1 <= current ? 'text-neutral-50' : 'text-neutral-500'}
              `}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-3 sm:w-6 h-px ${
                i + 1 < current ? 'bg-red-600' : 'bg-neutral-800'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}