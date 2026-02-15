import React, { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

/* ────────────────────────────────────────────
   SVG Icons (inline, no dep needed)
   ──────────────────────────────────────────── */
const Ico = {
  Check: (p) => <svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Copy: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Upload: () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  FileText: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  ArrowRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  ArrowLeft: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  ExternalLink: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  RotateCcw: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
  Star: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
}

/* ────────────────────────────────────────────
   Toast Component
   ──────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="toast-wrap">
      <div className={`toast ${type}`}>
        {type === 'success' && <Ico.Check />}
        {type === 'error' && <span style={{fontSize:16}}>✕</span>}
        {type === 'info' && <span style={{fontSize:16}}>ℹ</span>}
        <span>{msg}</span>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   Loading Overlay
   ──────────────────────────────────────────── */
function LoadingOverlay({ text }) {
  return (
    <div className="loading-overlay">
      <div className="spinner" />
      <div className="loading-text">{text || '処理中...'}</div>
    </div>
  )
}

/* ════════════════════════════════════════════
   Main Application
   ════════════════════════════════════════════ */
export default function App() {
  const [mode, setMode] = useState('user')
  const [toast, setToast] = useState(null)

  // Data
  const [templates, setTemplates] = useState([])
  const [subjects] = useState(['数学', '物理', '英語', '化学', '生物', '情報'])
  const [difficulties] = useState(['易', '普通', '難'])

  // Wizard state
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    templateId: '', subject: '数学', difficulty: '普通', numQuestions: 3,
    sourceText: '', fileName: '',
  })
  const [prompt, setPrompt] = useState('')
  const [ragCtx, setRagCtx] = useState(null)
  const [llmOutput, setLlmOutput] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const notify = (msg, type = 'info') => setToast({ msg, type })
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))

  /* ── Fetch templates ── */
  const fetchTemplates = useCallback(async () => {
    try {
      const r = await fetch('/api/templates')
      const d = await r.json()
      if (r.ok && d.templates?.length) {
        setTemplates(d.templates)
        if (!form.templateId) upd('templateId', d.templates[0].id)
      }
    } catch (e) { console.error(e) }
  }, [])
  useEffect(() => { fetchTemplates() }, [])

  /* ── Step 1 → 2 : Generate prompt ── */
  const generatePrompt = async () => {
    if (!form.templateId) return notify('テンプレートを選んでください', 'error')
    setLoading(true); setLoadingMsg('プロンプトを生成中...')
    try {
      const body = {
        template_id: form.templateId,
        subject: form.subject,
        difficulty: form.difficulty,
        num_questions: form.numQuestions,
        rag_inject: true,
        source_text: form.sourceText || undefined,
        user_mode: true,
      }
      const r = await fetch('/api/template_render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (r.ok) {
        setPrompt(d.rendered_prompt || d.rendered)
        setRagCtx(d.context)
        setStep(2)
        notify('プロンプト生成完了', 'success')
      } else {
        notify('エラー: ' + (d.detail || r.statusText), 'error')
      }
    } catch { notify('通信エラー', 'error') }
    setLoading(false)
  }

  /* ── File upload (extract text) ── */
  const uploadFile = async (file) => {
    if (!file) return
    setLoading(true); setLoadingMsg('テキストを抽出中...')
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await fetch('/api/extract_text', { method: 'POST', body: fd })
      const d = await r.json()
      if (r.ok) {
        setForm(p => ({ ...p, sourceText: d.extracted_text, fileName: d.filename || file.name }))
        notify(`${d.filename || file.name} からテキストを抽出しました`, 'success')
      } else {
        notify('抽出失敗: ' + (d.detail || ''), 'error')
      }
    } catch { notify('アップロードエラー', 'error') }
    setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); uploadFile(e.dataTransfer.files?.[0]) }
  const onDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)

  /* ── Copy prompt ── */
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); notify('クリップボードにコピーしました', 'success') }
    catch { notify('コピー失敗', 'error') }
  }

  /* ── Step 3 → 4 : Generate PDF ── */
  const generatePdf = async () => {
    if (!llmOutput.trim()) return notify('LaTeXコードを貼り付けてください', 'error')
    setLoading(true); setLoadingMsg('PDFを生成中...')
    try {
      const r = await fetch('/api/generate_pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex: llmOutput, title: 'Generated Problem', return_url: true }),
      })
      if (r.ok) {
        const d = await r.json().catch(() => null)
        const url = d?.pdf_url || URL.createObjectURL(await r.blob())
        setPdfUrl(url)
        setStep(4)
        notify('PDFを作成しました！', 'success')
      } else {
        const d = await r.json().catch(() => null)
        notify('PDF生成失敗: ' + (d?.detail || d?.error || ''), 'error')
      }
    } catch { notify('PDF生成エラー', 'error') }
    setLoading(false)
  }

  /* ── Reset wizard ── */
  const resetWizard = () => {
    setStep(1); setPrompt(''); setRagCtx(null); setLlmOutput(''); setPdfUrl('')
    setForm(p => ({ ...p, sourceText: '', fileName: '' }))
  }

  /* ════════════════════════════════════════
     STEP Names for progress bar
     ════════════════════════════════════════ */
  const STEPS = [
    { n: 1, label: '問題設定' },
    { n: 2, label: 'AIに依頼', sub: '外部AI使用' },
    { n: 3, label: '結果を入力' },
    { n: 4, label: 'PDF完成' },
  ]

  /* ════════════════════════════════════════
     RENDER
     ════════════════════════════════════════ */
  return (
    <div className="app-shell">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {loading && <LoadingOverlay text={loadingMsg} />}

      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-mark"><Ico.Star /></div>
            <div>
              <div className="logo-text">類題生成</div>
              <div className="logo-sub">Smart Problem Generator</div>
            </div>
          </div>
          <div className="mode-toggle">
            <button className={mode === 'user' ? 'active' : ''} onClick={() => setMode('user')}>ユーザー</button>
            <button className={mode === 'dev' ? 'active' : ''} onClick={() => setMode('dev')}>開発者</button>
          </div>
        </div>
      </header>

      <div className="main-content">

        {mode === 'user' ? (
          <>
            {/* ── FLOW OVERVIEW ── */}
            <div className="flow-overview">
              <span>条件設定</span>
              <span className="flow-arrow">→</span>
              <span>プロンプトコピー</span>
              <span className="flow-arrow">→</span>
              <span className="flow-external">★ ChatGPT / Claude に貼付（外部）</span>
              <span className="flow-arrow">→</span>
              <span>結果貼り付け</span>
              <span className="flow-arrow">→</span>
              <span>PDF完成</span>
            </div>

            {/* ── PROGRESS BAR ── */}
            <div className="progress-bar">
              {STEPS.map((s, i) => (
                <React.Fragment key={s.n}>
                  <div
                    className={`progress-step ${step === s.n ? 'active' : ''} ${step > s.n ? 'done clickable' : ''}`}
                    onClick={() => step > s.n && setStep(s.n)}
                  >
                    <div className="progress-dot">
                      {step > s.n ? <Ico.Check s={14} /> : s.n}
                    </div>
                    <div className="progress-name">{s.label}</div>
                    {s.sub && <div className="progress-sub">{s.sub}</div>}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`progress-line ${step > s.n ? 'filled' : ''}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* ══════════════════════════════════
                STEP 1 — 問題設定
               ══════════════════════════════════ */}
            {step === 1 && (
              <div className="card anim-fade-up">
                <div className="card-header">
                  <span className="card-emoji">📝</span>
                  <div className="card-title">問題の条件を設定</div>
                  <div className="card-desc">AIへ送るプロンプトを作成します</div>
                </div>

                <div className="tip">
                  <span className="tip-icon">💡</span>
                  <div>初めての方：下の項目を選んで<strong>「プロンプト生成」</strong>を押すだけ！<br />ファイルアップロードは任意です。</div>
                </div>

                <div className="form-row form-row-2" style={{marginBottom:16}}>
                  <div className="field">
                    <label className="field-label">テンプレート</label>
                    <select className="select" value={form.templateId} onChange={e => upd('templateId', e.target.value)}>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">科目</label>
                    <select className="select" value={form.subject} onChange={e => upd('subject', e.target.value)}>
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-row form-row-2" style={{marginBottom:20}}>
                  <div className="field">
                    <label className="field-label">難易度</label>
                    <select className="select" value={form.difficulty} onChange={e => upd('difficulty', e.target.value)}>
                      {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">問題数</label>
                    <input className="input" type="number" min={1} max={10} value={form.numQuestions}
                      onChange={e => upd('numQuestions', Number(e.target.value))} />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">参照ファイル（任意）</label>
                  <div
                    className={`upload-area ${form.fileName ? 'has-file' : ''} ${dragOver ? 'drag-over' : ''}`}
                    onClick={() => fileRef.current?.click()}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                  >
                    <input ref={fileRef} type="file" accept=".pdf,.txt,.tex,.md,.json" onChange={e => uploadFile(e.target.files?.[0])} />
                    <div className="upload-icon"><Ico.Upload /></div>
                    {form.fileName ? (
                      <>
                        <div className="upload-file-name">
                          <Ico.FileText /> {form.fileName}
                          <button className="upload-clear" onClick={e => { e.stopPropagation(); setForm(p => ({...p, sourceText:'', fileName:''})) }}>×</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="upload-label"><strong>タップ</strong>または<strong>ドラッグ＆ドロップ</strong></div>
                        <div className="upload-formats">PDF / テキスト / LaTeX 対応</div>
                      </>
                    )}
                  </div>
                  <div className="field-hint">似た形式の問題を作りたい場合、元の問題ファイルをアップロードすると精度が上がります</div>
                </div>

                <button className="btn btn-primary btn-block" style={{marginTop:8}} onClick={generatePrompt} disabled={loading || !form.templateId}>
                  プロンプトを生成 <Ico.ArrowRight />
                </button>
              </div>
            )}

            {/* ══════════════════════════════════
                STEP 2 — プロンプトをコピー
               ══════════════════════════════════ */}
            {step === 2 && (
              <div className="card anim-fade-up">
                <div className="card-header">
                  <span className="card-emoji">📋</span>
                  <div className="card-title">プロンプトをコピーしてAIに依頼</div>
                  <div className="card-desc">外部のAI（ChatGPT・Claude等）を使ってLaTeXコードを生成します</div>
                </div>

                <div className="instruction-steps">
                  <div className="instruction-step">
                    <span className="instruction-num">1</span>
                    <div>下の<strong>「プロンプトをコピー」</strong>ボタンでコピー</div>
                  </div>
                  <div className="instruction-step">
                    <span className="instruction-num">2</span>
                    <div>外部AIを開いて貼り付け、実行する</div>
                  </div>
                  <div className="instruction-step">
                    <span className="instruction-num">3</span>
                    <div>AIの出力（LaTeXコード）をコピーしておく</div>
                  </div>
                </div>

                <div className="prompt-preview">{prompt}</div>

                {ragCtx?.chunk_count > 0 && (
                  <div style={{textAlign:'center', marginBottom:16}}>
                    <span className="rag-badge">📚 {ragCtx.chunk_count}件の類似問題を参照しています</span>
                  </div>
                )}

                <div style={{marginBottom:16}}>
                  <button className="btn btn-primary btn-block" onClick={copyPrompt}>
                    <Ico.Copy /> プロンプトをコピー
                  </button>
                </div>

                <div style={{display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginBottom:20}}>
                  <a href="https://chat.openai.com/" target="_blank" rel="noreferrer" className="ai-link">
                    <Ico.ExternalLink /> ChatGPT を開く
                  </a>
                  <a href="https://claude.ai/" target="_blank" rel="noreferrer" className="ai-link">
                    <Ico.ExternalLink /> Claude を開く
                  </a>
                </div>

                <div className="btn-row btn-row-2">
                  <button className="btn btn-outline" onClick={() => setStep(1)}>
                    <Ico.ArrowLeft /> 戻る
                  </button>
                  <button className="btn btn-success" onClick={() => setStep(3)}>
                    AIの出力を受け取った → 次へ <Ico.ArrowRight />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════
                STEP 3 — LaTeX 貼り付け → PDF生成
               ══════════════════════════════════ */}
            {step === 3 && (
              <div className="card anim-fade-up">
                <div className="card-header">
                  <span className="card-emoji">✨</span>
                  <div className="card-title">LLMの出力を貼り付け</div>
                  <div className="card-desc">LLMが生成したLaTeXコードをそのまま貼り付けてPDFを作成します</div>
                </div>

                <div className="tip">
                  <span className="tip-icon">📌</span>
                  <div>ChatGPT/Claude の出力をまるごとコピーして、下のテキストエリアに貼り付けてください。<br /><code>\documentclass</code> から <code>\end{'{document}'}</code> まで全体を含めてOKです。<br />※ コードブロック記号（<code>```</code>）は不要です。LaTeXコードのみ貼り付けてください。</div>
                </div>

                <div className="field">
                  <label className="field-label">LaTeX コード（AIの出力）</label>
                  <textarea
                    className="input"
                    style={{ height: 280, fontFamily: "'SF Mono','Fira Code','Consolas',monospace", fontSize: 12 }}
                    placeholder={"\\documentclass{article}\n\\begin{document}\n...\n\\end{document}"}
                    value={llmOutput}
                    onChange={e => setLlmOutput(e.target.value)}
                  />
                </div>

                <div className="btn-row btn-row-2">
                  <button className="btn btn-outline" onClick={() => setStep(2)}>
                    <Ico.ArrowLeft /> 戻る
                  </button>
                  <button className="btn btn-success" onClick={generatePdf} disabled={loading || !llmOutput.trim()}>
                    PDF を生成 <Ico.ArrowRight />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════
                STEP 4 — 完了
               ══════════════════════════════════ */}
            {step === 4 && (
              <div className="card anim-fade-up">
                <div className="success-screen">
                  <div className="success-icon">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div className="card-title" style={{fontSize:22, marginBottom:8}}>PDF作成完了！🎉</div>
                  <div className="card-desc" style={{marginBottom:32}}>
                    問題PDFが正常に生成されました。<br />
                    下のボタンからダウンロード・閲覧できます。
                  </div>
                  <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
                    <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-success">
                      <Ico.ExternalLink /> PDFを開く
                    </a>
                    <button className="btn btn-outline" onClick={resetWizard}>
                      <Ico.RotateCcw /> もう一度作る
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── DEV MODE ── */
          <div className="card anim-fade-up" style={{marginTop:8}}>
            <div className="card-header">
              <span className="card-emoji">🛠️</span>
              <div className="card-title">開発者モード</div>
              <div className="card-desc">RAGパイプラインの詳細テストとチューニング</div>
            </div>
            <div className="dev-notice">
              従来の多機能ダッシュボードは現在メンテナンス中です。<br />
              基本的な機能は「ユーザー」モードをご利用ください。
            </div>
            <button className="btn btn-primary" onClick={() => setMode('user')}>
              ユーザーモードに切り替え
            </button>
          </div>
        )}
      </div>
    </div>
  )
}