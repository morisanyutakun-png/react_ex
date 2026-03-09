import './globals.css';
import Header from '@/components/Header';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata = {
  title: 'REM — Rapid Exam Maker',
  description: '次世代試験問題生成プラットフォーム',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
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
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
          document.addEventListener('gesturechange', function(e) { e.preventDefault(); });
          document.addEventListener('gestureend', function(e) { e.preventDefault(); });
        `}} />
      </head>
      <body className="min-h-screen bg-[#f8faff] text-[#1e293b] selection:bg-blue-500/[0.15] selection:text-[#1e293b]">
        <AuthProvider>
          <BrandingProvider>
            <Header />
            {children}
          </BrandingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
