'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/ui';

const NAV_ITEMS = [
  { href: '/', label: 'ホーム', icon: <Icons.Home className="w-4 h-4" />, mobileIcon: <Icons.Home className="w-5 h-5" /> },
  { href: '/user', label: 'つくる', icon: <Icons.User className="w-4 h-4" />, mobileIcon: <Icons.User className="w-5 h-5" /> },
  { href: '/dev', label: '高める', icon: <Icons.Dev className="w-4 h-4" />, mobileIcon: <Icons.Dev className="w-5 h-5" /> },
  { href: '/search', label: '検索', icon: <Icons.Search className="w-4 h-4" />, mobileIcon: <Icons.Search className="w-5 h-5" /> },
  { href: '/db-editor', label: 'DB編集', icon: <Icons.Table className="w-4 h-4" />, mobileIcon: <Icons.Table className="w-5 h-5" /> },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* ── デスクトップヘッダー ── */}
      <header className="glass-card sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-12">
            <Link
              href="/"
              className="flex items-center gap-2 group"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-600 text-white">
                <Icons.Book className="w-4 h-4" />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-[#1d1d1f]">
                REM
              </span>
            </Link>

            {/* デスクトップナビ */}
            <nav className="hidden sm:flex items-center gap-0.5">
              {NAV_ITEMS.map(({ href, label, icon }) => {
                const active =
                  href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative px-3 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 flex items-center gap-1.5
                      ${active
                        ? 'bg-red-600 text-white'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'
                      }`}
                  >
                    {icon}
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* モバイルハンバーガー */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 -mr-2 rounded-lg text-[#6e6e73] hover:bg-black/[0.04] transition-all"
              aria-label="メニューを開く"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* モバイルドロップダウンメニュー */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-black/[0.06] bg-white/90 backdrop-blur-xl animate-in">
            <nav className="px-3 py-2 space-y-0.5">
              {NAV_ITEMS.map(({ href, label, icon }) => {
                const active =
                  href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all
                      ${active
                        ? 'bg-red-600 text-white'
                        : 'text-[#1d1d1f] hover:bg-black/[0.04] active:bg-black/[0.06]'
                      }`}
                  >
                    {icon}
                    {label}
                    {active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* ── モバイルボトムナビバー ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-black/[0.06] safe-area-bottom">
        <div className="flex items-center justify-around px-1 py-1">
          {NAV_ITEMS.map(({ href, label, mobileIcon }) => {
            const active =
              href === '/'
                ? pathname === '/'
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl min-w-[3.5rem] transition-all active:scale-95
                  ${active
                    ? 'text-red-600'
                    : 'text-[#aeaeb2]'
                  }`}
              >
                <div className="p-0.5">
                  {mobileIcon}
                </div>
                <span className={`text-[10px] font-medium leading-none ${active ? 'text-red-600' : 'text-[#aeaeb2]'}`}>
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
