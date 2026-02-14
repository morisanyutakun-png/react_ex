import React, { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

/* ============================
   Icons (Heroicons style simple SVG)
   ============================ */
const Icons = {
  Check: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  ChevronRight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
  Upload: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>,
  Copy: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
  File: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>,
  Sparkles: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>,
}

/* ============================
   Component: Toast
   ============================ */
const Toast = ({ msg, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer) }, [onClose])
  return <div className={`toast ${type}`}>
    {type === 'success' && <Icons.Check />}
    <span>{msg}</span>
  </div>
}

/* ============================
   Main Application
   ============================ */
export default function App() {
  const [mode, setMode] = useState('user') // 'user' | 'dev'
  const [status, setStatus] = useState(null) // { msg, type }

  // Data State
  const [templates, setTemplates] = useState([])
  const [subjects, setSubjects] = useState(['数学', '物理', '英語', '化学', '生物', '情報'])
  const [difficulties] = useState(['易', '普通', '難'])

  // User Mode State
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    templateId: '', subject: '数学', difficulty: '普通', numQuestions: 3, sourceText: '', fileName: ''
  })
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [ragContext, setRagContext] = useState(null)
  const [llmOutput, setLlmOutput] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(false)

  // Dev Mode State (Simplified for this rewrite, keeping core logic)
  const [devState, setDevState] = useState({ templateId: '', subject: '数学', difficulty: '普通', numQuestions: 1, prompt: '', output: '' })

  /* ============================
     Effects & Helpers
     ============================ */
  const notify = (msg, type = 'info') => setStatus({ msg, type })

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      if (res.ok) {
        setTemplates(data.templates || [])
        // Auto-select first template
        if (data.templates?.length > 0 && !formData.templateId) {
          setFormData(prev => ({ ...prev, templateId: data.templates[0].id }))
        }
      }
    } catch (e) { console.error(e) }
  }, [formData.templateId])

  useEffect(() => { fetchTemplates() }, [])

  /* ============================
     User Mode Actions
     ============================ */
  const handleGeneratePrompt = async () => {
    if (!formData.templateId) return notify('テンプレートを選択してください', 'error')
    setLoading(true)
    try {
      const body = {
        template_id: formData.templateId,
        subject: formData.subject,
        difficulty: formData.difficulty,
        num_questions: formData.numQuestions,
        rag_inject: true,
        source_text: formData.sourceText || undefined,
        user_mode: true
      }
      const res = await fetch('/api/template_render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (res.ok) {
        setGeneratedPrompt(data.rendered_prompt || data.rendered)
        setRagContext(data.context)
        setStep(2)
        notify('プロンプトを生成しました', 'success')
      } else {
        notify('生成エラー: ' + (data.detail || res.statusText), 'error')
      }
    } catch (e) { notify('通信エラー', 'error') }
    setLoading(false)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/extract_text', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setFormData(prev => ({ ...prev, sourceText: data.extracted_text, fileName: data.filename }))
        notify('テキストを抽出しました', 'success')
      } else {
        notify('抽出失敗: ' + data.detail, 'error')
      }
    } catch (e) { notify('アップロードエラー', 'error') }
    setLoading(false)
  }

  const handleGeneratePdf = async () => {
    if (!llmOutput.trim()) return notify('LaTeXを入力してください', 'error')
    setLoading(true)
    try {
      const res = await fetch('/api/generate_pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex: llmOutput, title: 'Generated Problem', return_url: true })
      })
      if (res.ok) {
        const data = await res.json()
        const url = data.pdf_url || URL.createObjectURL(await res.blob())
        setPdfUrl(url)
        setStep(4)
        notify('PDFを作成しました', 'success')
      } else {
        notify('PDF生成失敗', 'error')
      }
    } catch (e) { notify('PDF生成エラー', 'error') }
    setLoading(false)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt)
      notify('コピーしました', 'success')
    } catch (e) { notify('コピーに失敗しました', 'error') }
  }

  /* ============================
     Render Logic
     ============================ */
  return (
    <div className="app-container">
      {status && <Toast msg={status.msg} type={status.type} onClose={() => setStatus(null)} />}

      <header className="app-header">
        <div className="brand">
          <div className="brand-icon"><Icons.Sparkles /></div>
          <div className="brand-text">
            <h1>類題生成アプリ</h1>
            <p>Smart Problem Generator</p>
          </div>
        </div>
        <div className="mode-switch">
          <button className={`mode-btn ${mode === 'user' ? 'active' : ''}`} onClick={() => setMode('user')}>ユーザー</button>
          <button className={`mode-btn ${mode === 'dev' ? 'active' : ''}`} onClick={() => setMode('dev')}>開発者</button>
        </div>
      </header>

      {mode === 'user' ? (
        <div className="wizard-container fade-in">
          {/* Progress Indicator */}
          <div className="wizard-progress">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`step-indicator ${step === s ? 'active' : ''} ${step > s ? 'done' : ''}`} onClick={() => step > s && setStep(s)}>
                <div className="step-circle">{step > s ? <Icons.Check /> : s}</div>
                <div className="step-label">
                  {s === 1 ? '設定' : s === 2 ? 'プロンプト' : s === 3 ? '生成' : '完了'}
                </div>
              </div>
            ))}
          </div>

          {/* STEP 1: Settings */}
          {step === 1 && (
            <div className="card-main slide-in">
              <h2 className="card-title">問題設定</h2>
              <p className="card-subtitle">生成したい問題の条件を指定してください</p>

              <div className="form-grid">
                <div className="form-group">
                  <label>テンプレート</label>
                  <select className="form-select" value={formData.templateId} onChange={e => setFormData({ ...formData, templateId: e.target.value })}>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>科目</label>
                  <select className="form-select" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })}>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>難易度</label>
                  <select className="form-select" value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value })}>
                    {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>問題数</label>
                  <input type="number" className="form-input" min="1" max="10" value={formData.numQuestions} onChange={e => setFormData({ ...formData, numQuestions: Number(e.target.value) })} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 32 }}>
                <label>元となる問題ファイル（任意）</label>
                <div className="upload-zone" onClick={() => document.getElementById('file-upload').click()}>
                  <input id="file-upload" type="file" hidden accept=".pdf,.txt,.tex" onChange={handleFileUpload} />
                  <span className="upload-icon"><Icons.Upload /></span>
                  {formData.fileName ? (
                    <div style={{ color: 'var(--pk-success)', fontWeight: 600 }}>
                      <Icons.File /> {formData.fileName} <span style={{ fontSize: 12, color: '#888' }}>(抽出済み)</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--pk-text-light)' }}>
                      クリックしてファイルをアップロード<br />
                      <span style={{ fontSize: 12 }}>PDF, Text, LaTeX 対応</span>
                    </span>
                  )}
                </div>
              </div>

              <button className="btn btn-primary btn-full" onClick={handleGeneratePrompt} disabled={loading}>
                {loading ? <div className="spinner" /> : '次へ進む'}
              </button>
            </div>
          )}

          {/* STEP 2: Prompt Check */}
          {step === 2 && (
            <div className="card-main slide-in">
              <h2 className="card-title">プロンプト確認</h2>
              <p className="card-subtitle">以下のプロンプトをコピーして、LLMに入力してください</p>

              <div className="prompt-box">
                {generatedPrompt}
              </div>

              {ragContext?.chunk_count > 0 && (
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <span className="tag">📚 {ragContext.chunk_count}件の参考資料が含まれています</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)}>戻る</button>
                <button className="btn btn-primary" onClick={() => { copyToClipboard(); setStep(3) }}>
                  <Icons.Copy /> コピーして次へ
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Llm Output */}
          {step === 3 && (
            <div className="card-main slide-in">
              <h2 className="card-title">LaTeX 貼り付け</h2>
              <p className="card-subtitle">LLMから出力されたLaTeXコードをここに貼り付けてください</p>

              <textarea
                className="form-input"
                style={{ height: 300, fontFamily: 'monospace', resize: 'vertical', marginBottom: 24 }}
                placeholder="\documentclass{article}..."
                value={llmOutput}
                onChange={e => setLlmOutput(e.target.value)}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)}>戻る</button>
                <button className="btn btn-primary" onClick={handleGeneratePdf} disabled={loading || !llmOutput.trim()}>
                  {loading ? <div className="spinner" /> : 'PDF を生成する'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Result */}
          {step === 4 && (
            <div className="card-main slide-in" style={{ textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, background: '#D4EFDF', borderRadius: '50%', color: '#27AE60', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <h2 className="card-title">作成完了！</h2>
              <p className="card-subtitle">問題PDFが正常に生成されました</p>

              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 32 }}>
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                  PDF を開く
                </a>
                <button className="btn btn-secondary" onClick={() => { setStep(1); setFormData({ ...formData, sourceText: '', fileName: '' }); setLlmOutput(''); setPdfUrl('') }}>
                  最初に戻る
                </button>
              </div>
            </div>
          )}

        </div>
      ) : (
        /* ============================
           Dev Mode (Classic View)
           ============================ */
        <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
          <div className="card-main">
            <h2 className="card-title">開発者モード</h2>
            <p className="card-subtitle" style={{ marginBottom: 20 }}>RAGパイプラインの詳細テストとチューニング</p>
            <div style={{ padding: 20, background: '#FEF9E7', borderRadius: 8, color: '#9A7D0A', fontSize: 14 }}>
              <Icons.Sparkles /> 従来の多機能ダッシュボードは現在メンテナンス中です。基本的な機能はユーザーモードをご利用ください。
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setMode('user')}>ユーザーモードに戻る</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
