import React, { useState, useEffect, useCallback } from 'react'

export default function App() {
  /* ============================
     共有 state
     ============================ */
  const [status, setStatus] = useState('')
  const [mode, setMode] = useState('user')
  const [templates, setTemplates] = useState([])
  const [subjects, setSubjects] = useState(['数学','物理','英語','化学','生物','情報'])
  const [difficulties, setDifficulties] = useState(['易','普通','難'])
  const DIFFICULTY_MAP = { '易': 0.2, '普通': 0.5, '難': 0.8 }

  /* ============================
     ユーザモード専用 state
     ============================ */
  const [userTemplateId, setUserTemplateId] = useState('')
  const [userSubject, setUserSubject] = useState('数学')
  const [userDifficulty, setUserDifficulty] = useState('普通')
  const [userNumQuestions, setUserNumQuestions] = useState(1)
  const [userPrompt, setUserPrompt] = useState('')
  const [userRenderContext, setUserRenderContext] = useState(null)
  const [userLlmOutput, setUserLlmOutput] = useState('')
  const [lastPdfUrl, setLastPdfUrl] = useState('')
  const [pdfWorking, setPdfWorking] = useState(false)

  /* ============================
     開発モード専用 state
     ============================ */
  const [devTemplateId, setDevTemplateId] = useState('')
  const [devSubject, setDevSubject] = useState('数学')
  const [devField, setDevField] = useState('')
  const [devDifficulty, setDevDifficulty] = useState('普通')
  const [devNumQuestions, setDevNumQuestions] = useState(1)
  // Step1結果: テンプレートから生成した素のプロンプト（RAGなし）
  const [devBasePrompt, setDevBasePrompt] = useState('')
  // Step2結果: RAG注入後のプロンプト
  const [devRagPrompt, setDevRagPrompt] = useState('')
  const [devRetrievedChunks, setDevRetrievedChunks] = useState([])
  // Step3: LLM出力の貼り付け & DB保存
  const [devLlmOutput, setDevLlmOutput] = useState('')
  const [devDocId, setDevDocId] = useState('')
  const [devDocEntries, setDevDocEntries] = useState([])
  // Step4: チューニングログ
  const [devTuningScore, setDevTuningScore] = useState('')
  const [devTuningNotes, setDevTuningNotes] = useState('')
  const [devExpectedOutput, setDevExpectedOutput] = useState('')
  // RAG weights
  const [topK, setTopK] = useState(5)
  const [difficultyMatchWeight, setDifficultyMatchWeight] = useState(0.6)
  const [trickinessWeight, setTrickinessWeight] = useState(0.0)
  const [textWeight, setTextWeight] = useState(0.5)
  // テンプレート追加
  const [showNewTplForm, setShowNewTplForm] = useState(false)
  const [newTplSubject, setNewTplSubject] = useState('')
  const [newTplField, setNewTplField] = useState('')
  const [newTplDifficulty, setNewTplDifficulty] = useState('普通')
  const [newTplSaving, setNewTplSaving] = useState(false)
  // 現在のステップハイライト
  const [devCurrentStep, setDevCurrentStep] = useState(1)

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
        // 科目リストにテンプレのmetadata.subjectを追加
        const extraSubjects = new Set(subjects)
        tpls.forEach(t => {
          if (t.metadata && t.metadata.subject) extraSubjects.add(t.metadata.subject)
        })
        setSubjects(Array.from(extraSubjects))
        return tpls
      }
    } catch (e) { console.warn('templates fetch failed', e) }
    return []
  }, [])

  useEffect(() => { refreshTemplates() }, [])

  // When templates load, auto-select a sensible default for user mode if none chosen.
  useEffect(() => {
    try {
      if (mode === 'user' && templates && templates.length > 0 && !userTemplateId) {
        const first = templates[0]
        setUserTemplateId(first.id || '')
        if (first.metadata) {
          if (first.metadata.subject) setUserSubject(first.metadata.subject)
          if (first.metadata.difficulty && difficulties.includes(first.metadata.difficulty)) setUserDifficulty(first.metadata.difficulty)
        }
      }
    } catch (e) {
      console.warn('auto-select user template failed', e)
    }
  }, [templates, mode])

  // テンプレート選択時のメタデータ自動反映
  const getTemplate = (id) => templates.find(t => t.id === id) || null

  const onSelectDevTemplate = (tplId) => {
    setDevTemplateId(tplId)
    const tpl = getTemplate(tplId)
    if (tpl && tpl.metadata) {
      if (tpl.metadata.subject) setDevSubject(tpl.metadata.subject)
      if (tpl.metadata.field) setDevField(tpl.metadata.field)
      if (tpl.metadata.difficulty && difficulties.includes(tpl.metadata.difficulty)) setDevDifficulty(tpl.metadata.difficulty)
    } else {
      setDevField('')
    }
    // テンプレート変更時はプロンプトをリセット
    setDevBasePrompt('')
    setDevRagPrompt('')
    setDevRetrievedChunks([])
    setDevCurrentStep(1)
  }

  const onSelectUserTemplate = (tplId) => {
    setUserTemplateId(tplId)
    const tpl = getTemplate(tplId)
    if (tpl && tpl.metadata) {
      if (tpl.metadata.subject) setUserSubject(tpl.metadata.subject)
      if (tpl.metadata.difficulty && difficulties.includes(tpl.metadata.difficulty)) setUserDifficulty(tpl.metadata.difficulty)
    }
  }

  const selectedDevTemplate = getTemplate(devTemplateId)
  const selectedUserTemplate = getTemplate(userTemplateId)

  /* ============================
     テンプレート追加
     ============================ */
  const saveNewTemplate = async (subject, field, difficulty) => {
    const s = String(subject || '').trim()
    if (!s) { setStatus('教科を選択してください'); return }
    const f = String(field || '').trim()
    const d = String(difficulty || '普通').trim()
    const label = f ? s + '（' + f + '）' : s
    const name = label + ' テンプレート'
    const id = (f ? s + '_' + f : s).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\u3040-\u9fff\-]/g, '') || ('tpl_' + Date.now())
    const desc = label + ' の問題を生成するテンプレート（自動生成）'
    const promptLines = [
      '科目: {subject}',
      f ? '分野: ' + f : null,
      '難易度: {difficulty}',
      '出題数: {num_questions}',
      '',
      '指示:',
      '以下の条件で' + label + 'の問題を出題してください。',
      f ? '特に「' + f + '」の範囲を重点的に扱ってください。' : null,
      '',
      '- 出力形式: LaTeX（\\documentclass から \\end{document} まで完全な文書）',
      '- 問題と解答・解説を必ず含めること',
      '- 問題数は {num_questions} 問とする',
      '- 難易度は「{difficulty}」レベルに合わせること',
    ].filter(l => l !== null).join('\n')

    const body = { id, name, description: desc, prompt: promptLines,
      metadata: { subject: s, field: f || null, difficulty: d, auto_generated: true } }

    setNewTplSaving(true)
    setStatus('テンプレート「' + label + '」を保存中...')
    try {
      const res = await fetch('/api/template', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setStatus('保存失敗: ' + (j && (j.detail || j.error) || res.statusText)); setNewTplSaving(false); return }
      setStatus('✅ テンプレート「' + label + '」を作成しました')
      if (!subjects.includes(s)) setSubjects(prev => [...prev, s])
      await refreshTemplates()
      setDevTemplateId(id)
      setDevSubject(s)
      if (f) setDevField(f)
      if (d && difficulties.includes(d)) setDevDifficulty(d)
      setNewTplSubject(''); setNewTplField(''); setNewTplDifficulty('普通')
      setShowNewTplForm(false)
    } catch (e) { setStatus('エラー: ' + e.message) }
    setNewTplSaving(false)
  }

  /* ============================
     STEP 1: テンプレートからプロンプト生成（RAG なし）
     ============================ */
  const devGenerateBasePrompt = async () => {
    if (!devTemplateId) { setStatus('テンプレートを選択してください'); return }
    setStatus('テンプレートをレンダリング中（RAGなし）...')
    try {
      const body = {
        template_id: devTemplateId,
        subject: devSubject,
        difficulty: devDifficulty,
        num_questions: devNumQuestions,
        rag_inject: false,  // ★ RAG注入しない
      }
      const res = await fetch('/api/template_render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { setStatus('エラー: ' + (j.detail || res.statusText)); return }
      const rendered = j.rendered_prompt || j.rendered || ''
      setDevBasePrompt(rendered)
      setDevRagPrompt('')
      setDevRetrievedChunks([])
      setDevCurrentStep(2)
      setStatus('✅ ベースプロンプト生成完了（RAGなし）。次にRAGを注入してください。')
    } catch (e) { setStatus('生成エラー: ' + e.message) }
  }

  /* ============================
     STEP 2: RAG 注入（科目・分野でフィルタ）
     ============================ */
  const devInjectRag = async () => {
    const question = devBasePrompt
    if (!question) return setStatus('まずSTEP1でベースプロンプトを生成してください')
    setStatus('RAG を取得中（科目: ' + devSubject + (devField ? ' / 分野: ' + devField : '') + '）...')
    try {
      const body = {
        question: question,
        top_k: Number(topK),
        use_vector: true,
        difficulty_match_weight: Number(difficultyMatchWeight),
        trickiness_weight: Number(trickinessWeight),
        text_weight: Number(textWeight),
        target_difficulty: DIFFICULTY_MAP[devDifficulty] !== undefined ? DIFFICULTY_MAP[devDifficulty] : undefined,
        metadata: { subject: devSubject, field: devField || undefined },
      }
      if (devDocId) body.doc_id = devDocId
      const res = await fetch('/api/assemble_prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { setStatus('RAG 失敗: ' + (j.detail || res.statusText)); return }
      const p = j.prompt_summarized || j.prompt || ''
      setDevRagPrompt(p)
      setDevRetrievedChunks(j.retrieved || [])
      setDevCurrentStep(3)
      setStatus('✅ RAG 注入完了（' + (j.retrieved || []).length + ' 件参照）。プロンプトをLLMに送ってください。')
    } catch (e) { setStatus('RAG エラー: ' + e.message) }
  }

  /* ============================
     STEP 3: LLM出力をDBにパース・保存
     ============================ */
  const devUploadOutput = async () => {
    if (!devLlmOutput) return setStatus('LLM出力を貼り付けてください')
    setStatus('出力をパースしてDBに保存中...')
    try {
      const body = { latex: devLlmOutput }
      const res = await fetch('/api/upload_json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { setStatus('保存失敗: ' + (j.detail || res.statusText)); return }
      setDevDocId(j.doc_id || '')
      setDevCurrentStep(4)
      setStatus('✅ DB保存完了 doc_id=' + (j.doc_id || '') + '。チューニングログを記録できます。')
    } catch (e) { setStatus('保存エラー: ' + e.message) }
  }

  /* ============================
     STEP 4: チューニングログ保存
     ============================ */
  const devSaveTuningLog = async () => {
    if (!devLlmOutput) return setStatus('LLM出力がありません')
    setStatus('チューニングログを保存中...')
    try {
      const tpl = selectedDevTemplate || {}
      const body = {
        prompt: devRagPrompt || devBasePrompt,
        model_output: devLlmOutput,
        expected_output: devExpectedOutput || undefined,
        score: devTuningScore !== '' ? Number(devTuningScore) : undefined,
        notes: devTuningNotes || undefined,
        metadata: {
          template_id: devTemplateId || null,
          subject: devSubject || null,
          difficulty: devDifficulty || null,
          field: devField || (tpl.metadata && tpl.metadata.field) || null,
          doc_id: devDocId || null,
        },
      }
      const res = await fetch('/api/tuning/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { setStatus('保存失敗: ' + (j.detail || res.statusText)); return }
      setStatus('✅ チューニングログ保存完了 id=' + (j.id || ''))
      setDevTuningScore(''); setDevTuningNotes(''); setDevExpectedOutput('')
    } catch (e) { setStatus('保存エラー: ' + e.message) }
  }

  /* ============================
     DB確認 helper
     ============================ */
  const fetchDocEntries = async () => {
    if (!devDocId) return setStatus('doc_id がありません')
    try {
      const res = await fetch('/api/doc/' + devDocId + '/entries')
      const j = await res.json()
      if (!res.ok) { setStatus('DB取得エラー'); return }
      setDevDocEntries(j.rows || [])
      setStatus('DB取得完了: ' + (j.rows || []).length + '件')
    } catch (e) { setStatus('エラー: ' + e.message) }
  }

  /* ============================
     ユーザモード: プロンプト生成（RAG含む）
     ============================ */
  const userGeneratePrompt = async () => {
    if (!userTemplateId) { setStatus('テンプレートを選択してください'); return }
    setStatus('プロンプトを生成中（RAG含む）...')
    try {
      const body = {
        template_id: userTemplateId,
        subject: userSubject,
        difficulty: userDifficulty,
        num_questions: userNumQuestions,
        rag_inject: true,
        subject_filter: userSubject,
        user_mode: true,
        top_k: Number(topK),
      }
      const res = await fetch('/api/template_render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { setStatus('エラー: ' + (j.detail || res.statusText)); return }
      // Store render context so UI can show whether RAG was injected and what was used
      setUserRenderContext(j.context || null)
      setUserPrompt(j.rendered_prompt || j.rendered || '')
      // give a clear status indicating whether RAG content was included
      if (j.context && (j.context.chunk_count || (j.context.rag_summary && j.context.rag_summary.length > 0))) {
        setStatus('✅ プロンプト生成完了（RAG 注入: ' + (j.context.chunk_count || 0) + ' 件参照）')
      } else {
        setStatus('✅ プロンプト生成完了（RAG未検出）')
      }
    } catch (e) { setStatus('生成エラー: ' + e.message) }
  }

  const userCompilePdf = async () => {
    const latex = userLlmOutput
    if (!latex || !latex.trim()) return setStatus('LaTeX を貼り付けてください')
    setPdfWorking(true); setStatus('PDF を生成中...')
    try {
      const res = await fetch('/api/generate_pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex, title: 'Generated', return_url: true }) })
      if (res.ok) {
        const j = await res.json().catch(() => null)
        if (j && j.pdf_url) { setLastPdfUrl(j.pdf_url); window.open(j.pdf_url, '_blank'); setStatus('PDF を開きました') }
        else { const blob = await res.blob(); window.open(URL.createObjectURL(blob), '_blank'); setStatus('PDF を表示しました') }
      } else {
        const je = await res.json().catch(() => null)
        setStatus('PDF 生成失敗: ' + ((je && (je.detail || je.error)) || res.statusText))
      }
    } catch (e) { setStatus('エラー: ' + e.message) }
    setPdfWorking(false)
  }

  /* ============================
     Clipboard
     ============================ */
  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); setStatus('📋 コピーしました') }
    catch (e) { setStatus('コピー失敗: ' + e.message) }
  }

  /* ============================
     Helpers
     ============================ */
  const difficultyLabel = (v) => {
    if (v === null || v === undefined || v === '') return '—'
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    if (n < 0.18) return '非常に易い'
    if (n < 0.36) return '易い'
    if (n < 0.55) return '普通'
    if (n < 0.75) return '難しい'
    return '非常に難しい'
  }

  // dev mode: 使うプロンプト（RAG済みがあればそちら、なければベース）
  const devFinalPrompt = devRagPrompt || devBasePrompt

  // テンプレートに紐づく科目リストをフィルタして表示
  const devFilteredTemplates = templates.filter(t => {
    if (!devSubject) return true
    if (!t.metadata || !t.metadata.subject) return true
    return t.metadata.subject === devSubject
  })

  /* ============================
     STYLES
     ============================ */
  const stepStyle = (step, active) => ({
    padding: '14px 16px',
    border: active ? '2px solid #0a58ca' : '1px solid #dee2e6',
    borderRadius: 8,
    background: active ? '#f0f4ff' : '#fff',
    marginBottom: 12,
    position: 'relative',
  })
  const stepHeader = (num, title, active) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: active ? '#0a58ca' : '#adb5bd', color: '#fff', fontWeight: 700, fontSize: 14 }}>{num}</span>
      <strong style={{ fontSize: 15, color: active ? '#0a58ca' : '#333' }}>{title}</strong>
    </div>
  )
  const btnPrimary = { padding: '8px 18px', borderRadius: 6, border: 'none', background: '#0a58ca', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
  const btnSecondary = { padding: '6px 14px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', color: '#333', fontWeight: 500, fontSize: 13, cursor: 'pointer' }
  const btnSuccess = { padding: '8px 18px', borderRadius: 6, border: 'none', background: '#198754', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
  const btnDanger = { padding: '6px 14px', borderRadius: 6, border: 'none', background: '#dc3545', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
  const labelStyle = { fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }
  const selectStyle = { padding: '5px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }
  const metaTag = (icon, label, value) => value ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#e9ecef', borderRadius: 12, fontSize: 12, color: '#555' }}>{icon} {label}: <strong>{value}</strong></span>
  ) : null

  /* ============================
     RENDER
     ============================ */
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>📚 試験問題 RAG チューニングシステム</h1>
      <div style={{ marginBottom: 12, color: '#0a58ca', minHeight: 22, fontSize: 14 }}>{status}</div>

      {/* ── モード切替 ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button onClick={() => setMode('user')} style={{ ...btnPrimary, background: mode === 'user' ? '#0a58ca' : '#e9ecef', color: mode === 'user' ? '#fff' : '#555' }}>📝 ユーザモード</button>
        <button onClick={() => setMode('dev')} style={{ ...btnPrimary, background: mode === 'dev' ? '#0a58ca' : '#e9ecef', color: mode === 'dev' ? '#fff' : '#555' }}>🔧 開発モード</button>
      </div>

      {/* ============================================================
           ユーザモード
           ============================================================ */}
      {mode === 'user' && (
        <section>
          <h3 style={{ fontSize: 17, marginBottom: 12 }}>問題を生成する</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <select value={userTemplateId} onChange={e => onSelectUserTemplate(e.target.value)} style={{ ...selectStyle, minWidth: 240 }}>
              <option value="">-- テンプレートを選択 --</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name || t.id}{t.metadata && t.metadata.subject ? ' [' + t.metadata.subject + ']' : ''}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>科目:
              <select value={userSubject} onChange={e => setUserSubject(e.target.value)} style={selectStyle}>{subjects.map(s => <option key={s} value={s}>{s}</option>)}</select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>難易度:
              <select value={userDifficulty} onChange={e => setUserDifficulty(e.target.value)} style={selectStyle}>{difficulties.map(d => <option key={d} value={d}>{d}</option>)}</select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>問数:
              <input type="number" value={userNumQuestions} onChange={e => setUserNumQuestions(Number(e.target.value))} style={{ width: 50, ...selectStyle }} min={1} />
            </label>
            <button onClick={userGeneratePrompt} style={btnPrimary} disabled={!userTemplateId}>プロンプト生成</button>
          </div>

          {userPrompt && (
            <div>
              <label style={labelStyle}>生成されたプロンプト（LLMに送ってください）</label>
              <textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)} rows={8} style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
              {/* RAG 注入情報の表示 */}
              {userRenderContext ? (
                <div style={{ marginTop: 8, padding: 8, background: '#f8f9fa', borderRadius: 6, border: '1px solid #eee', fontSize: 13 }}>
                  <div>参照チャンク数: <strong>{userRenderContext.chunk_count || 0}</strong></div>
                  {userRenderContext.rag_summary ? (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>RAG 要約（先頭）</div>
                      <div style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>{(userRenderContext.rag_summary || '').slice(0, 800)}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={() => copyToClipboard(userPrompt)} style={btnSecondary}>📋 コピー</button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>LLM の出力（LaTeX を貼り付け）</label>
            <textarea value={userLlmOutput} onChange={e => setUserLlmOutput(e.target.value)} rows={6} style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, padding: 8, borderRadius: 6, border: '1px solid #ccc' }} placeholder="ChatGPT 等の出力をここに貼り付け" />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={userCompilePdf} style={btnPrimary} disabled={!userLlmOutput || pdfWorking}>{pdfWorking ? '生成中...' : '📄 PDF を生成して表示'}</button>
            </div>
          </div>

          {lastPdfUrl && (
            <div style={{ marginTop: 12, padding: 8, background: '#f0fff4', borderRadius: 6, border: '1px solid #d1e7dd' }}>
              <a href={lastPdfUrl} target="_blank" rel="noreferrer">📄 PDF を開く</a>
            </div>
          )}
        </section>
      )}

      {/* ============================================================
           開発モード
           ============================================================ */}
      {mode === 'dev' && (
        <div>
          {/* ── 説明 ── */}
          <div style={{ padding: 10, background: '#fff3cd', borderRadius: 6, marginBottom: 16, fontSize: 13, color: '#856404', border: '1px solid #ffc107' }}>
            <strong>開発モードのワークフロー:</strong> ① テンプレート選択 → ② RAG注入（科目/分野でフィルタ） → ③ LLM出力をDBに保存 → ④ チューニングログ記録
          </div>

          {/* ═══════════════════════════════════
               STEP 1: テンプレート選択 & プロンプト生成
               ═══════════════════════════════════ */}
          <div style={stepStyle(1, devCurrentStep >= 1)}>
            {stepHeader('1', 'テンプレート選択 & ベースプロンプト生成', devCurrentStep >= 1)}

            {/* 科目フィルタ → テンプレート選択 */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <div>
                <label style={labelStyle}>科目（フィルタ）</label>
                <select value={devSubject} onChange={e => { setDevSubject(e.target.value); setDevTemplateId(''); setDevField('') }} style={{ ...selectStyle, minWidth: 120 }}>
                  <option value="">全て</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={labelStyle}>テンプレート</label>
                <select value={devTemplateId} onChange={e => onSelectDevTemplate(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                  <option value="">-- 選択 --</option>
                  {(devSubject ? devFilteredTemplates : templates).map(t => (
                    <option key={t.id} value={t.id}>{t.name || t.id}{t.metadata && t.metadata.field ? ' [' + t.metadata.field + ']' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>難易度</label>
                <select value={devDifficulty} onChange={e => setDevDifficulty(e.target.value)} style={selectStyle}>
                  {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>問数</label>
                <input type="number" value={devNumQuestions} onChange={e => setDevNumQuestions(Number(e.target.value))} style={{ width: 50, ...selectStyle }} min={1} />
              </div>
            </div>

            {/* テンプレート情報 */}
            {selectedDevTemplate && (
              <div style={{ padding: 8, background: '#f8f9fa', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{selectedDevTemplate.name || selectedDevTemplate.id}</div>
                {selectedDevTemplate.description && <div style={{ color: '#666', marginTop: 2 }}>{selectedDevTemplate.description}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {metaTag('📚', '科目', selectedDevTemplate.metadata?.subject)}
                  {metaTag('🔬', '分野', selectedDevTemplate.metadata?.field)}
                  {metaTag('📊', '難易度', selectedDevTemplate.metadata?.difficulty)}
                </div>
              </div>
            )}

            {/* アクション */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={devGenerateBasePrompt} style={btnPrimary} disabled={!devTemplateId}>ベースプロンプト生成（RAGなし）</button>
              <button onClick={() => { setShowNewTplForm(v => !v) }} style={showNewTplForm ? btnDanger : btnSuccess}>
                {showNewTplForm ? '✕ 閉じる' : '＋ テンプレート追加'}
              </button>
              <button onClick={async () => { await refreshTemplates(); setStatus('再読み込み完了') }} style={btnSecondary}>🔄</button>
            </div>

            {/* テンプレート追加フォーム */}
            {showNewTplForm && (
              <div style={{ marginTop: 10, padding: 12, border: '2px solid #198754', borderRadius: 8, background: '#f0faf4' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#198754', marginBottom: 8 }}>📝 新しいテンプレートを追加</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={labelStyle}>教科 *</label>
                    <select value={newTplSubject} onChange={e => setNewTplSubject(e.target.value)} style={{ ...selectStyle, minWidth: 130 }}>
                      <option value="">-- 選択 --</option>
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                      <option value="__custom">その他（入力）</option>
                    </select>
                  </div>
                  {newTplSubject === '__custom' && (
                    <div>
                      <label style={labelStyle}>教科名</label>
                      <input id="newTplCustomSubject" style={{ ...selectStyle, width: 120 }} placeholder="例: 情報" />
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>分野</label>
                    <input value={newTplField} onChange={e => setNewTplField(e.target.value)} style={{ ...selectStyle, width: 150 }} placeholder="例: 微分積分" />
                  </div>
                  <div>
                    <label style={labelStyle}>難易度</label>
                    <select value={newTplDifficulty} onChange={e => setNewTplDifficulty(e.target.value)} style={selectStyle}>
                      {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <button style={{ ...btnSuccess, opacity: newTplSaving ? 0.6 : 1 }} disabled={newTplSaving || !newTplSubject}
                    onClick={() => {
                      const subj = newTplSubject === '__custom'
                        ? (document.getElementById('newTplCustomSubject')?.value || '').trim()
                        : newTplSubject
                      if (!subj) { setStatus('教科を入力してください'); return }
                      saveNewTemplate(subj, newTplField, newTplDifficulty)
                    }}>{newTplSaving ? '保存中...' : '作成'}</button>
                </div>
                <div style={{ marginTop: 6, color: '#555', fontSize: 11 }}>教科＋分野を入力するだけ。テンプレート名・ID・本文は自動生成されます。</div>
              </div>
            )}

            {/* ベースプロンプト表示 */}
            {devBasePrompt && (
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>ベースプロンプト（RAGなし）</label>
                <textarea value={devBasePrompt} onChange={e => setDevBasePrompt(e.target.value)} rows={6} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
                <button onClick={() => copyToClipboard(devBasePrompt)} style={{ ...btnSecondary, marginTop: 4 }}>📋 コピー</button>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════
               STEP 2: RAG 注入
               ═══════════════════════════════════ */}
          <div style={stepStyle(2, devCurrentStep >= 2)}>
            {stepHeader('2', 'RAG 注入（科目・分野でフィルタ検索）', devCurrentStep >= 2)}

            {devCurrentStep < 2 && <div style={{ color: '#999', fontSize: 13 }}>STEP 1 を完了してください</div>}

            {devCurrentStep >= 2 && (
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <button onClick={devInjectRag} style={btnPrimary} disabled={!devBasePrompt}>
                    🔍 RAG を注入（{devSubject}{devField ? ' / ' + devField : ''} でフィルタ）
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>Top-K:
                    <input type="number" value={topK} onChange={e => setTopK(Number(e.target.value))} style={{ width: 50, ...selectStyle }} min={1} />
                  </label>
                </div>

                {/* RAG重み調整 */}
                <details style={{ fontSize: 12, marginBottom: 8 }}>
                  <summary style={{ cursor: 'pointer', color: '#666' }}>⚙️ RAG 重み調整</summary>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                    <label>テキスト: <strong>{textWeight.toFixed(1)}</strong>
                      <input type="range" min="0" max="2" step="0.1" value={textWeight} onChange={e => setTextWeight(Number(e.target.value))} />
                    </label>
                    <label>難易度: <strong>{difficultyMatchWeight.toFixed(1)}</strong>
                      <input type="range" min="0" max="2" step="0.1" value={difficultyMatchWeight} onChange={e => setDifficultyMatchWeight(Number(e.target.value))} />
                    </label>
                    <label>ひっかけ度: <strong>{trickinessWeight.toFixed(1)}</strong>
                      <input type="range" min="0" max="2" step="0.1" value={trickinessWeight} onChange={e => setTrickinessWeight(Number(e.target.value))} />
                    </label>
                  </div>
                </details>

                {/* RAG結果 */}
                {devRetrievedChunks.length > 0 && (
                  <div style={{ padding: 8, background: '#f8f9fa', borderRadius: 6, border: '1px solid #eee', marginBottom: 8, maxHeight: 200, overflowY: 'auto' }}>
                    <strong style={{ fontSize: 13 }}>RAG 参照候補（{devRetrievedChunks.length} 件）</strong>
                    {devRetrievedChunks.map((c, i) => (
                      <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                        <span style={{ color: '#888' }}>#{i+1}</span>{' '}
                        <span>{(c.text || '').slice(0, 150).replace(/\n/g, ' ')}{(c.text || '').length > 150 ? '...' : ''}</span>
                        <span style={{ color: '#aaa', marginLeft: 8 }}>
                          score: {typeof c.final_score !== 'undefined' ? Number(c.final_score).toFixed(2) : (typeof c.score !== 'undefined' ? Number(c.score).toFixed(2) : '—')}
                          {c.difficulty != null ? ' / 難度: ' + difficultyLabel(c.difficulty) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* RAG済みプロンプト */}
                {devRagPrompt && (
                  <div>
                    <label style={labelStyle}>RAG 注入済みプロンプト</label>
                    <textarea value={devRagPrompt} onChange={e => setDevRagPrompt(e.target.value)} rows={8} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 8, borderRadius: 6, border: '1px solid #b6d4fe' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={() => copyToClipboard(devRagPrompt)} style={btnPrimary}>📋 このプロンプトをコピーしてLLMに送る</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════
               STEP 3: LLM出力を貼り付けてDB保存
               ═══════════════════════════════════ */}
          <div style={stepStyle(3, devCurrentStep >= 3)}>
            {stepHeader('3', 'LLM 出力を貼り付けて DB に保存', devCurrentStep >= 3)}

            {devCurrentStep < 3 && <div style={{ color: '#999', fontSize: 13 }}>STEP 2 を完了してください</div>}

            {devCurrentStep >= 3 && (
              <div>
                <label style={labelStyle}>LLM 出力（ここに貼り付け）</label>
                <textarea value={devLlmOutput} onChange={e => setDevLlmOutput(e.target.value)} rows={8} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 8, borderRadius: 6, border: '1px solid #ccc' }} placeholder="LLM の出力（LaTeX / JSON）をここに貼り付け" />
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <button onClick={devUploadOutput} style={btnSuccess} disabled={!devLlmOutput}>💾 DB にパースして保存</button>
                  {devDocId && <span style={{ fontSize: 12, color: '#198754' }}>✅ doc_id: <code>{devDocId}</code></span>}
                </div>

                {/* DB確認 */}
                {devDocId && (
                  <details style={{ marginTop: 8, fontSize: 13 }}>
                    <summary style={{ cursor: 'pointer', color: '#666' }}>📂 DB エントリを確認</summary>
                    <div style={{ marginTop: 6 }}>
                      <button onClick={fetchDocEntries} style={btnSecondary}>取得</button>
                      {devDocEntries.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 6 }}>
                          <thead><tr style={{ background: '#f8f9fa' }}><th style={{ border: '1px solid #eee', padding: 4 }}>ID</th><th style={{ border: '1px solid #eee', padding: 4 }}>スニペット</th><th style={{ border: '1px solid #eee', padding: 4 }}>難易度</th></tr></thead>
                          <tbody>{devDocEntries.map(r => (
                            <tr key={r.id}><td style={{ border: '1px solid #eee', padding: 4 }}>{r.id}</td><td style={{ border: '1px solid #eee', padding: 4, maxWidth: 400 }}><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{(r.snippet || '').slice(0, 200)}</pre></td><td style={{ border: '1px solid #eee', padding: 4 }}>{r.difficulty}</td></tr>
                          ))}</tbody>
                        </table>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════
               STEP 4: チューニングログ
               ═══════════════════════════════════ */}
          <div style={stepStyle(4, devCurrentStep >= 4)}>
            {stepHeader('4', 'チューニングログを記録', devCurrentStep >= 4)}

            {devCurrentStep < 4 && <div style={{ color: '#999', fontSize: 13 }}>STEP 3 を完了してください</div>}

            {devCurrentStep >= 4 && (
              <div>
                <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                  テンプレート: <strong>{selectedDevTemplate?.name || devTemplateId || '—'}</strong>
                  {devSubject && <span> / 科目: <strong>{devSubject}</strong></span>}
                  {devField && <span> / 分野: <strong>{devField}</strong></span>}
                  {devDocId && <span> / doc_id: <code>{devDocId}</code></span>}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8 }}>
                  <div>
                    <label style={labelStyle}>スコア (0-1)</label>
                    <input type="number" step="0.1" min="0" max="1" value={devTuningScore} onChange={e => setDevTuningScore(e.target.value)} style={{ width: 80, ...selectStyle }} placeholder="0.0-1.0" />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={labelStyle}>期待出力</label>
                    <input value={devExpectedOutput} onChange={e => setDevExpectedOutput(e.target.value)} style={{ ...selectStyle, width: '100%' }} placeholder="期待される出力の要約" />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={labelStyle}>メモ</label>
                    <input value={devTuningNotes} onChange={e => setDevTuningNotes(e.target.value)} style={{ ...selectStyle, width: '100%' }} placeholder="短いメモ（任意）" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={devSaveTuningLog} style={btnPrimary} disabled={!devLlmOutput}>📊 チューニングログを保存</button>
                </div>
              </div>
            )}
          </div>

          {/* ── リセット ── */}
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button onClick={() => {
              setDevBasePrompt(''); setDevRagPrompt(''); setDevRetrievedChunks([])
              setDevLlmOutput(''); setDevDocId(''); setDevDocEntries([])
              setDevTuningScore(''); setDevTuningNotes(''); setDevExpectedOutput('')
              setDevCurrentStep(1)
              setStatus('リセットしました')
            }} style={btnSecondary}>🔄 全ステップをリセット</button>
          </div>
        </div>
      )}
    </div>
  )
}
