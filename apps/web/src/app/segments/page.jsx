import { useState } from 'react'
import Link from 'next/link'

export default function SegmentsPage() {
  const [id, setId] = useState('')

  return (
    <div>
      <h2>Segments (minimal)</h2>
      <p>This is a minimal list. Enter a segment id to open detail.</p>
      <input value={id} onChange={(e)=>setId(e.target.value)} placeholder="segment id" />
      <Link href={`/segments/${id}`}>
        <button style={{marginLeft:8}}>Open</button>
      </Link>
      <p style={{marginTop:12}}>If you have a segments listing API, it can be wired here.</p>
    </div>
  )
}
