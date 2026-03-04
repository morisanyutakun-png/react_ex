import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: 'REM — Rapid Exam Maker',
  description: '次世代試験問題生成プラットフォーム',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#f8faff] text-[#1e293b] selection:bg-blue-500/[0.15] selection:text-[#1e293b]">
        {/* Ambient floating orbs */}
        <div className="ambient-orbs" aria-hidden="true">
          <div className="ambient-orb ambient-orb-1" />
          <div className="ambient-orb ambient-orb-2" />
          <div className="ambient-orb ambient-orb-3" />
          <div className="ambient-orb ambient-orb-4" />
          <div className="ambient-orb ambient-orb-5" />
          <div className="ambient-orb ambient-orb-6" />
          <div className="ambient-orb ambient-orb-7" />
        </div>
        {/* Geometric mesh overlay */}
        <div className="geo-mesh-overlay" aria-hidden="true" />
        {/* Circuit trace decorations */}
        <div aria-hidden="true">
          <div className="circuit-trace circuit-trace-1" />
          <div className="circuit-trace circuit-trace-2" />
          <div className="circuit-trace circuit-trace-3" />
          <div className="circuit-trace circuit-trace-4" />
        </div>
        {/* Bottom horizon line */}
        <div className="wave-decoration" aria-hidden="true" />
        <Header />
        {children}
      </body>
    </html>
  );
}
