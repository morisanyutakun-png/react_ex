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
  Zap: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  ChevronDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ChevronUp: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>,
  Clock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Shield: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  WifiOff: () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
}

/* ────────────────────────────────────────────
   Onboarding Component (初回チュートリアル)
   ──────────────────────────────────────────── */
const ONBOARDING_SLIDES = [
  {
    emoji: '⚛️',
    title: '物理を制す、受験を制す',
    desc: '高校物理・大学物理の類題をAIが瞬時に生成。力学・電磁気・波動・熱力学、あらゆる分野をPDF出力できます。',
  },
  {
    emoji: '🎯',
    title: '受験生・高校生・大学生へ',
    desc: '共通テスト対策から大学物理まで幅広く対応。数学・英語などの他教科の類題生成にも使えます。',
  },
  {
    emoji: '📝',
    title: 'かんたん4ステップ',
    desc: '1. 物理の出題パターンを選ぶ → 2. 問題数・ベース問題を設定 → 3. AIに依頼 → 4. PDF完成！',
  },
  {
    emoji: '🚀',
    title: 'さあ、物理の類題を作ろう！',
    desc: 'まずは出題パターンを選んで、最初の類題を生成してみましょう。受験突破の第一歩がここから始まります。',
  },
]

function OnboardingScreen({ onComplete }) {
  const [slideIndex, setSlideIndex] = useState(0)
  const slide = ONBOARDING_SLIDES[slideIndex]
  const isLast = slideIndex === ONBOARDING_SLIDES.length - 1

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card anim-scale-in">
        <div className="onboarding-slide anim-fade-up" key={slideIndex}>
          <div className="onboarding-emoji">{slide.emoji}</div>
          <h2 className="onboarding-title">{slide.title}</h2>
          <p className="onboarding-desc">{slide.desc}</p>
        </div>
        <div className="onboarding-dots">
          {ONBOARDING_SLIDES.map((_, i) => (
            <div key={i} className={`onboarding-dot ${i === slideIndex ? 'active' : ''}`} />
          ))}
        </div>
        <div className="onboarding-actions">
          {slideIndex > 0 && (
            <button className="btn btn-ghost" onClick={() => setSlideIndex(i => i - 1)}>戻る</button>
          )}
          {isLast ? (
            <button className="btn btn-primary btn-lg btn-block" onClick={onComplete}>
              はじめる <Ico.ArrowRight />
            </button>
          ) : (
            <button className="btn btn-primary btn-lg btn-block" onClick={() => setSlideIndex(i => i + 1)}>
              次へ <Ico.ArrowRight />
            </button>
          )}
        </div>
        <button className="onboarding-skip" onClick={onComplete}>スキップ</button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   Offline Banner Component
   ──────────────────────────────────────────── */
function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline) }
  }, [])
  if (!isOffline) return null
  return (
    <div className="offline-banner">
      <Ico.WifiOff />
      <div>
        <div className="offline-title">オフラインです</div>
        <div className="offline-desc">インターネット接続を確認してください。接続が回復すると自動的に復帰します。</div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   History helpers (localStorage)
   ──────────────────────────────────────────── */
const HISTORY_KEY = 'examgen_history'
const MAX_HISTORY = 50

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch { return [] }
}

