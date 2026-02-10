import './globals.css'

export const metadata = {
  title: 'Segments',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <div style={{ padding: 16 }}>{children}</div>
      </body>
    </html>
  )
}
