'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { useBranding } from '@/contexts/BrandingContext';
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
  TextArea,
  Button,
  CopyButton,
  NumberField,
  EmptyState,
  PageHeader,
  Icons,
  MobileNavLinks,
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
        <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <div className="flex items-stretch gap-1.5">
        <div className="relative group flex-1">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full pl-4 pr-10 py-3 rounded-2xl border border-blue-200/50 bg-[#111827] text-sm
                      text-[#1e293b] transition-all duration-300 cursor-pointer appearance-none
                      hover:border-blue-300/50 hover:bg-[#161d2e] hover:shadow-md
                      focus:border-blue-300/70 focus:ring-2 focus:ring-blue-200/40 focus:shadow-md
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
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none transition-all duration-300 group-hover:text-[#64748b] text-[#c7c7cc]">
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {hasValue && (
            <div className="absolute top-2 right-8 w-1.5 h-1.5 rounded-full bg-[#2563eb] opacity-40" />
          )}
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            title={addLabel || '追加'}
            className="flex items-center justify-center w-11 rounded-2xl border border-dashed border-blue-200/50
                       text-[#c7c7cc] hover:border-blue-300/60 hover:text-[#1e293b] hover:bg-blue-50/50
                       transition-all duration-300 flex-shrink-0 active:scale-90 hover:shadow-sm"
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
    red: 'bg-blue-100/50 text-[#1e293b] border-[#2563eb]/15',
    emerald: 'bg-blue-100/50 text-[#1e293b] border-[#2563eb]/15',
    amber: 'bg-blue-50/50 text-[#475569] border-blue-300/50/15',
    violet: 'bg-blue-50/50 text-[#475569] border-blue-300/50/15',
    sky: 'bg-[#2563eb]/[0.06] text-[#334155] border-[#2563eb]/15',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${colors[color] || colors.red} transition-all hover:shadow-sm`}>
      <span className="opacity-50 font-medium">{label}:</span>
      <span>{value}</span>
      {onClear && (
        <button onClick={onClear} className="ml-0.5 w-4 h-4 rounded-full bg-blue-100/50 hover:bg-blue-100/70 flex items-center justify-center transition-all">
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
    { label: 'バランス', icon: '⇌', text: 0.5, diff: 0.6, trick: 0.0, desc: '標準的なバランス配分' },
    { label: '類似重視', icon: '≈', text: 1.5, diff: 0.3, trick: 0.0, desc: '似た問題を多く参照' },
    { label: '難易度重視', icon: '▸▸', text: 0.3, diff: 1.5, trick: 0.0, desc: '同じ難易度帯を重視' },
    { label: 'ひっかけ強化', icon: '⁇', text: 0.3, diff: 0.3, trick: 1.5, desc: '巧妙な問題を参照' },
  ];
  const axes = [
    { label: '類似度', value: textWeight, color: '#1e293b', onChange: onText, desc: '作りたい問題に似た過去問を重視します' },
    { label: '難易度', value: diffWeight, color: '#334155', onChange: onDiff, desc: '指定した難しさに近い過去問を重視します' },
    { label: 'ひっかけ', value: trickWeight, color: '#475569', onChange: onTrick, desc: 'ひっかけ要素のある過去問を重視します' },
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
                    ? 'bg-[#1e2d4a] shadow-md ring-2 ring-[#4f7cfa]/30'
                    : 'bg-white/50 shadow-sm ring-1 ring-blue-200/30 hover:ring-blue-200/50 hover:shadow-md hover:bg-white/80'
                  }`}
              >
                {isActive && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-[#2563eb]" />}
                <span className="text-xl block mb-1">{p.icon}</span>
                <span className={`text-[11px] font-bold block ${isActive ? 'text-[#1e293b]' : 'text-[#1e293b]'}`}>{p.label}</span>
                <span className="text-[9px] text-[#94a3b8] block mt-0.5 leading-tight">{p.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ビジュアルバランスメーター */}
      <div className="p-5 bg-[#111827] rounded-2xl border border-blue-200/50 shadow-sm">
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
                  <div className="absolute inset-x-0 h-[5px] rounded-full bg-blue-50/60" />
                  <div className="absolute left-0 h-[5px] rounded-full transition-all duration-200"
                       style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.color}, ${p.color}bb)` }} />
                  <input
                    type="range" min={0} max={2} step={0.1} value={p.value}
                    onChange={(e) => p.onChange(Number(e.target.value))}
                    className="relative w-full h-[5px] rounded-full appearance-none cursor-pointer bg-transparent z-10
                      [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(37,99,235,0.12),0_0_0_1px_rgba(37,99,235,0.04)]
                      [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200
                      [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:active:scale-110"
                  />
                </div>
                <p className="text-[10px] text-[#94a3b8] mt-0.5 ml-4">{p.desc}</p>
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
    { value: 0.2, icon: '×', label: '低い', color: '#1e293b' },
    { value: 0.4, icon: '△', label: 'いまいち', color: '#475569' },
    { value: 0.6, icon: '○', label: 'まあまあ', color: '#475569' },
    { value: 0.8, icon: '◎', label: '良い', color: '#1e293b' },
    { value: 1.0, icon: '◉', label: '最高', color: '#334155' },
  ];
  return (
    <div className="flex items-stretch gap-2">
      {levels.map((l) => {
        const isActive = score === l.value;
        return (
          <button key={l.value} onClick={() => onChange(l.value)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl transition-all duration-300 active:scale-95 relative overflow-hidden
              ${isActive
                ? 'bg-[#1e2d4a] shadow-md ring-2 scale-105'
                : 'bg-white/50 ring-1 ring-blue-200/30 hover:ring-blue-200/50 hover:bg-white/80 hover:shadow-sm'
              }`}
            style={isActive ? { ringColor: `${l.color}40`, '--tw-ring-color': `${l.color}40` } : undefined}>
            {isActive && <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: l.color }} />}
            <span className={`text-2xl transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>{l.icon}</span>
            <span className={`text-[10px] font-bold transition-colors ${isActive ? '' : 'text-[#94a3b8]'}`}
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
  const { serviceName, logoUrl, paperTheme, resolvedPaperColors } = useBranding();
  const [status, setStatus] = useState('');

  // 科目アイコン（SVG）
  const SubjectIcon = useCallback(({ type, className = "w-4 h-4" }) => {
    const icons = {
      '数学': (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h6l-6 8 6 8H4" /><path d="M14 12h6" /><path d="M14 6h6" /><path d="M14 18h6" />
        </svg>
      ),
      '物理': (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="12" cy="12" r="2" fill="currentColor" /><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
        </svg>
      ),
      '化学': (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3h6v5.172a2 2 0 01-.586 1.414l-.828.828A2 2 0 0013 11.828V17a4 4 0 01-2 3.464A4 4 0 019 17v-5.172a2 2 0 00-.586-1.414l-.828-.828A2 2 0 017 8.172V3" /><path d="M9 3h6" /><path d="M7.5 16h9" />
        </svg>
      ),
      '英語': (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      ),
      '生物': (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M7 4a8 8 0 005 7.5A8 8 0 0017 4" /><path d="M7 20a8 8 0 005-7.5A8 8 0 0017 20" /><path d="M8 6h8" /><path d="M8 18h8" /><path d="M7 12h10" />
        </svg>
      ),
      '情報': (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
      '国語': (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 2l4 4-9.5 9.5a4 4 0 01-2 1.1L6 18l1.4-4.5a4 4 0 011.1-2L18 2z" /><path d="M6 18v4h4" />
        </svg>
      ),
      '社会': (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" fill="none" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      ),
      '地学': (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3l4 8 5-5 4 14H3z" /><path d="M4.14 15.08C5 14 6 13.5 7 13.5c2 0 3.5 2.5 5 2.5s2.5-1 4-1 2.5.5 4 2" />
        </svg>
      ),
      '理科': (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
        </svg>
      ),
    };
    return icons[type] || <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /></svg>;
  }, []);

  // 科目カラー定義
  const SUBJECT_COLOR_MAP = useMemo(() => ({
    '数学': { bg: 'from-[#3b82f6] to-[#2563eb]', light: '#3b82f6', bgLight: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    '物理': { bg: 'from-[#8b5cf6] to-[#7c3aed]', light: '#8b5cf6', bgLight: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    '化学': { bg: 'from-[#10b981] to-[#059669]', light: '#10b981', bgLight: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    '英語': { bg: 'from-[#f59e0b] to-[#d97706]', light: '#f59e0b', bgLight: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    '生物': { bg: 'from-[#22c55e] to-[#16a34a]', light: '#22c55e', bgLight: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    '情報': { bg: 'from-[#06b6d4] to-[#0891b2]', light: '#06b6d4', bgLight: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    '国語': { bg: 'from-[#ec4899] to-[#db2777]', light: '#ec4899', bgLight: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
    '社会': { bg: 'from-[#f97316] to-[#ea580c]', light: '#f97316', bgLight: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    '地学': { bg: 'from-[#14b8a6] to-[#0d9488]', light: '#14b8a6', bgLight: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    '理科': { bg: 'from-[#6366f1] to-[#4f46e5]', light: '#6366f1', bgLight: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  }), []);
  const getSubjectColor = useCallback((subj) => SUBJECT_COLOR_MAP[subj] || { bg: 'from-[#64748b] to-[#475569]', light: '#64748b', bgLight: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }, [SUBJECT_COLOR_MAP]);

  // テンプレートを教科ごとにグループ化
  const groupedTemplates = useMemo(() => {
    const groups = {};
    templates.forEach((t) => {
      const subj = t.metadata?.subject || 'その他';
      if (!groups[subj]) groups[subj] = [];
      groups[subj].push(t);
    });
    return groups;
  }, [templates]);

  const [expandedSubjects, setExpandedSubjects] = useState([]);
  const toggleSubjectGroup = useCallback((subj) => {
    setExpandedSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj]
    );
  }, []);

  // テンプレートが少ない場合は自動展開
  useEffect(() => {
    const subjects = Object.keys(groupedTemplates);
    if (subjects.length <= 3) {
      setExpandedSubjects(subjects);
    }
  }, [groupedTemplates]);

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
    if (!templateId) { setStatus('出題パターンを選択してください'); return; }
    setStatus('AIへの指示文を作成中...');
    try {
      const data = await renderTemplate({
        template_id: templateId, subject, difficulty,
        num_questions: numQuestions, rag_inject: false,
        brand_name: serviceName || undefined,
        brand_logo_url: logoUrl || undefined,
        paper_theme: paperTheme || undefined,
        paper_colors: resolvedPaperColors || undefined,
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
      setStatus('指示文の作成完了！ → 次のステップへ進みます');
      // 自動的に「実行」ステップへ遷移
      setActiveSection('execute');
    } catch (e) { setStatus(`エラー: ${e.message}`); }
  };

  // ── RAG 注入 ──
  const injectRag = async () => {
    if (!basePrompt) { setStatus('まず指示文を作成してください'); return; }
    setStatus('過去問を参考にしています...');
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
      setStatus(`過去問の参考が完了しました（${(data.retrieved || []).length}件）`);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('empty vocabulary') || msg.includes('retrieval failed')) {
        setStatus('参考にできる過去問がまだありません。「過去問なしで進む」をクリックしてください。');
      } else if (msg.includes('502') || msg.includes('504') || msg.includes('backend_timeout') || msg.includes('backend_unavailable')) {
        setStatus('過去問の取得に失敗しました。数秒後にもう一度お試しください。');
      } else {
        setStatus(`過去問の取得エラー: ${msg}`);
      }
    }
  };

  const skipRag = () => {
    setRagSkipped(true); setRagPrompt(''); setRetrievedChunks([]);
    setStatus('過去問なしで進めます');
  };

  // ── AI 出力パース ──
  const parseLlmOutput = () => {
    if (!llmOutput.trim()) { setParseError('AIの回答がまだ入力されていません'); return; }
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
      setStatus('読み取り成功！ → 確認・保存へ移動します');
      // 自動的に「評価・保存」ステップへ遷移
      setActiveSection('evaluate');
    } else {
      setParsedProblem({
        stem: llmOutput.trim(), stem_latex: llmOutput.trim(), final_answer: '',
        checks: [{ desc: '自動生成 — 未検証', ok: false }, { desc: '自動生成 — 未検証', ok: false }],
      });
      setStatus('テキストとして読み取りました → 確認画面へ移動します');
      // テキスト読み取りでも自動遷移
      setActiveSection('evaluate');
    }
  };

  // ── 保存 ──
  const saveToProblemsDb = async () => {
    if (!parsedProblem) { setStatus('まずAIの回答を読み取ってください'); return;
    }
    setStatus('答えを確認して保存しています...');
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
        setStatus('答え合わせで不一致が見つかりました — 内容を確認してください');
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
    if (!llmOutput) { setStatus('AIの回答がまだありません'); return; }
    setStatus('出来栄えを記録しています...');
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
      setStatus('出来栄えの記録が完了しました');
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
    { id: 'configure', label: '出題パターン', icon: '◆', enabled: true },
    { id: 'execute', label: 'AIに送る', icon: '▷', enabled: hasPrompt },
    { id: 'evaluate', label: '確認・保存', icon: '◇', enabled: hasOutput },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5 px-4 sm:px-5 py-6 sm:py-10 pb-8 sm:pb-12">
      {/* ── ヒーロー ── */}
      <div className="text-center pt-2 pb-2 relative">
        {/* Aurora gradient background blobs */}
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-400/10 blur-3xl" />
          <div className="absolute -top-5 -right-10 w-32 h-32 rounded-full bg-gradient-to-bl from-purple-400/15 to-blue-400/10 blur-3xl" />
        </div>
        <div className="inline-flex items-center justify-center w-[56px] h-[56px] rounded-[18px] bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white shadow-lg shadow-blue-500/25 mb-4">
          <Icons.Dev className="w-7 h-7" />
        </div>
        <h1 className="text-[22px] sm:text-[26px] font-black tracking-tight text-[#1e293b] mb-1 leading-none">
          品質をみがく
        </h1>
        <p className="text-[13px] sm:text-[14px] text-[#64748b] max-w-[340px] mx-auto leading-relaxed">
          出題パターンを選んで → AIに指示を出し → 出来栄えを確認する
        </p>
      </div>

      <StatusBar message={status} />

      {/* ── フィードバックダッシュボード（常時表示） ── */}
      {feedbackData && (
        <div className="relative overflow-hidden rounded-[20px] bg-[#111827] border border-[#1e2d4a] shadow-sm"
             style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="icon-premium w-9 h-9 text-white">
                <Icons.Chart className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-bold text-[#1e293b] tracking-tight">あなたの評価データ</h3>
                <p className="text-[11px] text-[#94a3b8]">過去の記録をもとに、AIへの指示に自動反映します</p>
              </div>
              {feedbackLoading && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/50 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse" />
                  <span className="text-[10px] text-[#64748b] font-semibold">更新中</span>
                </div>
              )}
            </div>

            {/* 統計カード */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="relative overflow-hidden rounded-2xl bg-blue-50/40 border border-blue-200/50 p-4 text-center">
                <div className="text-2xl font-bold text-[#1e293b] tabular-nums">{feedbackData.stats?.total_evaluations ?? 0}</div>
                <div className="text-[10px] text-[#64748b] font-semibold mt-0.5 uppercase tracking-wider">累計記録</div>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-blue-50/40 border border-blue-200/50 p-4 text-center">
                <div className="text-2xl font-bold text-[#1e293b] tabular-nums">{feedbackData.stats?.avg_score != null ? feedbackData.stats.avg_score : '—'}</div>
                <div className="text-[10px] text-[#64748b] font-semibold mt-0.5 uppercase tracking-wider">平均スコア</div>
                {/* スコアバー */}
                {feedbackData.stats?.avg_score != null && (
                  <div className="mt-2 h-1.5 bg-blue-50/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#2563eb] transition-all duration-500"
                         style={{ width: `${(feedbackData.stats.avg_score / 5) * 100}%` }} />
                  </div>
                )}
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-blue-50/40 border border-blue-200/50 p-4 text-center">
                <div className="text-2xl font-bold text-[#1e293b] tabular-nums">{feedbackData.stats?.high_score_count ?? 0}</div>
                <div className="text-[10px] text-[#64748b] font-semibold mt-0.5 uppercase tracking-wider">高評価 (4+)</div>
              </div>
            </div>

            {/* 高評価例 */}
            {feedbackData.feedback?.length > 0 ? (
              <details className="group rounded-2xl bg-blue-50/40 border border-blue-200/40 overflow-hidden">
                <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-[#1e293b] hover:bg-blue-50/40 select-none flex items-center gap-2 transition-all">
                  <svg className="w-3.5 h-3.5 transition-transform duration-200 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>うまくいった例を見る</span>
                  <span className="ml-auto px-2 py-0.5 bg-blue-50/60 text-[#64748b] rounded-full text-[10px] font-bold">{feedbackData.feedback.length}件</span>
                </summary>
                <div className="px-4 pb-4 space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
                  {feedbackData.feedback.map((fb, idx) => (
                    <div key={fb.id || idx} className="p-3 bg-white/80 rounded-xl border border-blue-200/40 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50/60 text-[#1e293b] rounded-lg text-[10px] font-bold">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            {fb.score}
                          </span>
                          {fb.metadata?.subject && (
                            <span className="px-2 py-0.5 bg-blue-50/60 text-[#64748b] rounded-lg text-[9px] font-bold">{fb.metadata.subject}</span>
                          )}
                          {fb.metadata?.field && (
                            <span className="px-2 py-0.5 bg-blue-50/60 text-[#64748b] rounded-lg text-[9px] font-bold">{fb.metadata.field}</span>
                          )}
                        </div>
                        <span className="text-[9px] text-[#c7c7cc] font-medium">{fb.timestamp?.slice(0, 10)}</span>
                      </div>
                      {fb.notes && (
                        <div className="text-[11px] text-[#64748b] flex items-start gap-1.5 mb-1">
                          <svg className="w-3.5 h-3.5 text-[#475569] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                          <span>{fb.notes}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-[#424245] line-clamp-2 leading-relaxed bg-blue-50/40 rounded-lg p-2 mt-1 font-mono">
                        {fb.model_output_excerpt?.slice(0, 200)}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ) : (
              <div className="text-center py-4 bg-blue-50/40 rounded-2xl border border-blue-200/40">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50/60 mb-2">
                  <svg className="w-5 h-5 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <p className="text-xs text-[#64748b] font-medium">出来栄えを記録すると、次回の指示文に自動反映されます</p>
                <p className="text-[10px] text-[#94a3b8] mt-0.5">データは自動的に保存されます</p>
              </div>
            )}

            {/* 評価履歴ボタン */}
            <div className="mt-4 pt-4 border-t border-blue-200/40 flex items-center justify-between">
              <button
                onClick={() => { setShowEvalHistory(!showEvalHistory); if (!evalHistory) loadEvalHistory(subject); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748b] hover:text-[#1e293b] hover:bg-blue-50/60 transition-all border border-blue-200/40 hover:border-blue-200/60"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {showEvalHistory ? '記録を閉じる' : 'これまでの記録を見る'}
              </button>
              <button
                onClick={() => { loadFeedback(subject, templateId); loadEvalHistory(subject); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold text-[#94a3b8] hover:text-[#1e293b] transition-all"
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
        <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-[#1e2d4a] shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="icon-premium w-10 h-10 text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">これまでの記録</h3>
                <p className="text-[11px] text-[#64748b]">全{evalHistory.analytics?.total || 0}件の評価データ</p>
              </div>
              {evalHistoryLoading && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse" />
                  <span className="text-[10px] text-[#64748b] font-bold">読込中</span>
                </div>
              )}
            </div>

            {/* 分析サマリー */}
            {evalHistory.analytics && (
              <div className="mb-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                  <div className="p-3 rounded-xl bg-blue-50/40 border border-blue-200/50 text-center">
                    <div className="text-lg font-bold text-[#1e293b] tabular-nums">{evalHistory.analytics.total}</div>
                    <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-wider">累計記録</div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50/40 border border-blue-200/50 text-center">
                    <div className="text-lg font-bold text-[#1e293b] tabular-nums">{evalHistory.analytics.avg_score ?? '—'}</div>
                    <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-wider">平均スコア</div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50/40 border border-blue-200/50 text-center">
                    <div className="text-lg font-bold text-[#1e293b] tabular-nums">{evalHistory.analytics.high_count}</div>
                    <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-wider">高評価</div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50/40 border border-blue-200/50 text-center">
                    <div className="text-lg font-bold text-[#1e293b] tabular-nums">{evalHistory.analytics.low_count}</div>
                    <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-wider">もう少し</div>
                  </div>
                </div>

                {/* スコア分布バー */}
                {Object.keys(evalHistory.analytics.score_distribution || {}).length > 0 && (
                  <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200/40 mb-4">
                    <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-3">評価の分布</div>
                    <div className="flex items-end gap-1 h-16">
                      {[0.2, 0.4, 0.6, 0.8, 1.0].map((score) => {
                        const count = evalHistory.analytics.score_distribution[score] || 0;
                        const maxCount = Math.max(...Object.values(evalHistory.analytics.score_distribution), 1);
                        const height = (count / maxCount) * 100;
                        const colors = { 0.2: '#1e293b', 0.4: '#3b82f6', 0.6: '#3b82f6', 0.8: '#1e40af', 1.0: '#2563eb' };
                        const labels = { 0.2: '低い', 0.4: 'いまいち', 0.6: 'まあまあ', 0.8: '良い', 1.0: '最高' };
                        return (
                          <div key={score} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold tabular-nums" style={{ color: colors[score] }}>{count}</span>
                            <div className="w-full rounded-t-lg transition-all duration-500"
                                 style={{ height: `${Math.max(height, 4)}%`, background: `linear-gradient(to top, ${colors[score]}40, ${colors[score]})` }} />
                            <span className="text-[10px] text-[#94a3b8] font-bold">{labels[score]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 科目別スコア */}
                {Object.keys(evalHistory.analytics.per_subject || {}).length > 0 && (
                  <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200/40 mb-4">
                    <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-3">科目ごとの評価</div>
                    <div className="space-y-2">
                      {Object.entries(evalHistory.analytics.per_subject).map(([subj, data]) => {
                        const scoreColor = data.avg >= 0.8 ? '#1e40af' : data.avg >= 0.6 ? '#3b82f6' : data.avg >= 0.4 ? '#3b82f6' : '#1e293b';
                        return (
                          <div key={subj} className="flex items-center gap-3">
                            <span className="text-[12px] font-bold text-[#1e293b] min-w-[3rem]">{subj}</span>
                            <div className="flex-1 h-2 bg-blue-50/60 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                   style={{ width: `${(data.avg || 0) * 100}%`, background: scoreColor }} />
                            </div>
                            <span className="text-[11px] font-bold tabular-nums min-w-[2.5rem] text-right" style={{ color: scoreColor }}>
                              {data.avg ?? '—'}
                            </span>
                            <span className="text-[9px] text-[#94a3b8] font-medium">{data.count}件</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* トレンドラインスパークライン */}
                {evalHistory.analytics.recent_trend?.length > 1 && (
                  <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200/40 mb-4">
                    <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-3">最近の傾向</div>
                    <div className="flex items-end gap-1 h-12">
                      {evalHistory.analytics.recent_trend.map((pt, idx) => {
                        const height = ((pt.score || 0) / 1.0) * 100;
                        const scoreColor = pt.score >= 0.8 ? '#1e40af' : pt.score >= 0.6 ? '#3b82f6' : pt.score >= 0.4 ? '#3b82f6' : '#1e293b';
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
                <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-1">最近の評価</div>
                {evalHistory.evaluations.map((ev, idx) => {
                  const scoreIcon = { 0.2: '×', 0.4: '△', 0.6: '○', 0.8: '◎', 1.0: '◉' };
                  const scoreColor = ev.score >= 0.8 ? '#1e40af' : ev.score >= 0.6 ? '#3b82f6' : ev.score >= 0.4 ? '#3b82f6' : '#1e293b';
                  return (
                    <div key={ev.id || idx} className="p-3 bg-[#111827] rounded-xl border border-blue-200/40 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{scoreIcon[ev.score] || '—'}</span>
                          <span className="text-[12px] font-bold tabular-nums" style={{ color: scoreColor }}>
                            {ev.score}
                          </span>
                          {ev.metadata?.subject && (
                            <span className="px-2 py-0.5 bg-blue-50/60 text-[#64748b] rounded-lg text-[9px] font-bold">{ev.metadata.subject}</span>
                          )}
                          {ev.metadata?.field && (
                            <span className="px-2 py-0.5 bg-blue-50/60 text-[#64748b] rounded-lg text-[9px] font-bold">{ev.metadata.field}</span>
                          )}
                        </div>
                        <span className="text-[9px] text-[#c7c7cc] font-medium">{ev.timestamp?.slice(0, 10)}</span>
                      </div>
                      {ev.notes && <div className="text-[11px] text-[#64748b] ml-8 mb-1">{ev.notes}</div>}
                      {ev.model_output_excerpt && (
                        <div className="text-[10px] text-[#94a3b8] ml-8 line-clamp-1 font-mono">{ev.model_output_excerpt.slice(0, 150)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-[#94a3b8]">まだ記録がありません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── セクションナビ (Apple風セグメントコントロール) ── */}
      <div className="relative rounded-2xl bg-blue-50/50 border border-blue-200/40 p-1 sm:p-1.5">
        <div className="flex items-center gap-1">
        {sections.map((s, idx) => {
          const isActive = activeSection === s.id;
          const stepNum = idx + 1;
          const sectionColors = {
            configure: '#2563eb',
            execute:   '#3b82f6',
            evaluate:  '#1e40af',
          };
          const sc = sectionColors[s.id] || sectionColors.configure;
          return (
          <button key={s.id} onClick={() => s.enabled && setActiveSection(s.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-[13px] font-bold transition-all duration-300 relative whitespace-nowrap min-h-[44px]
              ${isActive
                ? 'bg-[#1e2d4a] shadow-md'
                : s.enabled
                  ? 'text-[#64748b] hover:text-[#1e293b] hover:bg-white/60'
                  : 'text-[#d2d2d7] cursor-not-allowed'
              }`}
            style={isActive ? { color: sc, boxShadow: `0 2px 8px ${sc}20` } : undefined}
            disabled={!s.enabled}>
            <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black text-white" style={{ background: isActive ? sc : s.enabled ? '#94a3b8' : '#d2d2d7' }}>{stepNum}</span>
            <span>{s.label}</span>
            {isActive && (
              <span className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-5 h-[2.5px] rounded-full" style={{ background: sc }} />
            )}
            {!s.enabled && s.id !== 'configure' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] text-[#c7c7cc] px-2 py-0.5 rounded-full whitespace-nowrap">
                {s.id === 'execute' ? '指示文の作成後' : 'AI結果の入力後'}
              </span>
            )}
          </button>
          );
        })}
        <button onClick={resetAll} title="リセット"
          className="px-3 py-3 rounded-xl text-[#c7c7cc] hover:text-[#1e293b] hover:bg-[#2563eb]/[0.06] transition-all flex-shrink-0 active:scale-90">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </button>
        </div>
      </div>

      {/* ── ウィザードアシスト ── */}
      <div className="relative overflow-hidden rounded-2xl border" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(37,99,235,0.10))', borderColor: 'rgba(37,99,235,0.15)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#2563eb] text-white text-xs font-black flex-shrink-0 shadow-sm">
            {activeSection === 'configure' ? '1' : activeSection === 'execute' ? '2' : '3'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#1e293b] leading-snug">
              {activeSection === 'configure' && !templateId && '出題パターンを選んで、指示文を作成しましょう'}
              {activeSection === 'configure' && templateId && !hasPrompt && '設定ができました。「指示文を作成」ボタンを押してください'}
              {activeSection === 'configure' && hasPrompt && '指示文ができました！次のステップへ進めます'}
              {activeSection === 'execute' && !hasOutput && '指示文をコピーして外部AIに送り、結果を貼り付けてください'}
              {activeSection === 'execute' && hasOutput && '結果が入力されました！次のステップへ進めます'}
              {activeSection === 'evaluate' && '出来栄えを確認して、評価を記録しましょう'}
            </p>
          </div>
          {activeSection === 'configure' && hasPrompt && (
            <button onClick={() => setActiveSection('execute')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2563eb] text-white text-[11px] font-bold shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] flex-shrink-0">
              次へ <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          )}
          {activeSection === 'execute' && hasOutput && (
            <button onClick={() => setActiveSection('evaluate')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2563eb] text-white text-[11px] font-bold shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] flex-shrink-0">
              次へ <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
         出題パターン選択
         ════════════════════════════════════════════════════════ */}
      {activeSection === 'configure' && (
        <div className="space-y-6">

          {/* ── 条件設定（出題パターン＋問数） ── */}
          <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-[#1e2d4a] shadow-sm">
            {/* ヘッダー */}
            <div className="relative px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="icon-premium w-10 h-10 text-white">
                  <Icons.File className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">出題パターンを選ぶ</h3>
                  <p className="text-[11px] text-[#64748b]">教科・分野・難易度がセットされたパターンから選べます</p>
                </div>
              </div>

              {/* 選択中サマリータグ */}
              {templateId && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-blue-200/40">
                  {(() => {
                    const sel = templates.find((t) => t.id === templateId);
                    return <SelectedTag label="出題パターン" value={sel?.name || templateId} color="violet" onClear={() => { setTemplateId(''); setSubject(''); setField(''); }} />;
                  })()}
                  <SelectedTag label="問数" value={`${numQuestions}問`} color="sky" />
                </div>
              )}
            </div>

            {/* 出題パターン — 教科別アコーディオン */}
            <div className="px-5 pb-3">
              {templates.length === 0 ? (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50/60 mb-3">
                    <svg className="w-7 h-7 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-[#1e293b]">出題パターンがありません</p>
                  <p className="text-xs text-[#64748b] mt-1">「問題をつくる」モードで作成してください</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {Object.entries(groupedTemplates).map(([subjName, subjectTemplates]) => {
                    const sc = getSubjectColor(subjName);
                    const isExpanded = expandedSubjects.includes(subjName);
                    const hasActive = subjectTemplates.some((t) => templateId === t.id);

                    return (
                      <div key={subjName} className={`rounded-2xl border overflow-hidden transition-all duration-300 ${hasActive ? `${sc.border} shadow-sm` : 'border-blue-100/60'}`}>
                        <button
                          onClick={() => toggleSubjectGroup(subjName)}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors duration-200 ${isExpanded ? sc.bgLight : 'hover:bg-blue-50/40'}`}
                        >
                          <div className={`flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br ${sc.bg} text-white text-sm font-bold flex-shrink-0`}>
                            <SubjectIcon type={subjName} className="w-4 h-4" />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <span className={`text-[14px] font-bold ${sc.text}`}>{subjName}</span>
                            <span className="text-[11px] text-[#94a3b8] ml-2">{subjectTemplates.length}パターン</span>
                          </div>
                          {hasActive && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#2563eb] text-white">選択中</span>
                          )}
                          <svg className={`w-4 h-4 text-[#94a3b8] transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-blue-100/40 divide-y divide-blue-50">
                            {subjectTemplates.map((t) => {
                              const isActive = templateId === t.id;
                              const meta = t.metadata || {};
                              const fld = meta.field || '';
                              const thm = meta.theme || '';
                              const diff = meta.difficulty || '';
                              const diffLevels = { '基礎': 1, '標準': 2, '応用': 3, '発展': 4, '難関': 5, '最難関': 6 };
                              const diffLevel = diffLevels[diff] || 0;
                              const diffColors = { 1: '#93c5fd', 2: '#60a5fa', 3: '#3b82f6', 4: '#2563eb', 5: '#1d4ed8', 6: '#1e40af' };
                              const dotColor = diffColors[diffLevel] || '#cbd5e1';
                              const breadcrumb = [fld, thm].filter(Boolean).join(' › ');

                              return (
                                <button
                                  key={t.id}
                                  onClick={() => onSelectTemplate(t.id)}
                                  className={`group w-full text-left px-4 py-3 transition-all duration-200
                                    ${isActive ? `${sc.bgLight} border-l-2` : 'hover:bg-blue-50/30 border-l-2 border-transparent'}`}
                                  style={isActive ? { borderLeftColor: sc.light } : {}}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[13px] font-semibold text-[#1e293b] truncate">
                                          {breadcrumb || t.name || t.id}
                                        </span>
                                        {isActive && (
                                          <div className="flex items-center justify-center w-[16px] h-[16px] rounded-full bg-[#2563eb] flex-shrink-0">
                                            <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                          </div>
                                        )}
                                      </div>
                                      {diffLevel > 0 && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                          <div className="flex gap-[3px]">
                                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                              <div key={i} className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: i <= diffLevel ? dotColor : '#bfdbfe' }} />
                                            ))}
                                          </div>
                                          <span className="text-[9px] font-medium" style={{ color: dotColor }}>{difficultyLabel(diff)}</span>
                                        </div>
                                      )}
                                    </div>
                                    {!isActive && (
                                      <svg className="w-3.5 h-3.5 text-[#c7c7cc] flex-shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
                    );
                  })}
                </div>
              )}
            </div>

            {/* 選択中のパターン表示 */}
            {templateId && (
              <div className="mx-5 mb-3 p-3 rounded-xl bg-blue-50/50 border border-blue-100/60">
                <div className="text-[10px] text-[#64748b]">選択中のパターン:</div>
                <div className="text-[13px] font-bold text-[#2563eb]">{templates.find((t) => t.id === templateId)?.name || templateId}</div>
                {(() => {
                  const sel = templates.find((t) => t.id === templateId);
                  return sel?.metadata ? (
                    <div className="text-[10px] text-[#64748b] mt-1">
                      {[sel.metadata.subject, sel.metadata.field, sel.metadata.difficulty].filter(Boolean).join(' / ')}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* 問数 + リフレッシュ */}
            <div className="px-5 pb-5 flex items-end gap-4 border-t border-blue-200/40 pt-4 mx-5">
              <div className="flex-1">
                <NumberField label="問数" value={numQuestions} onChange={setNumQuestions} min={1} />
              </div>
              <button onClick={async () => { await refresh(); setStatus('一覧を再読み込みしました'); }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#64748b] hover:text-[#1e293b] hover:bg-blue-100/60 transition-all border border-blue-200/40 hover:border-[#2563eb]/20"
                title="一覧を再読込">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                <span className="hidden sm:inline">再読み込み</span>
                <span className="text-[10px] text-[#c7c7cc] font-normal ml-1">{templates.length}件</span>
              </button>
            </div>
          </div>

          {/* ── 参考問題（テンプレート合致で自動取得） ── */}
          <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-[#1e2d4a] shadow-sm">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-premium w-10 h-10 text-white">
                  <Icons.Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">参考問題を選択</h3>
                  <p className="text-[11px] text-[#64748b]">選択した出題パターンに合致する過去問が表示されます</p>
                </div>
              </div>

            {/* 選択済み問題の表示 */}
            {selectedRefProblem && (
              <div className="mb-3 relative overflow-hidden rounded-2xl border border-blue-200/50 bg-blue-50/40
                              shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-blue-100/50" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="check-circle checked">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">選択中</span>
                        {selectedRefProblem.id && (
                          <span className="text-[10px] text-[#475569]/60 font-mono">#{selectedRefProblem.id}</span>
                        )}
                      </div>
                      <div className="text-[13px] text-[#1e293b] leading-relaxed line-clamp-3 ml-[30px]">
                        <LatexText>{(selectedRefProblem.stem || selectedRefProblem.text || '').slice(0, 200)}</LatexText>
                      </div>
                      <div className="flex gap-1.5 mt-2 ml-[30px] flex-wrap">
                        {selectedRefProblem.subject && (
                          <span className="px-2 py-0.5 bg-blue-100/60 text-[#1e293b] rounded-full text-[9px] font-bold">{selectedRefProblem.subject}</span>
                        )}
                        {(selectedRefProblem.topic || selectedRefProblem.metadata?.field) && (
                          <span className="px-2 py-0.5 bg-blue-100/60 text-[#1e293b] rounded-full text-[9px] font-bold">{selectedRefProblem.topic || selectedRefProblem.metadata?.field}</span>
                        )}
                        {selectedRefProblem.difficulty != null && (
                          <span className="px-2 py-0.5 bg-blue-100/50 text-[#475569] rounded-full text-[9px] font-bold">{difficultyLabel(selectedRefProblem.difficulty)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={clearRefProblem}
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50/60 hover:bg-[#2563eb]/10
                                 text-[#94a3b8] hover:text-[#1e293b] transition-all duration-200 flex-shrink-0 active:scale-90"
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
                  <span className="px-2.5 py-1 bg-blue-100/60 text-[#1e293b] rounded-full text-[10px] font-bold">{subject}</span>
                )}
                {field && (
                  <span className="px-2.5 py-1 bg-blue-100/60 text-[#1e293b] rounded-full text-[10px] font-bold">{field}</span>
                )}
              </div>
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50/50 border border-blue-200/40
                              focus-within:bg-[#111827] focus-within:border-blue-300/50/30 focus-within:shadow-sm transition-all duration-200">
                <svg className="w-3.5 h-3.5 text-[#c7c7cc] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={refSearchInputRef}
                  type="text"
                  value={refFilterQuery}
                  onChange={(e) => setRefFilterQuery(e.target.value)}
                  placeholder="絞り込み..."
                  className="flex-1 bg-transparent text-xs text-[#1e293b] outline-none placeholder:text-[#c7c7cc]"
                />
                {refFilterQuery && (
                  <button onClick={() => setRefFilterQuery('')} className="text-[#94a3b8] hover:text-[#1e293b] transition-colors">
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
                <svg className="animate-spin h-5 w-5 text-[#475569]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-[11px] text-[#94a3b8]">過去問を取得中...</p>
              </div>
            ) : filteredRefProblems.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider px-1 mb-1">
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
                            <span className="text-[10px] text-[#94a3b8] font-mono">#{item.id ?? idx + 1}</span>
                          </div>
                          <div className="text-[13px] text-[#1e293b] leading-relaxed line-clamp-2">
                            <LatexText>{(item.stem || item.text || '').slice(0, 150)}</LatexText>
                          </div>
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {item.subject && (
                              <span className="px-2 py-0.5 bg-blue-100/60 text-[#1e293b] rounded-full text-[9px] font-bold">{item.subject}</span>
                            )}
                            {(item.topic || item.metadata?.field) && (
                              <span className="px-2 py-0.5 bg-blue-100/60 text-[#1e293b] rounded-full text-[9px] font-bold">{item.topic || item.metadata?.field}</span>
                            )}
                            {item.difficulty != null && (
                              <span className="px-2 py-0.5 bg-blue-100/50 text-[#475569] rounded-full text-[9px] font-bold">{difficultyLabel(item.difficulty)}</span>
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
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50/60 mb-2">
                  <svg className="w-5 h-5 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-xs text-[#94a3b8]">「{refFilterQuery}」に一致する問題はありません</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50/60 mb-2">
                  <svg className="w-5 h-5 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </div>
                <p className="text-xs text-[#94a3b8]">この科目・分野の過去問はまだ登録されていません</p>
              </div>
            )}

            {referenceStem && !selectedRefProblem && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2563eb] flex-shrink-0" />
                <span className="text-[10px] text-[#1e293b] font-bold">参考問題が設定されています</span>
              </div>
            )}
            </div>
          </div>

          {/* ── RAG ミキサー ── */}
          <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-[#1e2d4a] shadow-sm">
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="icon-premium w-10 h-10 text-white">
                  <Icons.Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">過去問の参考バランス</h3>
                  <p className="text-[11px] text-[#64748b]">過去問をどう参考にするか、バランスを調整できます</p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <RagMixer
                textWeight={textWeight} diffWeight={difficultyMatchWeight} trickWeight={trickinessWeight}
                onText={setTextWeight} onDiff={setDifficultyMatchWeight} onTrick={setTrickinessWeight}
              />
              <div className="mt-5 pt-4 border-t border-blue-200/40">
                <NumberField label="参考にする問題の数" value={topK} onChange={setTopK} min={1} max={20} />
              </div>
            </div>
          </div>

          {/* ── 指示文作成 ── */}
          <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-[#1e2d4a] shadow-sm">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-premium w-10 h-10 text-white">
                  <Icons.Prompt className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">AIへの指示文を作成</h3>
                  <p className="text-[11px] text-[#64748b]">
                    {!templateId
                      ? '↑ まず上の出題パターンを選んでください'
                      : !basePrompt
                        ? 'ボタンを押すと、選んだパターンからAIへの指示文が自動生成されます'
                        : '指示文が完成しました。次のステップへ進めます。'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={generateBasePrompt} disabled={!templateId}>
                  <Icons.Prompt className="w-4 h-4" /> {basePrompt ? '指示文を再作成' : '指示文を作成する'}
                </Button>
                {basePrompt && (
                  <>
                    <Button onClick={injectRag} variant="secondary">
                      <Icons.Search className="w-4 h-4" /> 過去問を参考にする
                    </Button>
                    <Button onClick={skipRag} variant="ghost">過去問なしで進む</Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {ragSkipped && (
            <div className="p-3 bg-blue-100/50 rounded-lg border border-blue-200/40/40 text-xs text-[#475569] flex items-center gap-2">
              <Icons.Info className="w-3.5 h-3.5 flex-shrink-0" /> 過去問なしで進めています
            </div>
          )}

          {retrievedChunks.length > 0 && (
            <div className="p-4 bg-blue-50/60 rounded-lg border border-blue-200/50 max-h-56 overflow-y-auto custom-scrollbar">
              <div className="text-xs font-semibold text-[#94a3b8] mb-2 uppercase tracking-wide flex items-center gap-2">
                参照データ ({retrievedChunks.length}件)
                {retrievedChunks[0]?.search_tier && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    retrievedChunks[0].search_tier === 'subject+field' ? 'bg-blue-100/50 text-[#1e293b]' :
                    retrievedChunks[0].search_tier === 'subject-only' ? 'bg-blue-50/60 text-[#475569]' :
                    'bg-gray-200 text-[#94a3b8]'
                  }`}>
                    {retrievedChunks[0].search_tier === 'subject+field' ? '科目+分野' :
                     retrievedChunks[0].search_tier === 'subject-only' ? '科目のみ' : 'グローバル'}
                  </span>
                )}
              </div>
              {retrievedChunks.map((c, i) => (
                <div key={i} className="py-2 border-b border-blue-200/50 last:border-0 text-xs flex items-start gap-2">
                  <span className="text-gray-300 font-mono flex-shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {c.subject && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100/60 text-[#1e293b] mr-1">{c.subject}</span>
                    )}
                    <span className="text-[#94a3b8] leading-relaxed">
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
            <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-[#1e2d4a] shadow-sm">
              <div className="px-6 pt-6 pb-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="icon-premium w-10 h-10 text-white">
                    <Icons.Prompt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">作成された指示文</h3>
                    <p className="text-[11px] text-[#64748b]">{finalPrompt.length.toLocaleString()} 文字{ragSkipped ? '（参照なし）' : ragPrompt ? '（参照済み）' : ''}</p>
                  </div>
                </div>
                <TextArea value={finalPrompt} onChange={ragPrompt ? setRagPrompt : setBasePrompt} rows={6} />
                <div className="flex items-center gap-3 mt-3">
                  <CopyButton text={finalPrompt} onCopied={setStatus} />
                  <Button variant="secondary" size="sm" onClick={() => setActiveSection('execute')}>
                    次へ進む <Icons.ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         実行
         ════════════════════════════════════════════════════════ */}
      {activeSection === 'execute' && (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-[#1e2d4a] shadow-sm">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-premium w-10 h-10 text-white">
                  <Icons.Prompt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">AIに指示文を送る</h3>
                  <p className="text-[11px] text-[#64748b]">① コピー → ② AIを開く → ③ 貼り付けて実行</p>
                </div>
              </div>
            <div className="p-4 bg-blue-100/60 rounded-2xl border border-[#2563eb]/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#2563eb] text-white text-xs font-black">1</div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#1e293b]">まず指示文をコピー</div>
                  <div className="text-[11px] text-[#64748b]">{finalPrompt.length.toLocaleString()} 文字</div>
                </div>
                <CopyButton text={finalPrompt} onCopied={setStatus} label="コピー" />
              </div>
              <pre className="text-xs text-[#64748b] bg-blue-50/60 rounded-xl p-3 max-h-32 overflow-auto custom-scrollbar font-mono leading-relaxed">
                {finalPrompt.slice(0, 500)}{finalPrompt.length > 500 ? '\n...' : ''}
              </pre>
            </div>
            {/* RAG 注入ボタン（未注入の場合に表示） */}
            {!ragPrompt && !ragSkipped && (
              <div className="flex flex-wrap items-center gap-2 mt-3 p-3 bg-blue-100/50 rounded-lg border border-blue-200/50/40">
                <span className="text-xs text-[#475569] font-bold">過去問未参考:</span>
                <Button onClick={injectRag} variant="secondary" size="sm">
                  <Icons.Search className="w-3.5 h-3.5" /> 過去問を参考にする
                </Button>
                <Button onClick={skipRag} variant="ghost" size="sm">過去問なしで進む</Button>
              </div>
            )}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#475569] text-white text-xs font-black">2</div>
                <span className="text-sm font-bold text-[#1e293b]">AIを開いて貼り付け</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { name: 'ChatGPT', url: 'https://chat.openai.com', color: 'from-[#2563eb] to-[#2563eb]' },
                { name: 'Claude', url: 'https://claude.ai', color: 'from-[#3b82f6] to-[#2563eb]' },
                { name: 'Gemini', url: 'https://gemini.google.com', color: 'from-[#3b82f6] to-[#3b82f6]' },
              ].map(({ name, url, color }) => (
                <a key={name} href={url} target="_blank" rel="noreferrer"
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#2563eb] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]`}>
                  {name}
                </a>
              ))}
              </div>
            </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-[#1e2d4a] shadow-sm">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-premium w-10 h-10 text-white">
                  <Icons.File className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">AIの回答を貼り付け</h3>
                  <p className="text-[11px] text-[#64748b]">AIが返した文章をそのままここに貼り付けてください</p>
                </div>
              </div>
            <TextArea value={llmOutput}
              onChange={(v) => { setLlmOutput(v); setParsedProblem(null); setParseError(''); setSavedProblemId(null); }}
              rows={10} placeholder="AIが返した文章をそのままここに貼り付けてください" />
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button onClick={parseLlmOutput} disabled={!llmOutput}>
                <Icons.Search className="w-4 h-4" /> 内容を読み取る
              </Button>
            </div>
            {parseError && (
              <div className="mt-3 p-3 bg-blue-50/60 rounded-lg border border-blue-200/60/40 text-xs text-[#1e293b]">
                <Icons.Info className="w-3.5 h-3.5 inline mr-1" /> {parseError}
              </div>
            )}
            {parsedProblem && (
              <div className="mt-4 p-4 bg-blue-100/60 rounded-lg border border-[#2563eb]/20/40 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1e293b]">
                  <Icons.Success className="w-4 h-4" /> 読み取り結果
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
                      <span className="font-medium text-[#1e293b] flex-shrink-0 min-w-[80px]">{k}:</span>
                      <span className="text-[#94a3b8] break-all">
                        {typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 200)}{String(v).length > 200 ? '...' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         評価・保存
         ════════════════════════════════════════════════════════ */}
      {activeSection === 'evaluate' && (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-[#1e2d4a] shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="icon-premium w-10 h-10 text-white">
                  <Icons.Chart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">出来栄えを確認</h3>
                  <p className="text-[11px] text-[#64748b]">生成された問題の出来を確認して、次回のために記録します</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-3">出来栄え</label>
                  <QualityRating score={tuningScore ? Number(tuningScore) : ''} onChange={(v) => setTuningScore(String(v))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">メモ</label>
                    <input value={tuningNotes} onChange={(e) => setTuningNotes(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-blue-200/50 bg-[#111827] shadow-sm text-sm text-[#e2e8ff]
                        transition-all hover:border-blue-300/50 hover:shadow-md focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/30 outline-none font-medium"
                      placeholder="例: 難しさは良い。でも解説がもう少し欲しい。" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">こうなって欲しかった <span className="text-[#94a3b8] normal-case tracking-normal">（任意）</span></label>
                    <input value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-blue-200/50 bg-[#111827] shadow-sm text-sm text-[#e2e8ff]
                        transition-all hover:border-blue-300/50 hover:shadow-md focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/30 outline-none font-medium"
                      placeholder="こんな問題が作られたら良かった、というイメージ" />
                  </div>
                </div>

                {/* 保存先情報 */}
                <div className="flex items-center gap-2 p-3 bg-blue-50/60 rounded-xl border border-[#2563eb]/10">
                  <svg className="w-4 h-4 text-[#1e293b] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
                  </svg>
                  <span className="text-[11px] text-[#1e293b] font-medium">記録は自動保存されます。ブラウザを閉じても失われません。</span>
                </div>

                <Button onClick={saveLog} disabled={!llmOutput}>
                  <Icons.Success className="w-4 h-4" /> 出来栄えを記録する
                </Button>
              </div>
            </div>
          </div>



          <div className="relative overflow-hidden rounded-3xl bg-[#111827] border border-[#1e2d4a] shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#2563eb] text-white shadow-md">
                  <Icons.Data className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">問題を保存</h3>
                  <p className="text-[11px] text-[#64748b]">AIの回答を保存します（答え合わせも自動で行います）</p>
                </div>
              </div>
            {parsedProblem ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50/60 rounded-lg border border-blue-200/50 text-xs space-y-1.5">
                  {parsedProblem.stem && (
                    <div><span className="font-bold text-[#94a3b8]">問題:</span> <span className="text-[#64748b]">{parsedProblem.stem.slice(0, 200)}{parsedProblem.stem.length > 200 ? '...' : ''}</span></div>
                  )}
                  {parsedProblem.final_answer && (
                    <div><span className="font-bold text-[#64748b]">解答:</span> <span className="text-[#1e293b] font-bold">{parsedProblem.final_answer}</span></div>
                  )}
                  {parsedProblem.checks && (
                    <div className="flex gap-3 mt-1">
                      {parsedProblem.checks.map((c, i) => (
                        <span key={i} className={`text-xs ${c.ok ? 'text-[#1e293b]' : 'text-[#1e293b]'}`}>
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
                      ? 'bg-blue-100/60 border-[#2563eb]/20 text-[#1e293b]'
                      : 'bg-blue-50/60 border-blue-200/60 text-[#1e293b]'
                  }`}>
                    {verificationResult.verified
                      ? <><Icons.Success className="w-4 h-4" /> 答え合わせ OK: {verificationResult.expected} = {verificationResult.computed}</>
                      : <><Icons.Info className="w-4 h-4" /> 答えが一致しません: 期待={verificationResult.expected}, 実際={verificationResult.computed}</>}
                  </div>
                )}
                {savedProblemId && (
                  <div className="p-3 bg-blue-100/60 rounded-lg border border-[#2563eb]/20 text-sm text-[#1e293b] font-semibold flex items-center gap-2">
                    <Icons.Success className="w-4 h-4" /> 保存済み — ID: {savedProblemId}
                  </div>
                )}
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-3 bg-blue-100/60 text-[#1e293b] rounded-lg border border-blue-200/50 font-bold text-sm hover:bg-blue-100/50 transition-colors">
                    <Icons.Pdf className="w-4 h-4" /> PDF プレビューを開く
                  </a>
                )}
              </div>
            ) : (
              <EmptyState title="まだ読み取ったデータがありません" description="「AIに送る」タブでAIの回答を貼り付け、「内容を読み取る」を押してください" />
            )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-4">
            <Button variant="ghost" onClick={() => setActiveSection('configure')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              出題パターンに戻る
            </Button>
            <span className="text-xs text-gray-300">|</span>
            <Button variant="ghost" onClick={resetAll}>最初からやり直す</Button>
          </div>
        </div>
      )}
      <MobileNavLinks currentPath="/dev" />
    </div>
  );
}
