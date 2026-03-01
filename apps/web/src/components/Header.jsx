'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/ui';

const NAV_ITEMS = [
  { href: '/',          label: 'ホーム',   icon: <Icons.Home className="w-[15px] h-[15px]" />, mobileIcon: <Icons.Home className="w-[22px] h-[22px]" /> },
  { href: '/user',      label: 'つくる',   icon: <Icons.User className="w-[15px] h-[15px]" />, mobileIcon: <Icons.User className="w-[22px] h-[22px]" /> },
  { href: '/dev',       label: '磨く',     icon: <Icons.Dev className="w-[15px] h-[15px]" />,  mobileIcon: <Icons.Dev className="w-[22px] h-[22px]" /> },
  { href: '/search',    label: 'さがす',   icon: <Icons.Search className="w-[15px] h-[15px]" />, mobileIcon: <Icons.Search className="w-[22px] h-[22px]" /> },
  { href: '/db-editor', label: 'データ',   icon: <Icons.Table className="w-[15px] h-[15px]" />, mobileIcon: <Icons.Table className="w-[22px] h-[22px]" /> },
  { href: '/help',      label: 'ヘルプ',   icon: <Icons.Book className="w-[15px] h-[15px]" />, mobileIcon: <Icons.Book className="w-[22px] h-[22px]" /> },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <>
      {/* ── デスクトップヘッダー (Apple frosted glass) ── */}
      <header className="header-bar sticky top-[3px] z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[52px]">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex items-center justify-center w-[30px] h-[30px] rounded-[9px] bg-[#1d1d1f] text-white transition-transform duration-300 group-hover:scale-105">
                <Icons.Book className="w-3.5 h-3.5" />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-[#1d1d1f]">
                REM
              </span>
            </Link>

            {/* デスクトップナビ — Apple minimal */}
            <nav className="hidden sm:flex items-center gap-0.5">
              {NAV_ITEMS.map(({ href, label, icon }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-300 flex items-center gap-1.5
                      ${active
                        ? 'bg-black/[0.06] text-[#1d1d1f]'
                        : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.03]'
                      }`}
                  >
                    {icon}
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* ── モバイルボトムナビバー ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl border-t border-black/[0.06] safe-area-bottom"
           style={{ background: 'rgba(255,255,255,0.92)' }}>
        <div className="flex items-center justify-around px-1">
          {NAV_ITEMS.map(({ href, label, mobileIcon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 px-2 min-w-[3.5rem] min-h-[52px] justify-center transition-all duration-300 active:scale-90
                  ${active ? 'text-[#0071e3]' : 'text-[#aeaeb2]'}`}
              >
                <div className="relative">
                  {mobileIcon}
                  {active && (
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0071e3]" />
                  )}
                </div>
                <span className={`text-[10px] font-semibold leading-none mt-0.5 ${active ? 'text-[#0071e3]' : 'text-[#aeaeb2]'}`}>
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
