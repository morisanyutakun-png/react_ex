'use client';

import { useState } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import {
  renderTemplate,
  assemblePrompt,
  saveProblem,
  saveTuningLog,
  generatePdf,
  createTemplate,
} from '@/lib/api';
import {
  DIFFICULTIES, DIFFICULTY_MAP, SUBJECT_TOPICS,
  OUTPUT_FORMAT_INSTRUCTION, buildReferencePromptSection,
  buildTemplatePrompt, buildTemplateId,
} from '@/lib/constants';
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
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.08em] uppercase">
          {label}
        </label>
      )}
      <div className="flex items-stretch gap-1.5">
        <div className="relative group flex-1">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-white/70 text-sm
                      text-slate-700 transition-all cursor-pointer appearance-none
                      hover:border-indigo-200 focus:border-indigo-400 focus:bg-white
                      outline-none pr-10 shadow-sm group-hover:shadow-md font-medium
                      disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) =>
              typeof opt === 'string'
                ? <option key={opt} value={opt}>{opt}</option>
                : <option key={opt.value} value={opt.value}>{opt.label}</option>
            )}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-300 group-hover:text-indigo-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            title={addLabel || '追加'}
            className="flex items-center justify-center w-10 rounded-xl border-2 border-dashed border-slate-200
                       text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50
                       transition-all duration-200 flex-shrink-0 active:scale-95"
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
   インライン追加モーダル（汎用）
   ═══════════════════════════════════════════════════════ */

