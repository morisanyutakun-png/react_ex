import Header from '@/components/Header';

export const metadata = {
  title: 'ユーザモード — ExamGen RAG',
};

export default function UserLayout({ children }) {
  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </>
  );
}
