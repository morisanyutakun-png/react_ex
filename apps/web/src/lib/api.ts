export async function getAnnotation(segmentId) {
  const res = await fetch(`/segments/${segmentId}/annotation`)
  if (!res.ok) {
    const txt = await res.text()
    const err = new Error(`Failed to fetch annotation: ${res.status}`)
    err.status = res.status
    err.body = txt
    throw err
  }
  return res.json()
}

export async function saveAnnotation(segmentId, body) {
  const res = await fetch(`/segments/${segmentId}/annotation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    const err = new Error(`Failed to save annotation: ${res.status}`)
    err.status = res.status
    err.body = txt
    throw err
  }
  return res.json()
}
