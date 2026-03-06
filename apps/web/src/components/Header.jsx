'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/ui';
import { useBranding } from '@/contexts/BrandingContext';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { href: '/',          label: 'ホーム',   icon: <Icons.Home className="w-[14px] h-[14px]" />, mobileIcon: <Icons.Home className="w-[21px] h-[21px]" /> },
  { href: '/user',      label: 'つくる',   icon: <Icons.User className="w-[14px] h-[14px]" />, mobileIcon: <Icons.User className="w-[21px] h-[21px]" /> },
  { href: '/dev',       label: '磨く',     icon: <Icons.Dev className="w-[14px] h-[14px]" />,  mobileIcon: <Icons.Dev className="w-[21px] h-[21px]" /> },
  { href: '/search',    label: 'さがす',   icon: <Icons.Search className="w-[14px] h-[14px]" />, mobileIcon: <Icons.Search className="w-[21px] h-[21px]" /> },
  { href: '/db-editor', label: 'データ',   icon: <Icons.Table className="w-[14px] h-[14px]" />, mobileIcon: <Icons.Table className="w-[21px] h-[21px]" /> },
  { href: '/help',      label: 'ヘルプ',   icon: <Icons.Book className="w-[14px] h-[14px]" />, mobileIcon: <Icons.Book className="w-[21px] h-[21px]" /> },
];

export default function Header() {
  const pathname = usePathname();
  const { serviceName, primaryColor } = useBranding();
  const { user, isAuthenticated, isGuest, logout } = useAuth();

  return (
    <>
      {/* ── アクセントバー ── */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-[60]"
           style={{ background: primaryColor }} />

      {/* ── デスクトップヘッダー (Frosted glass light) ── */}
      <header className="header-bar sticky top-0 z-50" style={{ marginTop: '3px' }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="flex items-center justify-between h-[48px]">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex items-center justify-center w-[28px] h-[28px] rounded-[8px] text-white group-hover:scale-105"
                   style={{ background: primaryColor, transition: 'transform 0.5s var(--ease-spring)' }}>
                <Icons.Book className="w-3 h-3 relative z-10" style={{ transition: 'transform 0.5s var(--ease-spring)' }} />
              </div>
              <span className="text-[14px] font-bold tracking-[-0.02em]" style={{ color: primaryColor, transition: 'opacity 0.3s ease' }}>
                {serviceName}
              </span>
            </Link>

            {/* デスクトップナビ */}
            <nav className="hidden sm:flex items-center gap-0.5">
              {NAV_ITEMS.map(({ href, label, icon }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative px-3 py-1.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5
                      ${active
                        ? ''
                        : 'text-[#64748b] hover:bg-blue-50'
                      }`}
                    style={{
                      transition: 'all 0.4s var(--ease-spring)',
                      ...(active ? {
                        background: `${primaryColor}12`,
                        color: primaryColor,
                        boxShadow: `inset 0 0 0 1.5px ${primaryColor}30`,
                      } : {}),
                      ...(!active ? { '--tw-text-opacity': 1 } : {}),
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = primaryColor; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#64748b'; }}
                  >
                    {icon}
                    {label}
                    {active && (
                      <span className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-4 h-[2.5px] rounded-full"
                            style={{ background: primaryColor }} />
                    )}
                  </Link>
                );
              })}
              {/* 設定アイコン */}
              <Link
                href="/settings"
                className={`relative px-2 py-1.5 rounded-full text-[13px] font-medium flex items-center
                  ${pathname === '/settings'
                    ? ''
                    : 'text-[#94a3b8] hover:text-[#64748b]'
                  }`}
                style={{
                  transition: 'all 0.4s var(--ease-spring)',
                  ...(pathname === '/settings' ? {
                    background: `${primaryColor}12`,
                    color: primaryColor,
                    boxShadow: `inset 0 0 0 1.5px ${primaryColor}30`,
                  } : {}),
                }}
                onMouseEnter={(e) => { if (pathname !== '/settings') e.currentTarget.style.color = primaryColor; }}
                onMouseLeave={(e) => { if (pathname !== '/settings') e.currentTarget.style.color = '#94a3b8'; }}
                title="ブランド設定"
              >
                <Icons.Settings className="w-[15px] h-[15px]" />
              </Link>
              {/* 認証 */}
              <div className="ml-1 pl-1 border-l border-slate-200 flex items-center gap-1">
                {isAuthenticated ? (
                  <>
                    <span className="text-[12px] font-medium text-slate-500 px-1">
                      {user?.display_name || user?.email?.split('@')[0] || 'User'}
                    </span>
                    <button
                      onClick={logout}
                      className="px-2 py-1 rounded-full text-[11px] font-medium text-slate-400 hover:bg-slate-100 transition-colors"
                    >
                      ログアウト
                    </button>
                  </>
                ) : isGuest ? (
                  <Link
                    href="/login"
                    className="px-3 py-1.5 rounded-full text-[12px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    ゲスト利用中
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="px-3 py-1.5 rounded-full text-[12px] font-medium text-white transition-all hover:opacity-90"
                    style={{ background: primaryColor }}
                  >
                    ログイン
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* ── モバイルボトムナビバー ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
           style={{
             background: 'rgba(248,250,255,0.92)',
             backdropFilter: 'saturate(200%) blur(24px)',
             WebkitBackdropFilter: 'saturate(200%) blur(24px)',
             borderTop: `0.5px solid ${primaryColor}14`,
             boxShadow: `0 -4px 16px ${primaryColor}0a, 0 -0.5px 0 ${primaryColor}0a`,
           }}>
        <div className="flex items-center justify-around px-1">
          {NAV_ITEMS.map(({ href, label, mobileIcon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 py-2 px-2 min-w-[3.5rem] min-h-[52px] justify-center rounded-xl"
                style={{
                  color: active ? primaryColor : '#94a3b8',
                  background: active ? `${primaryColor}0c` : 'transparent',
                  transition: 'all 0.35s var(--ease-spring)',
                }}
              >
                <div className="relative" style={{ transition: 'transform 0.35s var(--ease-spring)', transform: active ? 'scale(1.08)' : 'scale(1)' }}>
                  {mobileIcon}
                  {active && (
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full"
                         style={{ background: primaryColor }} />
                  )}
                </div>
                <span className="text-[10px] leading-none mt-0.5"
                      style={{ color: active ? primaryColor : '#94a3b8', fontWeight: active ? 700 : 500 }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
