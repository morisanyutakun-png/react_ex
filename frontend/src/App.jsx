import React, { useState, useEffect, useCallback, useRef } from 'react'

/* ============================
   CSS-in-JS テーマ（plan.tex のカラーパレット準拠）
   ============================ */
const C = {
  primary: '#1A5276',
  secondary: '#2E86C1',
  accent: '#E67E22',
  success: '#27AE60',
  danger: '#C0392B',
  lightbg: '#EBF5FB',
  lightaccent: '#FEF5E7',
  lightgray: '#F2F3F4',
  darktext: '#2C3E50',
  white: '#FFFFFF',
  border: '#D6DBDF',
  cardShadow: '0 2px 8px rgba(26,82,118,0.08)',
}

export default function App() {
  /* ============================
     共有 state
     ============================ */
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('info') // 'info','success','error','warning'
  const [mode, setMode] = useState('user')
  const [templates, setTemplates] = useState([])
  const [subjects, setSubjects] = useState(['数学','物理','英語','化学','生物','情報'])
  const [difficulties] = useState(['易','普通','難'])
  const DIFFICULTY_MAP = { '易': 0.2, '普通': 0.5, '難': 0.8 }

  /* ============================
     ユーザモード専用 state
     ============================ */
  const [userStep, setUserStep] = useState(1)
  const [userTemplateId, setUserTemplateId] = useState('')
  const [userSubject, setUserSubject] = useState('数学')
  const [userDifficulty, setUserDifficulty] = useState('普通')
  const [userNumQuestions, setUserNumQuestions] = useState(3)
  const [userPrompt, setUserPrompt] = useState('')
  const [userRenderContext, setUserRenderContext] = useState(null)
  const [userLlmOutput, setUserLlmOutput] = useState('')
  const [lastPdfUrl, setLastPdfUrl] = useState('')
  const [pdfWorking, setPdfWorking] = useState(false)
  // 問題抽出（ファイルアップロード）
  const [sourceText, setSourceText] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const fileInputRef = useRef(null)

  /* ============================
     開発モード専用 state
     ============================ */
  const [devTemplateId, setDevTemplateId] = useState('')
  const [devSubject, setDevSubject] = useState('数学')
  const [devField, setDevField] = useState('')
  const [devDifficulty, setDevDifficulty] = useState('普通')
  const [devNumQuestions, setDevNumQuestions] = useState(1)
  const [devBasePrompt, setDevBasePrompt] = useState('')
  const [devRagPrompt, setDevRagPrompt] = useState('')
  const [devRetrievedChunks, setDevRetrievedChunks] = useState([])
  const [devLlmOutput, setDevLlmOutput] = useState('')
  const [devDocId, setDevDocId] = useState('')
  const [devDocEntries, setDevDocEntries] = useState([])
  const [devTuningScore, setDevTuningScore] = useState('')
  const [devTuningNotes, setDevTuningNotes] = useState('')
  const [devExpectedOutput, setDevExpectedOutput] = useState('')
  const [topK, setTopK] = useState(5)
  const [difficultyMatchWeight, setDifficultyMatchWeight] = useState(0.6)
  const [trickinessWeight, setTrickinessWeight] = useState(0.0)
  const [textWeight, setTextWeight] = useState(0.5)
  const [showNewTplForm, setShowNewTplForm] = useState(false)
  const [newTplSubject, setNewTplSubject] = useState('')
  const [newTplField, setNewTplField] = useState('')
  const [newTplDifficulty, setNewTplDifficulty] = useState('普通')
  const [newTplSaving, setNewTplSaving] = useState(false)
  const [devCurrentStep, setDevCurrentStep] = useState(1)

  /* ============================
     Status helper
     ============================ */
  const notify = (msg, type = 'info') => { setStatus(msg); setStatusType(type) }

  /* ============================
     Template helpers
     ============================ */
  const refreshTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates')
      const j = await res.json()
      if (res.ok) {
        const tpls = j.templates || []
        setTemplates(tpls)
        const extraSubjects = new Set(subjects)
        tpls.forEach(t => { if (t.metadata?.subject) extraSubjects.add(t.metadata.subject) })
        setSubjects(Array.from(extraSubjects))
        return tpls
      }
    } catch (e) { console.warn('templates fetch failed', e) }
    return []
  }, [])

  useEffect(() => { refreshTemplates() }, [])

  useEffect(() => {
    try {
      if (mode === 'user' && templates?.length > 0 && !userTemplateId) {
        const first = templates[0]
        setUserTemplateId(first.id || '')
        if (first.metadata?.subject) setUserSubject(first.metadata.subject)
      }
    } catch (e) { console.warn('auto-select user template failed', e) }
  }, [templates, mode])

  const getTemplate = (id) => templates.find(t => t.id === id) || null

  const onSelectDevTemplate = (tplId) => {
    setDevTemplateId(tplId)
    const tpl = getTemplate(tplId)
    if (tpl?.metadata) {
      if (tpl.metadata.subject) setDevSubject(tpl.metadata.subject)
      if (tpl.metadata.field) setDevField(tpl.metadata.field)
      if (tpl.metadata.difficulty && difficulties.includes(tpl.metadata.difficulty)) setDevDifficulty(tpl.metadata.difficulty)
    } else { setDevField('') }
    setDevBasePrompt(''); setDevRagPrompt(''); setDevRetrievedChunks([]); setDevCurrentStep(1)
  }

  const onSelectUserTemplate = (tplId) => {
    setUserTemplateId(tplId)
    const tpl = getTemplate(tplId)
    if (tpl?.metadata) {
      if (tpl.metadata.subject) setUserSubject(tpl.metadata.subject)
      if (tpl.metadata.difficulty && difficulties.includes(tpl.metadata.difficulty)) setUserDifficulty(tpl.metadata.difficulty)
    }
  }

  const selectedDevTemplate = getTemplate(devTemplateId)

  /* ============================
     テンプレート追加
     ============================ */
  const saveNewTemplate = async (subject, field, difficulty) => {
    const s = String(subject || '').trim()
    if (!s) { notify('教科を選択してください', 'error'); return }
    const f = String(field || '').trim()
    const d = String(difficulty || '普通').trim()
    const label = f ? s + '（' + f + '）' : s
    const name = label + ' テンプレート'
    const id = (f ? s + '_' + f : s).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\u3040-\u9fff\-]/g, '') || ('tpl_' + Date.now())
    const desc = label + ' の問題を生成するテンプレート（自動生成）'
    const promptLines = [
      '科目: {subject}', f ? '分野: ' + f : null, '難易度: {difficulty}', '出題数: {num_questions}', '',
      '指示:', '以下の条件で' + label + 'の問題を出題してください。',
      f ? '特に「' + f + '」の範囲を重点的に扱ってください。' : null, '',
      '- 出力形式: LaTeX（\\documentclass から \\end{document} まで完全な文書）',
      '- 問題と解答・解説を必ず含めること', '- 問題数は {num_questions} 問とする',
      '- 難易度は「{difficulty}」レベルに合わせること',
    ].filter(l => l !== null).join('\n')
    const body = { id, name, description: desc, prompt: promptLines,
      metadata: { subject: s, field: f || null, difficulty: d, auto_generated: true } }
    setNewTplSaving(true); notify('テンプレート保存中...', 'info')
    try {
      const res = await fetch('/api/template', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json().catch(() => null)
      if (!res.ok) { notify('保存失敗: ' + (j?.detail || j?.error || res.statusText), 'error'); setNewTplSaving(false); return }
      notify('テンプレート「' + label + '」を作成しました', 'success')
      if (!subjects.includes(s)) setSubjects(prev => [...prev, s])
      await refreshTemplates()
      setNewTplSubject(''); setNewTplField(''); setNewTplDifficulty('普通'); setShowNewTplForm(false)
    } catch (e) { notify('エラー: ' + e.message, 'error') }
    setNewTplSaving(false)
  }

  /* ============================
     ファイルアップロード（問題抽出）
     ============================ */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true); notify('ファイルからテキストを抽出中...', 'info')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/extract_text', { method: 'POST', body: formData })
      const j = await res.json()
      if (!res.ok) { notify('抽出失敗: ' + (j?.detail || j?.error || res.statusText), 'error'); setUploadingFile(false); return }
      setSourceText(j.extracted_text || '')
      setUploadedFileName(j.filename || file.name)
      notify(`${j.filename} から ${j.char_count} 文字を抽出しました${j.truncated ? '（10,000文字に切り詰め）' : ''}`, 'success')
    } catch (e) { notify('抽出エラー: ' + e.message, 'error') }
    setUploadingFile(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /* ============================
     Dev mode STEP functions
     ============================ */
  const devGenerateBasePrompt = async () => {
    if (!devTemplateId) { notify('テンプレートを選択してください', 'error'); return }
    notify('テンプレートをレンダリング中...', 'info')
    try {
      const body = { template_id: devTemplateId, subject: devSubject, difficulty: devDifficulty, num_questions: devNumQuestions, rag_inject: false }
      const res = await fetch('/api/template_render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { notify('エラー: ' + (j.detail || res.statusText), 'error'); return }
      setDevBasePrompt(j.rendered_prompt || j.rendered || '')
      setDevRagPrompt(''); setDevRetrievedChunks([]); setDevCurrentStep(2)
      notify('ベースプロンプト生成完了', 'success')
    } catch (e) { notify('生成エラー: ' + e.message, 'error') }
  }

  const devInjectRag = async () => {
    if (!devBasePrompt) return notify('まずSTEP1でベースプロンプトを生成してください', 'warning')
    notify('RAG を取得中...', 'info')
    try {
      const body = {
        question: devBasePrompt, top_k: Number(topK), use_vector: true,
        difficulty_match_weight: Number(difficultyMatchWeight), trickiness_weight: Number(trickinessWeight),
        text_weight: Number(textWeight),
        target_difficulty: DIFFICULTY_MAP[devDifficulty] ?? undefined,
        metadata: { subject: devSubject, field: devField || undefined },
      }
      if (devDocId) body.doc_id = devDocId
      const res = await fetch('/api/assemble_prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { notify('RAG 失敗: ' + (j.detail || res.statusText), 'error'); return }
      setDevRagPrompt(j.prompt_summarized || j.prompt || '')
      setDevRetrievedChunks(j.retrieved || []); setDevCurrentStep(3)
      notify('RAG 注入完了（' + (j.retrieved || []).length + ' 件参照）', 'success')
    } catch (e) { notify('RAG エラー: ' + e.message, 'error') }
  }

  const devUploadOutput = async () => {
    if (!devLlmOutput) return notify('LLM出力を貼り付けてください', 'warning')
    notify('DBに保存中...', 'info')
    try {
      const res = await fetch('/api/upload_json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex: devLlmOutput }) })
      const j = await res.json()
      if (!res.ok) { notify('保存失敗: ' + (j.detail || res.statusText), 'error'); return }
      setDevDocId(j.doc_id || ''); setDevCurrentStep(4)
      notify('DB保存完了 doc_id=' + (j.doc_id || ''), 'success')
    } catch (e) { notify('保存エラー: ' + e.message, 'error') }
  }

  const devSaveTuningLog = async () => {
    if (!devLlmOutput) return notify('LLM出力がありません', 'warning')
    notify('チューニングログを保存中...', 'info')
    try {
      const tpl = selectedDevTemplate || {}
      const body = {
        prompt: devRagPrompt || devBasePrompt, model_output: devLlmOutput,
        expected_output: devExpectedOutput || undefined,
        score: devTuningScore !== '' ? Number(devTuningScore) : undefined,
        notes: devTuningNotes || undefined,
        metadata: { template_id: devTemplateId || null, subject: devSubject || null,
          difficulty: devDifficulty || null, field: devField || tpl.metadata?.field || null, doc_id: devDocId || null },
      }
      const res = await fetch('/api/tuning/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { notify('保存失敗: ' + (j.detail || res.statusText), 'error'); return }
      notify('チューニングログ保存完了', 'success')
      setDevTuningScore(''); setDevTuningNotes(''); setDevExpectedOutput('')
    } catch (e) { notify('保存エラー: ' + e.message, 'error') }
  }

  const fetchDocEntries = async () => {
    if (!devDocId) return notify('doc_id がありません', 'warning')
    try {
      const res = await fetch('/api/doc/' + devDocId + '/entries')
      const j = await res.json()
      if (!res.ok) { notify('DB取得エラー', 'error'); return }
      setDevDocEntries(j.rows || []); notify('DB取得完了: ' + (j.rows || []).length + '件', 'success')
    } catch (e) { notify('エラー: ' + e.message, 'error') }
  }

  /* ============================
     ユーザモード: プロンプト生成（RAG含む）
     ============================ */
  const userGeneratePrompt = async () => {
    if (!userTemplateId) { notify('テンプレートを選択してください', 'error'); return }
    notify('プロンプトを生成中...', 'info')
    try {
      const body = {
        template_id: userTemplateId, subject: userSubject, difficulty: userDifficulty,
        num_questions: userNumQuestions, rag_inject: true, subject_filter: userSubject,
        user_mode: true, top_k: Number(topK),
        source_text: sourceText || undefined,
      }
      const res = await fetch('/api/template_render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { notify('エラー: ' + (j.detail || res.statusText), 'error'); return }
      setUserRenderContext(j.context || null)
      setUserPrompt(j.rendered_prompt || j.rendered || '')
      setUserStep(2)
      const chunkCount = j.context?.chunk_count || 0
      notify('プロンプト生成完了' + (chunkCount > 0 ? `（RAG ${chunkCount} 件参照）` : ''), 'success')
    } catch (e) { notify('生成エラー: ' + e.message, 'error') }
  }

  const userCompilePdf = async () => {
    const latex = userLlmOutput
    if (!latex?.trim()) return notify('LaTeX を貼り付けてください', 'warning')
    setPdfWorking(true); notify('PDF を生成中...', 'info')
    try {
      const res = await fetch('/api/generate_pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex, title: 'Generated', return_url: true }) })
      if (res.ok) {
        const j = await res.json().catch(() => null)
        if (j?.pdf_url) { setLastPdfUrl(j.pdf_url); window.open(j.pdf_url, '_blank'); notify('PDF を開きました', 'success') }
        else { const blob = await res.blob(); window.open(URL.createObjectURL(blob), '_blank'); notify('PDF を表示しました', 'success') }
        setUserStep(4)
      } else {
        const je = await res.json().catch(() => null)
        notify('PDF 生成失敗: ' + (je?.detail || je?.error || res.statusText), 'error')
      }
    } catch (e) { notify('エラー: ' + e.message, 'error') }
    setPdfWorking(false)
  }

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); notify('コピーしました', 'success') }
    catch (e) { notify('コピー失敗: ' + e.message, 'error') }
  }

  const difficultyLabel = (v) => {
    if (v == null || v === '') return '—'
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    if (n < 0.18) return '非常に易い'
    if (n < 0.36) return '易い'
    if (n < 0.55) return '普通'
    if (n < 0.75) return '難しい'
    return '非常に難しい'
  }

  const devFilteredTemplates = templates.filter(t => {
    if (!devSubject) return true
    return !t.metadata?.subject || t.metadata.subject === devSubject
  })

  /* ============================
     STYLE HELPERS
     ============================ */
  const card = (extra = {}) => ({
    background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: '20px 24px', marginBottom: 16, boxShadow: C.cardShadow, ...extra,
  })
  const stepCard = (active, done) => ({
    ...card(), borderLeft: active ? `4px solid ${C.secondary}` : done ? `4px solid ${C.success}` : `4px solid ${C.border}`,
    opacity: active || done ? 1 : 0.6, transition: 'all 0.2s ease',
  })
  const stepBadge = (num, active, done) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: '50%', fontWeight: 700, fontSize: 14,
    background: done ? C.success : active ? C.secondary : '#D5D8DC', color: C.white,
    flexShrink: 0,
  })
  const btn = (color, textColor = C.white) => ({
    padding: '10px 20px', borderRadius: 8, border: 'none', background: color,
    color: textColor, fontWeight: 600, fontSize: 14, cursor: 'pointer',
    transition: 'opacity 0.15s', display: 'inline-flex', alignItems: 'center', gap: 6,
  })
  const btnOutline = (color) => ({
    ...btn(C.white, color), border: `1.5px solid ${color}`,
  })
  const inputStyle = {
    padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
    fontSize: 14, outline: 'none', transition: 'border-color 0.15s',
  }
  const selectSt = { ...inputStyle, background: C.white }
  const labelSt = { fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block', color: C.darktext }
  const textareaSt = {
    width: '100%', fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    fontSize: 13, padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`,
    background: '#FAFBFC', lineHeight: 1.5, resize: 'vertical', outline: 'none',
  }
  const tag = (bg, fg) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
    background: bg, borderRadius: 20, fontSize: 12, color: fg, fontWeight: 500,
  })
  const statusColors = { info: C.secondary, success: C.success, error: C.danger, warning: C.accent }

  /* ============================
     USER MODE STEP INDICATORS
     ============================ */
  const userSteps = [
    { num: 1, title: '条件設定', desc: 'テンプレート・科目・難易度・問数を指定' },
    { num: 2, title: 'プロンプト確認', desc: 'LLMに送るプロンプトを確認・コピー' },
    { num: 3, title: 'LaTeX貼り付け', desc: 'LLMの出力をここに貼り付け' },
    { num: 4, title: 'PDF生成', desc: '体裁の整ったPDFを生成・表示' },
  ]

  /* ============================
     RENDER
     ============================ */
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${C.lightbg} 0%, #F8F9FA 100%)` }}>
      {/* ── ヘッダー ── */}
      <header style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, ${C.secondary} 100%)`,
        padding: '16px 0', boxShadow: '0 2px 12px rgba(26,82,118,0.15)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📚</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.white, letterSpacing: '-0.3px' }}>類題生成アプリ</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>テンプレート + RAG + LaTeX → PDF</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 3 }}>
            <button onClick={() => setMode('user')} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: mode === 'user' ? C.white : 'transparent', color: mode === 'user' ? C.primary : 'rgba(255,255,255,0.8)',
              transition: 'all 0.2s',
            }}>ユーザモード</button>
            <button onClick={() => setMode('dev')} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: mode === 'dev' ? C.white : 'transparent', color: mode === 'dev' ? C.primary : 'rgba(255,255,255,0.8)',
              transition: 'all 0.2s',
            }}>開発モード</button>
          </div>
        </div>
      </header>

      {/* ── ステータスバー ── */}
      {status && (
        <div style={{
          maxWidth: 960, margin: '12px auto 0', padding: '0 24px',
        }}>
          <div style={{
            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: statusType === 'success' ? '#E8F8F0' : statusType === 'error' ? '#FDEDEC' : statusType === 'warning' ? C.lightaccent : C.lightbg,
            color: statusColors[statusType] || C.secondary,
            border: `1px solid ${statusType === 'success' ? '#A9DFBF' : statusType === 'error' ? '#F5B7B1' : statusType === 'warning' ? '#F9E79F' : '#AED6F1'}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>{statusType === 'success' ? '✓' : statusType === 'error' ? '✕' : statusType === 'warning' ? '!' : 'ℹ'}</span>
            {status}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '20px 24px 40px' }}>

        {/* ================================================================
             ユーザモード
             ================================================================ */}
        {mode === 'user' && (
          <div>
            {/* ── 操作ガイド ── */}
            <div style={{ ...card({ background: `linear-gradient(135deg, ${C.lightbg}, ${C.white})`, border: `1px solid #AED6F1` }), marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.primary, marginBottom: 12 }}>操作手順</div>
              <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                {userSteps.map((s, i) => (
                  <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                      background: userStep > s.num ? C.success : userStep === s.num ? C.secondary : '#D5D8DC',
                      color: C.white,
                    }}>{userStep > s.num ? '✓' : s.num}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: userStep >= s.num ? C.darktext : '#ABB2B9' }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{s.desc}</div>
                    </div>
                    {i < userSteps.length - 1 && <div style={{ width: 24, height: 2, background: userStep > s.num ? C.success : '#D5D8DC', marginLeft: 4, flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            </div>

            {/* ── STEP 1: 条件設定 ── */}
            <div style={stepCard(userStep === 1, userStep > 1)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={stepBadge(1, userStep === 1, userStep > 1)}>{userStep > 1 ? '✓' : '1'}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>条件を設定する</div>
                  <div style={{ fontSize: 12, color: '#888' }}>テンプレート・科目・難易度・問数を指定してプロンプトを生成</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelSt}>テンプレート</label>
                  <select value={userTemplateId} onChange={e => onSelectUserTemplate(e.target.value)} style={{ ...selectSt, width: '100%' }}>
                    <option value="">-- テンプレートを選択 --</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name || t.id}{t.metadata?.subject ? ' [' + t.metadata.subject + ']' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>科目</label>
                  <select value={userSubject} onChange={e => setUserSubject(e.target.value)} style={{ ...selectSt, width: '100%' }}>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>難易度</label>
                  <select value={userDifficulty} onChange={e => setUserDifficulty(e.target.value)} style={{ ...selectSt, width: '100%' }}>
                    {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>生成する問題数</label>
                  <input type="number" value={userNumQuestions} onChange={e => setUserNumQuestions(Number(e.target.value))} style={{ ...inputStyle, width: '100%' }} min={1} max={20} />
                </div>
              </div>

              {/* ── ファイルアップロード（問題抽出） ── */}
              <div style={{
                padding: 16, borderRadius: 10, border: `2px dashed ${C.accent}40`,
                background: C.lightaccent, marginBottom: 14,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.accent, marginBottom: 6 }}>
                  参照元の問題をアップロード（任意）
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                  PDF・テキスト・LaTeX ファイルから問題を抽出し、同じ形式・難易度で類題を生成します
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="file" ref={fileInputRef} accept=".pdf,.txt,.tex,.md,.json,.text,.latex"
                    onChange={handleFileUpload} style={{ display: 'none' }} />
                  <button onClick={() => fileInputRef.current?.click()} style={btnOutline(C.accent)} disabled={uploadingFile}>
                    {uploadingFile ? '抽出中...' : '📎 ファイルを選択'}
                  </button>
                  {uploadedFileName && (
                    <span style={tag(C.lightaccent, C.accent)}>
                      📄 {uploadedFileName}
                      <button onClick={() => { setSourceText(''); setUploadedFileName('') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 14, padding: 0, marginLeft: 4 }}>×</button>
                    </span>
                  )}
                </div>
                {sourceText && (
                  <details style={{ marginTop: 10, fontSize: 12 }}>
                    <summary style={{ cursor: 'pointer', color: C.accent, fontWeight: 600 }}>抽出されたテキストを確認</summary>
                    <textarea value={sourceText} onChange={e => setSourceText(e.target.value)}
                      rows={5} style={{ ...textareaSt, marginTop: 6, fontSize: 12 }} />
                  </details>
                )}
              </div>

              <button onClick={userGeneratePrompt} style={{ ...btn(C.primary), width: '100%', justifyContent: 'center' }} disabled={!userTemplateId}>
                プロンプトを生成する
              </button>
            </div>

            {/* ── STEP 2: プロンプト確認 ── */}
            <div style={stepCard(userStep === 2, userStep > 2)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={stepBadge(2, userStep === 2, userStep > 2)}>{userStep > 2 ? '✓' : '2'}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>プロンプトを LLM に送る</div>
                  <div style={{ fontSize: 12, color: '#888' }}>下のプロンプトをコピーして ChatGPT・Claude 等に貼り付けてください</div>
                </div>
              </div>

              {userPrompt ? (
                <div>
                  <textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)} rows={10} style={textareaSt} />
                  {userRenderContext?.chunk_count > 0 && (
                    <div style={{ ...tag(C.lightbg, C.secondary), marginTop: 8 }}>
                      📚 RAG参照: {userRenderContext.chunk_count} 件のデータを参照
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => { copyToClipboard(userPrompt); setUserStep(3) }} style={btn(C.secondary)}>📋 プロンプトをコピー</button>
                    <button onClick={() => setUserStep(3)} style={btnOutline(C.secondary)}>次のステップへ →</button>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#ABB2B9', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
                  STEP 1 でプロンプトを生成してください
                </div>
              )}
            </div>

            {/* ── STEP 3: LaTeX 貼り付け ── */}
            <div style={stepCard(userStep === 3, userStep > 3)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={stepBadge(3, userStep === 3, userStep > 3)}>{userStep > 3 ? '✓' : '3'}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>LLM の出力を貼り付け</div>
                  <div style={{ fontSize: 12, color: '#888' }}>LLM が生成した LaTeX コードをここに貼り付けてください</div>
                </div>
              </div>

              <textarea value={userLlmOutput} onChange={e => { setUserLlmOutput(e.target.value); if (e.target.value.trim()) setUserStep(Math.max(userStep, 3)) }}
                rows={10} style={textareaSt} placeholder="ChatGPT / Claude 等の出力（LaTeX）をここに貼り付け..." />

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={userCompilePdf} style={btn(C.success)} disabled={!userLlmOutput?.trim() || pdfWorking}>
                  {pdfWorking ? '⏳ 生成中...' : '📄 PDF を生成して表示'}
                </button>
              </div>
            </div>

            {/* ── STEP 4: PDF結果 ── */}
            {lastPdfUrl && (
              <div style={{ ...card({ border: `2px solid ${C.success}`, background: '#E8F8F0' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📄</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.success }}>PDF が生成されました</div>
                    <div style={{ fontSize: 12, color: '#666' }}>体裁の整った問題セットを印刷・配布できます</div>
                  </div>
                  <a href={lastPdfUrl} target="_blank" rel="noreferrer" style={{ ...btn(C.success), textDecoration: 'none' }}>PDF を開く</a>
                </div>
              </div>
            )}

            {/* ── リセット ── */}
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button onClick={() => {
                setUserStep(1); setUserPrompt(''); setUserLlmOutput(''); setLastPdfUrl('')
                setUserRenderContext(null); setSourceText(''); setUploadedFileName('')
                notify('リセットしました', 'info')
              }} style={{ ...btnOutline('#ABB2B9'), fontSize: 13 }}>最初からやり直す</button>
            </div>
          </div>
        )}

        {/* ================================================================
             開発モード
             ================================================================ */}
        {mode === 'dev' && (
          <div>
            <div style={{ ...card({ background: '#FFF9E6', border: '1px solid #F9E79F' }), fontSize: 13, color: '#7D6608' }}>
              <strong>開発モードのワークフロー:</strong> ① テンプレート選択 → ② RAG注入 → ③ LLM出力をDBに保存 → ④ チューニングログ記録
            </div>

            {/* ── STEP 1 ── */}
            <div style={stepCard(devCurrentStep === 1, devCurrentStep > 1)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={stepBadge(1, devCurrentStep === 1, devCurrentStep > 1)}>{devCurrentStep > 1 ? '✓' : '1'}</div>
                <strong style={{ fontSize: 15, color: C.primary }}>テンプレート選択 & ベースプロンプト生成</strong>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <label style={labelSt}>科目（フィルタ）</label>
                  <select value={devSubject} onChange={e => { setDevSubject(e.target.value); setDevTemplateId(''); setDevField('') }} style={{ ...selectSt, minWidth: 120 }}>
                    <option value="">全て</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={labelSt}>テンプレート</label>
                  <select value={devTemplateId} onChange={e => onSelectDevTemplate(e.target.value)} style={{ ...selectSt, width: '100%' }}>
                    <option value="">-- 選択 --</option>
                    {(devSubject ? devFilteredTemplates : templates).map(t => (
                      <option key={t.id} value={t.id}>{t.name || t.id}{t.metadata?.field ? ' [' + t.metadata.field + ']' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>難易度</label>
                  <select value={devDifficulty} onChange={e => setDevDifficulty(e.target.value)} style={selectSt}>
                    {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>問数</label>
                  <input type="number" value={devNumQuestions} onChange={e => setDevNumQuestions(Number(e.target.value))} style={{ width: 60, ...inputStyle }} min={1} />
                </div>
              </div>

              {selectedDevTemplate && (
                <div style={{ padding: 10, background: C.lightgray, borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{selectedDevTemplate.name || selectedDevTemplate.id}</div>
                  {selectedDevTemplate.description && <div style={{ color: '#666', marginTop: 2 }}>{selectedDevTemplate.description}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {selectedDevTemplate.metadata?.subject && <span style={tag(C.lightbg, C.secondary)}>📚 {selectedDevTemplate.metadata.subject}</span>}
                    {selectedDevTemplate.metadata?.field && <span style={tag(C.lightaccent, C.accent)}>🔬 {selectedDevTemplate.metadata.field}</span>}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={devGenerateBasePrompt} style={btn(C.primary)} disabled={!devTemplateId}>ベースプロンプト生成</button>
                <button onClick={() => setShowNewTplForm(v => !v)} style={showNewTplForm ? btn(C.danger) : btn(C.success)}>
                  {showNewTplForm ? '✕ 閉じる' : '＋ テンプレート追加'}
                </button>
                <button onClick={async () => { await refreshTemplates(); notify('再読み込み完了', 'success') }} style={btnOutline('#ABB2B9')}>🔄</button>
              </div>

              {showNewTplForm && (
                <div style={{ marginTop: 12, padding: 14, border: `2px solid ${C.success}`, borderRadius: 10, background: '#E8F8F0' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.success, marginBottom: 8 }}>新しいテンプレートを追加</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                      <label style={labelSt}>教科 *</label>
                      <select value={newTplSubject} onChange={e => setNewTplSubject(e.target.value)} style={{ ...selectSt, minWidth: 130 }}>
                        <option value="">-- 選択 --</option>
                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="__custom">その他（入力）</option>
                      </select>
                    </div>
                    {newTplSubject === '__custom' && (
                      <div>
                        <label style={labelSt}>教科名</label>
                        <input id="newTplCustomSubject" style={{ ...inputStyle, width: 120 }} placeholder="例: 情報" />
                      </div>
                    )}
                    <div>
                      <label style={labelSt}>分野</label>
                      <input value={newTplField} onChange={e => setNewTplField(e.target.value)} style={{ ...inputStyle, width: 150 }} placeholder="例: 微分積分" />
                    </div>
                    <div>
                      <label style={labelSt}>難易度</label>
                      <select value={newTplDifficulty} onChange={e => setNewTplDifficulty(e.target.value)} style={selectSt}>
                        {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <button style={{ ...btn(C.success), opacity: newTplSaving ? 0.6 : 1 }} disabled={newTplSaving || !newTplSubject}
                      onClick={() => {
                        const subj = newTplSubject === '__custom' ? (document.getElementById('newTplCustomSubject')?.value || '').trim() : newTplSubject
                        if (!subj) { notify('教科を入力してください', 'error'); return }
                        saveNewTemplate(subj, newTplField, newTplDifficulty)
                      }}>{newTplSaving ? '保存中...' : '作成'}</button>
                  </div>
                </div>
              )}

              {devBasePrompt && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelSt}>ベースプロンプト（RAGなし）</label>
                  <textarea value={devBasePrompt} onChange={e => setDevBasePrompt(e.target.value)} rows={6} style={textareaSt} />
                  <button onClick={() => copyToClipboard(devBasePrompt)} style={{ ...btnOutline('#ABB2B9'), marginTop: 6, fontSize: 13 }}>📋 コピー</button>
                </div>
              )}
            </div>

            {/* ── STEP 2 ── */}
            <div style={stepCard(devCurrentStep === 2, devCurrentStep > 2)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={stepBadge(2, devCurrentStep === 2, devCurrentStep > 2)}>{devCurrentStep > 2 ? '✓' : '2'}</div>
                <strong style={{ fontSize: 15, color: C.primary }}>RAG 注入（科目・分野でフィルタ検索）</strong>
              </div>

              {devCurrentStep < 2 && <div style={{ color: '#ABB2B9', fontSize: 13, padding: '8px 0' }}>STEP 1 を完了してください</div>}

              {devCurrentStep >= 2 && (
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    <button onClick={devInjectRag} style={btn(C.primary)} disabled={!devBasePrompt}>
                      🔍 RAG を注入
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>Top-K:
                      <input type="number" value={topK} onChange={e => setTopK(Number(e.target.value))} style={{ width: 60, ...inputStyle }} min={1} />
                    </label>
                  </div>

                  <details style={{ fontSize: 12, marginBottom: 10 }}>
                    <summary style={{ cursor: 'pointer', color: C.secondary, fontWeight: 600 }}>⚙️ RAG 重み調整</summary>
                    <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
                      {[['テキスト', textWeight, setTextWeight], ['難易度', difficultyMatchWeight, setDifficultyMatchWeight], ['ひっかけ度', trickinessWeight, setTrickinessWeight]].map(([l, v, s]) => (
                        <label key={l} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span>{l}: <strong>{v.toFixed(1)}</strong></span>
                          <input type="range" min="0" max="2" step="0.1" value={v} onChange={e => s(Number(e.target.value))} />
                        </label>
                      ))}
                    </div>
                  </details>

                  {devRetrievedChunks.length > 0 && (
                    <div style={{ padding: 10, background: C.lightgray, borderRadius: 8, marginBottom: 10, maxHeight: 180, overflowY: 'auto' }}>
                      <strong style={{ fontSize: 13 }}>RAG 参照候補（{devRetrievedChunks.length} 件）</strong>
                      {devRetrievedChunks.map((c, i) => (
                        <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #E5E7E9', fontSize: 12 }}>
                          <span style={{ color: '#888' }}>#{i+1}</span>{' '}
                          {(c.text || '').slice(0, 150).replace(/\n/g, ' ')}{(c.text || '').length > 150 ? '...' : ''}
                          <span style={{ color: '#ABB2B9', marginLeft: 8 }}>
                            score: {c.final_score != null ? Number(c.final_score).toFixed(2) : c.score != null ? Number(c.score).toFixed(2) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {devRagPrompt && (
                    <div>
                      <label style={labelSt}>RAG 注入済みプロンプト</label>
                      <textarea value={devRagPrompt} onChange={e => setDevRagPrompt(e.target.value)} rows={8} style={{ ...textareaSt, borderColor: C.secondary }} />
                      <button onClick={() => copyToClipboard(devRagPrompt)} style={{ ...btn(C.primary), marginTop: 6, fontSize: 13 }}>📋 このプロンプトをコピーしてLLMに送る</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── STEP 3 ── */}
            <div style={stepCard(devCurrentStep === 3, devCurrentStep > 3)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={stepBadge(3, devCurrentStep === 3, devCurrentStep > 3)}>{devCurrentStep > 3 ? '✓' : '3'}</div>
                <strong style={{ fontSize: 15, color: C.primary }}>LLM 出力を貼り付けて DB に保存</strong>
              </div>

              {devCurrentStep < 3 && <div style={{ color: '#ABB2B9', fontSize: 13, padding: '8px 0' }}>STEP 2 を完了してください</div>}

              {devCurrentStep >= 3 && (
                <div>
                  <textarea value={devLlmOutput} onChange={e => setDevLlmOutput(e.target.value)} rows={8} style={textareaSt} placeholder="LLM の出力（LaTeX / JSON）を貼り付け..." />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <button onClick={devUploadOutput} style={btn(C.success)} disabled={!devLlmOutput}>💾 DBに保存</button>
                    {devDocId && <span style={tag('#E8F8F0', C.success)}>✓ doc_id: {devDocId}</span>}
                  </div>
                  {devDocId && (
                    <details style={{ marginTop: 10, fontSize: 13 }}>
                      <summary style={{ cursor: 'pointer', color: C.secondary, fontWeight: 600 }}>📂 DB エントリを確認</summary>
                      <div style={{ marginTop: 6 }}>
                        <button onClick={fetchDocEntries} style={btnOutline('#ABB2B9')}>取得</button>
                        {devDocEntries.length > 0 && (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 6 }}>
                            <thead><tr style={{ background: C.lightgray }}><th style={{ border: `1px solid ${C.border}`, padding: 6 }}>ID</th><th style={{ border: `1px solid ${C.border}`, padding: 6 }}>スニペット</th><th style={{ border: `1px solid ${C.border}`, padding: 6 }}>難易度</th></tr></thead>
                            <tbody>{devDocEntries.map(r => (
                              <tr key={r.id}><td style={{ border: `1px solid ${C.border}`, padding: 6 }}>{r.id}</td><td style={{ border: `1px solid ${C.border}`, padding: 6, maxWidth: 400 }}><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{(r.snippet || '').slice(0, 200)}</pre></td><td style={{ border: `1px solid ${C.border}`, padding: 6 }}>{r.difficulty}</td></tr>
                            ))}</tbody>
                          </table>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>

            {/* ── STEP 4 ── */}
            <div style={stepCard(devCurrentStep === 4, false)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={stepBadge(4, devCurrentStep === 4, false)}>4</div>
                <strong style={{ fontSize: 15, color: C.primary }}>チューニングログを記録</strong>
              </div>

              {devCurrentStep < 4 && <div style={{ color: '#ABB2B9', fontSize: 13, padding: '8px 0' }}>STEP 3 を完了してください</div>}

              {devCurrentStep >= 4 && (
                <div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, fontSize: 12, color: '#888' }}>
                    {selectedDevTemplate?.name && <span style={tag(C.lightbg, C.secondary)}>{selectedDevTemplate.name}</span>}
                    {devSubject && <span style={tag(C.lightgray, C.darktext)}>{devSubject}</span>}
                    {devDocId && <span style={tag('#E8F8F0', C.success)}>doc_id: {devDocId}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div>
                      <label style={labelSt}>スコア (0-1)</label>
                      <input type="number" step="0.1" min="0" max="1" value={devTuningScore} onChange={e => setDevTuningScore(e.target.value)} style={{ width: 80, ...inputStyle }} placeholder="0.0-1.0" />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label style={labelSt}>期待出力</label>
                      <input value={devExpectedOutput} onChange={e => setDevExpectedOutput(e.target.value)} style={{ ...inputStyle, width: '100%' }} placeholder="期待される出力の要約" />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label style={labelSt}>メモ</label>
                      <input value={devTuningNotes} onChange={e => setDevTuningNotes(e.target.value)} style={{ ...inputStyle, width: '100%' }} placeholder="短いメモ（任意）" />
                    </div>
                  </div>
                  <button onClick={devSaveTuningLog} style={btn(C.primary)} disabled={!devLlmOutput}>📊 チューニングログを保存</button>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button onClick={() => {
                setDevBasePrompt(''); setDevRagPrompt(''); setDevRetrievedChunks([])
                setDevLlmOutput(''); setDevDocId(''); setDevDocEntries([])
                setDevTuningScore(''); setDevTuningNotes(''); setDevExpectedOutput('')
                setDevCurrentStep(1); notify('リセットしました', 'info')
              }} style={{ ...btnOutline('#ABB2B9'), fontSize: 13 }}>🔄 全ステップをリセット</button>
            </div>
          </div>
        )}
      </main>

      {/* ── フッター ── */}
      <footer style={{
        background: C.primary, padding: '16px 0', textAlign: 'center',
        color: 'rgba(255,255,255,0.6)', fontSize: 12,
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          類題生成アプリ — 教材品質の問題セットを即座に生成
        </div>
      </footer>
    </div>
  )
}
