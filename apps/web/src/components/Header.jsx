'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/ui';

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

  return (
    <>
      {/* ── デスクトップヘッダー (Frosted glass light) ── */}
      <header className="header-bar sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="flex items-center justify-between h-[48px]">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex items-center justify-center w-[28px] h-[28px] rounded-[8px] icon-glossy text-white"
                   style={{ transition: 'transform 0.5s var(--ease-spring), box-shadow 0.4s ease' }}>
                <Icons.Book className="w-3 h-3 relative z-10" style={{ transition: 'transform 0.5s var(--ease-spring)' }} />
              </div>
              <span className="text-[14px] font-bold tracking-[-0.02em] text-[#1d1d1f]" style={{ transition: 'opacity 0.3s ease' }}>
                REM
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
                    className={`relative px-3 py-1.5 rounded-full text-[13px] font-medium flex items-center gap-1.5
                      ${active
                        ? 'text-white'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.03]'
                      }`}
                    style={{
                      transition: 'all 0.4s var(--ease-spring)',
                      ...(active ? {
                        background: 'linear-gradient(180deg, #3a3a3c 0%, #1d1d1f 100%)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      } : {}),
                    }}
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
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
           style={{
             background: 'rgba(255,255,255,0.88)',
             backdropFilter: 'saturate(200%) blur(20px)',
             WebkitBackdropFilter: 'saturate(200%) blur(20px)',
             borderTop: '0.5px solid rgba(0,0,0,0.08)',
             boxShadow: '0 -0.5px 0 rgba(0,0,0,0.04)',
           }}>
        <div className="flex items-center justify-around px-1">
          {NAV_ITEMS.map(({ href, label, mobileIcon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 px-2 min-w-[3.5rem] min-h-[52px] justify-center
                  ${active ? 'text-[#1d1d1f]' : 'text-[#aeaeb2]'}`}
                style={{ transition: 'all 0.35s var(--ease-spring)' }}
              >
                <div className="relative" style={{ transition: 'transform 0.35s var(--ease-spring)' }}>
                  {mobileIcon}
                  {active && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1d1d1f]"
                         style={{ boxShadow: '0 0 4px rgba(0,0,0,0.15)' }} />
                  )}
                </div>
                <span className={`text-[10px] font-medium leading-none mt-0.5 ${active ? 'text-[#1d1d1f]' : 'text-[#aeaeb2]'}`}>
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