function InlineAddModal({ title, isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-md overflow-hidden animate-in"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-700">{title}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   選択中タグ表示
   ═══════════════════════════════════════════════════════ */

function SelectedTag({ label, value, color = 'indigo', onClear }) {
  if (!value) return null;
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${colors[color] || colors.indigo}`}>
      <span className="opacity-60">{label}:</span>
      <span>{value}</span>
      {onClear && (
        <button onClick={onClear} className="ml-0.5 opacity-40 hover:opacity-100 transition-opacity">×</button>
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   汎用項目追加フォーム（教科・分野追加モーダル内で使用）
   ═══════════════════════════════════════════════════════ */

function AddItemForm({ label, placeholder, onAdd, onCancel }) {
  const [value, setValue] = useState('');
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.08em] uppercase">{label}</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onAdd(value.trim()); }}
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-white/70 text-sm text-slate-700 outline-none
            hover:border-indigo-200 focus:border-indigo-400 focus:bg-white transition-all shadow-sm font-medium"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => { if (value.trim()) onAdd(value.trim()); }}
          disabled={!value.trim()}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold
                     bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm
                     hover:from-indigo-600 hover:to-indigo-700 hover:shadow-md
                     disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          追加する
        </button>
        <button onClick={onCancel}
          className="px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
          キャンセル
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   RAG ミキサー
   ═══════════════════════════════════════════════════════ */

function RagMixer({ textWeight, diffWeight, trickWeight, onText, onDiff, onTrick }) {
  const total = textWeight + diffWeight + trickWeight || 1;
  const pcts = [
    { label: '類似度', value: textWeight, color: 'bg-blue-500', onChange: onText },
    { label: '難易度', value: diffWeight, color: 'bg-emerald-500', onChange: onDiff },
    { label: 'ひっかけ', value: trickWeight, color: 'bg-amber-500', onChange: onTrick },
  ];
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">バランス</div>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
          {pcts.map((p, i) => {
            const w = (p.value / total) * 100;
            return w > 0 ? (
              <div key={i} className={`${p.color} transition-all duration-500`} style={{ width: `${w}%` }} />
            ) : null;
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
          {pcts.map((p, i) => (
            <span key={i}>{p.label} {Math.round((p.value / total) * 100)}%</span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {pcts.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${p.color} flex-shrink-0`} />
            <span className="text-xs font-medium text-slate-500 w-16 flex-shrink-0">{p.label}</span>
            <input
              type="range" min={0} max={2} step={0.1} value={p.value}
              onChange={(e) => p.onChange(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 accent-indigo-500
                [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-sm"
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(p.value / 2) * 100}%, #e2e8f0 ${(p.value / 2) * 100}%, #e2e8f0 100%)`,
              }}
            />
            <span className="text-xs font-bold text-indigo-600 w-8 text-right tabular-nums">
              {p.value.toFixed(1)}
            </span>
          </div>
        ))}
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
    <div className="flex items-center gap-1">
      {levels.map((l) => (
        <button key={l.value} onClick={() => onChange(l.value)}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200
            ${score === l.value
              ? 'bg-indigo-50 border-2 border-indigo-300 scale-110'
              : 'bg-white border-2 border-transparent hover:bg-slate-50 hover:border-slate-200'
            }`}>
          <span className="text-xl">{l.emoji}</span>
          <span className={`text-[10px] font-bold ${score === l.value ? 'text-indigo-600' : 'text-slate-400'}`}>
            {l.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   テンプレート追加モーダル（改良版）
   ═══════════════════════════════════════════════════════ */

function AddTemplateModal({ isOpen, onClose, subjects, onCreated, setStatus }) {
  const [newSubject, setNewSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [newField, setNewField] = useState('');
  const [newDifficulty, setNewDifficulty] = useState('普通');
  const [saving, setSaving] = useState(false);

  const effectiveSubject = newSubject === '__custom' ? customSubject : newSubject;
  const fieldOptions = (newSubject && newSubject !== '__custom' && SUBJECT_TOPICS[newSubject])
    ? SUBJECT_TOPICS[newSubject]
    : [];

  const handleSave = async () => {
    if (!effectiveSubject) { setStatus('教科を選択してください'); return; }
    const f = newField;
    const label = f ? `${effectiveSubject}（${f}）` : effectiveSubject;
    const id = buildTemplateId(effectiveSubject, f);
    setSaving(true);
    setStatus(`テンプレート「${label}」を作成中...`);
    try {
      await createTemplate({
        id,
        name: `${label} テンプレート`,
        description: `${label} の問題を生成するテンプレート`,
        prompt: buildTemplatePrompt(effectiveSubject, f),
        metadata: { subject: effectiveSubject, field: f || null, difficulty: newDifficulty, auto_generated: true },
      });
      setStatus(`テンプレート「${label}」を作成しました`);
      onCreated?.(id, effectiveSubject, f);
      onClose();
      setNewSubject(''); setCustomSubject(''); setNewField(''); setNewDifficulty('普通');
    } catch (e) { setStatus(`作成失敗: ${e.message}`); }
    setSaving(false);
  };

  return (
    <InlineAddModal title="テンプレートを新規追加" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-slate-400 leading-relaxed">
          教科と分野を選ぶだけで、テンプレートが自動生成されます。
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Dropdown label="教科 *" value={newSubject} onChange={setNewSubject}
            placeholder="選択..."
            options={[
              ...subjects.map((s) => ({ value: s, label: s })),
              { value: '__custom', label: '✏️ その他（入力）' },
            ]} />
          <Dropdown label="難易度" value={newDifficulty} onChange={setNewDifficulty}
            options={DIFFICULTIES.map((d) => ({ value: d, label: d }))} />
        </div>

        {newSubject === '__custom' && (
          <div>
            <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.08em] uppercase">教科名（入力）</label>
            <input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-white/70 text-sm text-slate-700 outline-none
                hover:border-indigo-200 focus:border-indigo-400 focus:bg-white transition-all shadow-sm font-medium"
              placeholder="例: 地学" autoFocus />
          </div>
        )}

        {fieldOptions.length > 0 && (
          <Dropdown label="分野（任意）" value={newField} onChange={setNewField}
            placeholder="全般"
            options={fieldOptions.map((f) => ({ value: f, label: f }))} />
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave}
            disabled={saving || !effectiveSubject}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold
                       bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm
                       hover:from-indigo-600 hover:to-indigo-700 hover:shadow-md
                       disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
            <Icons.Success className="w-4 h-4" />
            {saving ? '作成中...' : 'テンプレートを作成'}
          </button>
          <button onClick={onClose}
            className="px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
            キャンセル
          </button>
        </div>
      </div>
    </InlineAddModal>
  );
}

/* ═══════════════════════════════════════════════════════
   メインページ
   ═══════════════════════════════════════════════════════ */

export default function TuningPage() {
  const { templates, subjects, refresh } = useTemplates();
  const [status, setStatus] = useState('');

  // 条件設定
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [field, setField] = useState('');
  const [difficulty, setDifficulty] = useState('普通');
  const [numQuestions, setNumQuestions] = useState(1);

  // モーダル開閉
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [customSubjects, setCustomSubjects] = useState([]);
  const [customFields, setCustomFields] = useState({});

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
  const [showRefInput, setShowRefInput] = useState(false);

  // UI状態
  const [activeSection, setActiveSection] = useState('configure');

  /* ── テンプレート選択に連動するフィルタリング ── */
  const filteredTemplates = subject
    ? templates.filter((t) => !t.metadata?.subject || t.metadata.subject === subject)
    : templates;

  const templateOptions = filteredTemplates.map((t) => ({
    value: t.id,
    label: `${t.name || t.id}${t.metadata?.field ? ` (${t.metadata.field})` : ''}`,
  }));

  const fieldOptions = (() => {
    const base = (subject && SUBJECT_TOPICS[subject]) ? [...SUBJECT_TOPICS[subject]] : [];
    const custom = (subject && customFields[subject]) ? customFields[subject] : [];
    return [...new Set([...base, ...custom])];
  })();

  /* ── 全科目リスト（SUBJECTS + カスタム） ── */
  const allSubjects = [...new Set([...subjects, ...customSubjects])];

  /* ── テンプレート選択ハンドラ ── */
  const onSelectTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl?.metadata) {
      if (tpl.metadata.subject && !subject) setSubject(tpl.metadata.subject);
      if (tpl.metadata.field) setField(tpl.metadata.field);
      if (tpl.metadata.difficulty) setDifficulty(tpl.metadata.difficulty);
    }
    setBasePrompt('');
    setRagPrompt('');
    setRetrievedChunks([]);
    setRagSkipped(false);
  };

  /* ── 科目変更 → テンプレート・分野リセット ── */
  const onSubjectChange = (v) => {
    setSubject(v);
    setTemplateId('');
    setField('');
  };

  /* ── テンプレート追加コールバック ── */
  const onTemplateCreated = async (id, sub, f) => {
    await refresh();
    setSubject(sub);
    if (f) setField(f);
    setTemplateId(id);
    setShowAddTemplate(false);
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
      setBasePrompt((hasOutputSpec ? rendered : rendered + OUTPUT_FORMAT_INSTRUCTION) + refSection);
      setRagPrompt('');
      setRetrievedChunks([]);
      setRagSkipped(false);
      setStatus('プロンプト生成完了');
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
      setStatus('パース成功');
    } else {
      setParsedProblem({
        stem: llmOutput.trim(), stem_latex: llmOutput.trim(), final_answer: '',
        checks: [{ desc: '自動生成 — 未検証', ok: false }, { desc: '自動生成 — 未検証', ok: false }],
      });
      setStatus('テキストとして読み取りました（JSON形式推奨）');
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
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="チューニング"
        description="プロンプトとRAGの設定を調整して、生成される問題の品質を高めるワークスペース"
        icon={<Icons.Dev />}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: '高める' }]}
      />

      <StatusBar message={status} />

      {/* ── セクションナビ (ステップ風) ── */}
      <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-slate-100/80 shadow-sm">
        {sections.map((s, idx) => (
          <button key={s.id} onClick={() => s.enabled && setActiveSection(s.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 relative
              ${activeSection === s.id
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-200/40'
                : s.enabled
                  ? 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
            disabled={!s.enabled}>
            <span className={`flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black
              ${activeSection === s.id
                ? 'bg-white/20 text-white'
                : s.enabled
                  ? 'bg-slate-100 text-slate-400'
                  : 'bg-slate-50 text-slate-200'
              }`}>
              {idx + 1}
            </span>
            <span>{s.icon} {s.label}</span>
            {!s.enabled && s.id !== 'configure' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                {s.id === 'execute' ? 'プロンプト生成後' : '出力貼付後'}
              </span>
            )}
          </button>
        ))}
        <button onClick={resetAll} title="リセット"
          className="px-3 py-3 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50/80 transition-all flex-shrink-0">
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

          {/* ── 条件設定（全プルダウン＋追加ボタン） ── */}
          <SectionCard title="条件を選ぶ" icon={<Icons.File />}
            subtitle="すべてプルダウンから選択 — 項目が足りなければ ＋ ボタンで追加">

            {/* 選択中サマリータグ */}
            {(subject || templateId || field || difficulty) && (
              <div className="flex flex-wrap gap-2 mb-5 pb-4 border-b border-slate-100">
                <SelectedTag label="科目" value={subject} color="indigo" onClear={() => { setSubject(''); setTemplateId(''); setField(''); }} />
                {templateId && (() => {
                  const sel = templates.find((t) => t.id === templateId);
                  return <SelectedTag label="テンプレート" value={sel?.name || templateId} color="violet" onClear={() => setTemplateId('')} />;
                })()}
                <SelectedTag label="分野" value={field} color="emerald" onClear={() => setField('')} />
                <SelectedTag label="難易度" value={difficulty} color="amber" />
                <SelectedTag label="問数" value={`${numQuestions}問`} color="sky" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
              {/* 科目 */}
              <Dropdown
                label="教科"
                value={subject}
                onChange={onSubjectChange}
                placeholder="— 選択してください —"
                options={allSubjects.map((s) => ({ value: s, label: s }))}
                onAdd={() => setShowAddSubject(true)}
                addLabel="教科を追加"
              />

              {/* テンプレート */}
              <Dropdown
                label="テンプレート"
                value={templateId}
                onChange={onSelectTemplate}
                placeholder={subject ? '— 選択してください —' : '先に教科を選択'}
                options={templateOptions}
                disabled={!subject}
                className="sm:col-span-1 lg:col-span-2"
                onAdd={() => setShowAddTemplate(true)}
                addLabel="テンプレートを追加"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
              {/* 分野 */}
              <Dropdown
                label="分野"
                value={field}
                onChange={setField}
                placeholder="全ての分野"
                options={fieldOptions.map((f) => ({ value: f, label: f }))}
                disabled={!subject}
                onAdd={() => setShowAddField(true)}
                addLabel="分野を追加"
              />

              {/* 難易度 */}
              <Dropdown
                label="難易度"
                value={difficulty}
                onChange={setDifficulty}
                options={DIFFICULTIES.map((d) => ({ value: d, label: d }))}
              />

              {/* 問数 */}
              <NumberField label="問数" value={numQuestions} onChange={setNumQuestions} min={1} />
            </div>

            {/* 選択中テンプレート詳細 */}
            {templateId && (() => {
              const sel = templates.find((t) => t.id === templateId);
              return sel ? (
                <div className="p-4 bg-gradient-to-r from-indigo-50/40 to-violet-50/30 rounded-xl border border-indigo-100/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Icons.File className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-700 truncate">{sel.name || sel.id}</div>
                      {sel.description && <div className="text-xs text-slate-400 mt-0.5 truncate">{sel.description}</div>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {sel.metadata?.subject && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{sel.metadata.subject}</span>}
                    {sel.metadata?.field && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">{sel.metadata.field}</span>}
                    {sel.metadata?.difficulty && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">{sel.metadata.difficulty}</span>}
                  </div>
                </div>
              ) : null;
            })()}

            {/* リフレッシュボタン */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100/80">
              <button onClick={async () => { await refresh(); setStatus('テンプレート一覧を再読み込みしました'); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                title="テンプレートを再読込">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                再読み込み
              </button>
              <span className="text-[10px] text-slate-300">{templates.length}件のテンプレート</span>
            </div>
          </SectionCard>

          {/* ── 追加モーダル群 ── */}
          <AddTemplateModal
            isOpen={showAddTemplate}
            onClose={() => setShowAddTemplate(false)}
            subjects={allSubjects}
            onCreated={onTemplateCreated}
            setStatus={setStatus}
          />

          <InlineAddModal title="教科を追加" isOpen={showAddSubject} onClose={() => setShowAddSubject(false)}>
            <AddItemForm
              label="教科名"
              placeholder="例: 地学、家庭科"
              onAdd={(v) => {
                setCustomSubjects((prev) => [...new Set([...prev, v])]);
                setSubject(v);
                setShowAddSubject(false);
                setStatus(`教科「${v}」を追加しました`);
              }}
              onCancel={() => setShowAddSubject(false)}
            />
          </InlineAddModal>

          <InlineAddModal title="分野を追加" isOpen={showAddField} onClose={() => setShowAddField(false)}>
            <AddItemForm
              label="分野名"
              placeholder={subject ? `「${subject}」の分野を入力` : '分野名を入力'}
              onAdd={(v) => {
                setCustomFields((prev) => ({
                  ...prev,
                  [subject]: [...new Set([...(prev[subject] || []), v])],
                }));
                setField(v);
                setShowAddField(false);
                setStatus(`分野「${v}」を追加しました`);
              }}
              onCancel={() => setShowAddField(false)}
            />
          </InlineAddModal>

          {/* ── 参考問題（折りたたみ） ── */}
          <SectionCard>
            <button onClick={() => setShowRefInput(!showRefInput)}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors w-full">
              <svg className={`w-4 h-4 transition-transform ${showRefInput ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              参考問題を追加（類題を作りたい場合）
              {referenceStem && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full ml-auto">設定済み</span>}
            </button>
            {showRefInput && (
              <div className="mt-4 p-4 bg-violet-50/60 rounded-xl border border-violet-200/40 space-y-3">
                <p className="text-xs text-violet-600">基本となる問題を入力すると、同パターンの類題を生成します。</p>
                <TextArea label="参考問題文" value={referenceStem} onChange={setReferenceStem} rows={3}
                  placeholder="例: 2次関数 f(x)=x^2-6x+5 の最小値とそのときのxの値を求めよ。" />
                <TextArea label="参考解答（任意）" value={referenceAnswer} onChange={setReferenceAnswer} rows={2}
                  placeholder="例: f(x)=(x-3)^2-4 より、x=3のとき最小値-4" />
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
              <div className="space-y-3 text-xs text-slate-500">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100/40">
                  <span className="font-bold text-blue-600">類似度</span>
                  <p className="mt-1 text-blue-500">プロンプトと似た内容の過去問を重視</p>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100/40">
                  <span className="font-bold text-emerald-600">難易度</span>
                  <p className="mt-1 text-emerald-500">指定難易度に近い過去問を重視</p>
                </div>
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100/40">
                  <span className="font-bold text-amber-600">ひっかけ</span>
                  <p className="mt-1 text-amber-500">ひっかけ要素のある過去問を重視</p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── プロンプト生成 ── */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={generateBasePrompt} disabled={!templateId} className="shadow-lg shadow-indigo-200/30">
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
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/40 text-xs text-amber-700 flex items-center gap-2">
              <Icons.Info className="w-3.5 h-3.5 flex-shrink-0" /> RAGスキップ中
            </div>
          )}

          {retrievedChunks.length > 0 && (
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 max-h-56 overflow-y-auto custom-scrollbar">
              <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide flex items-center gap-2">
                参照データ ({retrievedChunks.length}件)
                {retrievedChunks[0]?.search_tier && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    retrievedChunks[0].search_tier === 'subject+field' ? 'bg-emerald-100 text-emerald-700' :
                    retrievedChunks[0].search_tier === 'subject-only' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-200 text-slate-500'
                  }`}>
                    {retrievedChunks[0].search_tier === 'subject+field' ? '科目+分野' :
                     retrievedChunks[0].search_tier === 'subject-only' ? '科目のみ' : 'グローバル'}
                  </span>
                )}
              </div>
              {retrievedChunks.map((c, i) => (
                <div key={i} className="py-2 border-b border-slate-100 last:border-0 text-xs flex items-start gap-2">
                  <span className="text-slate-300 font-mono flex-shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {c.subject && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-50 text-indigo-500 mr-1">{c.subject}</span>
                    )}
                    <span className="text-slate-600 leading-relaxed">
                      {(c.text || '').slice(0, 150).replace(/\n/g, ' ')}{(c.text || '').length > 150 ? '...' : ''}
                    </span>
                  </div>
                  <span className="text-slate-400 flex-shrink-0 tabular-nums">
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
            <div className="p-4 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center">
                  <Icons.Copy className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-700">送信用プロンプト</div>
                  <div className="text-xs text-slate-400">
                    {finalPrompt.length.toLocaleString()} 文字
                    {ragSkipped && ' （RAG なし）'}
                    {ragPrompt && ' （RAG 注入済み）'}
                  </div>
                </div>
                <CopyButton text={finalPrompt} onCopied={setStatus} label="コピー" />
              </div>
              <pre className="text-xs text-slate-600 bg-white/60 rounded-lg p-3 max-h-32 overflow-auto custom-scrollbar font-mono leading-relaxed">
                {finalPrompt.slice(0, 500)}{finalPrompt.length > 500 ? '\n...' : ''}
              </pre>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { name: 'ChatGPT', url: 'https://chat.openai.com', color: 'from-green-500 to-emerald-600' },
                { name: 'Claude', url: 'https://claude.ai', color: 'from-amber-500 to-orange-500' },
                { name: 'Gemini', url: 'https://gemini.google.com', color: 'from-blue-500 to-indigo-600' },
              ].map(({ name, url, color }) => (
                <a key={name} href={url} target="_blank" rel="noreferrer"
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r ${color} text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]`}>
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
              {parsedProblem && (
                <Button variant="secondary" size="sm" onClick={() => setActiveSection('evaluate')}>
                  評価・保存へ <Icons.ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
            {parseError && (
              <div className="mt-3 p-3 bg-rose-50/60 rounded-xl border border-rose-200/40 text-xs text-rose-700">
                <Icons.Info className="w-3.5 h-3.5 inline mr-1" /> {parseError}
              </div>
            )}
            {parsedProblem && (
              <div className="mt-4 p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/40 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Icons.Success className="w-4 h-4" /> パース結果
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
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
                      <span className="font-medium text-emerald-600 flex-shrink-0 min-w-[80px]">{k}:</span>
                      <span className="text-slate-600 break-all">
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
                <label className="block text-[11px] font-black text-slate-400 mb-3 tracking-[0.1em] uppercase">品質スコア</label>
                <QualityRating score={tuningScore ? Number(tuningScore) : ''} onChange={(v) => setTuningScore(String(v))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">メモ</label>
                  <input value={tuningNotes} onChange={(e) => setTuningNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-white/50 text-sm text-slate-700
                      transition-all hover:border-indigo-200 focus:border-indigo-400 focus:bg-white outline-none shadow-sm font-medium"
                    placeholder="例: 難易度は適切だが解説が冗長" />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">期待していた出力（任意）</label>
                  <input value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-white/50 text-sm text-slate-700
                      transition-all hover:border-indigo-200 focus:border-indigo-400 focus:bg-white outline-none shadow-sm font-medium"
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
                <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-100 text-xs space-y-1.5">
                  {parsedProblem.stem && (
                    <div><span className="font-bold text-slate-500">問題:</span> <span className="text-slate-700">{parsedProblem.stem.slice(0, 200)}{parsedProblem.stem.length > 200 ? '...' : ''}</span></div>
                  )}
                  {parsedProblem.final_answer && (
                    <div><span className="font-bold text-slate-500">解答:</span> <span className="text-indigo-600 font-bold">{parsedProblem.final_answer}</span></div>
                  )}
                  {parsedProblem.checks && (
                    <div className="flex gap-3 mt-1">
                      {parsedProblem.checks.map((c, i) => (
                        <span key={i} className={`text-xs ${c.ok ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {c.ok ? '✓' : '✗'} {c.desc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="success" onClick={saveToProblemsDb} className="shadow-lg shadow-emerald-200/50">
                    <Icons.Data className="w-4 h-4" /> DBに保存する
                  </Button>
                  <Button variant="ghost" onClick={compilePdf} disabled={!llmOutput || pdfWorking}>
                    {pdfWorking
                      ? <span className="flex items-center gap-2"><Icons.Info className="animate-pulse" /> 生成中...</span>
                      : <span className="flex items-center gap-2"><Icons.Pdf className="w-4 h-4" /> PDF</span>}
                  </Button>
                </div>
                {verificationResult && !verificationResult.skipped && (
                  <div className={`p-3 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
                    verificationResult.verified
                      ? 'bg-emerald-50/80 border-emerald-200/50 text-emerald-700'
                      : 'bg-rose-50/80 border-rose-200/50 text-rose-700'
                  }`}>
                    {verificationResult.verified
                      ? <><Icons.Success className="w-4 h-4" /> 検算OK: {verificationResult.expected} = {verificationResult.computed}</>
                      : <><Icons.Info className="w-4 h-4" /> 検算NG: 期待={verificationResult.expected}, 計算={verificationResult.computed}</>}
                  </div>
                )}
                {savedProblemId && (
                  <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/50 text-sm text-emerald-700 font-semibold flex items-center gap-2">
                    <Icons.Success className="w-4 h-4" /> 保存済み — ID: {savedProblemId}
                  </div>
                )}
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-bold text-sm hover:bg-emerald-100 transition-colors">
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
            <span className="text-xs text-slate-300">|</span>
            <Button variant="ghost" onClick={resetAll}>最初からやり直す</Button>
          </div>
        </div>
      )}
    </div>
  );
}
