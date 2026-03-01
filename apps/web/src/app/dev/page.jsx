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
  fetchEvaluationHistory,
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
  const presets = [
    { label: 'バランス', icon: '⚖️', text: 0.5, diff: 0.6, trick: 0.0, desc: '標準的なバランス配分' },
    { label: '類似重視', icon: '🎯', text: 1.5, diff: 0.3, trick: 0.0, desc: '似た問題を多く参照' },
    { label: '難易度重視', icon: '📊', text: 0.3, diff: 1.5, trick: 0.0, desc: '同じ難易度帯を重視' },
    { label: 'ひっかけ強化', icon: '🪤', text: 0.3, diff: 0.3, trick: 1.5, desc: '巧妙な問題を参照' },
  ];
  const axes = [
    { label: '類似度', value: textWeight, color: '#0a84ff', onChange: onText, desc: 'プロンプトと似た内容の過去問を重視' },
    { label: '難易度', value: diffWeight, color: '#30d158', onChange: onDiff, desc: '指定難易度に近い過去問を重視' },
    { label: 'ひっかけ', value: trickWeight, color: '#ff9f0a', onChange: onTrick, desc: 'ひっかけ要素のある過去問を重視' },
  ];
  return (
    <div className="space-y-6">
      {/* プリセット */}
      <div>
        <div className="text-[10px] font-bold text-[#c7c7cc] uppercase tracking-wider mb-2.5">プリセット — ワンクリックで設定</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {presets.map((p) => {
            const isActive = Math.abs(textWeight - p.text) < 0.05 && Math.abs(diffWeight - p.diff) < 0.05 && Math.abs(trickWeight - p.trick) < 0.05;
            return (
              <button key={p.label} onClick={() => { onText(p.text); onDiff(p.diff); onTrick(p.trick); }}
                className={`group relative rounded-2xl p-3 text-center transition-all duration-300 active:scale-[0.96]
                  ${isActive
                    ? 'bg-white shadow-md shadow-black/[0.06] ring-2 ring-[#fc3c44]/30'
                    : 'bg-white/50 shadow-sm ring-1 ring-black/[0.04] hover:ring-black/[0.08] hover:shadow-md hover:bg-white/80'
                  }`}
              >
                {isActive && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-[#fc3c44] to-[#ff6b6b]" />}
                <span className="text-xl block mb-1">{p.icon}</span>
                <span className={`text-[11px] font-bold block ${isActive ? 'text-[#fc3c44]' : 'text-[#1d1d1f]'}`}>{p.label}</span>
                <span className="text-[9px] text-[#aeaeb2] block mt-0.5 leading-tight">{p.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ビジュアルバランスメーター */}
      <div className="p-5 bg-white/60 backdrop-blur-sm rounded-2xl border border-black/[0.04] shadow-sm">
        {/* 円グラフ風バランス表示 */}
        <div className="flex items-center justify-center gap-6 sm:gap-10 mb-6">
          {axes.map((p) => {
            const pct = Math.round((p.value / total) * 100);
            const circumference = 2 * Math.PI * 14;
            const dashLen = (pct / 100) * circumference;
            return (
              <div key={p.label} className="flex flex-col items-center gap-1.5">
                <div className="relative w-[68px] h-[68px]">
                  <svg className="w-[68px] h-[68px] -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#f0f0f0" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke={p.color} strokeWidth="2.5"
                      strokeDasharray={`${dashLen} ${circumference}`} strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                      style={{ filter: `drop-shadow(0 0 4px ${p.color}40)` }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[14px] font-bold tabular-nums" style={{ color: p.color }}>{pct}%</span>
                  </div>
                </div>
                <span className="text-[11px] font-bold" style={{ color: p.color }}>{p.label}</span>
              </div>
            );
          })}
        </div>

        {/* スライダー */}
        <div className="space-y-4">
          {axes.map((p) => {
            const pct = (p.value / 2) * 100;
            return (
              <div key={p.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                         style={{ background: p.color, boxShadow: `0 0 6px ${p.color}40` }} />
                    <span className="text-[12px] font-bold" style={{ color: p.color }}>{p.label}</span>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-lg"
                        style={{ color: p.color, background: `${p.color}10` }}>
                    {p.value.toFixed(1)}
                  </span>
                </div>
                <div className="relative h-7 flex items-center">
                  <div className="absolute inset-x-0 h-[5px] rounded-full bg-black/[0.04]" />
                  <div className="absolute left-0 h-[5px] rounded-full transition-all duration-200"
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
                      [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:active:scale-110"
                  />
                </div>
                <p className="text-[10px] text-[#aeaeb2] mt-0.5 ml-4">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   品質レーティング
   ═══════════════════════════════════════════════════════ */

function QualityRating({ score, onChange }) {
  const levels = [
    { value: 0.2, emoji: '😕', label: '低い', color: '#ff3b30' },
    { value: 0.4, emoji: '🤔', label: 'いまいち', color: '#ff9500' },
    { value: 0.6, emoji: '🙂', label: 'まあまあ', color: '#ffcc00' },
    { value: 0.8, emoji: '😊', label: '良い', color: '#34c759' },
    { value: 1.0, emoji: '🎯', label: '最高', color: '#007aff' },
  ];
  return (
    <div className="flex items-stretch gap-2">
      {levels.map((l) => {
        const isActive = score === l.value;
        return (
          <button key={l.value} onClick={() => onChange(l.value)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl transition-all duration-300 active:scale-95 relative overflow-hidden
              ${isActive
                ? 'bg-white shadow-md shadow-black/[0.06] ring-2 scale-105'
                : 'bg-white/50 ring-1 ring-black/[0.04] hover:ring-black/[0.08] hover:bg-white/80 hover:shadow-sm'
              }`}
            style={isActive ? { ringColor: `${l.color}40`, '--tw-ring-color': `${l.color}40` } : undefined}>
            {isActive && <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: l.color }} />}
            <span className={`text-2xl transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>{l.emoji}</span>
            <span className={`text-[10px] font-bold transition-colors ${isActive ? '' : 'text-[#aeaeb2]'}`}
                  style={isActive ? { color: l.color } : undefined}>
              {l.label}
            </span>
          </button>
        );
      })}
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

  // 参考問題DB（テンプレート合致で自動取得）
  const [matchedRefProblems, setMatchedRefProblems] = useState([]);
  const [matchedRefLoading, setMatchedRefLoading] = useState(false);
  const [refFilterQuery, setRefFilterQuery] = useState('');
  const [selectedRefProblem, setSelectedRefProblem] = useState(null);
  const refSearchInputRef = useRef(null);

  /* ── フィルタ済み参考問題リスト ── */
  const filteredRefProblems = refFilterQuery.trim()
    ? matchedRefProblems.filter((item) => {
        const q = refFilterQuery.trim().toLowerCase();
        const text = (item.stem || item.text || '').toLowerCase();
        const topic = (item.topic || item.metadata?.field || '').toLowerCase();
        return text.includes(q) || topic.includes(q);
      })
    : matchedRefProblems;

  // フィードバックループ
  const [feedbackData, setFeedbackData] = useState(null); // { feedback: [...], stats: {...} }
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  // 評価履歴（包括的分析）
  const [evalHistory, setEvalHistory] = useState(null); // { evaluations: [...], analytics: {...} }
  const [evalHistoryLoading, setEvalHistoryLoading] = useState(false);
  const [showEvalHistory, setShowEvalHistory] = useState(false);

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

  /* ── 評価履歴取得 ── */
  const loadEvalHistory = useCallback(async (subj) => {
    setEvalHistoryLoading(true);
    try {
      const data = await fetchEvaluationHistory({ subject: subj || undefined, limit: 50 });
      setEvalHistory(data);
    } catch {
      setEvalHistory(null);
    }
    setEvalHistoryLoading(false);
  }, []);

  // テンプレートや教科変更時にフィードバックを自動取得
  useEffect(() => {
    if (subject || templateId) {
      loadFeedback(subject, templateId);
      loadEvalHistory(subject);
    }
  }, [subject, templateId, loadFeedback, loadEvalHistory]);

  /* ── テンプレート合致の参考問題を自動取得 ── */
  useEffect(() => {
    if (!subject) return;
    let cancelled = false;
    const fetchMatched = async () => {
      setMatchedRefLoading(true);
      try {
        const params = { limit: 15 };
        if (subject) params.subject = subject;
        if (field) params.topic = field;
        const data = await searchProblems(params);
        const items = data.results || data.problems || data || [];
        if (!cancelled) setMatchedRefProblems(Array.isArray(items) ? items : []);
      } catch {
        if (!cancelled) setMatchedRefProblems([]);
      }
      if (!cancelled) setMatchedRefLoading(false);
    };
    fetchMatched();
    return () => { cancelled = true; };
  }, [subject, field]);

  const selectRefProblem = (item) => {
    setSelectedRefProblem(item);
    setReferenceStem(item.stem || item.text || '');
    setReferenceAnswer(item.final_answer || item.answer || '');
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
    setStatus('過去問を参照中...');
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
      setStatus(`過去問参照完了（${(data.retrieved || []).length}件参照）`);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('empty vocabulary') || msg.includes('retrieval failed')) {
        setStatus('参照できる過去問がまだ登録されていません。「スキップ」で進めます。');
      } else if (msg.includes('502') || msg.includes('504') || msg.includes('backend_timeout') || msg.includes('backend_unavailable')) {
        setStatus('過去問参照エラー: サーバーが一時的に利用できません。数秒後に再試行してください。');
      } else {
        setStatus(`過去問参照エラー: ${msg}`);
      }
    }
  };

  const skipRag = () => {
    setRagSkipped(true); setRagPrompt(''); setRetrievedChunks([]);
    setStatus('過去問参照をスキップ');
  };

  // ── AI 出力パース ──
  const parseLlmOutput = () => {
    if (!llmOutput.trim()) { setParseError('AI出力が空です'); return; }
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

  // ── 保存 ──
  const saveToProblemsDb = async () => {
    if (!parsedProblem) { setStatus('まずパースしてください'); return;
    }
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
      else setStatus(`PDF 生成失敗: ${data?.error || 'サーバー設定を確認してください'}`);
    } catch (e) { setStatus(`PDF 生成失敗: ${e.message}`); }
    setPdfWorking(false);
  };

  // ── 評価ログ ──
  const saveLog = async () => {
    if (!llmOutput) { setStatus('AI出力がありません'); return; }
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
      await loadEvalHistory(subject);
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
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 px-3 sm:px-4">
      <PageHeader
        title="品質をみがく"
        description="過去問の参照やプロンプトの調整を通じて、生成される問題の品質を高めるワークスペース"
        icon={<Icons.Dev />}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'みがく' }]}
      />

      <StatusBar message={status} />

      {/* ── フィードバックダッシュボード（常時表示） ── */}
      {feedbackData && (
        <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg shadow-black/[0.03]">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff9500] via-[#fc3c44] to-[#af52de] opacity-80" />
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-[#ff9500] to-[#fc3c44] text-white shadow-lg shadow-[#fc3c44]/20">
                <Icons.Chart className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">改善フィードバック</h3>
                <p className="text-[11px] text-[#86868b]">過去の評価データから品質向上に活用</p>
              </div>
              {feedbackLoading && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#fc3c44]/[0.06] rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#fc3c44] animate-pulse" />
                  <span className="text-[10px] text-[#fc3c44] font-bold">更新中</span>
                </div>
              )}
            </div>

            {/* 統計カード */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#fc3c44]/[0.06] to-[#fc3c44]/[0.02] border border-[#fc3c44]/10 p-4 text-center">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#fc3c44] to-transparent opacity-40" />
                <div className="text-2xl font-bold text-[#fc3c44] tabular-nums">{feedbackData.stats?.total_evaluations ?? 0}</div>
                <div className="text-[10px] text-[#fc3c44]/70 font-bold mt-0.5 uppercase tracking-wider">総評価数</div>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#34c759]/[0.06] to-[#34c759]/[0.02] border border-[#34c759]/10 p-4 text-center">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#34c759] to-transparent opacity-40" />
                <div className="text-2xl font-bold text-[#34c759] tabular-nums">{feedbackData.stats?.avg_score != null ? feedbackData.stats.avg_score : '—'}</div>
                <div className="text-[10px] text-[#34c759]/70 font-bold mt-0.5 uppercase tracking-wider">平均スコア</div>
                {/* スコアバー */}
                {feedbackData.stats?.avg_score != null && (
                  <div className="mt-2 h-1.5 bg-black/[0.04] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#34c759] to-[#30d158] transition-all duration-700"
                         style={{ width: `${(feedbackData.stats.avg_score / 5) * 100}%` }} />
                  </div>
                )}
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff9500]/[0.06] to-[#ff9500]/[0.02] border border-[#ff9500]/10 p-4 text-center">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff9500] to-transparent opacity-40" />
                <div className="text-2xl font-bold text-[#ff9500] tabular-nums">{feedbackData.stats?.high_score_count ?? 0}</div>
                <div className="text-[10px] text-[#ff9500]/70 font-bold mt-0.5 uppercase tracking-wider">高評価 (4+)</div>
              </div>
            </div>

            {/* 高評価例 */}
            {feedbackData.feedback?.length > 0 ? (
              <details className="group rounded-2xl bg-black/[0.02] border border-black/[0.04] overflow-hidden">
                <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-[#fc3c44] hover:bg-black/[0.02] select-none flex items-center gap-2 transition-all">
                  <svg className="w-3.5 h-3.5 transition-transform duration-200 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>高評価の出力例を表示</span>
                  <span className="ml-auto px-2 py-0.5 bg-[#fc3c44]/[0.08] text-[#fc3c44] rounded-full text-[10px] font-bold">{feedbackData.feedback.length}件</span>
                </summary>
                <div className="px-4 pb-4 space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
                  {feedbackData.feedback.map((fb, idx) => (
                    <div key={fb.id || idx} className="p-3 bg-white/80 rounded-xl border border-black/[0.04] shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#ff9500]/[0.08] text-[#ff9500] rounded-lg text-[10px] font-bold">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            {fb.score}
                          </span>
                          {fb.metadata?.subject && (
                            <span className="px-2 py-0.5 bg-[#fc3c44]/[0.06] text-[#fc3c44] rounded-lg text-[9px] font-bold">{fb.metadata.subject}</span>
                          )}
                          {fb.metadata?.field && (
                            <span className="px-2 py-0.5 bg-[#34c759]/[0.06] text-[#34c759] rounded-lg text-[9px] font-bold">{fb.metadata.field}</span>
                          )}
                        </div>
                        <span className="text-[9px] text-[#c7c7cc] font-medium">{fb.timestamp?.slice(0, 10)}</span>
                      </div>
                      {fb.notes && (
                        <div className="text-[11px] text-[#86868b] flex items-start gap-1.5 mb-1">
                          <span className="text-[#ff9500] flex-shrink-0">💬</span>
                          <span>{fb.notes}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-[#424245] line-clamp-2 leading-relaxed bg-black/[0.02] rounded-lg p-2 mt-1 font-mono">
                        {fb.model_output_excerpt?.slice(0, 200)}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ) : (
              <div className="text-center py-4 bg-black/[0.02] rounded-2xl border border-black/[0.04]">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-black/[0.04] mb-2">
                  <svg className="w-5 h-5 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <p className="text-xs text-[#86868b] font-medium">評価を記録すると次回のプロンプトに自動反映されます</p>
                <p className="text-[10px] text-[#aeaeb2] mt-0.5">データは自動的に保存されます</p>
              </div>
            )}

            {/* 評価履歴ボタン */}
            <div className="mt-4 pt-4 border-t border-black/[0.04] flex items-center justify-between">
              <button
                onClick={() => { setShowEvalHistory(!showEvalHistory); if (!evalHistory) loadEvalHistory(subject); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#86868b] hover:text-[#fc3c44] hover:bg-[#fc3c44]/[0.06] transition-all border border-black/[0.04] hover:border-[#fc3c44]/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {showEvalHistory ? '履歴を閉じる' : '評価履歴を表示'}
              </button>
              <button
                onClick={() => { loadFeedback(subject, templateId); loadEvalHistory(subject); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold text-[#aeaeb2] hover:text-[#fc3c44] transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                更新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 評価履歴パネル ── */}
      {showEvalHistory && evalHistory && (
        <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg shadow-black/[0.03]">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#5856d6] via-[#007aff] to-[#5856d6] opacity-80" />
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-[#5856d6] to-[#007aff] text-white shadow-lg shadow-[#5856d6]/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">評価履歴 & 分析</h3>
                <p className="text-[11px] text-[#86868b]">全{evalHistory.analytics?.total || 0}件の評価データ</p>
              </div>
              {evalHistoryLoading && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#5856d6]/[0.06] rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5856d6] animate-pulse" />
                  <span className="text-[10px] text-[#5856d6] font-bold">読込中</span>
                </div>
              )}
            </div>

            {/* 分析サマリー */}
            {evalHistory.analytics && (
              <div className="mb-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#fc3c44]/[0.06] to-transparent border border-[#fc3c44]/10 text-center">
                    <div className="text-lg font-bold text-[#fc3c44] tabular-nums">{evalHistory.analytics.total}</div>
                    <div className="text-[9px] text-[#fc3c44]/60 font-bold uppercase tracking-wider">総評価数</div>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#34c759]/[0.06] to-transparent border border-[#34c759]/10 text-center">
                    <div className="text-lg font-bold text-[#34c759] tabular-nums">{evalHistory.analytics.avg_score ?? '—'}</div>
                    <div className="text-[9px] text-[#34c759]/60 font-bold uppercase tracking-wider">平均スコア</div>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#007aff]/[0.06] to-transparent border border-[#007aff]/10 text-center">
                    <div className="text-lg font-bold text-[#007aff] tabular-nums">{evalHistory.analytics.high_count}</div>
                    <div className="text-[9px] text-[#007aff]/60 font-bold uppercase tracking-wider">高評価</div>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#ff9500]/[0.06] to-transparent border border-[#ff9500]/10 text-center">
                    <div className="text-lg font-bold text-[#ff9500] tabular-nums">{evalHistory.analytics.low_count}</div>
                    <div className="text-[9px] text-[#ff9500]/60 font-bold uppercase tracking-wider">要改善</div>
                  </div>
                </div>

                {/* スコア分布バー */}
                {Object.keys(evalHistory.analytics.score_distribution || {}).length > 0 && (
                  <div className="p-4 bg-black/[0.02] rounded-xl border border-black/[0.04] mb-4">
                    <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-3">スコア分布</div>
                    <div className="flex items-end gap-1 h-16">
                      {[0.2, 0.4, 0.6, 0.8, 1.0].map((score) => {
                        const count = evalHistory.analytics.score_distribution[score] || 0;
                        const maxCount = Math.max(...Object.values(evalHistory.analytics.score_distribution), 1);
                        const height = (count / maxCount) * 100;
                        const colors = { 0.2: '#ff3b30', 0.4: '#ff9500', 0.6: '#ffcc00', 0.8: '#34c759', 1.0: '#007aff' };
                        const labels = { 0.2: '低い', 0.4: 'いまいち', 0.6: 'まあまあ', 0.8: '良い', 1.0: '最高' };
                        return (
                          <div key={score} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold tabular-nums" style={{ color: colors[score] }}>{count}</span>
                            <div className="w-full rounded-t-lg transition-all duration-500"
                                 style={{ height: `${Math.max(height, 4)}%`, background: `linear-gradient(to top, ${colors[score]}40, ${colors[score]})` }} />
                            <span className="text-[10px] text-[#aeaeb2] font-bold">{labels[score]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 科目別スコア */}
                {Object.keys(evalHistory.analytics.per_subject || {}).length > 0 && (
                  <div className="p-4 bg-black/[0.02] rounded-xl border border-black/[0.04] mb-4">
                    <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-3">科目別スコア</div>
                    <div className="space-y-2">
                      {Object.entries(evalHistory.analytics.per_subject).map(([subj, data]) => {
                        const scoreColor = data.avg >= 0.8 ? '#34c759' : data.avg >= 0.6 ? '#ffcc00' : data.avg >= 0.4 ? '#ff9500' : '#ff3b30';
                        return (
                          <div key={subj} className="flex items-center gap-3">
                            <span className="text-[12px] font-bold text-[#1d1d1f] min-w-[3rem]">{subj}</span>
                            <div className="flex-1 h-2 bg-black/[0.04] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                   style={{ width: `${(data.avg || 0) * 100}%`, background: scoreColor }} />
                            </div>
                            <span className="text-[11px] font-bold tabular-nums min-w-[2.5rem] text-right" style={{ color: scoreColor }}>
                              {data.avg ?? '—'}
                            </span>
                            <span className="text-[9px] text-[#aeaeb2] font-medium">{data.count}件</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* トレンドラインスパークライン */}
                {evalHistory.analytics.recent_trend?.length > 1 && (
                  <div className="p-4 bg-black/[0.02] rounded-xl border border-black/[0.04] mb-4">
                    <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-3">最近のトレンド</div>
                    <div className="flex items-end gap-1 h-12">
                      {evalHistory.analytics.recent_trend.map((pt, idx) => {
                        const height = ((pt.score || 0) / 1.0) * 100;
                        const scoreColor = pt.score >= 0.8 ? '#34c759' : pt.score >= 0.6 ? '#ffcc00' : pt.score >= 0.4 ? '#ff9500' : '#ff3b30';
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-0.5" title={`${pt.timestamp?.slice(0, 10)} — ${pt.score}`}>
                            <div className="w-full rounded-sm transition-all duration-300"
                                 style={{ height: `${Math.max(height, 8)}%`, background: scoreColor, opacity: 0.7 + (idx / evalHistory.analytics.recent_trend.length) * 0.3 }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-[#c7c7cc]">{evalHistory.analytics.recent_trend[0]?.timestamp?.slice(5, 10)}</span>
                      <span className="text-[10px] text-[#c7c7cc]">{evalHistory.analytics.recent_trend[evalHistory.analytics.recent_trend.length - 1]?.timestamp?.slice(5, 10)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 評価履歴リスト */}
            {evalHistory.evaluations?.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-wider mb-1">最近の評価</div>
                {evalHistory.evaluations.map((ev, idx) => {
                  const scoreEmoji = { 0.2: '😕', 0.4: '🤔', 0.6: '🙂', 0.8: '😊', 1.0: '🎯' };
                  const scoreColor = ev.score >= 0.8 ? '#34c759' : ev.score >= 0.6 ? '#ffcc00' : ev.score >= 0.4 ? '#ff9500' : '#ff3b30';
                  return (
                    <div key={ev.id || idx} className="p-3 bg-white/60 rounded-xl border border-black/[0.04] shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{scoreEmoji[ev.score] || '📝'}</span>
                          <span className="text-[12px] font-bold tabular-nums" style={{ color: scoreColor }}>
                            {ev.score}
                          </span>
                          {ev.metadata?.subject && (
                            <span className="px-2 py-0.5 bg-[#fc3c44]/[0.06] text-[#fc3c44] rounded-lg text-[9px] font-bold">{ev.metadata.subject}</span>
                          )}
                          {ev.metadata?.field && (
                            <span className="px-2 py-0.5 bg-[#34c759]/[0.06] text-[#34c759] rounded-lg text-[9px] font-bold">{ev.metadata.field}</span>
                          )}
                        </div>
                        <span className="text-[9px] text-[#c7c7cc] font-medium">{ev.timestamp?.slice(0, 10)}</span>
                      </div>
                      {ev.notes && <div className="text-[11px] text-[#86868b] ml-8 mb-1">{ev.notes}</div>}
                      {ev.model_output_excerpt && (
                        <div className="text-[10px] text-[#aeaeb2] ml-8 line-clamp-1 font-mono">{ev.model_output_excerpt.slice(0, 150)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-[#aeaeb2]">まだ評価データがありません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── セクションナビ (Apple風ステップバー) ── */}
      <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg shadow-black/[0.03] p-1 sm:p-1.5 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1">
        {sections.map((s, idx) => (
          <button key={s.id} onClick={() => s.enabled && setActiveSection(s.id)}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3.5 rounded-xl text-[11px] sm:text-sm font-bold transition-all duration-300 relative whitespace-nowrap min-h-[44px]
              ${activeSection === s.id
                ? 'bg-gradient-to-r from-[#fc3c44] to-[#e0323a] text-white shadow-md shadow-[#fc3c44]/20'
                : s.enabled
                  ? 'text-[#86868b] hover:text-[#fc3c44] hover:bg-[#fc3c44]/[0.06]'
                  : 'text-[#d2d2d7] cursor-not-allowed'
              }`}
            disabled={!s.enabled}>
            <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold transition-all
              ${activeSection === s.id
                ? 'bg-white/25 text-white'
                : s.enabled
                  ? 'bg-black/[0.04] text-[#aeaeb2]'
                  : 'bg-black/[0.02] text-[#d2d2d7]'
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
      </div>

      {/* ════════════════════════════════════════════════════════
         ⚙️ 設定
         ════════════════════════════════════════════════════════ */}
      {activeSection === 'configure' && (
        <div className="space-y-6">

          {/* ── 条件設定（テンプレート＋問数） ── */}
          <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg shadow-black/[0.03]">
            {/* ヘッダー */}
            <div className="relative px-6 pt-6 pb-4">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#fc3c44] via-[#ff6b6b] to-[#fc3c44] opacity-80" />
              <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-[#fc3c44] to-[#e0323a] text-white shadow-lg shadow-[#fc3c44]/20">
                  <Icons.File className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">テンプレートを選ぶ</h3>
                  <p className="text-[11px] text-[#86868b]">教科・分野・難易度はテンプレートに含まれます</p>
                </div>
              </div>

              {/* 選択中サマリータグ */}
              {templateId && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-black/[0.04]">
                  {(() => {
                    const sel = templates.find((t) => t.id === templateId);
                    return <SelectedTag label="テンプレート" value={sel?.name || templateId} color="violet" onClear={() => { setTemplateId(''); setSubject(''); setField(''); }} />;
                  })()}
                  <SelectedTag label="問数" value={`${numQuestions}問`} color="sky" />
                </div>
              )}
            </div>

            {/* テンプレートカードグリッド */}
            <div className="px-5 pb-3">
              {templates.length === 0 ? (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-black/[0.04] mb-3">
                    <svg className="w-7 h-7 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-[#1d1d1f]">テンプレートがありません</p>
                  <p className="text-xs text-[#86868b] mt-1">作るモードでテンプレートを作成してください</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                  {templates.map((t) => {
                    const isActive = templateId === t.id;
                    const subjectColors = {
                      '数学': { bg: 'from-[#007aff] to-[#5856d6]', icon: '∑' },
                      '物理': { bg: 'from-[#ff9500] to-[#ff6723]', icon: '⚛' },
                      '化学': { bg: 'from-[#34c759] to-[#30d158]', icon: '🧪' },
                      '英語': { bg: 'from-[#af52de] to-[#bf5af2]', icon: '🌐' },
                      '生物': { bg: 'from-[#00c7be] to-[#64d2ff]', icon: '🧬' },
                      '情報': { bg: 'from-[#5856d6] to-[#007aff]', icon: '💻' },
                    };
                    const sc = subjectColors[t.metadata?.subject] || { bg: 'from-[#fc3c44] to-[#e0323a]', icon: '📝' };
                    return (
                      <button
                        key={t.id}
                        onClick={() => onSelectTemplate(t.id)}
                        className={`group relative w-full text-left rounded-2xl overflow-hidden transition-all duration-300 active:scale-[0.98]
                          ${isActive
                            ? 'bg-white shadow-md shadow-black/[0.06] ring-2 ring-[#fc3c44]/30'
                            : 'bg-white/60 shadow-sm shadow-black/[0.03] hover:shadow-md hover:shadow-black/[0.06] ring-1 ring-black/[0.04] hover:ring-black/[0.08]'
                          }`}
                      >
                        {isActive && (
                          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#fc3c44] via-[#ff6b6b] to-[#fc3c44]" />
                        )}
                        <div className="p-3.5 flex items-center gap-3.5">
                          <div className={`flex items-center justify-center w-11 h-11 rounded-[14px] flex-shrink-0 text-lg
                            bg-gradient-to-br ${sc.bg} text-white shadow-lg shadow-black/[0.08]
                            transition-transform duration-300 ${isActive ? 'scale-105' : 'group-hover:scale-105'}`}>
                            {sc.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-bold text-[#1d1d1f] truncate">{t.name || t.id}</span>
                              {isActive && (
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-[#fc3c44] to-[#e0323a] flex-shrink-0">
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {t.description && (
                              <div className="text-[11px] text-[#86868b] mt-0.5 truncate">{t.description}</div>
                            )}
                            <div className="flex gap-1.5 mt-1.5 flex-wrap">
                              {t.metadata?.subject && (
                                <span className="px-2 py-0.5 bg-[#fc3c44]/[0.06] text-[#fc3c44] rounded-full text-[9px] font-bold border border-[#fc3c44]/10">{t.metadata.subject}</span>
                              )}
                              {t.metadata?.field && (
                                <span className="px-2 py-0.5 bg-[#34c759]/[0.06] text-[#34c759] rounded-full text-[9px] font-bold border border-[#34c759]/10">{t.metadata.field}</span>
                              )}
                              {t.metadata?.difficulty && (
                                <span className="px-2 py-0.5 bg-[#ff9500]/[0.06] text-[#ff9500] rounded-full text-[9px] font-bold border border-[#ff9500]/10">{difficultyLabel(t.metadata.difficulty)}</span>
                              )}
                            </div>
                          </div>
                          {!isActive && (
                            <svg className="w-4 h-4 text-[#c7c7cc] flex-shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 問数 + リフレッシュ */}
            <div className="px-5 pb-5 flex items-end gap-4 border-t border-black/[0.04] pt-4 mx-5">
              <div className="flex-1">
                <NumberField label="問数" value={numQuestions} onChange={setNumQuestions} min={1} />
              </div>
              <button onClick={async () => { await refresh(); setStatus('テンプレート一覧を再読み込みしました'); }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#86868b] hover:text-[#fc3c44] hover:bg-[#fc3c44]/[0.08] transition-all border border-black/[0.04] hover:border-[#fc3c44]/20"
                title="テンプレートを再読込">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                <span className="hidden sm:inline">再読み込み</span>
                <span className="text-[10px] text-[#c7c7cc] font-normal ml-1">{templates.length}件</span>
              </button>
            </div>
          </div>

          {/* ── 参考問題（テンプレート合致で自動取得） ── */}
          <SectionCard title="参考問題を選択" icon={<Icons.Search />}
            subtitle="テンプレートに合致する過去問が表示されます">

            {/* 選択済み問題の表示 */}
            {selectedRefProblem && (
              <div className="mb-3 relative overflow-hidden rounded-2xl border border-[#ff9500]/25 bg-gradient-to-br from-[#ff9500]/[0.06] to-[#ff9500]/[0.02]
                              shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#ff9500] via-[#ffcc00] to-[#ff9500] opacity-60" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="check-circle checked">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-[11px] font-bold text-[#ff9500] uppercase tracking-wider">選択中</span>
                        {selectedRefProblem.id && (
                          <span className="text-[10px] text-[#ff9500]/60 font-mono">#{selectedRefProblem.id}</span>
                        )}
                      </div>
                      <div className="text-[13px] text-[#1d1d1f] leading-relaxed line-clamp-3 ml-[30px]">
                        <LatexText>{(selectedRefProblem.stem || selectedRefProblem.text || '').slice(0, 200)}</LatexText>
                      </div>
                      <div className="flex gap-1.5 mt-2 ml-[30px] flex-wrap">
                        {selectedRefProblem.subject && (
                          <span className="px-2 py-0.5 bg-[#fc3c44]/[0.08] text-[#fc3c44] rounded-full text-[9px] font-bold">{selectedRefProblem.subject}</span>
                        )}
                        {(selectedRefProblem.topic || selectedRefProblem.metadata?.field) && (
                          <span className="px-2 py-0.5 bg-[#34c759]/[0.08] text-[#34c759] rounded-full text-[9px] font-bold">{selectedRefProblem.topic || selectedRefProblem.metadata?.field}</span>
                        )}
                        {selectedRefProblem.difficulty != null && (
                          <span className="px-2 py-0.5 bg-[#ff9500]/[0.08] text-[#ff9500] rounded-full text-[9px] font-bold">{difficultyLabel(selectedRefProblem.difficulty)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={clearRefProblem}
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-black/[0.04] hover:bg-[#ff3b30]/10
                                 text-[#aeaeb2] hover:text-[#ff3b30] transition-all duration-200 flex-shrink-0 active:scale-90"
                      title="選択を解除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* フィルタバー（科目ラベル + 絞り込み検索） */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {subject && (
                  <span className="px-2.5 py-1 bg-[#fc3c44]/[0.08] text-[#fc3c44] rounded-full text-[10px] font-bold">{subject}</span>
                )}
                {field && (
                  <span className="px-2.5 py-1 bg-[#34c759]/[0.08] text-[#34c759] rounded-full text-[10px] font-bold">{field}</span>
                )}
              </div>
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/[0.03] border border-black/[0.04]
                              focus-within:bg-white focus-within:border-[#ff9500]/30 focus-within:shadow-sm transition-all duration-200">
                <svg className="w-3.5 h-3.5 text-[#c7c7cc] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={refSearchInputRef}
                  type="text"
                  value={refFilterQuery}
                  onChange={(e) => setRefFilterQuery(e.target.value)}
                  placeholder="絞り込み..."
                  className="flex-1 bg-transparent text-xs text-[#1d1d1f] outline-none placeholder:text-[#c7c7cc]"
                />
                {refFilterQuery && (
                  <button onClick={() => setRefFilterQuery('')} className="text-[#aeaeb2] hover:text-[#ff3b30] transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* 問題一覧 */}
            {matchedRefLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <svg className="animate-spin h-5 w-5 text-[#ff9500]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-[11px] text-[#aeaeb2]">過去問を取得中...</p>
              </div>
            ) : filteredRefProblems.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-wider px-1 mb-1">
                  {filteredRefProblems.length} 件{refFilterQuery.trim() ? ` / ${matchedRefProblems.length} 件中` : ''}
                </div>
                {filteredRefProblems.map((item, idx) => {
                  const isSelected = selectedRefProblem?.id === item.id;
                  return (
                    <button
                      key={item.id ?? idx}
                      onClick={() => selectRefProblem(item)}
                      className={`result-item w-full text-left px-4 py-3 ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`check-circle mt-0.5 ${isSelected ? 'checked' : ''}`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] text-[#aeaeb2] font-mono">#{item.id ?? idx + 1}</span>
                          </div>
                          <div className="text-[13px] text-[#1d1d1f] leading-relaxed line-clamp-2">
                            <LatexText>{(item.stem || item.text || '').slice(0, 150)}</LatexText>
                          </div>
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {item.subject && (
                              <span className="px-2 py-0.5 bg-[#fc3c44]/[0.08] text-[#fc3c44] rounded-full text-[9px] font-bold">{item.subject}</span>
                            )}
                            {(item.topic || item.metadata?.field) && (
                              <span className="px-2 py-0.5 bg-[#34c759]/[0.08] text-[#34c759] rounded-full text-[9px] font-bold">{item.topic || item.metadata?.field}</span>
                            )}
                            {item.difficulty != null && (
                              <span className="px-2 py-0.5 bg-[#ff9500]/[0.08] text-[#ff9500] rounded-full text-[9px] font-bold">{difficultyLabel(item.difficulty)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : matchedRefProblems.length > 0 && refFilterQuery.trim() ? (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-black/[0.04] mb-2">
                  <svg className="w-5 h-5 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-xs text-[#aeaeb2]">「{refFilterQuery}」に一致する問題はありません</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-black/[0.04] mb-2">
                  <svg className="w-5 h-5 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </div>
                <p className="text-xs text-[#aeaeb2]">この科目・分野の過去問はまだ登録されていません</p>
              </div>
            )}

            {referenceStem && !selectedRefProblem && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34c759] flex-shrink-0" />
                <span className="text-[10px] text-[#34c759] font-bold">参考問題が設定されています</span>
              </div>
            )}
          </SectionCard>

          {/* ── RAG ミキサー ── */}
          <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg shadow-black/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#0a84ff] via-[#30d158] to-[#ff9f0a] opacity-70" />
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#5856d6] text-white shadow-lg shadow-[#0a84ff]/20">
                  <Icons.Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">過去問ミキサー</h3>
                  <p className="text-[11px] text-[#86868b]">過去問からの参照バランスを調整</p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <RagMixer
                textWeight={textWeight} diffWeight={difficultyMatchWeight} trickWeight={trickinessWeight}
                onText={setTextWeight} onDiff={setDifficultyMatchWeight} onTrick={setTrickinessWeight}
              />
              <div className="mt-5 pt-4 border-t border-black/[0.04]">
                <NumberField label="参照件数 (Top-K)" value={topK} onChange={setTopK} min={1} max={20} />
              </div>
            </div>
          </div>

          {/* ── プロンプト生成 ── */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={generateBasePrompt} disabled={!templateId}>
              <Icons.Prompt className="w-4 h-4" /> プロンプトを生成
            </Button>
            {basePrompt && (
              <>
                <Button onClick={injectRag} variant="secondary">
                  <Icons.Search className="w-4 h-4" /> 過去問を参照
                </Button>
                <Button onClick={skipRag} variant="ghost">参照をスキップ</Button>
              </>
            )}
          </div>

          {ragSkipped && (
            <div className="p-3 bg-[#ff9500]/[0.08] rounded-lg border border-[#ff9500]/20/40 text-xs text-amber-700 flex items-center gap-2">
              <Icons.Info className="w-3.5 h-3.5 flex-shrink-0" /> 過去問参照をスキップ中
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
              subtitle={`${finalPrompt.length.toLocaleString()} 文字${ragSkipped ? '（参照なし）' : ragPrompt ? '（参照済み）' : ''}`}>
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
          <SectionCard title="AIにプロンプトを送る" icon={<Icons.Prompt />}
            subtitle="プロンプトをコピーして、お好みのAIに貼り付けて実行">
            <div className="p-4 bg-[#fc3c44]/[0.08] rounded-lg border border-[#fc3c44]/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#fc3c44] text-white flex items-center justify-center">
                  <Icons.Copy className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#86868b]">送信用プロンプト</div>
                  <div className="text-xs text-[#c7c7cc]">
                    {finalPrompt.length.toLocaleString()} 文字
                    {ragSkipped && ' （参照なし）'}
                    {ragPrompt && ' （参照済み）'}
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
                <span className="text-xs text-[#ff9500] font-bold">過去問未参照:</span>
                <Button onClick={injectRag} variant="secondary" size="sm">
                  <Icons.Search className="w-3.5 h-3.5" /> 過去問を参照
                </Button>
                <Button onClick={skipRag} variant="ghost" size="sm">スキップ</Button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
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

          <SectionCard title="AIの出力を貼り付け" icon={<Icons.File />}
            subtitle="AIが生成した結果をここに貼り付けてください">
            <TextArea value={llmOutput}
              onChange={(v) => { setLlmOutput(v); setParsedProblem(null); setParseError(''); setSavedProblemId(null); }}
              rows={10} placeholder="AI の出力（JSON / テキスト）をここに貼り付け" />
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
                    ['ソース', parsedProblem.stem_latex],
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
          <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg shadow-black/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff9500] via-[#fc3c44] to-[#af52de] opacity-80" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-[#ff9500] to-[#fc3c44] text-white shadow-lg shadow-[#fc3c44]/20">
                  <Icons.Chart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">品質を評価</h3>
                  <p className="text-[11px] text-[#86868b]">出力の品質を評価して記録 — 次回の改善に活用</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-3">品質スコア</label>
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

                {/* 保存先情報 */}
                <div className="flex items-center gap-2 p-3 bg-[#34c759]/[0.04] rounded-xl border border-[#34c759]/10">
                  <svg className="w-4 h-4 text-[#34c759] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
                  </svg>
                  <span className="text-[11px] text-[#34c759] font-medium">評価は自動的に保存されます。ブラウザを閉じても保持されます。</span>
                </div>

                <Button onClick={saveLog} disabled={!llmOutput}>
                  <Icons.Success className="w-4 h-4" /> 評価を記録する
                </Button>
              </div>
            </div>
          </div>



          <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-lg shadow-black/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#34c759] via-[#30d158] to-[#34c759] opacity-80" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-[#34c759] to-[#30d158] text-white shadow-lg shadow-[#34c759]/20">
                  <Icons.Data className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">問題を保存</h3>
                  <p className="text-[11px] text-[#86868b]">パースした問題データを保存（検算を自動実行）</p>
                </div>
              </div>
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
                    <Icons.Data className="w-4 h-4" /> 保存する
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
              <EmptyState title="パース済みデータがありません" description="「実行」タブでAI出力をパースしてください" />
            )}
            </div>
          </div>

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
