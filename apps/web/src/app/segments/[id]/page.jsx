"use client"
import { useEffect, useState } from 'react'
import { getAnnotation, saveAnnotation } from '../../../lib/api'

function defaultTemplate(segmentId){
  return {
    segment_id: segmentId,
    schema_version: '1.0',
    payload: { tags: [], notes: '', difficulty: null }
  }
}

export default function SegmentDetail({ params }){
  const id = params.id
  const [segmentText, setSegmentText] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [parsedOk, setParsedOk] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(()=>{
    // Try fetch annotation
    let mounted = true
    getAnnotation(id).then(j=>{
      if(!mounted) return
      setJsonText(JSON.stringify(j.payload ?? j.payload ?? j, null, 2))
    }).catch(err=>{
      // no annotation: insert template
      setJsonText(JSON.stringify(defaultTemplate(Number(id)), null, 2))
    })

    // try to fetch segment text from server route if exists
    fetch(`/segments/${id}/content`).then(r=>{
      if(!r.ok) return null
      return r.text()
    }).then(t=>{
      if(t) setSegmentText(t)
    }).catch(()=>{})

    return ()=>{ mounted=false }
  },[id])

  useEffect(()=>{
    try{
      JSON.parse(jsonText)
      setParsedOk(true)
    }catch(e){
      setParsedOk(false)
    }
  },[jsonText])

  async function onSave(){
    setSaving(true)
    setMessage(null)
    try{
      const obj = JSON.parse(jsonText)
      const body = {
        payload: obj.payload ?? obj,
        schema_version: obj.schema_version ?? '1.0',
        created_by: obj.created_by ?? null
      }
      const res = await saveAnnotation(id, body)
      setMessage({ type: 'success', text: 'Saved (rev '+res.revision+')' })
      const ann = await getAnnotation(id)
      setJsonText(JSON.stringify(ann.payload ?? ann, null, 2))
    }catch(e){
      setMessage({ type: 'error', text: e.message })
    }finally{
      setSaving(false)
    }
  }

  return (
    <div>
      <h2>Segment {id}</h2>
      <div className="container">
        <div className="left">
          <h3>Segment text</h3>
          <div style={{whiteSpace:'pre-wrap',border:'1px solid #ddd',padding:8,minHeight:300}}>
            {segmentText || <em>No segment content available. Paste text below and save as needed.</em>}
          </div>
        </div>
        <div className="right">
          <h3>Annotation (JSON)</h3>
          <textarea className="textarea" value={jsonText} onChange={(e)=>setJsonText(e.target.value)} />
          <div>
            <button className="btn" onClick={onSave} disabled={!parsedOk || saving}>Save</button>
            <button className="btn" onClick={()=>{ setJsonText(JSON.stringify(defaultTemplate(Number(id)), null, 2)) }} style={{marginLeft:8}}>Reset Template</button>
          </div>
          {!parsedOk && <div style={{color:'red',marginTop:8}}>JSON が不正です。修正してください。</div>}
          {message && <div className="toast" style={{background: message.type==='error'? '#ffe6e6' : '#e6ffed'}}>{message.text}</div>}
        </div>
      </div>
    </div>
  )
}
