import Header from '@/components/Header';

export const metadata = {
  title: '問題検索 — ExamGen RAG',
};

export default function SearchLayout({ children }) {
  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </>
  );
}
