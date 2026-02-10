'use client';

/* ─────────────────────────────────────────────────
   共通UIコンポーネント群 (Indigo/Slate テーマ)
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
  )
};

/**
 * ページヘッダー
 */
export function PageHeader({ title, description, icon, breadcrumbs }) {
  return (
    <div className="mb-12">
      {breadcrumbs ? (
        <nav className="flex items-center gap-2 mb-8 text-[13px] font-bold tracking-tight">
          {breadcrumbs.map((bc, i) => (
            <div key={i} className="flex items-center gap-2">
              {bc.href ? (
                <a href={bc.href} className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-500 transition-colors">
                  {i === 0 && bc.label === 'Home' && <Icons.Home />}
                  <span>{bc.label.toUpperCase()}</span>
                </a>
              ) : (
                <span className="text-slate-800 uppercase tracking-widest">{bc.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <Icons.ArrowRight />}
            </div>
          ))}
        </nav>
      ) : null}
      
      <div className="flex flex-col md:flex-row md:items-end gap-6">
        {icon && (
          <div className="flex-shrink-0 w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200/50">
            {icon}
          </div>
        )}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[17px] text-slate-500 font-medium max-w-2xl leading-relaxed">
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
    ? 'bg-rose-50/80 text-rose-700 border-rose-200 backdrop-blur-sm'
    : isSuccess
    ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200 backdrop-blur-sm'
    : 'bg-indigo-50/80 text-indigo-700 border-indigo-200 backdrop-blur-sm';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium mb-6 border shadow-sm transition-all duration-300 ${styles}`}
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
        <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">
          {label}
        </label>
      )}
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/50 text-sm
                    text-slate-700 transition-all cursor-pointer appearance-none
                    hover:border-indigo-200 focus:border-indigo-500 focus:bg-white
                    outline-none pr-10 shadow-sm group-hover:shadow-md"
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
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
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
        <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">
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
        className="w-24 px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/50 text-sm text-slate-700
                   transition-all hover:border-indigo-200 focus:border-indigo-500 focus:bg-white
                   outline-none shadow-sm [&::-webkit-inner-spin-button]:opacity-100"
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
        <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        rows={rows}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full px-5 py-4 rounded-3xl border-2 border-slate-100 bg-white/50 font-mono text-sm
                   leading-relaxed resize-y text-slate-700 transition-all shadow-inner-sm
                   hover:border-indigo-100 focus:border-indigo-500 focus:bg-white
                   outline-none placeholder:text-slate-300
                   read-only:bg-slate-50/50 read-only:text-slate-500 read-only:border-slate-100"
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
        <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/50 text-sm text-slate-700
                   transition-all hover:border-indigo-200 focus:border-indigo-500 focus:bg-white
                   outline-none shadow-sm placeholder:text-slate-300"
      />
    </div>
  );
}

/**
 * ボタン
 */
export function Button({ children, onClick, variant = 'primary', disabled, className = '', size = 'md' }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variants = {
    primary:
      'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm hover:from-indigo-600 hover:to-indigo-700 hover:shadow-md',
    secondary:
      'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
    success:
      'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm hover:from-emerald-600 hover:to-emerald-700',
    danger:
      'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-sm hover:from-rose-600 hover:to-rose-700',
    warning:
      'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm hover:from-amber-500 hover:to-amber-600',
    ghost:
      'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700',
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
    slate: 'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <span className={`badge ${colorMap[color] || colorMap.slate}`}>
      {icon && <span>{icon}</span>}
      {label && <span className="text-[10px] opacity-70">{label}</span>}
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
    <label className="flex items-center gap-3 text-xs text-slate-600 py-1 group">
      <span className="min-w-[5rem] font-medium text-slate-500">{label}</span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                     bg-slate-200 accent-indigo-500
                     [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-indigo-500
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:shadow-sm
                     [&::-webkit-slider-thumb]:transition-transform
                     [&::-webkit-slider-thumb]:hover:scale-125"
          style={{
            background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
          }}
        />
      </div>
      <span className="font-bold text-indigo-600 w-10 text-right tabular-nums">
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
    <div className={`bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-card hover:border-indigo-200/50 transition-colors ${className}`}>
      {(title || icon) && (
        <div className="mb-5">
          <div className="flex items-center gap-3">
            {icon && <span className="text-indigo-500">{icon}</span>}
            {title && <h2 className="text-[17px] font-bold text-slate-800 tracking-tight">{title}</h2>}
          </div>
          {subtitle && <p className="text-[13px] text-slate-400 mt-1">{subtitle}</p>}
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
    <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
      <div className="flex justify-center mb-4 text-slate-300">
        {icon || <Icons.Empty />}
      </div>
      {title && <div className="text-base font-bold text-slate-500 mb-1">{title}</div>}
      {description && <div className="text-sm text-slate-400">{description}</div>}
    </div>
  );
}

/**
 * タブコンポーネント
 */
export function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${activeTab === tab.id
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
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
    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-xl text-xs font-bold transition-all shadow-sm
                ${i + 1 <= current
                  ? 'bg-indigo-600 text-white shadow-indigo-100'
                  : i + 1 === current + 1
                  ? 'bg-white text-indigo-600 ring-2 ring-indigo-50'
                  : 'bg-slate-50 text-slate-300'
                }`}
            >
              {i + 1 < current ? <Icons.Success className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`text-[13px] font-bold tracking-tight transition-colors whitespace-nowrap
                ${i + 1 <= current ? 'text-slate-800' : 'text-slate-400'}
              `}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-8 h-0.5 rounded-full ${
                i + 1 < current ? 'bg-indigo-200' : 'bg-slate-100'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}