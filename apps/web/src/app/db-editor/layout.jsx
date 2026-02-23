import Header from '@/components/Header';

export const metadata = {
  title: 'DB編集 — ExamGen RAG',
};

export default function DbEditorLayout({ children }) {
  return (
    <>
      <Header />
      <main className="py-8">{children}</main>
    </>
  );
}
