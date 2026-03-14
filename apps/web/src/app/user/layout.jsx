export const metadata = {
  title: 'つくる — REM',
};

export default function UserLayout({ children }) {
  return (
    <main className="pb-8 bg-gradient-to-b from-[#ecfdf5] via-[#f0fdf4] to-[#f7fdf9] min-h-screen text-[#1a2e23]">{children}</main>
  );
}
