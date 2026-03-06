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
  Database: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  Pdf: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-2h2a1 1 0 1 0 0-2H9v6"/></svg>,
  Skip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>,
  Paste: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  Wand: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M15 9h0"/><path d="M17.8 6.2L19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2L11 5"/></svg>,
  Zap: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
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
/* ── Preset emoji map ── */
const PRESET_EMOJI = {
  exam: '📝', worksheet: '📋', flashcard: '🃏', mock_exam: '📊',
  report: '📖', simple: '✏️', default: '📄',
}
const presetEmoji = (id) => PRESET_EMOJI[id] || PRESET_EMOJI.default

export default function App() {
  const [mode, setMode] = useState('user')
  const [toast, setToast] = useState(null)

  // Data
  const [templates, setTemplates] = useState([])
  const [difficulties] = useState(['易', '普通', '難'])
  const [latexPresets, setLatexPresets] = useState([])

  // View mode: 'wizard' (step-by-step) or 'manual' (direct paste)
  const [viewMode, setViewMode] = useState('wizard')
  // Manual mode paste state
  const [manualLatex, setManualLatex] = useState('')
  const [manualPreset, setManualPreset] = useState('exam')
  const [manualPdfUrl, setManualPdfUrl] = useState('')

  // Wizard state
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    templateId: '', difficulty: '普通', numQuestions: 3,
    latexPreset: 'exam',
  })
  const [prompt, setPrompt] = useState('')
  const [ragCtx, setRagCtx] = useState(null)
  const [llmOutput, setLlmOutput] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  // Step 3: Base question state
  const [baseMode, setBaseMode] = useState('skip') // 'db' | 'pdf' | 'skip'
  const [baseProblems, setBaseProblems] = useState([])
  const [selectedBaseProblem, setSelectedBaseProblem] = useState(null)
  const [basePdfData, setBasePdfData] = useState(null) // { filename, page_count, images, extracted_text }
  const [basePdfDragOver, setBasePdfDragOver] = useState(false)
  const basePdfRef = useRef(null)

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

  useEffect(() => {
    fetchTemplates()
    fetchPresets()
  }, [])

  /* ── Fetch base problems for Step 3 ── */
  const fetchBaseProblems = useCallback(async (templateId) => {
    if (!templateId) return
    try {
      const r = await fetch(`/api/problems_by_pattern?template_id=${encodeURIComponent(templateId)}&limit=20`)
      const d = await r.json()
      if (r.ok) setBaseProblems(d.problems || [])
    } catch (e) { console.error(e) }
  }, [])

  /* ── Upload base PDF (3 page limit) ── */
  const uploadBasePdf = async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return notify('PDFファイルのみアップロード可能です', 'error')
    }
    setLoading(true); setLoadingMsg('PDFを検証中...')
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await fetch('/api/validate_base_pdf', { method: 'POST', body: fd })
      const d = await r.json()
      if (r.ok) {
        setBasePdfData(d)
        notify(`${d.filename}（${d.page_count}ページ）を読み込みました`, 'success')
      } else {
        notify(d.detail || 'PDFの検証に失敗しました', 'error')
      }
    } catch { notify('アップロードエラー', 'error') }
    setLoading(false)
    if (basePdfRef.current) basePdfRef.current.value = ''
  }
  const onBasePdfDrop = (e) => { e.preventDefault(); setBasePdfDragOver(false); uploadBasePdf(e.dataTransfer.files?.[0]) }
  const onBasePdfDragOver = (e) => { e.preventDefault(); setBasePdfDragOver(true) }
  const onBasePdfDragLeave = () => setBasePdfDragOver(false)

  /* ── Generate prompt (Step 3 → 4) ── */
  const generatePrompt = async () => {
    if (!form.templateId) return notify('テンプレートを選んでください', 'error')
    setLoading(true); setLoadingMsg('指示文を作成中...')
    try {
      // Build source text from base problem if selected
      let sourceText = ''
      if (baseMode === 'db' && selectedBaseProblem) {
        sourceText = `【ベース問題】\n${selectedBaseProblem.stem || ''}\n${selectedBaseProblem.solution_outline || ''}`
      } else if (baseMode === 'pdf' && basePdfData?.extracted_text) {
        sourceText = basePdfData.extracted_text
      }

      const body = {
        template_id: form.templateId,
        difficulty: form.difficulty,
        num_questions: form.numQuestions,
        rag_inject: true,
        source_text: sourceText || undefined,
        user_mode: true,
        latex_preset: form.latexPreset || 'exam',
      }
      const r = await fetch('/api/template_render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (r.ok) {
        let renderedPrompt = d.rendered_prompt || d.rendered
        // When PDF mode: append instruction for the user to attach the PDF
        if (baseMode === 'pdf' && basePdfData) {
          renderedPrompt += (
            '\n\n【重要：添付PDFについて】\n' +
            'このメッセージと一緒に添付されたPDFファイルがベースライン問題です。\n' +
            'このPDFの問題形式・構成・難易度・出題スタイルを分析し、' +
            '同じスタイルで新しい類似問題を作成してください。\n' +
            'PDFの内容をそのままコピーするのではなく、数値や条件を変えた新しい問題を生成すること。'
          )
        }
        setPrompt(renderedPrompt)
        setRagCtx(d.context)
        setStep(4)
        notify('指示文の作成完了', 'success')
      } else {
        notify('エラー: ' + (d.detail || r.statusText), 'error')
      }
    } catch { notify('通信エラー', 'error') }
    setLoading(false)
  }

  /* ── Copy prompt ── */
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); notify('クリップボードにコピーしました', 'success') }
    catch { notify('コピー失敗', 'error') }
  }

  /* ── Step 5 → 6 : Generate PDF ── */
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
        setStep(6)
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
    setBaseMode('skip'); setBaseProblems([]); setSelectedBaseProblem(null); setBasePdfData(null)
  }

  /* ── Manual mode: Generate PDF directly ── */
  const generatePdfManual = async () => {
    if (!manualLatex.trim()) return notify('LaTeXコードを貼り付けてください', 'error')
    setLoading(true); setLoadingMsg('PDFを生成中...')
    try {
      const r = await fetch('/api/generate_pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latex: manualLatex,
          title: 'Manual PDF',
          return_url: true,
          latex_preset: manualPreset || 'exam',
        }),
      })
      if (r.ok) {
        const d = await r.json().catch(() => null)
        const url = d?.pdf_url || URL.createObjectURL(await r.blob())
        setManualPdfUrl(url)
        notify('PDFを作成しました！', 'success')
      } else {
        const d = await r.json().catch(() => null)
        notify('PDF生成失敗: ' + (d?.detail || d?.error || ''), 'error')
      }
    } catch { notify('PDF生成エラー', 'error') }
    setLoading(false)
  }

  /* ── Current preset info ── */
  const currentPreset = latexPresets.find(p => p.id === form.latexPreset)

  /* ── Selected template info ── */
  const selectedTemplate = templates.find(t => t.id === form.templateId)
  const templateMeta = selectedTemplate?.metadata || {}

  /* ════════════════════════════════════════
     STEP Names for progress bar (6 steps)
     ════════════════════════════════════════ */
  const STEPS = [
    { n: 1, label: '出題パターン' },
    { n: 2, label: '難易度・問題数' },
    { n: 3, label: 'ベース問題' },
    { n: 4, label: 'AIに依頼', sub: '外部AI使用' },
    { n: 5, label: '結果を入力' },
    { n: 6, label: 'PDF完成' },
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
          <div className="header-actions">
            <div className="mode-toggle">
              <button className={mode === 'user' ? 'active' : ''} onClick={() => setMode('user')}>ユーザー</button>
              <button className={mode === 'dev' ? 'active' : ''} onClick={() => setMode('dev')}>開発者</button>
            </div>
          </div>
        </div>
      </header>

      <div className="main-content">

        {mode === 'user' ? (
          <>
            {/* ── VIEW MODE SWITCHER ── */}
            <div className="view-mode-bar">
              <button
                className={`view-mode-btn ${viewMode === 'wizard' ? 'active' : ''}`}
                onClick={() => setViewMode('wizard')}
              >
                <Ico.Wand />
                <span>ガイド付き生成</span>
              </button>
              <button
                className={`view-mode-btn ${viewMode === 'manual' ? 'active' : ''}`}
                onClick={() => setViewMode('manual')}
              >
                <Ico.Paste />
                <span>手動入力モード</span>
              </button>
            </div>

            {/* ══════════════════════════════════
                MANUAL PASTE MODE — 直接LaTeX入力
               ══════════════════════════════════ */}
            {viewMode === 'manual' && (
              <>
                <div className="card anim-fade-up">
                  <div className="card-header">
                    <span className="card-emoji">📋</span>
                    <div className="card-title">手動入力モード</div>
                    <div className="card-desc">
                      ChatGPT / Claude が生成したLaTeXコードを直接貼り付けてPDFに変換します
                    </div>
                  </div>

                  <div className="tip">
                    <span className="tip-icon">💡</span>
                    <div>AIの出力した <code>{`\\documentclass`}</code> 〜 <code>{`\\end{document}`}</code> の全体をそのまま貼り付けてください。コードブロック記号（<code>```</code>）は不要です。</div>
                  </div>

                  {/* Preset chips */}
                  {latexPresets.length > 0 && (
                    <div className="field" style={{marginBottom: 16}}>
                      <label className="field-label">出力形式</label>
                      <div className="preset-chips">
                        {latexPresets.map(p => (
                          <button
                            key={p.id}
                            className={`preset-chip ${manualPreset === p.id ? 'active' : ''}`}
                            onClick={() => setManualPreset(p.id)}
                            title={p.description}
                          >
                            <span className="preset-chip-emoji">{presetEmoji(p.id)}</span>
                            <span className="preset-chip-label">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="field">
                    <label className="field-label">LaTeX コード（AIの出力を貼り付け）</label>
                    <textarea
                      className="input manual-textarea"
                      placeholder={"\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\\section{問題}\n問1: ...\n\\end{document}"}
                      value={manualLatex}
                      onChange={e => setManualLatex(e.target.value)}
                    />
                    {manualLatex.trim() && (
                      <div className="field-hint" style={{marginTop: 6}}>
                        {manualLatex.includes('\\documentclass') ? '✅ \\documentclass を検出' : '⚠️ \\documentclass が見つかりません'}
                        {manualLatex.includes('\\end{document}') ? ' ・ ✅ \\end{document} を検出' : ' ・ ⚠️ \\end{document} が見つかりません'}
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-success btn-block"
                    onClick={generatePdfManual}
                    disabled={loading || !manualLatex.trim()}
                  >
                    <Ico.Zap /> PDF を生成
                  </button>
                </div>

                {/* Manual mode PDF result */}
                {manualPdfUrl && (
                  <div className="card anim-fade-up" style={{marginTop: 16}}>
                    <div className="success-screen">
                      <div className="success-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <div className="card-title" style={{fontSize:20, marginBottom:8}}>PDF作成完了</div>
                      <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginTop: 16}}>
                        <a href={manualPdfUrl} target="_blank" rel="noreferrer" className="btn btn-success">
                          <Ico.ExternalLink /> PDFを開く
                        </a>
                        <button className="btn btn-outline" onClick={() => { setManualLatex(''); setManualPdfUrl('') }}>
                          <Ico.RotateCcw /> 新しく作る
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick links to AI services */}
                <div className="manual-ai-links">
                  <span className="manual-ai-links-label">AIサービス:</span>
                  <a href="https://chat.openai.com/" target="_blank" rel="noreferrer" className="ai-link-compact">
                    <Ico.ExternalLink /> ChatGPT
                  </a>
                  <a href="https://claude.ai/" target="_blank" rel="noreferrer" className="ai-link-compact">
                    <Ico.ExternalLink /> Claude
                  </a>
                </div>
              </>
            )}

            {/* ══════════════════════════════════
                WIZARD MODE — ステップバイステップ
               ══════════════════════════════════ */}
            {viewMode === 'wizard' && (
              <>
            {/* ── FLOW OVERVIEW ── */}
            <div className="flow-overview">
              <span>パターン選択</span>
              <span className="flow-arrow">→</span>
              <span>条件設定</span>
              <span className="flow-arrow">→</span>
              <span>ベース問題</span>
              <span className="flow-arrow">→</span>
              <span className="flow-external">ChatGPT / Claude に貼付</span>
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
                STEP 1 — 出題パターンを選ぶ
               ══════════════════════════════════ */}
            {step === 1 && (
              <div className="card anim-fade-up">
                <div className="card-header">
                  <span className="card-emoji">📝</span>
                  <div className="card-title">出題パターンを選ぶ</div>
                  <div className="card-desc">問題の出題形式・スタイルを決めるパターンを選択してください</div>
                </div>

                <div className="tip">
                  <span className="tip-icon">💡</span>
                  <div>パターンには科目・分野の情報が含まれています。目的に合ったものを選んでください。</div>
                </div>

                <div className="pattern-grid">
                  {templates.map(t => {
                    const meta = t.metadata || {}
                    const isSelected = form.templateId === t.id
                    return (
                      <div
                        key={t.id}
                        className={`pattern-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => upd('templateId', t.id)}
                      >
                        <div className="pattern-card-header">
                          <div className="pattern-card-name">{t.name || t.id}</div>
                          {isSelected && <div className="pattern-check"><Ico.Check s={14} /></div>}
                        </div>
                        {t.description && (
                          <div className="pattern-card-desc">{t.description}</div>
                        )}
                        <div className="pattern-card-tags">
                          {meta.subject && <span className="pattern-tag">{meta.subject}</span>}
                          {meta.field && <span className="pattern-tag">{meta.field}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button
                  className="btn btn-primary btn-block"
                  style={{marginTop: 16}}
                  onClick={() => form.templateId && setStep(2)}
                  disabled={!form.templateId}
                >
                  次へ <Ico.ArrowRight />
                </button>
              </div>
            )}

            {/* ══════════════════════════════════
                STEP 2 — 難易度・問題数
               ══════════════════════════════════ */}
            {step === 2 && (
              <div className="card anim-fade-up">
                <div className="card-header">
                  <span className="card-emoji">⚙️</span>
                  <div className="card-title">難易度・問題数を設定</div>
                  <div className="card-desc">生成する問題の難易度と数を選んでください</div>
                </div>

                {selectedTemplate && (
                  <div className="selected-pattern-badge">
                    <span>選択中：</span>
                    <strong>{selectedTemplate.name || selectedTemplate.id}</strong>
                    {templateMeta.subject && <span className="pattern-tag">{templateMeta.subject}</span>}
                  </div>
                )}

                {/* 難易度 */}
                <div className="field" style={{marginBottom: 20}}>
                  <label className="field-label">難易度</label>
                  <div className="difficulty-selector">
                    {difficulties.map(d => (
                      <button
                        key={d}
                        className={`difficulty-btn ${form.difficulty === d ? 'active' : ''}`}
                        onClick={() => upd('difficulty', d)}
                      >
                        <span className="difficulty-icon">
                          {d === '易' ? '🟢' : d === '普通' ? '🟡' : '🔴'}
                        </span>
                        <span>{d}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 問題数 */}
                <div className="field" style={{marginBottom: 20}}>
                  <label className="field-label">問題数</label>
                  <div className="num-questions-selector">
                    {[1, 2, 3, 5, 10].map(n => (
                      <button
                        key={n}
                        className={`num-btn ${form.numQuestions === n ? 'active' : ''}`}
                        onClick={() => upd('numQuestions', n)}
                      >
                        {n}問
                      </button>
                    ))}
                  </div>
                  <div className="field-hint" style={{marginTop: 8}}>
                    またはカスタム入力：
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={10}
                      value={form.numQuestions}
                      onChange={e => upd('numQuestions', Math.min(10, Math.max(1, Number(e.target.value))))}
                      style={{width: 80, display: 'inline-block', marginLeft: 8, padding: '6px 10px'}}
                    />
                  </div>
                </div>

                {/* 出力形式 */}
                <div className="field" style={{marginBottom: 8}}>
                  <label className="field-label">
                    出力形式
                    <span className="tooltip-icon" title="生成されるPDFのレイアウト形式を選択します">?</span>
                  </label>
                  <div className="preset-chips">
                    {latexPresets.map(p => (
                      <button
                        key={p.id}
                        className={`preset-chip ${form.latexPreset === p.id ? 'active' : ''}`}
                        onClick={() => upd('latexPreset', p.id)}
                        title={p.description}
                      >
                        <span className="preset-chip-emoji">{presetEmoji(p.id)}</span>
                        <span className="preset-chip-label">{p.name}</span>
                      </button>
                    ))}
                  </div>
                  {currentPreset && (
                    <div className="field-hint">{currentPreset.description}</div>
                  )}
                </div>

                <div className="btn-row btn-row-2">
                  <button className="btn btn-outline" onClick={() => setStep(1)}>
                    <Ico.ArrowLeft /> 戻る
                  </button>
                  <button className="btn btn-primary" onClick={() => { fetchBaseProblems(form.templateId); setStep(3) }}>
                    次へ <Ico.ArrowRight />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════
                STEP 3 — ベース問題選択
               ══════════════════════════════════ */}
            {step === 3 && (
              <div className="card anim-fade-up">
                <div className="card-header">
                  <span className="card-emoji">📄</span>
                  <div className="card-title">ベース問題を選択</div>
                  <div className="card-desc">参考にする問題をDBから選ぶか、PDFをアップロードしてください。スキップも可能です。</div>
                </div>

                {/* Tab selector */}
                <div className="base-mode-tabs">
                  <button
                    className={`base-mode-tab ${baseMode === 'db' ? 'active' : ''}`}
                    onClick={() => setBaseMode('db')}
                  >
                    <Ico.Database />
                    <span>DBから選択</span>
                  </button>
                  <button
                    className={`base-mode-tab ${baseMode === 'pdf' ? 'active' : ''}`}
                    onClick={() => setBaseMode('pdf')}
                  >
                    <Ico.Pdf />
                    <span>PDFアップロード</span>
                  </button>
                  <button
                    className={`base-mode-tab ${baseMode === 'skip' ? 'active' : ''}`}
                    onClick={() => { setBaseMode('skip'); setSelectedBaseProblem(null); setBasePdfData(null) }}
                  >
                    <Ico.Skip />
                    <span>スキップ</span>
                  </button>
                </div>

                {/* DB mode */}
                {baseMode === 'db' && (
                  <div className="base-content anim-fade-up">
                    {baseProblems.length > 0 ? (
                      <>
                        <div className="base-db-hint">同じ出題パターンの問題から1つ選んでください</div>
                        <div className="base-problem-list">
                          {baseProblems.map(p => (
                            <div
                              key={p.id}
                              className={`base-problem-card ${selectedBaseProblem?.id === p.id ? 'selected' : ''}`}
                              onClick={() => setSelectedBaseProblem(selectedBaseProblem?.id === p.id ? null : p)}
                            >
                              <div className="base-problem-stem">{p.stem}</div>
                              <div className="base-problem-meta">
                                {p.subject && <span className="pattern-tag">{p.subject}</span>}
                                {p.topic && <span className="pattern-tag">{p.topic}</span>}
                                {p.difficulty != null && (
                                  <span className="pattern-tag">難易度: {(p.difficulty * 100).toFixed(0)}%</span>
                                )}
                              </div>
                              {selectedBaseProblem?.id === p.id && (
                                <div className="base-problem-check"><Ico.Check s={16} /></div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="base-empty">
                        <div className="base-empty-icon"><Ico.Database /></div>
                        <div>このパターンに一致する問題がDBに見つかりませんでした。</div>
                        <div className="field-hint">PDFアップロードかスキップを選択してください。</div>
                      </div>
                    )}
                  </div>
                )}

                {/* PDF mode */}
                {baseMode === 'pdf' && (
                  <div className="base-content anim-fade-up">
                    <div className="tip tip-info" style={{marginBottom: 16}}>
                      <span className="tip-icon">📋</span>
                      <div>
                        PDFは<strong>3ページ以下</strong>のファイルのみアップロード可能です。
                        アップロードされたPDFはベースライン問題としてAIに添付送信されます。
                      </div>
                    </div>

                    {!basePdfData ? (
                      <div
                        className={`upload-area ${basePdfDragOver ? 'drag-over' : ''}`}
                        onClick={() => basePdfRef.current?.click()}
                        onDrop={onBasePdfDrop}
                        onDragOver={onBasePdfDragOver}
                        onDragLeave={onBasePdfDragLeave}
                      >
                        <input ref={basePdfRef} type="file" accept=".pdf" onChange={e => uploadBasePdf(e.target.files?.[0])} />
                        <div className="upload-icon"><Ico.Upload /></div>
                        <div className="upload-label"><strong>タップ</strong>または<strong>ドラッグ＆ドロップ</strong></div>
                        <div className="upload-formats">PDFファイル（3ページ以下）</div>
                      </div>
                    ) : (
                      <div className="base-pdf-preview">
                        <div className="base-pdf-info">
                          <div className="base-pdf-filename">
                            <Ico.FileText /> {basePdfData.filename}
                          </div>
                          <div className="base-pdf-pages">{basePdfData.page_count}ページ</div>
                          <button
                            className="btn btn-ghost"
                            style={{padding: '4px 10px', fontSize: 12}}
                            onClick={() => setBasePdfData(null)}
                          >
                            削除
                          </button>
                        </div>
                        {basePdfData.images?.length > 0 && (
                          <div className="base-pdf-thumbnails">
                            {basePdfData.images.map((img, i) => (
                              <div key={i} className="base-pdf-thumb">
                                <img src={`data:image/png;base64,${img}`} alt={`Page ${i+1}`} />
                                <div className="base-pdf-thumb-label">P{i+1}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Skip mode */}
                {baseMode === 'skip' && (
                  <div className="base-content anim-fade-up">
                    <div className="base-skip-notice">
                      <Ico.Skip />
                      <div>
                        <strong>ベース問題なしで生成</strong>
                        <div className="field-hint">RAGによる類似問題検索のみで指示文を作成します</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="btn-row btn-row-2">
                  <button className="btn btn-outline" onClick={() => setStep(2)}>
                    <Ico.ArrowLeft /> 戻る
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={generatePrompt}
                    disabled={loading || (baseMode === 'db' && !selectedBaseProblem) || (baseMode === 'pdf' && !basePdfData)}
                  >
                    指示文を作成 <Ico.ArrowRight />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════
                STEP 4 — 指示文をコピー
               ══════════════════════════════════ */}
            {step === 4 && (
              <div className="card anim-fade-up">
                <div className="card-header">
                  <span className="card-emoji">📋</span>
                  <div className="card-title">指示文をコピーしてAIに依頼</div>
                  <div className="card-desc">外部のAI（ChatGPT・Claude等）に指示文を渡してLaTeXコードを生成してもらいます</div>
                </div>

                <div className="instruction-steps">
                  <div className="instruction-step">
                    <span className="instruction-num">1</span>
                    <div>
                      <strong>「指示文をコピー」ボタンを押す</strong>
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
                  {baseMode === 'pdf' && basePdfData && (
                    <div className="instruction-step">
                      <span className="instruction-num" style={{background: 'var(--c-accent)'}}>!</span>
                      <div>
                        <strong>ベースPDFもAIに添付してください</strong>
                        <div className="step-detail">
                          「{basePdfData.filename}」をChatGPT/Claudeの添付ファイルとしてアップロードしてください。
                          指示文内にPDFを参照する旨が記載されています。
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="instruction-step">
                    <span className="instruction-num">{baseMode === 'pdf' && basePdfData ? '3' : '3'}</span>
                    <div>
                      <strong>コピーした指示文を貼り付けて送信</strong>
                      <div className="step-detail">AIが数秒〜数十秒でLaTeXコードを生成します</div>
                    </div>
                  </div>
                  <div className="instruction-step">
                    <span className="instruction-num">{baseMode === 'pdf' && basePdfData ? '4' : '4'}</span>
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
                  {baseMode === 'db' && selectedBaseProblem && (
                    <span className="rag-badge">🎯 ベース問題選択済み</span>
                  )}
                  {baseMode === 'pdf' && basePdfData && (
                    <span className="rag-badge">📎 PDF添付: {basePdfData.filename}</span>
                  )}
                </div>

                <div style={{marginBottom:16}}>
                  <button className="btn btn-primary btn-block" onClick={copyPrompt}>
                    <Ico.Copy /> 指示文をコピー
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
                  <button className="btn btn-outline" onClick={() => setStep(3)}>
                    <Ico.ArrowLeft /> 戻る
                  </button>
                  <button className="btn btn-success" onClick={() => setStep(5)}>
                    AIの出力を受け取った → 次へ <Ico.ArrowRight />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════
                STEP 5 — LaTeX 貼り付け → PDF生成
               ══════════════════════════════════ */}
            {step === 5 && (
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
                  <button className="btn btn-outline" onClick={() => setStep(4)}>
                    <Ico.ArrowLeft /> 戻る
                  </button>
                  <button className="btn btn-success" onClick={generatePdf} disabled={loading || !llmOutput.trim()}>
                    PDF を生成 <Ico.ArrowRight />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════
                STEP 6 — 完了
               ══════════════════════════════════ */}
            {step === 6 && (
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
            )}
          </>
        ) : (
          /* ── DEV MODE ── */
          <div className="card anim-fade-up" style={{marginTop:8}}>
            <div className="card-header">
              <span className="card-emoji">🛠️</span>
              <div className="card-title">開発者モード</div>
              <div className="card-desc">問題検索の詳細テストと調整</div>
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

                <dt>Q: 「手動入力モード」とは？</dt>
                <dd>既にLaTeXコードをお持ちの場合、ウィザードの全ステップを省略して
                    直接PDFを生成できるモードです。ChatGPT/Claudeの出力をそのまま貼り付けてください。</dd>

                <dt>Q: ベース問題とは？</dt>
                <dd>生成する問題の「お手本」となる問題です。DBから既存の問題を選ぶか、
                    PDFをアップロードすることで、より的確な類似問題を生成できます。</dd>

                <dt>Q: PDFアップロードの制限は？</dt>
                <dd>ベースPDFは3ページ以下のファイルのみアップロード可能です。
                    入力トークンの最適化のため、この制限を設けています。</dd>

                <dt>Q: ChatGPTやClaudeは無料で使えますか？</dt>
                <dd>はい、無料プランがあります。ただし利用回数に制限がある場合があります。</dd>

                <dt>Q: PDFがうまく生成されません</dt>
                <dd>以下を確認してください：
                    (1) コードブロック記号（```）を削除したか
                    (2) <code>\documentclass</code> から <code>{`\\end{document}`}</code> まで含まれているか
                    (3) LaTeX構文にエラーがないか</dd>

                <dt>Q: 「出力形式」は何を選べばいいですか？</dt>
                <dd>
                  <strong>試験問題</strong> - 定期テスト風のフォーマット（配点付き）<br/>
                  <strong>学習プリント</strong> - 演習用ワークシート（名前欄付き）<br/>
                  <strong>一問一答カード</strong> - 暗記用フラッシュカード<br/>
                  <strong>模試</strong> - 制限時間付きの模擬試験<br/>
                  <strong>レポート・解説</strong> - 解説重視のレポート<br/>
                  <strong>シンプル</strong> - 最小限の装飾
                </dd>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
