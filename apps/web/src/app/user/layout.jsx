import Header from '@/components/Header';

export const metadata = {
  title: 'つくる — REM',
};

export default function UserLayout({ children }) {
  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 sm:pb-8">{children}</main>
    </>
  );
}
