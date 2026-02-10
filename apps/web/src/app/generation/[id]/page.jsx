"use client"
import { useState, useEffect } from 'react'

export default function GenerationEvalPage({ params }){
  const id = params.id
  const [axes, setAxes] = useState({concept:3, steps:3, compute:3, trick:3})
  const [overall, setOverall] = useState(3)
  const [notes, setNotes] = useState('')
  const [isUsable, setIsUsable] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  async function submitEval(){
    setSaving(true); setMessage(null)
    try{
      const body = { axes, overall, notes, is_usable: isUsable }
      const res = await fetch(`/api/generation_runs/${id}/evals`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      })
      if(!res.ok){
        const txt = await res.text()
        throw new Error(`save failed: ${res.status} ${txt}`)
      }
      const j = await res.json()
      setMessage({type:'success', text:'評価を保存しました'})
    }catch(e){
      setMessage({type:'error', text: e.message})
    }finally{ setSaving(false) }
  }

  return (
    <div>
      <h2>Generation Run {id} — 評価送信</h2>
      <div style={{maxWidth:680}}>
        <div>
          <label>Concept: <input type="number" min={1} max={5} value={axes.concept} onChange={(e)=>setAxes({...axes, concept: Number(e.target.value)})} /></label>
        </div>
        <div>
          <label>Steps: <input type="number" min={1} max={5} value={axes.steps} onChange={(e)=>setAxes({...axes, steps: Number(e.target.value)})} /></label>
        </div>
        <div>
          <label>Compute: <input type="number" min={1} max={5} value={axes.compute} onChange={(e)=>setAxes({...axes, compute: Number(e.target.value)})} /></label>
        </div>
        <div>
          <label>Trick: <input type="number" min={1} max={5} value={axes.trick} onChange={(e)=>setAxes({...axes, trick: Number(e.target.value)})} /></label>
        </div>
        <div>
          <label>Overall: <input type="number" min={1} max={5} value={overall} onChange={(e)=>setOverall(Number(e.target.value))} /></label>
        </div>
        <div>
          <label>Usable: <input type="checkbox" checked={isUsable} onChange={(e)=>setIsUsable(e.target.checked)} /></label>
        </div>
        <div>
          <label>Notes:</label>
          <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} style={{width:'100%',minHeight:100}} />
        </div>
        <div style={{marginTop:8}}>
          <button onClick={submitEval} disabled={saving}>送信</button>
        </div>
        {message && <div style={{marginTop:8, background: message.type==='error' ? '#ffe6e6' : '#e6ffed', padding:8}}>{message.text}</div>}
      </div>
    </div>
  )
}
