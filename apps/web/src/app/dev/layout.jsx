export const metadata = {
  title: '高める — REM',
};

export default function DevLayout({ children }) {
  return (
    <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-8">{children}</main>
  );
}
