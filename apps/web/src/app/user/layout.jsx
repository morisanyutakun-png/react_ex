export const metadata = {
  title: 'つくる — REM',
};

export default function UserLayout({ children }) {
  return (
    <main className="pb-8 min-h-screen bg-[#fafafa] text-[#1d1d1f]">{children}</main>
  );
}