function saveToHistory(entry) {
  const history = loadHistory()
  history.unshift({ ...entry, id: Date.now(), createdAt: new Date().toISOString() })
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

function deleteFromHistory(id) {
  const history = loadHistory().filter(h => h.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

/* ────────────────────────────────────────────
   Settings helpers (localStorage)
   ──────────────────────────────────────────── */
const SETTINGS_KEY = 'examgen_settings'
const DEFAULT_SETTINGS = {
  defaultNumQuestions: 3,
  defaultLatexPreset: 'exam',
  defaultBaseMode: 'skip',
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch { return { ...DEFAULT_SETTINGS } }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
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
  const [latexPresets, setLatexPresets] = useState([])

  // App-level screens: 'main' | 'history' | 'settings' | 'legal'
  const [screen, setScreen] = useState('main')
  const [legalTab, setLegalTab] = useState('terms') // 'terms' | 'privacy'

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('examgen_onboarded'))

  // History
  const [history, setHistory] = useState(() => loadHistory())

  // Settings
  const [settings, setSettings] = useState(() => loadSettings())

  // Wizard state
  const [step, setStep] = useState(1)
  const initSettings = loadSettings()
  const [form, setForm] = useState({
    templateId: '', numQuestions: initSettings.defaultNumQuestions,
    latexPreset: initSettings.defaultLatexPreset,
  })
  const [prompt, setPrompt] = useState('')
  const [ragCtx, setRagCtx] = useState(null)
  const [llmOutput, setLlmOutput] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  // Step 4 sub-section toggle
  const [showPromptSection, setShowPromptSection] = useState(true)

  // Step 3: Base question state
  const [baseMode, setBaseMode] = useState(initSettings.defaultBaseMode || 'skip')
  const [baseProblems, setBaseProblems] = useState([])
  const [selectedBaseProblem, setSelectedBaseProblem] = useState(null)
  const [basePdfData, setBasePdfData] = useState(null) // { filename, page_count, images, extracted_text }
  const [basePdfDragOver, setBasePdfDragOver] = useState(false)
  const basePdfRef = useRef(null)

  const notify = (msg, type = 'info') => setToast({ msg, type })
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))

  /* ── Onboarding complete ── */
  const completeOnboarding = () => {
    localStorage.setItem('examgen_onboarded', '1')
    setShowOnboarding(false)
  }

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
    setLoading(true); setLoadingMsg('AIへの指示文を作成中...（問題はまだ生成されません）')
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
        setStep(3)
        setShowPromptSection(true)
        notify('プロンプト（AIへの指示文）を生成しました', 'success')
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

  /* ── Generate PDF ── */
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
        // Save to history
        const entry = {
          templateName: selectedTemplate?.name || form.templateId,
          numQuestions: form.numQuestions,
          latexPreset: form.latexPreset,
          pdfUrl: url,
        }
        saveToHistory(entry)
        setHistory(loadHistory())
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
    setShowPromptSection(true)
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
    { n: 2, label: '問題数・ベース問題' },
    { n: 3, label: 'AI依頼 & 入力' },
    { n: 4, label: 'PDF完成' },
  ]

  /* ════════════════════════════════════════
     RENDER
     ════════════════════════════════════════ */
  return (
    <div className="app-shell">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {loading && <LoadingOverlay text={loadingMsg} />}
      {showOnboarding && <OnboardingScreen onComplete={completeOnboarding} />}
      <OfflineBanner />

      {/* ── HEADER (desktop only) ── */}
      <header className="header desktop-only">
        <div className="header-inner">
          <div className="logo" style={{cursor:'pointer'}} onClick={() => setScreen('main')}>
            <div className="logo-mark">
              <svg width="24" height="24" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round">
                <circle cx="50" cy="50" r="7" fill="currentColor" stroke="none"/>
                <ellipse cx="50" cy="50" rx="42" ry="16"/>
                <ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(60 50 50)"/>
                <ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(-60 50 50)"/>
              </svg>
            </div>
            <div>
              <div className="logo-text">物理AI</div>
              <div className="logo-sub">物理・数学・英語の類題をAIで</div>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={() => setScreen('history')} title="履歴">
              <Ico.Clock />
            </button>
            <button className="btn btn-ghost" onClick={() => setScreen('settings')} title="設定">
              <Ico.Settings />
            </button>
            <div className="mode-toggle">
              <button className={mode === 'user' ? 'active' : ''} onClick={() => setMode('user')}>ユーザー</button>
              <button className={mode === 'dev' ? 'active' : ''} onClick={() => setMode('dev')}>開発者</button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-top-bar mobile-only">
        <div className="mobile-top-title">
          {screen === 'history' ? '生成履歴' : screen === 'settings' ? '設定' : screen === 'legal' ? (legalTab === 'terms' ? '利用規約' : 'プライバシーポリシー') : (STEPS[step - 1]?.label || '物理AI')}
        </div>
        {screen === 'main' && (
          <div className="mobile-progress-line">
            <div className="mobile-progress-fill" style={{width: `${(step / STEPS.length) * 100}%`}} />
          </div>
        )}
      </div>

      <div className="main-content">

        {/* ══════════════════════════════════
            SCREEN: History (生成履歴)
           ══════════════════════════════════ */}
        {screen === 'history' && (
          <div className="card anim-fade-up">
            <div className="card-header">
              <span className="card-emoji">🕐</span>
              <div className="card-title">生成履歴</div>
              <div className="card-desc">過去に生成したPDFの一覧です</div>
            </div>
            {history.length > 0 ? (
              <>
                <div className="history-list">
                  {history.map(h => (
                    <div key={h.id} className="history-item">
                      <div className="history-item-info">
                        <div className="history-item-name">
                          {presetEmoji(h.latexPreset)} {h.templateName}
                        </div>
                        <div className="history-item-meta">
                          {h.numQuestions}問 ・ {new Date(h.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="history-item-actions">
                        {h.pdfUrl && (
                          <a href={h.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-outline" style={{padding: '6px 12px', fontSize: 12}}>
                            <Ico.ExternalLink /> 開く
                          </a>
                        )}
                        <button
                          className="btn btn-ghost"
                          style={{padding: '6px 8px', color: 'var(--c-danger)'}}
                          onClick={() => { deleteFromHistory(h.id); setHistory(loadHistory()) }}
                        >
                          <Ico.Trash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-outline btn-block"
                  style={{marginTop: 16}}
                  onClick={() => { if (window.confirm('全ての履歴を削除しますか？')) { clearHistory(); setHistory([]) } }}
                >
                  履歴をすべて削除
                </button>
              </>
            ) : (
              <div className="base-empty">
                <div className="base-empty-icon"><Ico.Clock /></div>
                <div>まだ生成履歴がありません</div>
                <div className="field-hint">PDFを生成すると、ここに記録されます</div>
              </div>
            )}
            <div className="mobile-sticky-action">
              <button className="btn btn-primary btn-block btn-lg" onClick={() => setScreen('main')}>
                <Ico.ArrowLeft /> 戻る
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            SCREEN: Settings (設定)
           ══════════════════════════════════ */}
        {screen === 'settings' && (
          <div className="card anim-fade-up">
            <div className="card-header">
              <span className="card-emoji">⚙️</span>
              <div className="card-title">設定</div>
              <div className="card-desc">アプリの動作をカスタマイズ</div>
            </div>

            <div className="field" style={{marginBottom: 20}}>
              <label className="field-label">デフォルト問題数</label>
              <div className="num-questions-selector">
                {[1, 2, 3, 5, 10].map(n => (
                  <button
                    key={n}
                    className={`num-btn ${settings.defaultNumQuestions === n ? 'active' : ''}`}
                    onClick={() => { const s = { ...settings, defaultNumQuestions: n }; setSettings(s); saveSettings(s) }}
                  >
                    {n}問
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{marginBottom: 20}}>
              <label className="field-label">デフォルト出力形式</label>
              <div className="preset-chips">
                {latexPresets.map(p => (
                  <button
                    key={p.id}
                    className={`preset-chip ${settings.defaultLatexPreset === p.id ? 'active' : ''}`}
                    onClick={() => { const s = { ...settings, defaultLatexPreset: p.id }; setSettings(s); saveSettings(s) }}
                  >
                    <span className="preset-chip-emoji">{presetEmoji(p.id)}</span>
                    <span className="preset-chip-label">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{marginBottom: 20}}>
              <label className="field-label">デフォルトベース問題モード</label>
              <div className="base-mode-tabs">
                {[
                  { key: 'db', icon: <Ico.Database />, label: 'DB' },
                  { key: 'pdf', icon: <Ico.Pdf />, label: 'PDF' },
                  { key: 'skip', icon: <Ico.Skip />, label: 'スキップ' },
                ].map(m => (
                  <button
                    key={m.key}
                    className={`base-mode-tab ${settings.defaultBaseMode === m.key ? 'active' : ''}`}
                    onClick={() => { const s = { ...settings, defaultBaseMode: m.key }; setSettings(s); saveSettings(s) }}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-divider" />

            <div className="field" style={{marginBottom: 20}}>
              <label className="field-label">その他</label>
              <button
                className="btn btn-outline btn-block"
                style={{marginBottom: 8}}
                onClick={() => { setScreen('legal'); setLegalTab('terms') }}
              >
                <Ico.Shield /> 利用規約
              </button>
              <button
                className="btn btn-outline btn-block"
                style={{marginBottom: 8}}
                onClick={() => { setScreen('legal'); setLegalTab('privacy') }}
              >
                <Ico.Shield /> プライバシーポリシー
              </button>
              <button
                className="btn btn-outline btn-block"
                onClick={() => { setShowOnboarding(true) }}
              >
                チュートリアルを再表示
              </button>
            </div>

            <div className="settings-app-info">
              <div className="settings-app-version">⚛️ 物理AI v1.0.0</div>
              <div className="field-hint">物理×AI 類題生成 — 高校・受験・大学対応</div>
            </div>

            <div className="mobile-sticky-action">
              <button className="btn btn-primary btn-block btn-lg" onClick={() => setScreen('main')}>
                <Ico.ArrowLeft /> 戻る
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            SCREEN: Legal (利用規約・プライバシーポリシー)
           ══════════════════════════════════ */}
        {screen === 'legal' && (
          <div className="card anim-fade-up">
            <div className="legal-tabs">
              <button
                className={`legal-tab ${legalTab === 'terms' ? 'active' : ''}`}
                onClick={() => setLegalTab('terms')}
              >
                利用規約
              </button>
              <button
                className={`legal-tab ${legalTab === 'privacy' ? 'active' : ''}`}
                onClick={() => setLegalTab('privacy')}
              >
                プライバシーポリシー
              </button>
            </div>

            {legalTab === 'terms' && (
              <div className="legal-content anim-fade-up">
                <h3>利用規約</h3>
                <p className="legal-date">最終更新日: 2025年1月1日</p>

                <h4>第1条（適用）</h4>
                <p>本規約は、本アプリ「類題生成」（以下「本サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意の上、本サービスを利用するものとします。</p>

                <h4>第2条（サービス内容）</h4>
                <p>本サービスは、教育目的で問題の類題を生成するためのツールです。AIによる問題生成は外部サービス（ChatGPT、Claude等）を利用します。本サービスは問題データベースの検索とPDF生成機能を提供します。</p>

                <h4>第3条（利用条件）</h4>
                <p>ユーザーは以下の行為を行ってはなりません：</p>
                <ul>
                  <li>法令または公序良俗に違反する行為</li>
                  <li>本サービスの運営を妨害する行為</li>
                  <li>他のユーザーに不利益を与える行為</li>
                  <li>生成されたコンテンツの不正利用</li>
                </ul>

                <h4>第4条（知的財産権）</h4>
                <p>本サービスを通じて生成された問題の著作権は、元の問題の権利関係に従います。ユーザーは、生成された問題を教育目的の範囲内で利用できます。</p>

                <h4>第5条（免責事項）</h4>
                <p>本サービスは「現状有姿」で提供されます。生成された問題の正確性・完全性について保証するものではありません。本サービスの利用により生じた損害について、運営者は責任を負いません。</p>

                <h4>第6条（サービスの変更・停止）</h4>
                <p>運営者は、事前の通知なくサービスの内容を変更、または一時的もしくは永続的にサービスを停止することがあります。</p>

                <h4>第7条（規約の変更）</h4>
                <p>運営者は、必要に応じて本規約を変更することがあります。変更後の規約は、本アプリ上での掲示をもって効力を生じるものとします。</p>
              </div>
            )}

            {legalTab === 'privacy' && (
              <div className="legal-content anim-fade-up">
                <h3>プライバシーポリシー</h3>
                <p className="legal-date">最終更新日: 2025年1月1日</p>

                <h4>1. 収集する情報</h4>
                <p>本サービスでは、以下の情報を収集する場合があります：</p>
                <ul>
                  <li>利用状況に関する情報（利用回数、機能の使用状況等）</li>
                  <li>アップロードされたPDFファイルの内容（一時的な処理のみ）</li>
                  <li>デバイス情報（OS、ブラウザの種類等）</li>
                </ul>

                <h4>2. 情報の利用目的</h4>
                <p>収集した情報は、以下の目的で利用します：</p>
                <ul>
                  <li>サービスの提供・改善</li>
                  <li>ユーザーサポート</li>
                  <li>利用状況の分析</li>
                </ul>

                <h4>3. 情報の保存</h4>
                <p>生成履歴や設定情報は、お使いのデバイスのローカルストレージに保存されます。サーバーにユーザーの個人情報を保存することはありません。アップロードされたPDFは処理完了後にサーバーから削除されます。</p>

                <h4>4. 第三者への提供</h4>
                <p>収集した情報を第三者に提供することはありません。ただし、法令に基づく要請がある場合を除きます。</p>

                <h4>5. 外部サービスとの連携</h4>
                <p>本サービスでは、外部AIサービス（OpenAI、Anthropic等）の利用を推奨しています。これらのサービスの利用には、各サービスの利用規約・プライバシーポリシーが適用されます。</p>

                <h4>6. お問い合わせ</h4>
                <p>プライバシーに関するお問い合わせは、アプリ内のお問い合わせ機能よりご連絡ください。</p>
              </div>
            )}

            <div className="mobile-sticky-action">
              <button className="btn btn-primary btn-block btn-lg" onClick={() => setScreen('settings')}>
                <Ico.ArrowLeft /> 設定に戻る
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            SCREEN: Main (メイン画面)
           ══════════════════════════════════ */}
        {screen === 'main' && mode === 'user' ? (
          <>
            {/* ── FLOW OVERVIEW (desktop only) ── */}
            <div className="flow-overview desktop-only">
              <span>パターン選択</span>
              <span className="flow-arrow">→</span>
              <span>問題数・ベース問題</span>
              <span className="flow-arrow">→</span>
              <span className="flow-external">AI依頼 & 結果入力</span>
              <span className="flow-arrow">→</span>
              <span>PDF完成</span>
            </div>

            {/* ── PROGRESS BAR (desktop only) ── */}
            <div className="progress-bar desktop-only">
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
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`progress-line ${step > s.n ? 'filled' : ''}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="progress-percentage desktop-only">
              ステップ {step} / {STEPS.length}
            </div>

            {/* ══════════════════════════════════
                STEP 1 — 出題パターンを選ぶ
               ══════════════════════════════════ */}
            {step === 1 && (
              <div className="card anim-fade-up mobile-card">
                <div className="card-header mobile-card-header">
                  <span className="card-emoji">⚛️</span>
                  <div className="card-title">出題パターンを選ぶ</div>
                  <div className="card-desc mobile-card-desc">物理を中心に、数学・英語など各科目のパターンが揃っています</div>
                </div>

                {/* Physics Hero Banner */}
                <div className="physics-hero-banner">
                  <div className="physics-hero-content">
                    <div className="physics-hero-title">⚛️ 物理の類題生成</div>
                    <div className="physics-hero-subtitle">高校生・受験生・大学生向け</div>
                  </div>
                  <div className="physics-hero-pills">
                    <span>力学</span>
                    <span>電磁気</span>
                    <span>波動</span>
                    <span>熱力学</span>
                  </div>
                </div>

                <div className="tip mobile-tip-compact">
                  <span className="tip-icon">💡</span>
                  <div>物理（力学・電磁気・波動・熱力学）から選ぶことをおすすめします。他教科にも対応しています</div>
                </div>

                <div className="pattern-grid">
                  {[...templates].sort((a, b) => {
                    const aPhys = (a.metadata?.subject || '').includes('物理') ? -1 : 0
                    const bPhys = (b.metadata?.subject || '').includes('物理') ? -1 : 0
                    return aPhys - bPhys
                  }).map(t => {
                    const meta = t.metadata || {}
                    const isSelected = form.templateId === t.id
                    const isPhysics = (meta.subject || '').includes('物理')
                    return (
                      <div
                        key={t.id}
                        className={`pattern-card ${isSelected ? 'selected' : ''} ${isPhysics ? 'physics' : ''}`}
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
                          {meta.subject && <span className={`pattern-tag ${isPhysics ? 'physics-tag' : ''}`}>{meta.subject}</span>}
                          {meta.field && <span className="pattern-tag">{meta.field}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Mobile: sticky bottom action */}
                <div className="mobile-sticky-action">
                  <button
                    className="btn btn-primary btn-block btn-lg"
                    onClick={() => { if (form.templateId) { fetchBaseProblems(form.templateId); setStep(2) } }}
                    disabled={!form.templateId}
                  >
                    次へ進む <Ico.ArrowRight />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════
                STEP 2 — 問題数・ベース問題
               ══════════════════════════════════ */}
            {step === 2 && (
              <div className="card anim-fade-up">
                <div className="card-header">
                  <span className="card-emoji">⚙️</span>
                  <div className="card-title">問題数・ベース問題を設定</div>
                  <div className="card-desc">生成する問題数と、参考にするベース問題を設定してください</div>
                </div>

                {selectedTemplate && (
                  <div className="selected-pattern-badge">
                    <span>選択中：</span>
                    <strong>{selectedTemplate.name || selectedTemplate.id}</strong>
                    {templateMeta.subject && <span className="pattern-tag">{templateMeta.subject}</span>}
                  </div>
                )}

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
                <div className="field" style={{marginBottom: 20}}>
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

                {/* ── ベース問題選択セクション ── */}
                <div className="field" style={{marginBottom: 20}}>
                  <label className="field-label">ベース問題（参考にする問題）</label>
                  <div className="card-desc" style={{marginBottom: 12, fontSize: 13}}>参考にする問題をDBから選ぶか、PDFをアップロードしてください。スキップも可能です。</div>

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

                </div>

                <div className="mobile-sticky-action">
                  <div className="btn-row btn-row-2">
                    <button className="btn btn-outline btn-lg" onClick={() => setStep(1)}>
                      <Ico.ArrowLeft /> 戻る
                    </button>
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={generatePrompt}
                      disabled={loading || (baseMode === 'db' && !selectedBaseProblem) || (baseMode === 'pdf' && !basePdfData)}
                    >
                      指示文を作成 <Ico.ArrowRight />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════
                STEP 3 — AI依頼 & 結果入力 (統合)
               ══════════════════════════════════ */}
            {step === 3 && (
              <div className="card anim-fade-up mobile-card">
                <div className="card-header mobile-card-header">
                  <span className="card-emoji">🤖</span>
                  <div className="card-title">AIに依頼 → 結果を入力</div>
                  <div className="card-desc mobile-card-desc">指示文をAIに送り、返ってきたコードを貼り付けてください</div>
                </div>

                {/* ─── Section A: Prompt copy ─── */}
                <div className="mobile-section">
                  <div className="mobile-section-label">
                    <span className="mobile-section-badge">A</span>
                    指示文をコピーしてAIに送信
                  </div>

                  {/* Mobile: quick action buttons first */}
                  <div className="mobile-action-group">
                    <button className="btn btn-primary btn-block btn-lg" onClick={copyPrompt}>
                      <Ico.Copy /> 指示文をコピー
                    </button>
                    <div className="mobile-ai-links">
                      <a href="https://chat.openai.com/" target="_blank" rel="noreferrer" className="mobile-ai-link">
                        <Ico.ExternalLink /> ChatGPTで開く
                      </a>
                      <a href="https://claude.ai/" target="_blank" rel="noreferrer" className="mobile-ai-link">
                        <Ico.ExternalLink /> Claudeで開く
                      </a>
                    </div>
                  </div>

                  {baseMode === 'pdf' && basePdfData && (
                    <div className="mobile-alert">
                      <span className="mobile-alert-icon">📎</span>
                      ベースPDF「{basePdfData.filename}」もAIに添付してください
                    </div>
                  )}

                  {/* Collapsible prompt preview (desktop: always visible) */}
                  <button
                    className="mobile-toggle-preview"
                    onClick={() => setShowPromptSection(p => !p)}
                  >
                    {showPromptSection ? '指示文を隠す' : '指示文を確認する'}
                    {showPromptSection ? <Ico.ChevronUp /> : <Ico.ChevronDown />}
                  </button>

                  {showPromptSection && (
                    <div className="prompt-preview anim-fade-up">{prompt}</div>
                  )}

                  <div className="step4-badges">
                    {ragCtx?.chunk_count > 0 && (
                      <span className="rag-badge">📚 {ragCtx.chunk_count}件参照</span>
                    )}
                    {currentPreset && (
                      <span className="rag-badge">📄 {currentPreset.name}</span>
                    )}
                    {baseMode === 'db' && selectedBaseProblem && (
                      <span className="rag-badge">🎯 ベース問題済</span>
                    )}
                  </div>
                </div>

                <div className="mobile-divider" />

                {/* ─── Section B: Paste & Generate PDF ─── */}
                <div className="mobile-section">
                  <div className="mobile-section-label">
                    <span className="mobile-section-badge mobile-section-badge-b">B</span>
                    AIの出力を貼り付け
                  </div>

                  <div className="field">
                    <textarea
                      className="input manual-textarea"
                      placeholder={"\\documentclass{article}\n...\n\\end{document}"}
                      value={llmOutput}
                      onChange={e => setLlmOutput(e.target.value)}
                    />
                    {llmOutput.trim() && (
                      <div className="latex-validation-hints">
                        <span className={llmOutput.includes('\\documentclass') ? 'hint-ok' : 'hint-warn'}>
                          {llmOutput.includes('\\documentclass') ? '✅' : '⚠️'} documentclass
                        </span>
                        <span className={llmOutput.includes('\\end{document}') ? 'hint-ok' : 'hint-warn'}>
                          {llmOutput.includes('\\end{document}') ? '✅' : '⚠️'} end
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile sticky bottom actions */}
                <div className="mobile-sticky-action">
                  <button
                    className="btn btn-success btn-block btn-lg"
                    onClick={generatePdf}
                    disabled={loading || !llmOutput.trim()}
                  >
                    <Ico.Zap /> PDF を生成する
                  </button>
                  <button className="btn btn-outline btn-block" onClick={() => setStep(2)}>
                    <Ico.ArrowLeft /> 戻る
                  </button>
                </div>
              </div>
            )}


            {/* ══════════════════════════════════
                STEP 4 — 完了
               ══════════════════════════════════ */}
            {step === 4 && (
              <div className="card anim-fade-up mobile-card mobile-success-card">
                <div className="success-screen">
                  <div className="success-icon">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div className="card-title" style={{fontSize:22, marginBottom:8}}>PDF作成完了！</div>
                  <div className="card-desc mobile-card-desc" style={{marginBottom:24}}>
                    PDFが完成しました
                  </div>
                  <div className="mobile-sticky-action">
                    <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-success btn-block btn-lg">
                      <Ico.ExternalLink /> PDFを開く
                    </a>
                    <button className="btn btn-outline btn-block btn-lg" onClick={resetWizard}>
                      <Ico.RotateCcw /> もう一度作る
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : screen === 'main' && mode === 'dev' ? (
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
        ) : null}
      </div>

      {/* ── Floating Help Button (desktop only) ── */}
      <button className="help-floating desktop-only" onClick={() => setShowHelp(true)} title="ヘルプ">
        <Ico.Help />
      </button>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="mobile-bottom-nav mobile-only">
        <button
          className={`mobile-nav-item ${screen === 'main' && step === 1 ? 'active' : ''} ${screen === 'main' && step > 1 ? 'done' : ''}`}
          onClick={() => { setScreen('main'); step >= 1 && setStep(1) }}
        >
          <span className="mobile-nav-icon">📝</span>
          <span className="mobile-nav-label">パターン</span>
        </button>
        <button
          className={`mobile-nav-item ${screen === 'main' && step === 2 ? 'active' : ''} ${screen === 'main' && step > 2 ? 'done' : ''}`}
          onClick={() => { setScreen('main'); step >= 2 && setStep(2) }}
          disabled={screen === 'main' && step < 2}
        >
          <span className="mobile-nav-icon">⚙️</span>
          <span className="mobile-nav-label">問題設定</span>
        </button>
        <button
          className={`mobile-nav-item ${screen === 'history' ? 'active' : ''}`}
          onClick={() => { setScreen('history'); setHistory(loadHistory()) }}
        >
          <span className="mobile-nav-icon">🕐</span>
          <span className="mobile-nav-label">履歴</span>
        </button>
        <button
          className={`mobile-nav-item ${screen === 'settings' || screen === 'legal' ? 'active' : ''}`}
          onClick={() => setScreen('settings')}
        >
          <span className="mobile-nav-icon">⚙️</span>
          <span className="mobile-nav-label">設定</span>
        </button>
        <button className="mobile-nav-item" onClick={() => setShowHelp(true)}>
          <span className="mobile-nav-icon">❓</span>
          <span className="mobile-nav-label">ヘルプ</span>
        </button>
      </nav>

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

                <dt>Q: ステップ4の「セクションA」が閉じています</dt>
                <dd>セクションAは折りたたみ可能です。クリックして展開すると、
                    指示文のコピーとAIサービスへのリンクが表示されます。
                    既にLaTeXコードをお持ちの場合は、セクションBに直接貼り付けてPDFを生成できます。</dd>

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
