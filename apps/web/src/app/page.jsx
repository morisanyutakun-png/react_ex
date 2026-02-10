import Link from 'next/link'

export default function Home() {
  return (
    <div>
      <h1>Segments</h1>
      <p>Minimal UI: go to <Link href="/segments">segments list</Link></p>
    </div>
  )
}
