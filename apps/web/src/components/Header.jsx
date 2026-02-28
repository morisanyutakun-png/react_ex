'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/ui';

const NAV_ITEMS = [
  { href: '/',          label: 'ホーム',   icon: <Icons.Home className="w-[15px] h-[15px]" />, mobileIcon: <Icons.Home className="w-[22px] h-[22px]" />, color: '#fc3c44' },
  { href: '/user',      label: 'つくる',   icon: <Icons.User className="w-[15px] h-[15px]" />, mobileIcon: <Icons.User className="w-[22px] h-[22px]" />, color: '#e8457a' },
  { href: '/dev',       label: '高める',   icon: <Icons.Dev className="w-[15px] h-[15px]" />,  mobileIcon: <Icons.Dev className="w-[22px] h-[22px]" />, color: '#c084fc' },
  { href: '/search',    label: '検索',     icon: <Icons.Search className="w-[15px] h-[15px]" />, mobileIcon: <Icons.Search className="w-[22px] h-[22px]" />, color: '#f472b6' },
  { href: '/db-editor', label: 'DB',       icon: <Icons.Table className="w-[15px] h-[15px]" />, mobileIcon: <Icons.Table className="w-[22px] h-[22px]" />, color: '#34d399' },
  { href: '/help',      label: 'ヘルプ',   icon: <Icons.Book className="w-[15px] h-[15px]" />, mobileIcon: <Icons.Book className="w-[22px] h-[22px]" />, color: '#818cf8' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <>
      {/* ── デスクトップヘッダー (frosted glass + vivid accents) ── */}
      <header className="header-bar sticky top-[3px] z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[52px]">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex items-center justify-center w-[30px] h-[30px] rounded-[9px] bg-gradient-to-br from-[#e8457a] via-[#f472b6] to-[#c084fc] text-white shadow-md shadow-[#e8457a]/20 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-[#e8457a]/30 group-hover:scale-105">
                <Icons.Book className="w-3.5 h-3.5" />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-[#1d1d1f] group-hover:text-[#e8457a] transition-colors duration-300">
                REM
              </span>
            </Link>

            {/* デスクトップナビ — カラフルアクティブ */}
            <nav className="hidden sm:flex items-center gap-0.5">
              {NAV_ITEMS.map(({ href, label, icon, color }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-300 flex items-center gap-1.5
                      ${active
                        ? 'text-white'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'
                      }`}
                    style={active ? {
                      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                      boxShadow: `0 2px 8px ${color}40`,
                    } : {}}
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

      {/* ── モバイルボトムナビバー (enhanced touch targets) ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-2xl border-t border-black/[0.06] safe-area-bottom">
        <div className="flex items-center justify-around px-1">
          {NAV_ITEMS.map(({ href, label, mobileIcon, color }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 py-2 px-2 min-w-[3.5rem] min-h-[52px] justify-center transition-all duration-300 active:scale-90"
                style={{ color: active ? color : '#aeaeb2' }}
              >
                <div className="relative">
                  {mobileIcon}
                  {active && (
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                         style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                  )}
                </div>
                <span className="text-[10px] font-semibold leading-none mt-0.5"
                      style={{ color: active ? color : '#aeaeb2' }}>
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
