import './globals.css';

export const metadata = {
  title: 'ExamGen RAG — Pro Edition',
  description: 'RAG ベースの試験問題生成・チューニングプラットフォーム',
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
      <body className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
        <div className="fixed inset-0 pointer-events-none -z-10">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-200/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-200/10 blur-[120px] rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        </div>
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
