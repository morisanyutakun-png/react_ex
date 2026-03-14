export const metadata = {
  title: 'つくる — REM',
};

export default function UserLayout({ children }) {
  return (
    <main className="pb-8 bg-gradient-to-b from-[#a7f3d0] via-[#d1fae5] to-[#ecfdf5] min-h-screen text-[#1a2e23]">{children}</main>
  );
}
