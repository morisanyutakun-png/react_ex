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
  Help: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
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
  const [latexPresets, setLatexPresets] = useState([])
  const [fields, setFields] = useState([])

  // Wizard state
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    templateId: '', subject: '数学', difficulty: '普通', numQuestions: 3,
    sourceText: '', fileName: '', latexPreset: 'exam', fieldFilter: '',
  })
  const [prompt, setPrompt] = useState('')
  const [ragCtx, setRagCtx] = useState(null)
  const [llmOutput, setLlmOutput] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
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

  /* ── Fetch LaTeX presets ── */
  const fetchPresets = useCallback(async () => {
    try {
      const r = await fetch('/api/latex_presets')
      const d = await r.json()
      if (r.ok && d.presets?.length) {
        setLatexPresets(d.presets)
      }
    } catch (e) { console.error(e) }
  }, [])

  /* ── Fetch fields ── */
  const fetchFields = useCallback(async () => {
    try {
      const r = await fetch('/api/fields')
      const d = await r.json()
      if (r.ok && d.fields?.length) {
        setFields(d.fields)
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    fetchTemplates()
    fetchPresets()
    fetchFields()
  }, [])

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
        latex_preset: form.latexPreset || 'exam',
        field_filter: form.fieldFilter || undefined,
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
        body: JSON.stringify({
          latex: llmOutput,
          title: 'Generated Problem',
          return_url: true,
          latex_preset: form.latexPreset || 'exam',
        }),
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

  /* ── Filtered fields by selected subject ── */
  const filteredFields = fields.filter(f => !form.subject || f.subject === form.subject)

  /* ── Current preset info ── */
  const currentPreset = latexPresets.find(p => p.id === form.latexPreset)

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
            {/* ── HOW IT WORKS (collapsible, beginner-friendly) ── */}
            <details className="how-it-works">
              <summary className="how-summary">
                初めての方へ：このシステムの使い方
              </summary>
              <div className="how-content">
                <h3>このシステムでできること</h3>
                <p>過去問や類似問題のデータベースをもとに、AIが新しい問題を自動生成し、PDFとしてダウンロードできます。</p>

                <h3>4つのステップ</h3>
                <ol>
                  <li><strong>条件設定</strong> - 科目・分野・難易度・出力形式を選びます。</li>
                  <li><strong>プロンプト生成</strong> - システムが類似問題を検索し、AIへの指示文を自動作成します。</li>
                  <li><strong>外部AIで生成</strong> - ChatGPTやClaudeにプロンプトを貼り付け、LaTeXコードを生成してもらいます。</li>
                  <li><strong>PDF化</strong> - 生成されたLaTeXコードを貼り付けると、きれいなPDFに変換されます。</li>
                </ol>

                <h3>なぜ外部AIを使うの？</h3>
                <p>このシステムは「問題データベース（RAG）」と「PDF生成エンジン」を提供します。
                   AI生成は外部の高性能AIサービスに任せることで、常に最新・最高品質の問題生成が可能です。</p>
              </div>
            </details>

            {/* ── FLOW OVERVIEW ── */}
            <div className="flow-overview">
              <span>条件設定</span>
              <span className="flow-arrow">→</span>
              <span>プロンプトコピー</span>
              <span className="flow-arrow">→</span>
              <span className="flow-external">ChatGPT / Claude に貼付</span>
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
            <div className="progress-percentage">
              ステップ {step} / {STEPS.length}
            </div>

            {/* ══════════════════════════════════
                STEP 1 — 問題設定
               ══════════════════════════════════ */}
            {step === 1 && (
              <div className="card anim-fade-up">
                <div className="card-header">
                  <span className="card-emoji">📝</span>
                  <div className="card-title">問題の条件を設定</div>
                  <div className="card-desc">AIへ送るプロンプトを自動作成します。下の項目を選択してください。</div>
                </div>

                <div className="tip">
                  <span className="tip-icon">💡</span>
                  <div>初めての方：下の項目を選んで<strong>「プロンプトを生成」</strong>ボタンを押すだけ！<br />分野やファイルアップロードは任意です。</div>
                </div>

                {/* Row 1: テンプレート + 科目 */}
                <div className="form-row form-row-2" style={{marginBottom:16}}>
                  <div className="field">
                    <label className="field-label">
                      テンプレート
                      <span className="tooltip-icon" title="問題の出題形式やスタイルを決めるテンプレートです。過去の出題傾向が含まれています。">?</span>
                    </label>
                    <select className="select" value={form.templateId} onChange={e => upd('templateId', e.target.value)}>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">
                      科目
                      <span className="tooltip-icon" title="問題を生成する科目を選択してください">?</span>
                    </label>
                    <select className="select" value={form.subject} onChange={e => { upd('subject', e.target.value); upd('fieldFilter', '') }}>
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: 分野 + 難易度 */}
                <div className="form-row form-row-2" style={{marginBottom:16}}>
                  <div className="field">
                    <label className="field-label">
                      分野（任意）
                      <span className="tooltip-icon" title="特定の分野に絞ると、その分野の類似問題を重点的に検索します">?</span>
                    </label>
                    <select className="select" value={form.fieldFilter} onChange={e => upd('fieldFilter', e.target.value)}>
                      <option value="">全ての分野</option>
                      {filteredFields.map(f => (
                        <option key={f.code || f.id} value={f.code || f.name}>
                          {f.name}{f.problem_count > 0 ? ` (${f.problem_count}問)` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="field-hint">分野を選ぶとRAG検索の精度が上がります</div>
                  </div>
                  <div className="field">
                    <label className="field-label">
                      難易度
                      <span className="tooltip-icon" title="易: 基礎〜標準 / 普通: 標準〜やや応用 / 難: 応用〜発展">?</span>
                    </label>
                    <select className="select" value={form.difficulty} onChange={e => upd('difficulty', e.target.value)}>
                      {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <div className="field-hint"><strong>易</strong>: 基本 | <strong>普通</strong>: 標準 | <strong>難</strong>: 応用</div>
                  </div>
                </div>

                {/* Row 3: 問題数 + 出力形式 */}
                <div className="form-row form-row-2" style={{marginBottom:20}}>
                  <div className="field">
                    <label className="field-label">問題数</label>
                    <input className="input" type="number" min={1} max={10} value={form.numQuestions}
                      onChange={e => upd('numQuestions', Number(e.target.value))} />
                  </div>
                  <div className="field">
                    <label className="field-label">
                      出力形式
                      <span className="tooltip-icon" title="生成されるPDFのレイアウト形式を選択します">?</span>
                    </label>
                    <select className="select" value={form.latexPreset} onChange={e => upd('latexPreset', e.target.value)}>
                      {latexPresets.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {currentPreset && (
                      <div className="field-hint">{currentPreset.description}</div>
                    )}
                  </div>
                </div>

                {/* File upload */}
                <div className="field">
                  <label className="field-label">
                    参照ファイル（任意）
                    <span className="tooltip-icon" title="似た形式の問題を作りたい場合、元の問題ファイルをアップロードすると精度が上がります">?</span>
                  </label>
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
                  <div className="card-desc">外部のAI（ChatGPT・Claude等）にプロンプトを渡してLaTeXコードを生成してもらいます</div>
                </div>

                <div className="instruction-steps">
                  <div className="instruction-step">
                    <span className="instruction-num">1</span>
                    <div>
                      <strong>「プロンプトをコピー」ボタンを押す</strong>
                      <div className="step-detail">指示文がクリップボードにコピーされます</div>
                    </div>
                  </div>
                  <div className="instruction-step">
                    <span className="instruction-num">2</span>
                    <div>
                      <strong>外部AI（ChatGPT / Claude）を開く</strong>
                      <div className="step-detail">下のリンクから開けます。無料プランでも利用可能です。</div>
                    </div>
                  </div>
                  <div className="instruction-step">
                    <span className="instruction-num">3</span>
                    <div>
                      <strong>コピーしたプロンプトを貼り付けて送信</strong>
                      <div className="step-detail">AIが数秒〜数十秒でLaTeXコードを生成します</div>
                    </div>
                  </div>
                  <div className="instruction-step">
                    <span className="instruction-num">4</span>
                    <div>
                      <strong>AIの出力（LaTeXコード全体）をコピー</strong>
                      <div className="step-detail"><code>\documentclass</code> から <code>{`\\end{document}`}</code> まで全てコピーしてください</div>
                    </div>
                  </div>
                </div>

                <div className="prompt-preview">{prompt}</div>

                <div style={{display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginBottom:16}}>
                  {ragCtx?.chunk_count > 0 && (
                    <span className="rag-badge">📚 {ragCtx.chunk_count}件の類似問題を参照</span>
                  )}
                  {currentPreset && (
                    <span className="rag-badge">📄 形式: {currentPreset.name}</span>
                  )}
                </div>

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
                  <div className="card-title">AIの出力を貼り付けてPDF生成</div>
                  <div className="card-desc">ChatGPT/Claude が生成したLaTeXコードを貼り付けてPDFに変換します</div>
                </div>

                <div className="tip tip-warning">
                  <span className="tip-icon">⚠️</span>
                  <div>
                    <strong>貼り付けるもの：</strong>AIが出力したLaTeXコード全体<br />
                    <strong>含めるもの：</strong><code>{`\\documentclass{article}`}</code> から <code>{`\\end{document}`}</code> まで<br />
                    <strong>含めないもの：</strong>コードブロック記号（<code>```latex</code> や <code>```</code>）は削除してください
                  </div>
                </div>

                <details className="examples-section">
                  <summary>正しい貼り付け例を見る</summary>
                  <div className="example-code">
                    <div className="example-label good">正しい例</div>
                    <pre>{`\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
\\section{問題}
問1: ...
\\end{document}`}</pre>
                  </div>
                  <div className="example-code">
                    <div className="example-label bad">間違った例（コードブロック記号付き）</div>
                    <pre>{`\`\`\`latex
\\documentclass{article}
...
\\end{document}
\`\`\``}</pre>
                  </div>
                </details>

                <div className="field" style={{marginTop:16}}>
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
                  <div className="card-title" style={{fontSize:22, marginBottom:8}}>PDF作成完了！</div>
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

      {/* ── Floating Help Button ── */}
      <button className="help-floating" onClick={() => setShowHelp(true)} title="ヘルプ">
        <Ico.Help />
      </button>

      {/* ── Help Modal ── */}
      {showHelp && (
        <div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={e => e.stopPropagation()}>
            <div className="help-header">
              <h2>ヘルプ・よくある質問</h2>
              <button onClick={() => setShowHelp(false)}>×</button>
            </div>
            <div className="help-content">
              <dl>
                <dt>Q: 外部AIは必須ですか？</dt>
                <dd>はい。このシステムは「問題データベース検索」と「PDF生成」を担当します。
                    問題の生成はChatGPTやClaude等の外部AIサービスが行います。</dd>

                <dt>Q: ChatGPTやClaudeは無料で使えますか？</dt>
                <dd>はい、無料プランがあります。ただし利用回数に制限がある場合があります。</dd>

                <dt>Q: PDFがうまく生成されません</dt>
                <dd>以下を確認してください：
                    (1) コードブロック記号（```）を削除したか
                    (2) <code>\documentclass</code> から <code>{`\\end{document}`}</code> まで含まれているか
                    (3) LaTeX構文にエラーがないか</dd>

                <dt>Q: テンプレートとは何ですか？</dt>
                <dd>テンプレートは問題生成の「型」です。科目・分野ごとに最適化された出題指示が含まれており、
                    AIがより的確な問題を生成できるようになります。</dd>

                <dt>Q: 「出力形式」は何を選べばいいですか？</dt>
                <dd>
                  <strong>試験問題</strong> - 定期テスト風のフォーマット（配点付き）<br/>
                  <strong>学習プリント</strong> - 演習用ワークシート（名前欄付き）<br/>
                  <strong>一問一答カード</strong> - 暗記用フラッシュカード<br/>
                  <strong>模試</strong> - 制限時間付きの模擬試験<br/>
                  <strong>レポート・解説</strong> - 解説重視のレポート<br/>
                  <strong>シンプル</strong> - 最小限の装飾
                </dd>

                <dt>Q: 分野フィルタは何のためですか？</dt>
                <dd>分野を指定すると、データベースからその分野の類似問題だけを検索します。
                    これにより、より的確な参考問題がプロンプトに含まれ、生成品質が向上します。</dd>

                <dt>Q: ファイルアップロードは必須ですか？</dt>
                <dd>いいえ、任意です。似た形式の問題を作りたい場合にアップロードすると、
                    そのスタイルを参考にした問題が生成されます。</dd>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
