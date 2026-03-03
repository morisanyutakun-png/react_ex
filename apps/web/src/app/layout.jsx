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
        {/* Floating geometric shapes */}
        <div aria-hidden="true">
          <div className="geo-float geo-float-triangle" />
          <div className="geo-float geo-float-circle" />
          <div className="geo-float geo-float-diamond" />
          <div className="geo-float geo-float-cross" />
        </div>
        {/* Wave decoration */}
        <div className="wave-decoration" aria-hidden="true">
          <svg viewBox="0 0 1440 200" preserveAspectRatio="none" fill="none">
            <path d="M0,120 C240,180 480,60 720,120 C960,180 1200,60 1440,120 C1680,180 1920,60 2160,120 C2400,180 2640,60 2880,120 L2880,200 L0,200 Z" fill="rgba(37,99,235,0.4)" />
            <path d="M0,140 C240,100 480,180 720,140 C960,100 1200,180 1440,140 C1680,100 1920,180 2160,140 C2400,100 2640,180 2880,140 L2880,200 L0,200 Z" fill="rgba(99,102,241,0.3)" />
          </svg>
        </div>
        <Header />
        {children}
      </body>
    </html>
  );
}
