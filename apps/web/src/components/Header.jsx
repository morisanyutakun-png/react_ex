'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/ui';
import { useBranding } from '@/contexts/BrandingContext';
import { useAuth } from '@/contexts/AuthContext';

export const NAV_ITEMS = [
  { href: '/',          label: 'ホーム',   icon: <Icons.Home className="w-[14px] h-[14px]" />, mobileIcon: <Icons.Home className="w-[21px] h-[21px]" /> },
  { href: '/user',      label: 'つくる',   icon: <Icons.User className="w-[14px] h-[14px]" />, mobileIcon: <Icons.User className="w-[21px] h-[21px]" /> },
  { href: '/mock',      label: '模試',     icon: <Icons.Chart className="w-[14px] h-[14px]" />, mobileIcon: <Icons.Chart className="w-[21px] h-[21px]" /> },
  { href: '/help',      label: 'ヘルプ',   icon: <Icons.Book className="w-[14px] h-[14px]" />, mobileIcon: <Icons.Book className="w-[21px] h-[21px]" /> },
];

export default function Header() {
  const pathname = usePathname();
  const { serviceName } = useBranding();
  const { user, isAuthenticated, isGuest, logout } = useAuth();

  return (
    <header className="header-bar sticky top-0 z-50 hidden sm:block">
      <div className="max-w-[1180px] mx-auto px-6">
        <div className="flex items-center justify-between h-[56px]">

          {/* ── Brand lockup ── */}
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="brand-mark">
              <span className="brand-mark-dot" />
            </span>
            <span className="brand-wordmark">{serviceName || 'REM'}</span>
          </Link>

          {/* ── Center nav (segmented control style) ── */}
          <nav className="header-segment">
            {NAV_ITEMS.map(({ href, label }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                  className={`header-segment-item${active ? ' is-active' : ''}`}>
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* ── Right cluster ── */}
          <div className="flex items-center gap-1">
            <Link href="/settings"
              className={`header-icon-btn${pathname === '/settings' ? ' is-active' : ''}`}
              title="設定"
              aria-label="設定">
              <Icons.Settings className="w-[15px] h-[15px]" />
            </Link>

            <span className="header-divider" aria-hidden="true" />

            {isAuthenticated ? (
              <>
                <span className="header-user-name">
                  {user?.display_name || user?.email?.split('@')[0] || 'User'}
                </span>
                <button onClick={logout} className="header-ghost-btn">
                  ログアウト
                </button>
              </>
            ) : isGuest ? (
              <Link href="/login" className="header-pill-btn">
                ゲスト利用中
              </Link>
            ) : (
              <Link href="/login" className="header-primary-btn">
                ログイン
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
