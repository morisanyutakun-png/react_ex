'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import {
  renderTemplate,
  assemblePrompt,
  saveProblem,
  saveTuningLog,
  generatePdf,
  searchProblems,
  fetchTuningFeedback,
} from '@/lib/api';
import {
  DIFFICULTY_MAP,
  OUTPUT_FORMAT_INSTRUCTION, buildReferencePromptSection,
  difficultyLabel,
} from '@/lib/constants';
import { LatexText } from '@/components/LatexRenderer';
import {
  StatusBar,
  SectionCard,
  TextArea,
  Button,
  CopyButton,
  NumberField,
  EmptyState,
  PageHeader,
  Icons,
} from '@/components/ui';

/* ═══════════════════════════════════════════════════════
   ユーティリティ
   ═══════════════════════════════════════════════════════ */

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }
  const braceStart = text.indexOf('{');
  if (braceStart >= 0) {
    let depth = 0;
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(braceStart, i + 1)); } catch { break; }
      }
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════
   プルダウンコンポーネント（統一デザイン・追加ボタン付き）
   ═══════════════════════════════════════════════════════ */

function Dropdown({ label, value, onChange, options, placeholder, className = '', onAdd, addLabel, disabled }) {
  const hasValue = value !== '' && value !== undefined;
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <div className="flex items-stretch gap-1.5">
        <div className="relative group flex-1">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full pl-4 pr-10 py-3 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-sm text-sm
                      text-[#1d1d1f] transition-all duration-300 cursor-pointer appearance-none
                      hover:border-black/[0.10] hover:bg-white hover:shadow-md
                      focus:border-[#fc3c44]/40 focus:ring-2 focus:ring-[#fc3c44]/10 focus:shadow-lg focus:shadow-[#fc3c44]/5
                      outline-none font-semibold shadow-sm
                      disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) =>
              typeof opt === 'string'
                ? <option key={opt} value={opt}>{opt}</option>
                : <option key={opt.value} value={opt.value}>{opt.label}</option>
            )}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none transition-all duration-300 group-hover:text-[#fc3c44] text-[#c7c7cc]">
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {hasValue && (
            <div className="absolute top-2 right-8 w-1.5 h-1.5 rounded-full bg-[#fc3c44] opacity-60" />
          )}
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            title={addLabel || '追加'}
            className="flex items-center justify-center w-11 rounded-2xl border border-dashed border-black/[0.06]
                       text-[#c7c7cc] hover:border-[#fc3c44] hover:text-[#fc3c44] hover:bg-[#fc3c44]/[0.06]
                       transition-all duration-300 flex-shrink-0 active:scale-90 hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
/* ═══════════════════════════════════════════════════════
   選択中タグ表示
   ═══════════════════════════════════════════════════════ */

function SelectedTag({ label, value, color = 'red', onClear }) {
  if (!value) return null;
  const colors = {
    red: 'bg-[#fc3c44]/[0.06] text-[#fc3c44] border-[#fc3c44]/15',
    emerald: 'bg-[#34c759]/[0.06] text-[#34c759] border-[#34c759]/15',
    amber: 'bg-[#ff9500]/[0.06] text-[#ff9500] border-[#ff9500]/15',
    violet: 'bg-[#af52de]/[0.06] text-[#af52de] border-[#af52de]/15',
    sky: 'bg-[#007aff]/[0.06] text-[#007aff] border-[#007aff]/15',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${colors[color] || colors.red} transition-all hover:shadow-sm`}>
      <span className="opacity-50 font-medium">{label}:</span>
      <span>{value}</span>
      {onClear && (
        <button onClick={onClear} className="ml-0.5 w-4 h-4 rounded-full bg-black/[0.06] hover:bg-black/[0.10] flex items-center justify-center transition-all">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   RAG ミキサー
   ═══════════════════════════════════════════════════════ */

function RagMixer({ textWeight, diffWeight, trickWeight, onText, onDiff, onTrick }) {
  const total = textWeight + diffWeight + trickWeight || 1;
  const axes = [
    { label: '類似度', value: textWeight, color: '#0a84ff', bgClass: 'bg-[#0a84ff]', onChange: onText },
    { label: '難易度', value: diffWeight, color: '#30d158', bgClass: 'bg-[#30d158]', onChange: onDiff },
    { label: 'ひっかけ', value: trickWeight, color: '#ff9f0a', bgClass: 'bg-[#ff9f0a]', onChange: onTrick },
  ];
  return (
    <div className="space-y-5">
      {/* Balance bar */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-[#c7c7cc] uppercase tracking-wider">バランス</div>
        <div className="flex h-3.5 rounded-full overflow-hidden bg-black/[0.04] shadow-inner">
          {axes.map((p, i) => {
            const w = (p.value / total) * 100;
            return w > 0 ? (
              <div key={i} className={`${p.bgClass} transition-all duration-500 ease-out`}
                   style={{ width: `${w}%` }} />
            ) : null;
          })}
        </div>
        <div className="flex justify-between text-[10px] font-semibold">
          {axes.map((p, i) => (
            <span key={i} style={{ color: p.color }}>
              {p.label} {Math.round((p.value / total) * 100)}%
            </span>
          ))}
        </div>
      </div>
      {/* Sliders */}
      <div className="space-y-3">
        {axes.map((p, i) => {
          const pct = (p.value / 2) * 100;
          return (
            <div key={i} className="flex items-center gap-3 group">
              <div className={`w-2.5 h-2.5 rounded-full ${p.bgClass} flex-shrink-0 shadow-sm`}
                   style={{ boxShadow: `0 0 6px ${p.color}40` }} />
              <span className="text-[11px] font-bold w-16 flex-shrink-0" style={{ color: p.color }}>{p.label}</span>
              <div className="flex-1 relative h-6 flex items-center">
                <div className="absolute inset-x-0 h-[5px] rounded-full bg-black/[0.04]" />
                <div className="absolute left-0 h-[5px] rounded-full transition-all duration-150"
                     style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.color}, ${p.color}bb)` }} />
                <input
                  type="range" min={0} max={2} step={0.1} value={p.value}
                  onChange={(e) => p.onChange(Number(e.target.value))}
                  className="relative w-full h-[5px] rounded-full appearance-none cursor-pointer bg-transparent z-10
                    [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]
                    [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200
                    [&::-webkit-slider-thumb]:hover:scale-125
                    [&::-webkit-slider-thumb]:active:scale-110"
                />
              </div>
              <span className="min-w-[2.2rem] text-right text-[12px] font-bold tabular-nums px-1.5 py-0.5 rounded-lg"
                    style={{ color: p.color, background: `${p.color}10` }}>
                {p.value.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   品質レーティング
   ═══════════════════════════════════════════════════════ */

function QualityRating({ score, onChange }) {
  const levels = [
    { value: 0.2, emoji: '😕', label: '低い' },
    { value: 0.4, emoji: '🤔', label: 'いまいち' },
    { value: 0.6, emoji: '🙂', label: 'まあまあ' },
    { value: 0.8, emoji: '😊', label: '良い' },
    { value: 1.0, emoji: '🎯', label: '最高' },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {levels.map((l) => (
        <button key={l.value} onClick={() => onChange(l.value)}
          className={`selection-card !p-0 flex flex-col items-center gap-0.5 px-3 py-2.5
            ${score === l.value ? 'active' : ''}`}>
          <span className="text-xl relative z-10">{l.emoji}</span>
          <span className={`text-[10px] font-bold relative z-10 ${score === l.value ? 'text-[#fc3c44]' : 'text-[#c7c7cc]'}`}>
            {l.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   メインページ
   ═══════════════════════════════════════════════════════ */

export default function TuningPage() {
  const { templates, refresh } = useTemplates();
  const [status, setStatus] = useState('');

  // 条件設定
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [field, setField] = useState('');
  const [difficulty, setDifficulty] = useState('標準');
  const [numQuestions, setNumQuestions] = useState(1);



  // プロンプト
  const [basePrompt, setBasePrompt] = useState('');
  const [ragPrompt, setRagPrompt] = useState('');
  const [retrievedChunks, setRetrievedChunks] = useState([]);
  const [topK, setTopK] = useState(5);
  const [textWeight, setTextWeight] = useState(0.5);
  const [difficultyMatchWeight, setDifficultyMatchWeight] = useState(0.6);
  const [trickinessWeight, setTrickinessWeight] = useState(0.0);
  const [ragSkipped, setRagSkipped] = useState(false);

  // LLM 出力 & パース
  const [llmOutput, setLlmOutput] = useState('');
  const [parsedProblem, setParsedProblem] = useState(null);
  const [parseError, setParseError] = useState('');
  const [savedProblemId, setSavedProblemId] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfWorking, setPdfWorking] = useState(false);

  // 評価
  const [tuningScore, setTuningScore] = useState('');
  const [tuningNotes, setTuningNotes] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');

  // 参考問題
  const [referenceStem, setReferenceStem] = useState('');
  const [referenceAnswer, setReferenceAnswer] = useState('');

  // 参考問題DB検索
  const [refSearchQuery, setRefSearchQuery] = useState('');
  const [refSearchResults, setRefSearchResults] = useState([]);
  const [refSearching, setRefSearching] = useState(false);
  const [selectedRefProblem, setSelectedRefProblem] = useState(null);
  const refSearchInputRef = useRef(null);

  // フィードバックループ
  const [feedbackData, setFeedbackData] = useState(null); // { feedback: [...], stats: {...} }
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  /* ── フィードバック取得 ── */
  const loadFeedback = useCallback(async (subj, tplId) => {
    setFeedbackLoading(true);
    try {
      const data = await fetchTuningFeedback({ subject: subj || undefined, templateId: tplId || undefined, minScore: 4.0, limit: 5 });
      setFeedbackData(data);
    } catch {
      setFeedbackData(null);
    }
    setFeedbackLoading(false);
  }, []);

  // テンプレートや教科変更時にフィードバックを自動取得
  useEffect(() => {
    if (subject || templateId) {
      loadFeedback(subject, templateId);
    }
  }, [subject, templateId, loadFeedback]);

  /* ── 参考問題DB検索関数 ── */
  const doRefSearch = useCallback(async () => {
    const q = refSearchQuery.trim();
    if (!q) return;
    setRefSearching(true);
    try {
      const params = { q, limit: 10 };
      if (subject) params.subject = subject;
      const data = await searchProblems(params);
      const items = data.results || data.problems || data || [];
      setRefSearchResults(Array.isArray(items) ? items : []);
    } catch {
      setRefSearchResults([]);
    }
    setRefSearching(false);
  }, [refSearchQuery, subject]);

  const selectRefProblem = (item) => {
    setSelectedRefProblem(item);
    setReferenceStem(item.stem || item.text || '');
    setReferenceAnswer(item.final_answer || item.answer || '');
    setRefSearchResults([]);
    setRefSearchQuery('');
  };

  const clearRefProblem = () => {
    setSelectedRefProblem(null);
    setReferenceStem('');
    setReferenceAnswer('');
  };

  // UI状態
  const [activeSection, setActiveSection] = useState('configure');

  /* ── テンプレート選択肢 ── */
  const templateOptions = templates.map((t) => ({
    value: t.id,
    label: `${t.name || t.id}${t.metadata?.field ? ` (${t.metadata.field})` : ''}`,
  }));

  /* ── テンプレート選択ハンドラ ── */
  const onSelectTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl?.metadata) {
      if (tpl.metadata.subject) setSubject(tpl.metadata.subject);
      if (tpl.metadata.field) setField(tpl.metadata.field);
      if (tpl.metadata.difficulty) setDifficulty(tpl.metadata.difficulty);
    }
    setBasePrompt('');
    setRagPrompt('');
    setRetrievedChunks([]);
    setRagSkipped(false);
  };

  // ── ベースプロンプト生成 ──
  const generateBasePrompt = async () => {
    if (!templateId) { setStatus('テンプレートを選択してください'); return; }
    setStatus('プロンプトを生成中...');
    try {
      const data = await renderTemplate({
        template_id: templateId, subject, difficulty,
        num_questions: numQuestions, rag_inject: false,
      });
      const rendered = data.rendered_prompt || data.rendered || '';
      const hasOutputSpec = /出力形式.*json|json.*形式|必ず.*json/i.test(rendered);
      const refSection = buildReferencePromptSection(referenceStem, referenceAnswer);
      // フィードバックから高評価例をプロンプトに注入
      let feedbackSection = '';
      if (feedbackData?.feedback?.length > 0) {
        const examples = feedbackData.feedback
          .filter((f) => f.model_output_excerpt?.trim())
          .slice(0, 3);
        if (examples.length > 0) {
          const lines = ['\n\n--- 過去の高評価出力例（参考）---',
            '以下は過去に高評価（スコア4以上）を受けた出力例です。品質・形式の参考にしてください。'];
          examples.forEach((ex, i) => {
            lines.push(`\n【例${i + 1}】(スコア: ${ex.score}${ex.notes ? `, メモ: ${ex.notes}` : ''})`);
            lines.push(ex.model_output_excerpt.slice(0, 300));
          });
          lines.push('\n---');
          feedbackSection = lines.join('\n');
        }
      }
      setBasePrompt((hasOutputSpec ? rendered : rendered + OUTPUT_FORMAT_INSTRUCTION) + refSection + feedbackSection);
      setRagPrompt('');
      setRetrievedChunks([]);
      setRagSkipped(false);
      setStatus('プロンプト生成完了 → 実行へ移動');
      // 自動的に「実行」ステップへ遷移
      setActiveSection('execute');
    } catch (e) { setStatus(`エラー: ${e.message}`); }
  };

  // ── RAG 注入 ──
  const injectRag = async () => {
    if (!basePrompt) { setStatus('まずプロンプトを生成してください'); return; }
    setStatus('RAGで関連データを取得中...');
    try {
      const body = {
        question: basePrompt, top_k: topK, use_vector: true,
        difficulty_match_weight: difficultyMatchWeight,
        trickiness_weight: trickinessWeight, text_weight: textWeight,
        target_difficulty: DIFFICULTY_MAP[difficulty] ?? undefined,
        metadata: { subject, field: field || undefined },
      };
      const data = await assemblePrompt(body);
      setRagPrompt(data.prompt_summarized || data.prompt || '');
      setRetrievedChunks(data.retrieved || []);
      setRagSkipped(false);
      setStatus(`RAG注入完了（${(data.retrieved || []).length}件参照）`);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('empty vocabulary') || msg.includes('retrieval failed')) {
        setStatus('RAGデータが未登録です。「スキップ」で進めます。');
      } else if (msg.includes('502') || msg.includes('504') || msg.includes('backend_timeout') || msg.includes('backend_unavailable')) {
        setStatus('RAGエラー: バックエンド一時利用不可。数秒後に再試行してください。');
      } else {
        setStatus(`RAGエラー: ${msg}`);
      }
    }
  };

  const skipRag = () => {
    setRagSkipped(true); setRagPrompt(''); setRetrievedChunks([]);
    setStatus('RAGをスキップ');
  };

  // ── LLM 出力パース ──
  const parseLlmOutput = () => {
    if (!llmOutput.trim()) { setParseError('LLM出力が空です'); return; }
    setParseError('');
    const parsed = extractJson(llmOutput);
    if (parsed) {
      if (typeof parsed.final_answer === 'string') {
        const numMatch = parsed.final_answer.match(/^[^\d-]*(-?[\d]+(?:\.\d+)?)/);
        if (numMatch && parsed.final_answer.length > 20) parsed.final_answer = numMatch[1];
      }
      if (!Array.isArray(parsed.checks)) {
        parsed.checks = [{ desc: '自動生成 — 未検証', ok: false }, { desc: '自動生成 — 未検証', ok: false }];
      } else {
        parsed.checks = parsed.checks.map((c, i) => ({ desc: c?.desc || `check ${i + 1}`, ok: c?.ok ?? false }));
        while (parsed.checks.length < 2) parsed.checks.push({ desc: '自動補完 — 未検証', ok: false });
      }
      setParsedProblem(parsed);
      setStatus('パース成功 → 評価・保存へ移動');
      // 自動的に「評価・保存」ステップへ遷移
      setActiveSection('evaluate');
    } else {
      setParsedProblem({
        stem: llmOutput.trim(), stem_latex: llmOutput.trim(), final_answer: '',
        checks: [{ desc: '自動生成 — 未検証', ok: false }, { desc: '自動生成 — 未検証', ok: false }],
      });
      setStatus('テキストとして読み取りました → 評価・保存へ移動');
      // テキスト読み取りでも自動遷移
      setActiveSection('evaluate');
    }
  };

  // ── DB 保存 ──
  const saveToProblemsDb = async () => {
    if (!parsedProblem) { setStatus('まずパースしてください'); return; }
    setStatus('検算して保存中...');
    setVerificationResult(null);
    try {
      const data = await saveProblem(parsedProblem, {
        subject: subject || null, field: field || null,
        template_id: templateId || null, difficulty_label: difficulty || null,
        source: 'dev_mode',
      });
      if (data.verification) setVerificationResult(data.verification);
      setSavedProblemId(data.inserted_id || null);
      setStatus(`保存完了 (id: ${data.inserted_id || '—'})`);
    } catch (e) {
      const errData = e.data || {};
      if (errData.error === 'verification_failed' && errData.verification) {
        setVerificationResult(errData.verification);
        setStatus('検算不一致 — 保存をブロック');
        return;
      }
      setStatus(`保存エラー: ${e.message}`);
    }
  };

  // ── PDF ──
  const compilePdf = async () => {
    if (!llmOutput?.trim()) return;
    setPdfWorking(true); setStatus('PDF 生成中...');
    try {
      const data = await generatePdf(llmOutput);
      if (data?.pdf_url) { setPdfUrl(data.pdf_url); window.open(data.pdf_url, '_blank'); setStatus('PDF を開きました'); }
      else setStatus(`PDF 生成失敗: ${data?.error || 'LaTeXエンジン未検出'}`);
    } catch (e) { setStatus(`PDF 生成失敗: ${e.message}`); }
    setPdfWorking(false);
  };

  // ── チューニングログ ──
  const saveLog = async () => {
    if (!llmOutput) { setStatus('LLM出力がありません'); return; }
    setStatus('評価を記録中...');
    try {
      const tpl = templates.find((t) => t.id === templateId) || {};
      await saveTuningLog({
        prompt: ragPrompt || basePrompt, model_output: llmOutput,
        expected_output: expectedOutput || undefined,
        score: tuningScore !== '' ? Number(tuningScore) : undefined,
        notes: tuningNotes || undefined,
        metadata: {
          template_id: templateId || null, subject: subject || null,
          difficulty: difficulty || null, field: field || tpl.metadata?.field || null,
          saved_problem_id: savedProblemId || null,
        },
      });
      setStatus('評価を記録しました');
      setTuningScore(''); setTuningNotes(''); setExpectedOutput('');
      // フィードバックデータを再読み込み（今の評価を即座に反映）
      // 少し待ってからリロード（DBへの書き込みが完了するのを待つ）
      await new Promise((r) => setTimeout(r, 500));
      await loadFeedback(subject, templateId);
    } catch (e) { setStatus(`保存エラー: ${e.message}`); }
  };

  const resetAll = () => {
    setBasePrompt(''); setRagPrompt(''); setRetrievedChunks([]);
    setRagSkipped(false); setLlmOutput(''); setParsedProblem(null); setParseError('');
    setSavedProblemId(null); setVerificationResult(null);
    setReferenceStem(''); setReferenceAnswer('');
    setPdfUrl(''); setTuningScore(''); setTuningNotes('');
    setExpectedOutput(''); setActiveSection('configure'); setStatus('リセットしました');
  };

  const finalPrompt = ragPrompt || basePrompt;
  const hasPrompt = !!basePrompt;
  const hasOutput = !!llmOutput.trim();

  const sections = [
    { id: 'configure', label: '設定', icon: '⚙️', enabled: true },
    { id: 'execute', label: '実行', icon: '▶️', enabled: hasPrompt },
    { id: 'evaluate', label: '評価・保存', icon: '✅', enabled: hasOutput },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-4">
      <PageHeader
        title="チューニング"
        description="プロンプトとRAGの設定を調整して、生成される問題の品質を高めるワークスペース"
        icon={<Icons.Dev />}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: '高める' }]}
      />

      <StatusBar message={status} />

      {/* ── フィードバック統計（常時表示） ── */}
      {feedbackData && (
        <div className="p-4 bg-black/[0.04] rounded-lg border border-black/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Icons.Chart className="w-4 h-4 text-[#fc3c44]" />
            <span className="text-sm font-bold text-[#1d1d1f]">改善フィードバック</span>
            {feedbackLoading && <span className="text-[10px] text-[#c7c7cc] animate-pulse">更新中...</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
            <div className="p-2 sm:p-3 bg-black/[0.04] rounded-lg border border-[#fc3c44]/20 text-center">
              <div className="text-base sm:text-lg font-bold text-[#fc3c44]">{feedbackData.stats?.total_evaluations ?? 0}</div>
              <div className="text-[9px] sm:text-[10px] text-[#fc3c44] font-bold">総評価数</div>
            </div>
            <div className="p-2 sm:p-3 bg-black/[0.04] rounded-lg border border-[#34c759]/20 text-center">
              <div className="text-base sm:text-lg font-bold text-[#34c759]">{feedbackData.stats?.avg_score != null ? feedbackData.stats.avg_score : '—'}</div>
              <div className="text-[9px] sm:text-[10px] text-emerald-500 font-bold">平均スコア</div>
            </div>
            <div className="p-2 sm:p-3 bg-black/[0.04] rounded-lg border border-[#ff9500]/20 text-center">
              <div className="text-base sm:text-lg font-bold text-[#ff9500]">{feedbackData.stats?.high_score_count ?? 0}</div>
              <div className="text-[9px] sm:text-[10px] text-amber-500 font-bold">高評価 (4+)</div>
            </div>
          </div>
          {feedbackData.feedback?.length > 0 ? (
            <details className="rounded-lg">
              <summary className="cursor-pointer text-xs font-bold text-[#fc3c44] hover:text-red-300 select-none flex items-center gap-1">
                <svg className="w-3 h-3 transition-transform details-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                高評価例を表示 ({feedbackData.feedback.length}件)
              </summary>
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                {feedbackData.feedback.map((fb, idx) => (
                  <div key={fb.id || idx} className="p-2 bg-black/[0.04] rounded-lg border border-black/[0.06] text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-[#ff9500]/[0.08] text-[#ff9500] rounded text-[9px] font-bold">★ {fb.score}</span>
                        {fb.metadata?.subject && (
                          <span className="px-1.5 py-0.5 bg-[#fc3c44]/[0.08] text-[#fc3c44] rounded text-[9px] font-bold">{fb.metadata.subject}</span>
                        )}
                      </div>
                      <span className="text-[9px] text-[#c7c7cc]">{fb.timestamp?.slice(0, 10)}</span>
                    </div>
                    {fb.notes && <div className="text-[#86868b] text-[10px]">💬 {fb.notes}</div>}
                    <div className="text-[#424245] line-clamp-1 text-[10px]">{fb.model_output_excerpt?.slice(0, 120)}</div>
                  </div>
                ))}
              </div>
            </details>
          ) : (
            <div className="text-xs text-[#86868b] text-center py-1">
              評価を記録すると次回のプロンプトに自動反映されます
            </div>
          )}
        </div>
      )}

      {/* ── セクションナビ (ステップ風) ── */}
      <div className="flex items-center gap-1 sm:gap-1.5 bg-black/[0.04] p-1 sm:p-1.5 rounded-xl border border-black/[0.06] overflow-x-auto no-scrollbar">
        {sections.map((s, idx) => (
          <button key={s.id} onClick={() => s.enabled && setActiveSection(s.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-3.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 relative whitespace-nowrap
              ${activeSection === s.id
                ? 'bg-[#fc3c44] text-white'
                : s.enabled
                  ? 'text-[#86868b] hover:text-[#fc3c44] hover:bg-[#fc3c44]/[0.08]'
                  : 'text-[#d2d2d7] cursor-not-allowed'
              }`}
            disabled={!s.enabled}>
            <span className={`flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold
              ${activeSection === s.id
                ? 'bg-white/30 text-white'
                : s.enabled
                  ? 'bg-black/[0.04] text-[#c7c7cc]'
                  : 'bg-black/[0.04] text-[#d2d2d7]'
              }`}>
              {idx + 1}
            </span>
            <span>{s.icon} {s.label}</span>
            {!s.enabled && s.id !== 'configure' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] bg-black/[0.04] text-[#c7c7cc] px-2 py-0.5 rounded-full whitespace-nowrap">
                {s.id === 'execute' ? 'プロンプト生成後' : '出力貼付後'}
              </span>
            )}
          </button>
        ))}
        <button onClick={resetAll} title="リセット"
          className="px-3 py-3 rounded-xl text-[#c7c7cc] hover:text-[#ff3b30] hover:bg-[#ff3b30]/[0.06] transition-all flex-shrink-0 active:scale-90">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════
         ⚙️ 設定
         ════════════════════════════════════════════════════════ */}
      {activeSection === 'configure' && (
        <div className="space-y-6">

          {/* ── 条件設定（テンプレート＋問数のみ） ── */}
          <SectionCard title="条件を選ぶ" icon={<Icons.File />}
            subtitle="テンプレートを選択してください — 教科・分野・難易度はテンプレートに含まれます">

            {/* 選択中サマリータグ */}
            {templateId && (
              <div className="flex flex-wrap gap-2 mb-5 pb-4 border-b border-black/[0.06]">
                {(() => {
                  const sel = templates.find((t) => t.id === templateId);
                  return <SelectedTag label="テンプレート" value={sel?.name || templateId} color="violet" onClear={() => setTemplateId('')} />;
                })()}
                <SelectedTag label="問数" value={`${numQuestions}問`} color="sky" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
              {/* テンプレート */}
              <Dropdown
                label="テンプレート"
                value={templateId}
                onChange={onSelectTemplate}
                placeholder="— 選択してください —"
                options={templateOptions}
              />

              {/* 問数 */}
              <NumberField label="問数" value={numQuestions} onChange={setNumQuestions} min={1} />
            </div>

            {/* 選択中テンプレート詳細 */}
            {templateId && (() => {
              const sel = templates.find((t) => t.id === templateId);
              return sel ? (
                <div className="p-4 bg-[#fc3c44]/[0.08] rounded-lg border border-[#fc3c44]/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#fc3c44]/10 text-[#fc3c44] flex items-center justify-center flex-shrink-0">
                      <Icons.File className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[#1d1d1f] truncate">{sel.name || sel.id}</div>
                      {sel.description && <div className="text-xs text-[#86868b] mt-0.5 truncate">{sel.description}</div>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {sel.metadata?.subject && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fc3c44]/[0.08] text-[#fc3c44]">{sel.metadata.subject}</span>}
                    {sel.metadata?.field && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#34c759]/[0.08] text-[#34c759]">{sel.metadata.field}</span>}
                    {sel.metadata?.difficulty && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff9500]/[0.08] text-[#ff9500]">{sel.metadata.difficulty}</span>}
                  </div>
                </div>
              ) : null;
            })()}

            {/* リフレッシュボタン */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-black/[0.06]">
              <button onClick={async () => { await refresh(); setStatus('テンプレート一覧を再読み込みしました'); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[#86868b] hover:text-[#fc3c44] hover:bg-[#fc3c44]/[0.08] transition-all"
                title="テンプレートを再読込">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                再読み込み
              </button>
              <span className="text-[10px] text-gray-300">{templates.length}件のテンプレート</span>
            </div>
          </SectionCard>

          {/* ── 参考問題（DB検索ベース） ── */}
          <SectionCard title="参考問題を選択" icon={<Icons.Search />}
            subtitle="DBから参考問題を検索して選択できます。選択した問題に沿った類題を生成します。">

            {/* 選択済み問題の表示 */}
            {selectedRefProblem && (
              <div className="mb-4 p-3 bg-[#ff9500]/[0.08] rounded-lg border-2 border-[#ff9500]/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <span className="text-[10px] text-[#ff9500] font-bold">選択中の参考問題</span>
                      {selectedRefProblem.id && (
                        <span className="text-[10px] text-[#ff9500] font-mono">#{selectedRefProblem.id}</span>
                      )}
                    </div>
                    <div className="text-xs text-[#86868b] leading-relaxed line-clamp-3">
                      <LatexText>{(selectedRefProblem.stem || selectedRefProblem.text || '').slice(0, 200)}</LatexText>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {selectedRefProblem.subject && (
                        <span className="px-1.5 py-0.5 bg-[#fc3c44]/[0.08] text-[#fc3c44] rounded text-[9px] font-bold">{selectedRefProblem.subject}</span>
                      )}
                      {(selectedRefProblem.topic || selectedRefProblem.metadata?.field) && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-[#34c759] rounded text-[9px] font-bold">{selectedRefProblem.topic || selectedRefProblem.metadata?.field}</span>
                      )}
                      {selectedRefProblem.difficulty != null && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-[#ff9500] rounded text-[9px] font-bold">{difficultyLabel(selectedRefProblem.difficulty)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={clearRefProblem}
                    className="px-2 py-1 text-[10px] text-amber-500 hover:text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg font-bold transition-colors flex-shrink-0"
                  >
                    解除
                  </button>
                </div>
              </div>
            )}

            {/* DB検索フォーム */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-xs font-semibold text-[#aeaeb2]">
                  キーワードでDBから検索
                </label>
                <span className="text-[10px] text-gray-300">（任意）</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={refSearchInputRef}
                    type="text"
                    value={refSearchQuery}
                    onChange={(e) => setRefSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') doRefSearch(); }}
                    placeholder="キーワードで過去問を検索..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-black/[0.06] bg-black/[0.04] text-xs
                               text-[#1d1d1f] transition-all hover:border-black/[0.08] focus:border-[#fc3c44]/50
                               focus:ring-2 focus:ring-[#fc3c44]/20 outline-none placeholder:text-[#c7c7cc]"
                  />
                </div>
                <button
                  onClick={doRefSearch}
                  disabled={refSearching || !refSearchQuery.trim()}
                  className="px-4 py-2.5 rounded-lg text-xs font-bold bg-[#fc3c44]/[0.08] text-[#fc3c44]
                             hover:bg-[#fc3c44] hover:text-[#1d1d1f] transition-all disabled:opacity-40 disabled:cursor-not-allowed
                             flex items-center gap-1.5"
                >
                  {refSearching ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      検索中
                    </>
                  ) : '検索'}
                </button>
              </div>
            </div>

            {/* 検索結果一覧 */}
            {refSearchResults.length > 0 && (
              <div className="border border-black/[0.06] rounded-lg overflow-hidden max-h-64 overflow-y-auto mb-3">
                {refSearchResults.map((item, idx) => (
                  <button
                    key={item.id ?? idx}
                    onClick={() => selectRefProblem(item)}
                    className="w-full text-left px-3 py-2.5 border-b border-black/[0.06] last:border-b-0
                               transition-all hover:bg-black/[0.03] bg-black/[0.04]"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-[#d2d2d7] font-mono mt-0.5 flex-shrink-0">#{item.id ?? idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#1d1d1f] leading-relaxed line-clamp-2">
                          <LatexText>{(item.stem || item.text || '').slice(0, 150)}</LatexText>
                        </div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {item.subject && (
                            <span className="px-1.5 py-0.5 bg-[#fc3c44]/[0.08] text-[#fc3c44] rounded text-[9px] font-bold">{item.subject}</span>
                          )}
                          {(item.topic || item.metadata?.field) && (
                            <span className="px-1.5 py-0.5 bg-[#34c759]/[0.08] text-emerald-500 rounded text-[9px] font-bold">{item.topic || item.metadata?.field}</span>
                          )}
                          {item.difficulty != null && (
                            <span className="px-1.5 py-0.5 bg-[#ff9500]/[0.08] text-amber-500 rounded text-[9px] font-bold">{difficultyLabel(item.difficulty)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* 検索結果が0件の場合 */}
            {refSearchResults.length === 0 && refSearchQuery && !refSearching && (
              <div className="text-center py-3 text-xs text-[#c7c7cc] mb-3">
                該当する問題が見つかりません
              </div>
            )}

            {referenceStem && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34c759] flex-shrink-0" />
                <span className="text-[10px] text-[#34c759] font-bold">参考問題が設定されています</span>
              </div>
            )}
          </SectionCard>

          {/* ── RAG ミキサー ── */}
          <SectionCard title="RAG ミキサー" icon={<Icons.Search />}
            subtitle="過去問データベースからの情報注入バランスを調整">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <RagMixer
                  textWeight={textWeight} diffWeight={difficultyMatchWeight} trickWeight={trickinessWeight}
                  onText={setTextWeight} onDiff={setDifficultyMatchWeight} onTrick={setTrickinessWeight}
                />
                <div className="mt-4">
                  <NumberField label="参照件数 (Top-K)" value={topK} onChange={setTopK} min={1} max={20} />
                </div>
              </div>
              <div className="space-y-3 text-xs text-[#aeaeb2]">
                <div className="p-3 bg-[#007aff]/[0.08] rounded-lg border border-blue-100/40">
                  <span className="font-bold text-[#007aff]">類似度</span>
                  <p className="mt-1 text-blue-500">プロンプトと似た内容の過去問を重視</p>
                </div>
                <div className="p-3 bg-[#34c759]/[0.08] rounded-lg border border-emerald-100/40">
                  <span className="font-bold text-[#34c759]">難易度</span>
                  <p className="mt-1 text-emerald-500">指定難易度に近い過去問を重視</p>
                </div>
                <div className="p-3 bg-[#ff9500]/[0.08] rounded-lg border border-amber-100/40">
                  <span className="font-bold text-[#ff9500]">ひっかけ</span>
                  <p className="mt-1 text-amber-500">ひっかけ要素のある過去問を重視</p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── プロンプト生成 ── */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={generateBasePrompt} disabled={!templateId}>
              <Icons.Prompt className="w-4 h-4" /> プロンプトを生成
            </Button>
            {basePrompt && (
              <>
                <Button onClick={injectRag} variant="secondary">
                  <Icons.Search className="w-4 h-4" /> RAGを注入
                </Button>
                <Button onClick={skipRag} variant="ghost">RAGをスキップ</Button>
              </>
            )}
          </div>

          {ragSkipped && (
            <div className="p-3 bg-[#ff9500]/[0.08] rounded-lg border border-[#ff9500]/20/40 text-xs text-amber-700 flex items-center gap-2">
              <Icons.Info className="w-3.5 h-3.5 flex-shrink-0" /> RAGスキップ中
            </div>
          )}

          {retrievedChunks.length > 0 && (
            <div className="p-4 bg-black/[0.04] rounded-lg border border-black/[0.06] max-h-56 overflow-y-auto custom-scrollbar">
              <div className="text-xs font-semibold text-[#aeaeb2] mb-2 uppercase tracking-wide flex items-center gap-2">
                参照データ ({retrievedChunks.length}件)
                {retrievedChunks[0]?.search_tier && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    retrievedChunks[0].search_tier === 'subject+field' ? 'bg-emerald-100 text-emerald-700' :
                    retrievedChunks[0].search_tier === 'subject-only' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-200 text-[#aeaeb2]'
                  }`}>
                    {retrievedChunks[0].search_tier === 'subject+field' ? '科目+分野' :
                     retrievedChunks[0].search_tier === 'subject-only' ? '科目のみ' : 'グローバル'}
                  </span>
                )}
              </div>
              {retrievedChunks.map((c, i) => (
                <div key={i} className="py-2 border-b border-black/[0.06] last:border-0 text-xs flex items-start gap-2">
                  <span className="text-gray-300 font-mono flex-shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {c.subject && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[#fc3c44]/[0.08] text-[#fc3c44] mr-1">{c.subject}</span>
                    )}
                    <span className="text-[#aeaeb2] leading-relaxed">
                      {(c.text || '').slice(0, 150).replace(/\n/g, ' ')}{(c.text || '').length > 150 ? '...' : ''}
                    </span>
                  </div>
                  <span className="text-[#c7c7cc] flex-shrink-0 tabular-nums">
                    {c.final_score !== undefined ? Number(c.final_score).toFixed(2) : c.score !== undefined ? Number(c.score).toFixed(2) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {basePrompt && (
            <SectionCard title="生成されたプロンプト"
              subtitle={`${finalPrompt.length.toLocaleString()} 文字${ragSkipped ? '（RAGなし）' : ragPrompt ? '（RAG注入済み）' : ''}`}>
              <TextArea value={finalPrompt} onChange={ragPrompt ? setRagPrompt : setBasePrompt} rows={6} />
              <div className="flex items-center gap-3 mt-3">
                <CopyButton text={finalPrompt} onCopied={setStatus} />
                <Button variant="secondary" size="sm" onClick={() => setActiveSection('execute')}>
                  実行へ進む <Icons.ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         ▶️ 実行
         ════════════════════════════════════════════════════════ */}
      {activeSection === 'execute' && (
        <div className="space-y-6">
          <SectionCard title="LLMにプロンプトを送る" icon={<Icons.Prompt />}
            subtitle="プロンプトをコピーして、お好みのLLMに貼り付けて実行">
            <div className="p-4 bg-[#fc3c44]/[0.08] rounded-lg border border-[#fc3c44]/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#fc3c44] text-white flex items-center justify-center">
                  <Icons.Copy className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#86868b]">送信用プロンプト</div>
                  <div className="text-xs text-[#c7c7cc]">
                    {finalPrompt.length.toLocaleString()} 文字
                    {ragSkipped && ' （RAG なし）'}
                    {ragPrompt && ' （RAG 注入済み）'}
                  </div>
                </div>
                <CopyButton text={finalPrompt} onCopied={setStatus} label="コピー" />
              </div>
              <pre className="text-xs text-[#86868b] bg-black/[0.04] rounded-lg p-3 max-h-32 overflow-auto custom-scrollbar font-mono leading-relaxed">
                {finalPrompt.slice(0, 500)}{finalPrompt.length > 500 ? '\n...' : ''}
              </pre>
            </div>
            {/* RAG 注入ボタン（未注入の場合に表示） */}
            {!ragPrompt && !ragSkipped && (
              <div className="flex flex-wrap items-center gap-2 mt-3 p-3 bg-[#ff9500]/[0.08] rounded-lg border border-amber-100/40">
                <span className="text-xs text-[#ff9500] font-bold">RAG未注入:</span>
                <Button onClick={injectRag} variant="secondary" size="sm">
                  <Icons.Search className="w-3.5 h-3.5" /> RAGを注入
                </Button>
                <Button onClick={skipRag} variant="ghost" size="sm">スキップ</Button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { name: 'ChatGPT', url: 'https://chat.openai.com', color: 'from-green-500 to-emerald-600' },
                { name: 'Claude', url: 'https://claude.ai', color: 'from-amber-500 to-orange-500' },
                { name: 'Gemini', url: 'https://gemini.google.com', color: 'from-blue-500 to-indigo-600' },
              ].map(({ name, url, color }) => (
                <a key={name} href={url} target="_blank" rel="noreferrer"
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r ${color} text-[#1d1d1f] text-sm font-semibold shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]`}>
                  {name}
                </a>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="LLMの出力を貼り付け" icon={<Icons.File />}
            subtitle="LLMが生成した結果をここに貼り付けてください">
            <TextArea value={llmOutput}
              onChange={(v) => { setLlmOutput(v); setParsedProblem(null); setParseError(''); setSavedProblemId(null); }}
              rows={10} placeholder="LLM の出力（JSON / LaTeX / テキスト）をここに貼り付け" />
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button onClick={parseLlmOutput} disabled={!llmOutput}>
                <Icons.Search className="w-4 h-4" /> パースする
              </Button>
            </div>
            {parseError && (
              <div className="mt-3 p-3 bg-rose-50 rounded-lg border border-rose-200/40 text-xs text-rose-700">
                <Icons.Info className="w-3.5 h-3.5 inline mr-1" /> {parseError}
              </div>
            )}
            {parsedProblem && (
              <div className="mt-4 p-4 bg-[#34c759]/[0.08] rounded-lg border border-[#34c759]/20/40 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Icons.Success className="w-4 h-4" /> パース結果
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    ['科目', parsedProblem.subject],
                    ['分野', parsedProblem.field],
                    ['問題文', parsedProblem.stem],
                    ['LaTeX', parsedProblem.stem_latex],
                    ['解法', parsedProblem.solution_outline],
                    ['最終解答', parsedProblem.final_answer],
                    ['難易度', parsedProblem.difficulty],
                    ['確信度', parsedProblem.confidence],
                    ['解説', parsedProblem.explanation],
                    ['解答要約', parsedProblem.answer_brief],
                  ].filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (
                    <div key={k} className="flex gap-2 items-start">
                      <span className="font-medium text-[#34c759] flex-shrink-0 min-w-[80px]">{k}:</span>
                      <span className="text-[#aeaeb2] break-all">
                        {typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 200)}{String(v).length > 200 ? '...' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         ✅ 評価・保存
         ════════════════════════════════════════════════════════ */}
      {activeSection === 'evaluate' && (
        <div className="space-y-6">
          <SectionCard title="品質を評価" icon={<Icons.Chart />}
            subtitle="出力の品質を評価して記録（次回の改善に活用）">
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-2">品質スコア</label>
                <QualityRating score={tuningScore ? Number(tuningScore) : ''} onChange={(v) => setTuningScore(String(v))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-1.5">メモ</label>
                  <input value={tuningNotes} onChange={(e) => setTuningNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-sm shadow-sm text-sm text-[#1d1d1f]
                      transition-all hover:border-black/[0.10] hover:shadow-md focus:border-[#fc3c44] focus:ring-2 focus:ring-[#fc3c44]/30 outline-none font-medium"
                    placeholder="例: 難易度は適切だが解説が冗長" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-1.5">期待していた出力 <span className="text-[#aeaeb2] normal-case tracking-normal">（任意）</span></label>
                  <input value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-sm shadow-sm text-sm text-[#1d1d1f]
                      transition-all hover:border-black/[0.10] hover:shadow-md focus:border-[#fc3c44] focus:ring-2 focus:ring-[#fc3c44]/30 outline-none font-medium"
                    placeholder="期待される出力の要約" />
                </div>
              </div>
              <Button onClick={saveLog} disabled={!llmOutput}>
                <Icons.Success className="w-4 h-4" /> 評価を記録する
              </Button>
            </div>
          </SectionCard>



          <SectionCard title="問題をDBに保存" icon={<Icons.Data />}
            subtitle="パースした問題データをDBに保存（検算を自動実行）">
            {parsedProblem ? (
              <div className="space-y-4">
                <div className="p-4 bg-black/[0.04] rounded-lg border border-black/[0.06] text-xs space-y-1.5">
                  {parsedProblem.stem && (
                    <div><span className="font-bold text-[#aeaeb2]">問題:</span> <span className="text-[#86868b]">{parsedProblem.stem.slice(0, 200)}{parsedProblem.stem.length > 200 ? '...' : ''}</span></div>
                  )}
                  {parsedProblem.final_answer && (
                    <div><span className="font-bold text-[#86868b]">解答:</span> <span className="text-[#fc3c44] font-bold">{parsedProblem.final_answer}</span></div>
                  )}
                  {parsedProblem.checks && (
                    <div className="flex gap-3 mt-1">
                      {parsedProblem.checks.map((c, i) => (
                        <span key={i} className={`text-xs ${c.ok ? 'text-[#34c759]' : 'text-rose-500'}`}>
                          {c.ok ? '✓' : '✗'} {c.desc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="success" onClick={saveToProblemsDb}>
                    <Icons.Data className="w-4 h-4" /> DBに保存する
                  </Button>
                  <Button variant="ghost" onClick={compilePdf} disabled={!llmOutput || pdfWorking}>
                    {pdfWorking
                      ? <span className="flex items-center gap-2"><Icons.Info className="animate-pulse" /> 生成中...</span>
                      : <span className="flex items-center gap-2"><Icons.Pdf className="w-4 h-4" /> PDF</span>}
                  </Button>
                </div>
                {verificationResult && !verificationResult.skipped && (
                  <div className={`p-3 rounded-lg border text-sm font-semibold flex items-center gap-2 ${
                    verificationResult.verified
                      ? 'bg-[#34c759]/[0.08] border-[#34c759]/20 text-emerald-700'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}>
                    {verificationResult.verified
                      ? <><Icons.Success className="w-4 h-4" /> 検算OK: {verificationResult.expected} = {verificationResult.computed}</>
                      : <><Icons.Info className="w-4 h-4" /> 検算NG: 期待={verificationResult.expected}, 計算={verificationResult.computed}</>}
                  </div>
                )}
                {savedProblemId && (
                  <div className="p-3 bg-[#34c759]/[0.08] rounded-lg border border-[#34c759]/20 text-sm text-emerald-700 font-semibold flex items-center gap-2">
                    <Icons.Success className="w-4 h-4" /> 保存済み — ID: {savedProblemId}
                  </div>
                )}
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-3 bg-[#34c759]/[0.08] text-emerald-700 rounded-lg border border-emerald-100 font-bold text-sm hover:bg-emerald-100 transition-colors">
                    <Icons.Pdf className="w-4 h-4" /> PDF プレビューを開く
                  </a>
                )}
              </div>
            ) : (
              <EmptyState title="パース済みデータがありません" description="「実行」タブでLLM出力をパースしてください" />
            )}
          </SectionCard>

          <div className="flex items-center justify-center gap-4 py-4">
            <Button variant="ghost" onClick={() => setActiveSection('configure')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              設定に戻って再調整
            </Button>
            <span className="text-xs text-gray-300">|</span>
            <Button variant="ghost" onClick={resetAll}>最初からやり直す</Button>
          </div>
        </div>
      )}
    </div>
  );
}
