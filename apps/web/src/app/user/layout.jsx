export const metadata = {
  title: 'つくる — REM',
};

export default function UserLayout({ children }) {
  return (
    <main className="pb-8 bg-[#f7f9f8] min-h-screen text-[#1a2e23]">{children}</main>
  );
}
