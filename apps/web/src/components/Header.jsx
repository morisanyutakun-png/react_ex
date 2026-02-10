'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/ui';

const NAV_ITEMS = [
  { href: '/', label: 'ホーム', icon: <Icons.Home className="w-4 h-4" /> },
  { href: '/user', label: 'ユーザ', icon: <Icons.User className="w-4 h-4" /> },
  { href: '/dev', label: '開発', icon: <Icons.Dev className="w-4 h-4" /> },
  { href: '/data', label: 'データ', icon: <Icons.Data className="w-4 h-4" /> },
  { href: '/search', label: '検索', icon: <Icons.Search className="w-4 h-4" /> },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="glass-card sticky top-0 z-50 border-b border-white/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white shadow-indigo-200 shadow-lg">
              <Icons.Book className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold gradient-text">
              ExamGen RAG
            </span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map(({ href, label, icon }) => {
              const active =
                href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-1.5
                    ${active
                      ? 'bg-white/80 text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'
                    }`}
                >
                  {icon}
                  {label}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-indigo-500" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
