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
      <body className="min-h-screen bg-black text-[#f5f5f7] selection:bg-[#fa2d48]/20 selection:text-white">
        <Header />
        {children}
      </body>
    </html>
  );
}
