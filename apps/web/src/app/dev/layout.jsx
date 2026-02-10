import Header from '@/components/Header';

export const metadata = {
  title: '開発モード — ExamGen RAG',
};

export default function DevLayout({ children }) {
  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </>
  );
}
