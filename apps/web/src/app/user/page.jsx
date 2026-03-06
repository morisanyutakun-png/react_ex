'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { renderTemplate, generatePdf, fetchLatexPresets, generateWithLlm, searchProblems, createTemplate, deleteTemplate, DIAGRAM_PACKAGE_DEFS, fetchUsage, adminUnlock, validateBasePdf, fetchProblemsByPattern } from '@/lib/api';
import {
  StatusBar,
  SectionCard,
  TextArea,
  Button,
  CopyButton,
  NumberField,
  SelectField,
  ProgressSteps,
  Icons,
} from '@/components/ui';
import { SUBJECTS, SUBJECT_TOPICS, DIFFICULTIES, QUESTION_FORMATS, difficultyLabel, buildTemplatePrompt, buildTemplateId } from '@/lib/constants';
import { LatexText } from '@/components/LatexRenderer';

/* ── ウィザードステップ定義（9ステップ） ── */
const STEPS = ['出題パターン', '難易度・問題数', 'ベース問題', '出力形式', '図表・パッケージ', 'オプション', '確認', '生成', '完成'];

/* ── 各図表タイプのASCIIアートプレビュー ── */
const PACKAGE_ILLUSTRATIONS = {
  tikz: ` A ──► B
 │       │
 ▼       ▼
 C ──► D
 △  ○  □  ◇`,
  circuitikz: `┌──[R]──┤├──┐
│            │
[+]         GND
│            │
└────────────┘`,
  pgfplots: `y^│    ·˙·
  │  ·     ·
  │·         ·
  └────────── x
    関数グラフ`,
  'tikz-cd': `A ──f──► B
│          │
g          h
│          │
▼          ▼
C ──k──► D`,
  forest: `     ┌─ 表
  ┌表─┤
  │   └─ 裏
──┤
  │   ┌─ 表
  └裏─┤
      └─ 裏`,
  listings: `def f(n):
  if n == 0:
    return 1
  return n * f(n-1)`,
  tabularx: `┌──────┬─────┐
│ 科目 │ 点数│
├──────┼─────┤
│ 数学 │  85 │
│ 英語 │  92 │
└──────┴─────┘`,
};

/* ── 各PDF形式のビジュアルサムネイルコンポーネント ── */
const PresetThumbnail = ({ id, active }) => {
  const base = active ? 'text-[#1e293b]' : 'text-[#64748b]';
  const bg = active ? 'bg-[#2563eb]/[0.08]' : 'bg-blue-50/60';
  const accent = active ? 'bg-[#2563eb]/[0.10]' : 'bg-[#d1d1d6]';
  const accentStrong = active ? 'bg-[#2563eb]/[0.25]' : 'bg-[#94a3b8]';
  const borderC = active ? 'border-[#2563eb]/20' : 'border-blue-200/60';

  const thumbnails = {
    exam: (
      <div className={`${bg} rounded-lg p-3 h-28 flex flex-col gap-1.5 border ${borderC}`}>
        <div className="flex items-center justify-between">
          <div className={`h-2.5 w-16 rounded ${accentStrong}`} />
          <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${active ? 'bg-[#2563eb]/[0.10] text-[#1e293b]' : 'bg-blue-100/50 text-[#64748b]'}`}>100点</div>
        </div>
        <div className={`h-1 w-full rounded ${accent} opacity-40`} />
        <div className="flex-1 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-4 h-4 rounded-full ${accentStrong} flex items-center justify-center text-[#1e293b] text-[7px] font-bold`}>1</div>
              <div className={`h-1.5 flex-1 rounded ${accent}`} />
            </div>
            <div className={`ml-5.5 h-1 w-3/4 rounded ${accent} opacity-60`} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-4 h-4 rounded-full ${accentStrong} flex items-center justify-center text-[#1e293b] text-[7px] font-bold`}>2</div>
              <div className={`h-1.5 flex-1 rounded ${accent}`} />
            </div>
            <div className={`ml-5.5 h-1 w-2/3 rounded ${accent} opacity-60`} />
          </div>
        </div>
        <div className={`h-1 w-full rounded ${accent} opacity-20`} />
        <div className={`h-1 w-1/2 rounded ${accent} opacity-40`} />
      </div>
    ),
    worksheet: (
      <div className={`${bg} rounded-lg p-3 h-28 flex flex-col gap-1.5 border ${borderC}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className={`text-[7px] font-bold ${base}`}>名前</span>
            <div className={`h-0.5 w-12 ${accent} rounded`} />
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[7px] font-bold ${base}`}>日付</span>
            <div className={`h-0.5 w-8 ${accent} rounded`} />
          </div>
        </div>
        <div className={`text-center text-[8px] font-bold ${base} py-0.5`}>学習プリント</div>
        <div className="flex-1 space-y-2">
          {[1, 2].map(n => (
            <div key={n} className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className={`text-[7px] font-bold ${base}`}>{n}.</span>
                <div className={`h-1.5 flex-1 rounded ${accent}`} />
              </div>
              <div className={`ml-3 h-3 rounded border-b-2 ${borderC}`} />
            </div>
          ))}
        </div>
      </div>
    ),
    flashcard: (
      <div className={`${bg} rounded-lg p-3 h-28 flex flex-col border ${borderC}`}>
        <div className="grid grid-cols-2 gap-0 flex-1 rounded overflow-hidden border" style={{ borderColor: active ? '#fca5a5' : '#d1d1d6' }}>
          <div className={`text-[7px] font-bold text-center py-1 ${active ? 'bg-[#2563eb]/[0.10] text-[#1e293b]' : 'bg-blue-100/50 text-[#64748b]'} border-r ${borderC}`}>問題</div>
          <div className={`text-[7px] font-bold text-center py-1 ${active ? 'bg-[#2563eb]/[0.10] text-[#1e293b]' : 'bg-blue-100/50 text-[#64748b]'}`}>解答</div>
          {[1, 2, 3].map(n => (
            <React.Fragment key={n}>
              <div className={`px-2 py-1.5 border-t border-r ${borderC} flex items-center`}>
                <div className={`h-1 w-full rounded ${accent}`} />
              </div>
              <div className={`px-2 py-1.5 border-t ${borderC} flex items-center`}>
                <div className={`h-1 w-3/4 rounded ${accent} opacity-60`} />
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    ),
    mock_exam: (
      <div className={`${bg} rounded-lg p-3 h-28 flex flex-col gap-1 border ${borderC}`}>
        <div className="flex items-center justify-between">
          <div className={`text-[8px] font-bold ${base}`}>模擬試験</div>
          <div className={`text-[7px] px-1.5 py-0.5 rounded ${active ? 'bg-[#2563eb]/[0.10] text-[#1e293b]' : 'bg-blue-100/50 text-[#64748b]'} font-bold`}>60分</div>
        </div>
        <div className={`p-1.5 rounded ${active ? 'bg-[#2563eb]/[0.10]/50' : 'bg-blue-100/50/50'} text-[6px] ${base}`}>
          【注意事項】解答用紙に記入
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <span className={`text-[7px] font-bold ${base}`}>第1問</span>
              <span className={`text-[6px] ${base} opacity-60`}>(30点)</span>
            </div>
            <div className="ml-2 space-y-0.5">
              <div className={`h-1 w-full rounded ${accent}`} />
              <div className={`h-1 w-4/5 rounded ${accent} opacity-60`} />
            </div>
          </div>
        </div>
      </div>
    ),
    report: (
      <div className={`${bg} rounded-lg p-3 h-28 flex flex-col gap-1 border ${borderC}`}>
        <div className={`h-2 w-12 rounded ${accentStrong}`} />
        <div className="flex-1 space-y-1.5">
          {['問題', '解法', 'ポイント'].map((label, i) => (
            <div key={label} className="space-y-0.5">
              <div className={`text-[6px] font-bold px-1 py-0.5 rounded ${active ? 'bg-[#2563eb]/[0.10] text-[#1e293b]' : 'bg-blue-100/50 text-[#64748b]'} inline-block`}>
                {label}
              </div>
              <div className={`h-1 rounded ${accent} ${i === 1 ? 'w-full' : 'w-3/4'}`} />
            </div>
          ))}
        </div>
      </div>
    ),
    minimal: (
      <div className={`${bg} rounded-lg p-3 h-28 flex flex-col justify-center gap-3 border ${borderC}`}>
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-1.5">
            <span className={`text-[7px] font-bold ${base}`}>問{n}.</span>
            <div className={`h-1.5 flex-1 rounded ${accent}`} />
          </div>
        ))}
      </div>
    ),
  };

  return thumbnails[id] || null;
};

export default function UserModePage() {
  const { templates, subjects, refresh } = useTemplates();

  // 科目アイコン（SVG）
  const SubjectIcon = useCallback(({ type, className = "w-4 h-4" }) => {
    const icons = {
      '数学': ( // 幾何学的な図形（∑記号風）
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h6l-6 8 6 8H4" /><path d="M14 12h6" /><path d="M14 6h6" /><path d="M14 18h6" />
        </svg>
      ),
      '物理': ( // 原子モデル
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="12" cy="12" r="2" fill="currentColor" /><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
        </svg>
      ),
      '化学': ( // フラスコ
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3h6v5.172a2 2 0 01-.586 1.414l-.828.828A2 2 0 0013 11.828V17a4 4 0 01-2 3.464A4 4 0 019 17v-5.172a2 2 0 00-.586-1.414l-.828-.828A2 2 0 017 8.172V3" /><path d="M9 3h6" /><path d="M7.5 16h9" />
        </svg>
      ),
      '英語': ( // 地球＋言語
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      ),
      '生物': ( // DNA二重螺旋
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M7 4a8 8 0 005 7.5A8 8 0 0017 4" /><path d="M7 20a8 8 0 005-7.5A8 8 0 0017 20" /><path d="M8 6h8" /><path d="M8 18h8" /><path d="M7 12h10" />
        </svg>
      ),
      '情報': ( // ターミナル/コード
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
      '国語': ( // 筆（ブラシ）
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 2l4 4-9.5 9.5a4 4 0 01-2 1.1L6 18l1.4-4.5a4 4 0 011.1-2L18 2z" /><path d="M6 18v4h4" />
        </svg>
      ),
      '社会': ( // ランドマーク/柱
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" fill="none" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      ),
      '地学': ( // 地層/山
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3l4 8 5-5 4 14H3z" /><path d="M4.14 15.08C5 14 6 13.5 7 13.5c2 0 3.5 2.5 5 2.5s2.5-1 4-1 2.5.5 4 2" />
        </svg>
      ),
      '理科': ( // 顕微鏡風（レンズ＋光線）
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" />
        </svg>
      ),
    };
    return icons[type] || <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /></svg>;
  }, []);

  // 科目カラー定義（共通）
  const SUBJECT_COLOR_MAP = useMemo(() => ({
    '数学': { bg: 'from-[#3b82f6] to-[#2563eb]', light: '#3b82f6', icon: '数学', bgLight: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    '物理': { bg: 'from-[#8b5cf6] to-[#7c3aed]', light: '#8b5cf6', icon: '物理', bgLight: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    '化学': { bg: 'from-[#10b981] to-[#059669]', light: '#10b981', icon: '化学', bgLight: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    '英語': { bg: 'from-[#f59e0b] to-[#d97706]', light: '#f59e0b', icon: '英語', bgLight: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    '生物': { bg: 'from-[#22c55e] to-[#16a34a]', light: '#22c55e', icon: '生物', bgLight: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    '情報': { bg: 'from-[#06b6d4] to-[#0891b2]', light: '#06b6d4', icon: '情報', bgLight: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    '国語': { bg: 'from-[#ec4899] to-[#db2777]', light: '#ec4899', icon: '国語', bgLight: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
    '社会': { bg: 'from-[#f97316] to-[#ea580c]', light: '#f97316', icon: '社会', bgLight: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    '地学': { bg: 'from-[#14b8a6] to-[#0d9488]', light: '#14b8a6', icon: '地学', bgLight: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    '理科': { bg: 'from-[#6366f1] to-[#4f46e5]', light: '#6366f1', icon: '理科', bgLight: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  }), []);
  const getSubjectColor = useCallback((subj) => SUBJECT_COLOR_MAP[subj] || { bg: 'from-[#64748b] to-[#475569]', light: '#64748b', icon: '—', bgLight: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }, [SUBJECT_COLOR_MAP]);

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

  const toggleSubjectGroup = useCallback((subj) => {
    setExpandedSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj]
    );
  }, []);

  // テンプレートが1教科しかない場合は自動展開
  useEffect(() => {
    const subjects = Object.keys(groupedTemplates);
    if (subjects.length <= 2) {
      setExpandedSubjects(subjects);
    }
  }, [groupedTemplates]);

  /* ── AI使用回数制限 ── */
  const [userId] = useState(() => {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem('rem_user_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('rem_user_id', id); }
    return id;
  });
  const [usage, setUsage] = useState({ generation_count: 0, limit: 3, remaining: 3, unlocked: false });
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // 使用状況取得
  useEffect(() => {
    if (!userId) return;
    fetchUsage(userId).then(setUsage).catch(() => {});
  }, [userId]);

  const handleAdminUnlock = async () => {
    setUnlockError('');
    try {
      const res = await adminUnlock(userId, unlockPassword);
      if (res.usage) setUsage(res.usage);
      setShowUnlockModal(false);
      setUnlockPassword('');
      setStatus('AI使用制限が解除されました');
    } catch (e) {
      setUnlockError(e.message || 'パスワードが正しくありません');
    }
  };

  /* ── ウィザード状態 ── */
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState('');

  /* ── テンプレート新規作成 ── */
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState([]);
  const [newTplSubject, setNewTplSubject] = useState('');
  const [newTplCustomSubject, setNewTplCustomSubject] = useState('');
  const [newTplField, setNewTplField] = useState('');
  const [newTplTheme, setNewTplTheme] = useState('');
  const [newTplDifficulty, setNewTplDifficulty] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const effectiveNewSubject = newTplSubject === '__custom' ? newTplCustomSubject : newTplSubject;
  const newTplFieldOptions = (newTplSubject && newTplSubject !== '__custom' && SUBJECT_TOPICS[newTplSubject])
    ? SUBJECT_TOPICS[newTplSubject] : [];

  const handleCreateTemplate = async () => {
    if (!effectiveNewSubject) { setStatus('教科を選択してください'); return; }
    if (!newTplDifficulty) { setStatus('難易度を選択してください'); return; }
    const f = newTplField;
    const label = f ? `${effectiveNewSubject}（${f}）` : effectiveNewSubject;
    const id = buildTemplateId(effectiveNewSubject, f);
    setCreatingTemplate(true);
    setStatus(`出題パターン「${label}」を作成中...`);
    try {
      await createTemplate({
        id,
        name: `${label} 出題パターン`,
        description: `${label} の問題を生成する出題パターン`,
        prompt: buildTemplatePrompt(effectiveNewSubject, f, { theme: newTplTheme }),
        metadata: { subject: effectiveNewSubject, field: f || null, theme: newTplTheme || null, subtopic: newTplTheme || null, difficulty: newTplDifficulty, auto_generated: true },
      });
      await refresh();
      setTemplateId(id);
      setSubject(effectiveNewSubject);
      if (f) setField(f);
      setDifficulty(newTplDifficulty);
      setStatus(`出題パターン「${label}」を作成しました`);
      setShowCreateTemplate(false);
      setNewTplSubject(''); setNewTplCustomSubject(''); setNewTplField(''); setNewTplTheme(''); setNewTplDifficulty('');
    } catch (e) { setStatus(`作成失敗: ${e.message}`); }
    setCreatingTemplate(false);
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('この出題パターンを削除しますか？')) return;
    try {
      await deleteTemplate(id);
      await refresh();
      if (templateId === id) setTemplateId('');
      setStatus('出題パターンを削除しました');
    } catch (e) { setStatus(`削除失敗: ${e.message}`); }
  };

  /* ── フォーム状態 ── */
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [field, setField] = useState('');
  const [theme, setTheme] = useState('');
  const [difficulty, setDifficulty] = useState('標準');
  const [numQuestions, setNumQuestions] = useState(1);
  const [topK, setTopK] = useState(5);
  const [latexPresets, setLatexPresets] = useState([]);
  const [latexPreset, setLatexPreset] = useState('exam');
  const [questionFormat, setQuestionFormat] = useState('standard');
  const [includeDiagramPerQuestion, setIncludeDiagramPerQuestion] = useState(false);
  const [customRequest, setCustomRequest] = useState('');
  const CUSTOM_REQUEST_MAX_LENGTH = 200;

  /* ── 生成結果 ── */
  const [prompt, setPrompt] = useState('');
  const [renderContext, setRenderContext] = useState(null);
  const [generatedLatex, setGeneratedLatex] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [pdfWorking, setPdfWorking] = useState(false);

  /* ── 手動モード用 ── */
  const [llmOutput, setLlmOutput] = useState('');
  const [mode, setMode] = useState('auto'); // 'auto' | 'manual'

  /* ── ベース問題DB検索 ── */
  const [baseFilterQuery, setBaseFilterQuery] = useState('');
  const [selectedBaseProblem, setSelectedBaseProblem] = useState(null);
  const baseSearchInputRef = useRef(null);

  /* ── ベース問題選択モード ── */
  const [baseMode, setBaseMode] = useState('skip'); // 'db' | 'pdf' | 'skip'
  const [basePdfFile, setBasePdfFile] = useState(null);
  const [basePdfImages, setBasePdfImages] = useState([]); // base64 PNG images
  const [basePdfPageCount, setBasePdfPageCount] = useState(0);
  const [basePdfError, setBasePdfError] = useState('');
  const [basePdfExtractedText, setBasePdfExtractedText] = useState('');
  const [basePdfUploading, setBasePdfUploading] = useState(false);
  const basePdfInputRef = useRef(null);

  /* ── スクロール用refs ── */
  const wizardTopRef = useRef(null);
  const nextActionRef = useRef(null);

  /* ── テンプレート合致問題（自動取得） ── */
  const [matchedProblems, setMatchedProblems] = useState([]);
  const [matchedLoading, setMatchedLoading] = useState(false);

  /* ── フィルタ済み問題リスト ── */
  const filteredProblems = baseFilterQuery.trim()
    ? matchedProblems.filter((item) => {
        const q = baseFilterQuery.trim().toLowerCase();
        const text = (item.stem || item.text || '').toLowerCase();
        const topic = (item.topic || item.metadata?.field || '').toLowerCase();
        return text.includes(q) || topic.includes(q);
      })
    : matchedProblems;

  /* ── ベース問題（過去問）参照: 選択された問題のテキストを sourceText として使う ── */
  const sourceText = selectedBaseProblem?.stem || selectedBaseProblem?.text || '';

  /* ── テンプレート合致問題を自動取得 ── */
  useEffect(() => {
    if (!subject) return;
    let cancelled = false;
    const fetchMatched = async () => {
      setMatchedLoading(true);
      try {
        const params = { limit: 15 };
        if (subject) params.subject = subject;
        if (field) params.topic = field;
        const data = await searchProblems(params);
        const items = data.results || data.problems || data || [];
        if (!cancelled) setMatchedProblems(Array.isArray(items) ? items : []);
      } catch {
        if (!cancelled) setMatchedProblems([]);
      }
      if (!cancelled) setMatchedLoading(false);
    };
    fetchMatched();
    return () => { cancelled = true; };
  }, [subject, field]);

  /* ── 図表パッケージ ── */
  const [extraPackages, setExtraPackages] = useState([]);
  const [customPackage, setCustomPackage] = useState('');

  const togglePackage = (id) =>
    setExtraPackages((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );

  const addCustomPackage = () => {
    const pkg = customPackage.trim().toLowerCase().replace(/\s+/g, '-');
    if (pkg && !extraPackages.includes(pkg)) {
      setExtraPackages((prev) => [...prev, pkg]);
    }
    setCustomPackage('');
  };

  useEffect(() => {
    fetchLatexPresets()
      .then((presets) => setLatexPresets(presets))
      .catch(() => {
        setLatexPresets([
          { id: 'exam', name: '試験問題', description: '定期テスト・入試形式' },
          { id: 'worksheet', name: '学習プリント', description: '演習用ワークシート' },
          { id: 'flashcard', name: '一問一答カード', description: 'フラッシュカード形式' },
          { id: 'mock_exam', name: '模試', description: '模擬試験形式' },
          { id: 'report', name: 'レポート・解説', description: '解説重視のレポート形式' },
          { id: 'minimal', name: 'シンプル', description: '最小限のプレーンな形式' },
        ]);
      });
  }, []);

  useEffect(() => {
    if (templates.length > 0 && !templateId) {
      const first = templates[0];
      setTemplateId(first.id || '');
      if (first.metadata?.subject) setSubject(first.metadata.subject);
      if (first.metadata?.field) setField(first.metadata.field);
      if (first.metadata?.difficulty) setDifficulty(first.metadata.difficulty);
    }
  }, [templates, templateId]);

  /* ── Step変更時: ページトップへスムーズスクロール ── */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const onSelectTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl?.metadata) {
      if (tpl.metadata.subject) {
        setSubject(tpl.metadata.subject);
        // 選択した教科のグループを自動展開
        setExpandedSubjects((prev) =>
          prev.includes(tpl.metadata.subject) ? prev : [...prev, tpl.metadata.subject]
        );
      }
      if (tpl.metadata.field) setField(tpl.metadata.field);
      if (tpl.metadata.theme) setTheme(tpl.metadata.theme);
      if (tpl.metadata.difficulty) setDifficulty(tpl.metadata.difficulty);
    }
    // 選択後「次へ」ボタンへスムーズスクロール
    setTimeout(() => {
      nextActionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  };

  const selectedTemplate = templates.find((t) => t.id === templateId) || null;

  /* ── AI自動生成: プロンプト→OpenAI→LaTeX→PDF ── */
  const handleAutoGenerate = async () => {
    if (!templateId) {
      setStatus('出題パターンを選んでください');
      return;
    }
    // 使用回数チェック
    if (!usage.unlocked && usage.remaining <= 0) {
      setShowUnlockModal(true);
      return;
    }
    setGenerating(true);
    setGeneratedLatex('');
    setPdfUrl('');
    setStep(8);

    setStatus('ステップ 1/3: AIへの指示文を作成中...');
    let generatedPrompt = '';
    try {
      const renderParams = {
        template_id: templateId,
        subject,
        difficulty,
        num_questions: numQuestions,
        rag_inject: true,
        subject_filter: subject,
        field_filter: field || undefined,
        user_mode: true,
        top_k: topK,
        latex_preset: latexPreset,
        extra_packages: extraPackages,
        question_format: questionFormat,
        sub_topic: theme || undefined,
        include_diagram_per_question: extraPackages.includes('tikz') && includeDiagramPerQuestion,
        custom_request: customRequest.trim() || undefined,
        ...(sourceText.trim() ? { source_text: sourceText.trim() } : {}),
      };
      // ベース問題テキストをプロンプト生成にも反映
      if (baseMode === 'db' && selectedBaseProblem) {
        renderParams.base_problem_text = selectedBaseProblem.stem || selectedBaseProblem.text || '';
      }
      const data = await renderTemplate(renderParams);
      generatedPrompt = data.rendered_prompt || data.rendered || '';
      setRenderContext(data.context || null);
      setPrompt(generatedPrompt);

      // RAGフィードバックをステータスに反映
      const ctx = data.context;
      if (ctx?.rag_status === 'ok' && ctx?.rag_retrieved > 0) {
        setStatus(`ステップ 1/3 完了: 過去問 ${ctx.rag_retrieved}件を参照`);
      } else if (ctx?.rag_status === 'no_data') {
        setStatus('ステップ 1/3 完了: AIのみで生成（過去問登録で精度UP）');
      } else if (ctx?.rag_status === 'fallback') {
        setStatus(`ステップ 1/3 完了: 過去問 ${ctx?.rag_retrieved || ctx?.chunk_count || 0}件を参照`);
      } else {
        setStatus('ステップ 1/3 完了');
      }
    } catch (e) {
      setStatus(`指示文の作成に失敗しました: ${e.message}`);
      setGenerating(false);
      return;
    }

    if (!generatedPrompt?.trim()) {
      setStatus('指示文の作成に失敗しました');
      setGenerating(false);
      return;
    }

    setStatus('ステップ 2/3: AI が問題を生成中...');
    try {
      const llmParams = {
        prompt: generatedPrompt,
        latex_preset: latexPreset,
        title: `${subject} - ${difficulty}`,
        extra_packages: extraPackages,
        subject: subject || '',
        field: field || '',
        question_format: questionFormat,
        sub_topic: theme || '',
        include_diagram_per_question: extraPackages.includes('tikz') && includeDiagramPerQuestion,
        custom_request: customRequest.trim() || undefined,
        user_id: userId,
      };
      // ベース問題（PDF or DB）の情報を付与
      if (baseMode === 'pdf' && basePdfImages.length > 0) {
        llmParams.base_pdf_images = basePdfImages;
      } else if (baseMode === 'db' && selectedBaseProblem) {
        llmParams.base_problem_text = selectedBaseProblem.stem || selectedBaseProblem.text || '';
      }
      const data = await generateWithLlm(llmParams);

      if (data?.error) {
        setStatus(`生成エラー: ${data.error}`);
        setGenerating(false);
        return;
      }

      if (data?.latex) {
        setGeneratedLatex(data.latex);
        setLlmOutput(data.latex);
      }

      if (data?.pdf_url) {
        setPdfUrl(data.pdf_url);
        window.open(data.pdf_url, '_blank');
        setStatus('PDF を生成・表示しました');
        setStep(9);
      } else if (data?.pdf_error) {
        setStatus(`問題の生成は成功 / PDF 変換失敗: ${data.pdf_error}`);
        setStep(9);
      } else {
        setStatus('問題の生成完了（PDF エンジン未設定）');
        setStep(9);
      }
    } catch (e) {
      // 429 = 使用回数上限
      if (e.data?.usage || e.message?.includes('無料利用回数')) {
        if (e.data?.usage) setUsage(e.data.usage);
        setShowUnlockModal(true);
        setStatus('AI生成の無料利用回数に達しました');
      } else {
        setStatus(`生成エラー: ${e.message}`);
      }
    }
    // 使用状況を更新
    if (userId) fetchUsage(userId).then(setUsage).catch(() => {});
    setGenerating(false);
  };

  /* ── 手動: プロンプト生成 → 自動コピー ── */
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptGenerating, setPromptGenerating] = useState(false);
  const generatePrompt = async () => {
    if (!templateId) {
      setStatus('出題パターンを選んでください');
      return;
    }
    setPromptCopied(false);
    setPromptGenerating(true);
    setStatus('AIへの指示文を作成中...');
    try {
      const manualRenderParams = {
        template_id: templateId,
        subject,
        difficulty,
        num_questions: numQuestions,
        rag_inject: true,
        subject_filter: subject,
        field_filter: field || undefined,
        user_mode: true,
        top_k: topK,
        latex_preset: latexPreset,
        extra_packages: extraPackages,
        question_format: questionFormat,
        sub_topic: theme || undefined,
        include_diagram_per_question: extraPackages.includes('tikz') && includeDiagramPerQuestion,
        custom_request: customRequest.trim() || undefined,
        ...(sourceText.trim() ? { source_text: sourceText.trim() } : {}),
      };
      // ベース問題テキストをプロンプトに反映
      if (baseMode === 'db' && selectedBaseProblem) {
        manualRenderParams.base_problem_text = selectedBaseProblem.stem || selectedBaseProblem.text || '';
      }
      const data = await renderTemplate(manualRenderParams);
      setRenderContext(data.context || null);
      const generatedText = data.rendered_prompt || data.rendered || '';
      setPrompt(generatedText);

      // 自動でクリップボードにコピー
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(generatedText);
        } else {
          const ta = document.createElement('textarea');
          ta.value = generatedText;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setPromptCopied(true);
      } catch { /* clipboard blocked — ユーザーが手動コピー可能 */ }

      setStatus(
        data.context?.chunk_count
          ? `指示文をコピーしました（過去問 ${data.context.chunk_count}件を参考）`
          : '指示文をクリップボードにコピーしました'
      );
      setPromptGenerating(false);
      setStep(9);
    } catch (e) {
      setStatus(`エラー: ${e.message}`);
      setPromptGenerating(false);
    }
  };

  /* ── 手動PDF変換 ── */
  const compilePdf = async (latex) => {
    const src = latex || llmOutput;
    if (!src?.trim()) {
      setStatus('内容を入力してください');
      return;
    }
    setPdfWorking(true);
    setStatus('PDF を生成中...');
    try {
      const data = await generatePdf(src);
      if (data?.pdf_url) {
        setPdfUrl(data.pdf_url);
        window.open(data.pdf_url, '_blank');
        setStatus('PDF を開きました');
      } else if (data?.error) {
        setStatus(`PDF 生成失敗: ${data.error}`);
      } else {
        setStatus('PDF 生成失敗: サーバーの設定を確認してください');
      }
    } catch (e) {
      setStatus(`PDF 生成失敗: ${e.message}`);
    }
    setPdfWorking(false);
  };

  /* ── 次/前ステップ ── */
  /* 新ステップ: 1=出題パターン, 2=難易度・問題数, 3=ベース問題, 4=出力形式, 5=図表, 6=オプション, 7=確認, 8=生成, 9=完成 */
  const canNext = () => {
    if (step === 1) return !!templateId || templates.length === 0;
    if (step === 2) return !!difficulty;
    if (step === 3) return true;  // ベース問題（任意）
    if (step === 4) return true;  // 出力形式
    if (step === 5) return true;  // 図表（任意）
    if (step === 6) return true;  // オプション
    if (step === 7) return true;  // 確認
    return false;
  };

  const goNext = () => {
    // Step 7（確認）で「生成」を実行
    if (step === 7 && mode === 'auto') {
      if (!templateId) {
        const id = buildTemplateId(subject, field);
        const f = field;
        const label = f ? `${subject}（${f}）` : subject;
        createTemplate({
          id,
          name: `${label} 出題パターン`,
          description: `${label} の問題を生成する出題パターン`,
          prompt: buildTemplatePrompt(subject, f, { theme }),
          metadata: { subject, field: f || null, theme: theme || null, subtopic: theme || null, difficulty, auto_generated: true },
        }).then(() => {
          setTemplateId(id);
          refresh().then(() => handleAutoGenerate());
        }).catch(() => {
          setStatus('テンプレート作成に失敗しました');
        });
      } else {
        handleAutoGenerate();
      }
    } else if (step === 7 && mode === 'manual') {
      if (!templateId) {
        const id = buildTemplateId(subject, field);
        const f = field;
        const label = f ? `${subject}（${f}）` : subject;
        createTemplate({
          id,
          name: `${label} 出題パターン`,
          description: `${label} の問題を生成する出題パターン`,
          prompt: buildTemplatePrompt(subject, f, { theme }),
          metadata: { subject, field: f || null, theme: theme || null, subtopic: theme || null, difficulty, auto_generated: true },
        }).then(() => {
          setTemplateId(id);
          refresh().then(() => generatePrompt());
        }).catch(() => {
          setStatus('テンプレート作成に失敗しました');
        });
      } else {
        generatePrompt();
      }
    } else if (canNext()) {
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 1 && step <= 7) {
      setStep(step - 1);
    }
    if (step === 9) setStep(7);
  };

  const resetWizard = () => {
    setStep(1);
    setGeneratedLatex('');
    setPdfUrl('');
    setPrompt('');
    setRenderContext(null);
    setLlmOutput('');
    setStatus('');
    setSelectedBaseProblem(null);
    setBaseFilterQuery('');
    setMatchedProblems([]);
    setQuestionFormat('standard');
    setIncludeDiagramPerQuestion(false);
    setCustomRequest('');
    setBaseMode('skip');
    setBasePdfFile(null);
    setBasePdfImages([]);
    setBasePdfPageCount(0);
    setBasePdfError('');
    setBasePdfExtractedText('');
  };

  /* ── ベースPDFアップロード処理 ── */
  const handleBasePdfUpload = async (file) => {
    if (!file) return;
    setBasePdfError('');
    setBasePdfExtractedText('');
    setBasePdfUploading(true);
    setBasePdfFile(file);
    try {
      const result = await validateBasePdf(file);
      if (!result.valid) {
        setBasePdfError(result.error || 'PDFのバリデーションに失敗しました');
        setBasePdfFile(null);
        setBasePdfImages([]);
        setBasePdfPageCount(0);
      } else {
        setBasePdfImages(result.images || []);
        setBasePdfPageCount(result.page_count || 0);
        setBasePdfExtractedText(result.extracted_text || '');
        setBasePdfError('');
      }
    } catch (e) {
      setBasePdfError(e.message || 'アップロードに失敗しました');
      setBasePdfFile(null);
      setBasePdfImages([]);
      setBasePdfPageCount(0);
    }
    setBasePdfUploading(false);
  };

  const selectedPreset = latexPresets.find((p) => p.id === latexPreset);

  return (
    <div ref={wizardTopRef} className="relative max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-14 pb-28 sm:pb-16">
      {/* ── Stripe風アーティスティックな虹色グラデーション背景 ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -2 }}>
        {/* 左上の紫〜インディゴのブロブ */}
        <div className="absolute -top-[20%] -left-[15%] w-[60vw] h-[60vw] rounded-full opacity-[0.12]"
          style={{
            background: 'radial-gradient(circle, #7c3aed 0%, #6366f1 40%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'aurora-blob-1 25s ease-in-out infinite',
          }}
        />
        {/* 右上のピンク〜ローズのブロブ */}
        <div className="absolute -top-[10%] -right-[10%] w-[50vw] h-[50vw] rounded-full opacity-[0.10]"
          style={{
            background: 'radial-gradient(circle, #ec4899 0%, #f472b6 40%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'aurora-blob-2 20s ease-in-out infinite',
          }}
        />
        {/* 中央のティール〜シアンのブロブ */}
        <div className="absolute top-[30%] left-[20%] w-[45vw] h-[45vw] rounded-full opacity-[0.08]"
          style={{
            background: 'radial-gradient(circle, #06b6d4 0%, #22d3ee 40%, transparent 70%)',
            filter: 'blur(90px)',
            animation: 'aurora-blob-3 22s ease-in-out infinite',
          }}
        />
        {/* 右下のオレンジ〜アンバーのブロブ */}
        <div className="absolute bottom-[10%] right-[5%] w-[40vw] h-[40vw] rounded-full opacity-[0.07]"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, #fbbf24 40%, transparent 70%)',
            filter: 'blur(70px)',
            animation: 'aurora-blob-4 28s ease-in-out infinite',
          }}
        />
        {/* 左下の緑〜エメラルドのブロブ */}
        <div className="absolute bottom-[-5%] -left-[10%] w-[35vw] h-[35vw] rounded-full opacity-[0.08]"
          style={{
            background: 'radial-gradient(circle, #10b981 0%, #34d399 40%, transparent 70%)',
            filter: 'blur(70px)',
            animation: 'aurora-blob-5 18s ease-in-out infinite',
          }}
        />
      </div>

      {/* ヘッダー — Artistic gradient design */}
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-[32px] sm:text-[40px] font-black tracking-[-0.03em] leading-[1.08] mb-3 gradient-text-hero-animated">
          問題をつくる
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[#64748b] leading-relaxed max-w-md mx-auto font-medium tracking-[-0.01em]">
          ステップに沿って進むだけで、試験問題の PDF が完成します
        </p>
      </div>

      {/* プログレスバー */}
      <div className="mb-6 sm:mb-8">
        <ProgressSteps steps={STEPS} current={step} />
      </div>

      <StatusBar message={status} />

      {/* ── AI使用回数バッジ ── */}
      {userId && (
        <div className="flex items-center justify-end mb-3 gap-2">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold ${
            usage.unlocked
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : usage.remaining > 0
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {usage.unlocked ? '無制限' : `残り ${usage.remaining}/${usage.limit} 回`}
          </div>
          {!usage.unlocked && (
            <button
              onClick={() => setShowUnlockModal(true)}
              className="text-[11px] text-[#64748b] hover:text-[#2563eb] underline underline-offset-2 transition-colors"
            >
              上限解除
            </button>
          )}
        </div>
      )}

      {/* ── 管理者パスワード解除モーダル ── */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowUnlockModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[90vw] max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-[18px] font-bold text-[#1e293b] mb-2">AI使用制限の解除</h3>
            <p className="text-[13px] text-[#64748b] mb-4">管理者パスワードを入力して、AI生成の回数制限を解除してください。</p>
            <input
              type="password"
              value={unlockPassword}
              onChange={e => setUnlockPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminUnlock()}
              placeholder="管理者パスワード"
              className="w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] mb-3"
              autoFocus
            />
            {unlockError && <p className="text-[12px] text-red-500 mb-3">{unlockError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowUnlockModal(false); setUnlockPassword(''); setUnlockError(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#e2e8f0] text-[13px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleAdminUnlock}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#2563eb] text-white text-[13px] font-semibold hover:bg-[#1e40af] transition-colors"
              >
                解除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ウィザードアシスト（各ステップのガイダンス） ── */}
      {step <= 7 && (
        <div className="wizard-guide mb-5">
          <div className="flex items-center gap-3 px-5 py-4 relative z-10">
            <div className="step-orb w-9 h-9 text-white text-[13px] font-bold flex-shrink-0">
              {step}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#1e293b] leading-snug">
                {step === 1 && '既存の出題パターンを選択、または新しく作成してください'}
                {step === 2 && '難易度と問題数を設定してください'}
                {step === 3 && 'ベースとなる問題を選択してください（任意）'}
                {step === 4 && 'PDFの出力形式を選んでください'}
                {step === 5 && '図表やLaTeXパッケージを選択してください（任意）'}
                {step === 6 && '問題形式やカスタムリクエストを設定してください（全て任意）'}
                {step === 7 && (mode === 'auto' ? '設定を確認したら「PDF を生成」で完成！' : '設定を確認したら「指示文を作成」で次へ')}
              </p>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                ステップ {step} / {STEPS.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 1: 出題パターン選択 ═══════ */}
      {step === 1 && (
        <div className="space-y-5 wizard-section-enter">
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="icon-glossy w-8 h-8">
                  <Icons.File className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-[#1e293b] tracking-tight">出題パターンを選ぶ</h3>
                  <p className="text-[10px] text-[#64748b]">科目・分野・レベルが設定済みのパターンから選ぶだけでOK</p>
                </div>
              </div>

              {templates.length === 0 ? (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50/60 mb-3">
                    <svg className="w-7 h-7 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-[#1e293b]">出題パターンがまだありません</p>
                  <p className="text-xs text-[#64748b] mt-1">「次のステップへ」から新しいパターンを作成しましょう</p>
                </div>
              ) : (
                <div className="space-y-3">
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
                                    <div
                                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#94a3b8] hover:text-red-500 hover:bg-red-50 transition-all duration-200 cursor-pointer opacity-0 group-hover:opacity-100 flex-shrink-0"
                                      title="削除"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                      </svg>
                                    </div>
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

              {/* 選択中のパターン表示 */}
              {templateId && (
                <div className="mt-4 p-3 rounded-xl bg-blue-50/50 border border-blue-100/60">
                  <div className="text-[10px] text-[#64748b]">選択中のパターン:</div>
                  <div className="text-[13px] font-bold text-[#2563eb]">{selectedTemplate?.name || templateId}</div>
                  {selectedTemplate?.metadata && (
                    <div className="text-[10px] text-[#64748b] mt-1">
                      {[selectedTemplate.metadata.subject, selectedTemplate.metadata.field, selectedTemplate.metadata.difficulty].filter(Boolean).join(' / ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 新規作成への導線 */}
          <div className="text-center">
            <button
              onClick={() => { setTemplateId(''); setShowCreateTemplate(true); }}
              className="text-[12px] text-[#64748b] hover:text-[#2563eb] transition-colors underline underline-offset-2"
            >
              ＋ 新しい出題パターンを作成する
            </button>
          </div>
        </div>
      )}

      {/* ═══════ (Hidden) 教科選択 — テンプレート作成時のみ使用 ═══════ */}
      {false && (
        <div className="space-y-5 wizard-section-enter">
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="icon-glossy w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">教科を選んでください</h3>
                  <p className="text-[11px] text-[#64748b]">作りたい問題の教科をタップしてください</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {SUBJECTS.map((subj) => {
                  const sc = getSubjectColor(subj);
                  const active = subject === subj;
                  return (
                    <button
                      key={subj}
                      onClick={() => {
                        setSubject(subj);
                        setField('');
                        setTheme('');
                        // テンプレートを自動検索
                        const matchingTpl = templates.find(t => t.metadata?.subject === subj);
                        if (matchingTpl) {
                          setTemplateId(matchingTpl.id);
                        }
                      }}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300 active:scale-[0.96] ${
                        active
                          ? `border-[${sc.light}] bg-gradient-to-b from-white to-[${sc.light}]/5 shadow-md`
                          : 'border-transparent bg-[#f8fafc] hover:bg-white hover:shadow-sm hover:border-blue-100'
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        active ? `bg-gradient-to-br ${sc.bg} text-white shadow-lg` : `${sc.bgLight} ${sc.text}`
                      }`}>
                        <SubjectIcon type={subj} className="w-5 h-5" />
                      </div>
                      <span className={`text-[13px] font-bold transition-colors ${active ? 'text-[#1e293b]' : 'text-[#64748b]'}`}>{subj}</span>
                      {active && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 rounded-full bg-[#2563eb] flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ (Hidden) 分野選択 — テンプレート作成時のみ使用 ═══════ */}
      {false && (
        <div className="space-y-5 wizard-section-enter">
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="icon-glossy w-10 h-10 text-white">
                  <SubjectIcon type={subject} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">{subject} の分野を選択</h3>
                  <p className="text-[11px] text-[#64748b]">特定の分野に絞りたい場合に選択してください（任意）</p>
                </div>
              </div>
              {SUBJECT_TOPICS[subject]?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setField(''); }}
                    className={`px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 active:scale-[0.96] ${
                      !field
                        ? 'bg-[#2563eb] text-white shadow-md'
                        : 'bg-[#f0f4ff] text-[#64748b] hover:bg-blue-50 border border-blue-200/60'
                    }`}
                  >
                    すべての分野
                  </button>
                  {SUBJECT_TOPICS[subject].map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setField(f);
                        // テンプレート自動マッチ
                        const matchingTpl = templates.find(t => t.metadata?.subject === subject && t.metadata?.field === f);
                        if (matchingTpl) setTemplateId(matchingTpl.id);
                      }}
                      className={`px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 active:scale-[0.96] ${
                        field === f
                          ? 'bg-[#2563eb] text-white shadow-md'
                          : 'bg-[#f0f4ff] text-[#64748b] hover:bg-blue-50 border border-blue-200/60'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[#94a3b8] py-4 text-center">この教科の分野一覧はまだ登録されていません。そのまま次へ進めます。</p>
              )}
              {/* テーマ入力 */}
              <div className="mt-4">
                <label className="text-[12px] font-bold text-[#64748b] mb-1.5 block">テーマ・単元（任意）</label>
                <input
                  type="text"
                  value={theme}
                  onChange={e => setTheme(e.target.value)}
                  placeholder="例: 二次関数、力学、関係代名詞 ..."
                  className="w-full px-4 py-3 text-[13px] border border-blue-200/60 bg-[#f0f4ff] rounded-2xl
                    focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20
                    placeholder:text-[#94a3b8] transition-all hover:border-blue-300/60"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 2: 難易度・問題数 ═══════ */}
      {step === 2 && (
        <div className="space-y-5 wizard-section-enter">
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="icon-glossy w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">難易度と問題数</h3>
                  <p className="text-[11px] text-[#64748b]">問題のレベルと生成する数を設定してください</p>
                </div>
              </div>

              {/* 難易度 */}
              <div className="mb-5">
                <label className="text-[12px] font-bold text-[#64748b] mb-2 block">難易度</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {DIFFICULTIES.map((d) => {
                    const active = difficulty === d.label;
                    return (
                      <button
                        key={d.label}
                        onClick={() => setDifficulty(d.label)}
                        className={`px-3 py-3 rounded-xl text-center transition-all duration-300 active:scale-[0.96] ${
                          active
                            ? 'bg-[#2563eb] text-white shadow-md font-bold'
                            : 'bg-[#f0f4ff] text-[#64748b] hover:bg-blue-50 border border-blue-200/60 font-semibold'
                        }`}
                      >
                        <div className="text-[13px]">{d.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 問題数 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <NumberField label="問題数" value={numQuestions} onChange={setNumQuestions} min={1} max={10} />
                </div>
                <div>
                  <NumberField label="参照する過去問数" value={topK} onChange={setTopK} min={1} max={20} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 3: ベース問題選択 ═══════ */}
      {step === 3 && (
        <div className="space-y-5 wizard-section-enter">
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="icon-glossy w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">ベース問題を選択</h3>
                  <p className="text-[11px] text-[#64748b]">参考にする問題を選ぶと、AIがより精度の高い類題を生成します（任意）</p>
                </div>
              </div>

              {/* タブ切り替え */}
              <div className="flex rounded-xl bg-[#f1f5f9] p-1 mb-5">
                {[
                  { id: 'skip', label: 'スキップ', icon: '→' },
                  { id: 'db', label: 'DBから選択', icon: '🔍' },
                  { id: 'pdf', label: 'PDFアップロード', icon: '📄' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setBaseMode(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[12px] font-bold transition-all duration-300 ${
                      baseMode === tab.id
                        ? 'bg-white text-[#1e293b] shadow-sm'
                        : 'text-[#64748b] hover:text-[#1e293b]'
                    }`}
                  >
                    <span className="text-[14px]">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* スキップモード */}
              {baseMode === 'skip' && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50/60 mb-3">
                    <svg className="w-7 h-7 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.81V8.69zM12.75 8.689c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.69z" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-bold text-[#1e293b]">ベース問題なしで生成</p>
                  <p className="text-[11px] text-[#94a3b8] mt-1">AIがゼロから問題を作成します。そのまま次へ進めます。</p>
                </div>
              )}

              {/* DB検索モード */}
              {baseMode === 'db' && (
                <div>
                  {/* フィルタバー */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {subject && (
                        <span className="px-2.5 py-1 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[10px] font-bold">{subject}</span>
                      )}
                      {field && (
                        <span className="px-2.5 py-1 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[10px] font-bold">{field}</span>
                      )}
                    </div>
                    <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50/50 border border-blue-200/40
                                    focus-within:bg-white focus-within:border-blue-300/50 focus-within:shadow-sm transition-all duration-200">
                      <svg className="w-3.5 h-3.5 text-[#94a3b8] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        ref={baseSearchInputRef}
                        type="text"
                        value={baseFilterQuery}
                        onChange={(e) => setBaseFilterQuery(e.target.value)}
                        placeholder="絞り込み..."
                        className="flex-1 bg-transparent text-xs text-[#1e293b] outline-none placeholder:text-[#94a3b8]"
                      />
                      {baseFilterQuery && (
                        <button onClick={() => setBaseFilterQuery('')} className="text-[#94a3b8] hover:text-[#1e293b] transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 選択済み表示 */}
                  {selectedBaseProblem && (
                    <div className="mb-3 p-3 rounded-xl bg-blue-50/50 border border-blue-200/60">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 rounded-full bg-[#2563eb] flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-[11px] font-bold text-[#475569]">選択中</span>
                          </div>
                          <div className="text-[12px] text-[#1e293b] leading-relaxed line-clamp-2 ml-7">
                            <LatexText>{(selectedBaseProblem.stem || selectedBaseProblem.text || '').slice(0, 200)}</LatexText>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedBaseProblem(null)}
                          className="w-7 h-7 rounded-lg bg-blue-50/60 hover:bg-red-50 text-[#94a3b8] hover:text-red-500 flex items-center justify-center transition-all flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 問題一覧 */}
                  {matchedLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <svg className="animate-spin h-5 w-5 text-[#475569]" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-[11px] text-[#94a3b8]">過去問を取得中...</p>
                    </div>
                  ) : filteredProblems.length > 0 ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                      <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider px-1 mb-1">
                        {filteredProblems.length} 件{baseFilterQuery.trim() ? ` / ${matchedProblems.length} 件中` : ''}
                      </div>
                      {filteredProblems.map((item, idx) => {
                        const isSelected = selectedBaseProblem?.id === item.id;
                        return (
                          <button
                            key={item.id ?? idx}
                            onClick={() => setSelectedBaseProblem(item)}
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
                                <div className="text-[12px] text-[#1e293b] leading-relaxed line-clamp-2">
                                  <LatexText>{(item.stem || item.text || '').slice(0, 150)}</LatexText>
                                </div>
                                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                  {item.subject && (
                                    <span className="px-2 py-0.5 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[9px] font-bold">{item.subject}</span>
                                  )}
                                  {(item.topic || item.metadata?.field) && (
                                    <span className="px-2 py-0.5 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[9px] font-bold">{item.topic || item.metadata?.field}</span>
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
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-[12px] text-[#94a3b8]">この科目・分野の過去問はまだ登録されていません</p>
                    </div>
                  )}
                </div>
              )}

              {/* PDFアップロードモード */}
              {baseMode === 'pdf' && (
                <div>
                  <div className="mb-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200/60">
                    <p className="text-[11px] text-amber-800 font-medium">
                      PDFは最大3ページまでアップロードできます。AIにそのまま画像として送られます。
                    </p>
                  </div>

                  {/* アップロードエリア */}
                  {!basePdfFile || basePdfError ? (
                    <div
                      onClick={() => basePdfInputRef.current?.click()}
                      className="relative border-2 border-dashed border-blue-200/60 rounded-2xl p-8 text-center cursor-pointer
                                 hover:border-[#2563eb]/40 hover:bg-blue-50/30 transition-all duration-300 group"
                    >
                      <input
                        ref={basePdfInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleBasePdfUpload(file);
                          e.target.value = '';
                        }}
                      />
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50/60 mb-3 group-hover:bg-[#2563eb]/10 transition-colors">
                        <svg className="w-7 h-7 text-[#94a3b8] group-hover:text-[#2563eb] transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <p className="text-[13px] font-bold text-[#1e293b]">PDFをアップロード</p>
                      <p className="text-[11px] text-[#94a3b8] mt-1">クリックまたはドラッグ＆ドロップ（3ページ以内）</p>
                    </div>
                  ) : basePdfUploading ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <svg className="animate-spin h-6 w-6 text-[#2563eb]" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-[12px] text-[#64748b] font-medium">PDFを処理中...</p>
                    </div>
                  ) : (
                    <div>
                      {/* アップロード成功 */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-emerald-800 truncate">{basePdfFile.name}</p>
                          <p className="text-[10px] text-emerald-600">{basePdfPageCount}ページ</p>
                        </div>
                        <button
                          onClick={() => {
                            setBasePdfFile(null);
                            setBasePdfImages([]);
                            setBasePdfPageCount(0);
                            setBasePdfError('');
                            setBasePdfExtractedText('');
                          }}
                          className="w-7 h-7 rounded-lg hover:bg-red-50 text-[#94a3b8] hover:text-red-500 flex items-center justify-center transition-all flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* ページプレビュー */}
                      {basePdfImages.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {basePdfImages.map((img, i) => (
                            <div key={i} className="relative rounded-xl overflow-hidden border border-blue-200/60 shadow-sm" style={{ backgroundColor: '#f8fafc' }}>
                              <img
                                src={`data:image/png;base64,${img}`}
                                alt={`Page ${i + 1}`}
                                className="w-full h-auto block"
                                style={{ minHeight: '80px' }}
                                onError={(e) => {
                                  // 画像が読み込めない場合のフォールバック
                                  e.target.style.display = 'none';
                                  e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                                }}
                              />
                              <div className="hidden items-center justify-center p-4 text-center" style={{ minHeight: '80px' }}>
                                <p className="text-[10px] text-[#94a3b8]">プレビュー不可</p>
                              </div>
                              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-white text-[9px] font-bold">
                                {i + 1}/{basePdfImages.length}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : basePdfExtractedText ? (
                        /* 画像がない場合のテキストプレビュー */
                        <div className="rounded-xl border border-blue-200/60 bg-slate-50/80 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] text-amber-600 font-medium">⚠ 画像プレビューは生成できませんでしたが、テキストは読み取れています</span>
                          </div>
                          <pre className="text-[10px] text-[#475569] whitespace-pre-wrap break-words max-h-40 overflow-y-auto font-mono leading-relaxed">
                            {basePdfExtractedText.slice(0, 500)}{basePdfExtractedText.length > 500 ? '...' : ''}
                          </pre>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3">
                          <p className="text-[11px] text-amber-700">⚠ PDFのプレビューを生成できませんでしたが、AIにはそのまま送信されます。</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* エラー表示 */}
                  {basePdfError && (
                    <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200/60">
                      <p className="text-[12px] text-red-600 font-medium">{basePdfError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 4: 出力形式 ═══════ */}
      {step === 4 && (
        <div className="space-y-5 wizard-section-enter">
          {/* PDF形式カード - 既存Step3のPDF部分を再利用 */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-glossy w-10 h-10 text-white">
                  <Icons.Pdf className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">PDF の見た目を選ぶ</h3>
                  <p className="text-[11px] text-[#64748b]">完成するPDFの形式を選んでください</p>
                </div>
              </div>
              {latexPresets.length === 0 ? (
                <div className="text-center py-8 text-[#64748b]">
                  <Icons.Empty className="mx-auto mb-2" />
                  <p className="text-sm">形式を読み込み中...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {latexPresets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setLatexPreset(p.id)}
                      className={`selection-card !p-0 text-left ${latexPreset === p.id ? 'active card-select-ripple' : ''}`}
                    >
                      <PresetThumbnail id={p.id} active={latexPreset === p.id} />
                      <div className="px-4 py-3 relative z-10">
                        <div className="flex items-center gap-2">
                          {latexPreset === p.id && (
                            <div className="check-circle checked !w-5 !h-5">
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          <div className="text-sm font-bold text-[#1e293b]">{p.name}</div>
                        </div>
                        <div className="text-[10px] text-[#64748b] mt-0.5 leading-tight">{p.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 生成方法カード */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-glossy w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">生成方法</h3>
                  <p className="text-[11px] text-[#64748b]">自動生成 or 手動で指示文を使う</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('auto')}
                  className={`selection-card text-left ${mode === 'auto' ? 'active' : ''}`}
                >
                  <div className="relative z-10 flex items-start gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all duration-300 ${
                      mode === 'auto' ? 'bg-[#2563eb] text-white shadow-md' : 'bg-blue-50/60 text-[#64748b]'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1e293b]">AI 自動生成</div>
                      <div className="text-[11px] text-[#64748b] mt-0.5">ワンクリックで PDF まで自動作成</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`selection-card text-left ${mode === 'manual' ? 'active' : ''}`}
                >
                  <div className="relative z-10 flex items-start gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all duration-300 ${
                      mode === 'manual' ? 'bg-[#2563eb] text-white shadow-md' : 'bg-blue-50/60 text-[#64748b]'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1e293b]">手動</div>
                      <div className="text-[11px] text-[#64748b] mt-0.5">AIへの指示文を取得して自分で送る</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 5: 図表・パッケージ選択 ═══════ */}
      {step === 5 && (
        <div className="space-y-5 wizard-section-enter">
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="icon-glossy w-8 h-8">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-[#1e293b] tracking-tight">図表・パッケージ</h3>
                  <p className="text-[10px] text-[#64748b]">任意 — 問題に含める図表の種類を選択（複数選択可）</p>
                </div>
              </div>

              {/* パッケージカード一覧 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DIAGRAM_PACKAGE_DEFS.map((pkg) => {
                  const active = extraPackages.includes(pkg.id);
                  const illustration = PACKAGE_ILLUSTRATIONS[pkg.id];
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => togglePackage(pkg.id)}
                      className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-300 active:scale-[0.97] ${
                        active
                          ? 'border-[#2563eb]/40 bg-blue-50/60 shadow-sm'
                          : 'border-transparent bg-[#f8fafc] hover:border-blue-100 hover:bg-blue-50/30'
                      }`}
                    >
                      {/* 推奨バッジ */}
                      {pkg.recommended && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#2563eb] text-white">
                          おすすめ
                        </span>
                      )}
                      {/* チェックマーク */}
                      {active && (
                        <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#2563eb] flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0 mt-0.5">{pkg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-[#1e293b]">{pkg.name}</div>
                          <div className="text-[10px] text-[#64748b] mt-0.5">{pkg.description}</div>
                          {pkg.hint && (
                            <div className="text-[10px] text-[#2563eb] font-medium mt-1">{pkg.hint}</div>
                          )}
                        </div>
                      </div>
                      {/* ASCIIプレビュー */}
                      {illustration && (
                        <pre className={`mt-3 text-[10px] leading-[1.4] font-mono p-2.5 rounded-xl whitespace-pre overflow-x-auto ${
                          active ? 'bg-white/80 text-[#1e293b]' : 'bg-[#f1f5f9] text-[#64748b]'
                        }`}>
                          {illustration}
                        </pre>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* TikZ 選択時のサブオプション */}
              {extraPackages.includes('tikz') && (
                <div className="mt-4 p-3 rounded-xl bg-blue-50/50 border border-blue-100/60">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${includeDiagramPerQuestion ? 'bg-[#2563eb]' : 'bg-[#cbd5e1]'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${includeDiagramPerQuestion ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <div>
                      <span className="text-[12px] font-bold text-[#1e293b]">問題ごとに図を自動挿入</span>
                      <p className="text-[10px] text-[#64748b]">各問題に個別のTikZ図を生成して挿入します</p>
                    </div>
                  </label>
                </div>
              )}

              {/* カスタムパッケージ入力 */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={customPackage}
                  onChange={(e) => setCustomPackage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomPackage()}
                  placeholder="その他のパッケージ名を入力..."
                  className="flex-1 px-3 py-2 text-[12px] border border-blue-200/60 bg-[#f0f4ff] rounded-xl
                    focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
                />
                <button
                  onClick={addCustomPackage}
                  disabled={!customPackage.trim()}
                  className="px-3 py-2 text-[12px] font-medium text-white bg-[#2563eb] rounded-xl
                    hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  追加
                </button>
              </div>

              {/* 選択中のパッケージ一覧 */}
              {extraPackages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {extraPackages.map((pkg) => {
                    const def = DIAGRAM_PACKAGE_DEFS.find(d => d.id === pkg);
                    return (
                      <span key={pkg} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#2563eb]/10 text-[#2563eb]">
                        {def?.icon || '📦'} {def?.label || pkg}
                        <button onClick={() => togglePackage(pkg)} className="ml-0.5 hover:text-red-500 transition-colors">×</button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 6: オプション ═══════ */}
      {step === 6 && (
        <div className="space-y-5 wizard-section-enter">
          {/* 問題形式 */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="icon-glossy w-8 h-8">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-[#1e293b] tracking-tight">問題形式</h3>
                  <p className="text-[10px] text-[#64748b]">任意 — 未選択なら記述式になります</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUESTION_FORMATS.map((fmt) => {
                  const active = questionFormat === fmt.value;
                  return (
                    <button
                      key={fmt.value}
                      onClick={() => setQuestionFormat(fmt.value)}
                      className={`px-3 py-2.5 rounded-xl text-left transition-all duration-300 active:scale-[0.97] ${
                        active ? 'bg-blue-50/60 border-2 border-[#2563eb]/30' : 'bg-[#f8fafc] border-2 border-transparent hover:border-blue-100'
                      }`}
                    >
                      <div className="text-[12px] font-bold text-[#1e293b]">{fmt.label}</div>
                      <div className="text-[10px] text-[#64748b] mt-0.5">{fmt.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* カスタム要望 */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="icon-glossy w-8 h-8">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-[#1e293b] tracking-tight">カスタム要望</h3>
                  <p className="text-[10px] text-[#64748b]">任意 — 問題の内容・形式についての要望を自由に記入</p>
                </div>
              </div>
              <textarea
                value={customRequest}
                onChange={(e) => { if (e.target.value.length <= CUSTOM_REQUEST_MAX_LENGTH) setCustomRequest(e.target.value); }}
                placeholder="例: 数値ではなく文字式で出題してほしい ..."
                rows={3}
                maxLength={CUSTOM_REQUEST_MAX_LENGTH}
                className="w-full px-4 py-3 text-[13px] leading-relaxed border border-blue-200/60 bg-[#f0f4ff] rounded-2xl
                  focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20
                  placeholder:text-[#94a3b8] transition-all resize-none"
              />
              <div className="text-right mt-1">
                <span className="text-[10px] text-[#94a3b8]">{customRequest.length} / {CUSTOM_REQUEST_MAX_LENGTH}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 7: 確認 ═══════ */}
      {step === 7 && (
        <div className="space-y-5 wizard-section-enter">
          {/* 選択中パターン */}
          {templateId && selectedTemplate && (
            <div className="card-glossy">
              <div className="p-5 relative z-10">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="icon-glossy w-8 h-8">
                    <Icons.File className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-[#1e293b] tracking-tight">出題パターン</h3>
                    <p className="text-[10px] text-[#64748b]">Step 1 で選択済み</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/60">
                  <div className="text-[13px] font-bold text-[#2563eb]">{selectedTemplate.name}</div>
                  {selectedTemplate.metadata && (
                    <div className="text-[10px] text-[#64748b] mt-0.5">
                      {[selectedTemplate.metadata.subject, selectedTemplate.metadata.field, selectedTemplate.metadata.difficulty].filter(Boolean).join(' / ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 設定サマリーカード */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-glossy w-8 h-8 text-white" style={{ background: 'linear-gradient(145deg, #38d260 0%, #248a3d 100%)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-[#1e293b] tracking-tight">設定サマリー</h3>
                  <p className="text-[10px] text-[#64748b]">以下の内容でAIが問題を生成します</p>
                </div>
              </div>
              <div className="space-y-2 bg-[#f8fafc] rounded-2xl p-4 border border-[#e2e8f0] text-[12px]">
                {[
                  ['教科', subject || '未選択'],
                  ['分野', field || 'すべて'],
                  ...(theme ? [['テーマ', theme]] : []),
                  ['難易度', difficulty],
                  ['問題数', `${numQuestions}問`],
                  ['出力形式', selectedPreset?.name || latexPreset],
                  ['生成方法', mode === 'auto' ? 'AI自動生成' : '手動'],
                  ...(questionFormat !== 'standard' ? [['問題形式', QUESTION_FORMATS.find(f => f.value === questionFormat)?.label]] : []),
                  ...(extraPackages.length > 0 ? [['図表', extraPackages.map(p => DIAGRAM_PACKAGE_DEFS.find(d => d.id === p)?.label || p).join(', ')]] : []),
                ].map(([label, value], i) => (
                  <div key={i}>
                    {i > 0 && <div className="h-px bg-[#e2e8f0] mb-2" />}
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748b] font-medium">{label}</span>
                      <span className="font-bold text-[#1e293b]">{value}</span>
                    </div>
                  </div>
                ))}
                {customRequest.trim() && (
                  <>
                    <div className="h-px bg-[#e2e8f0]" />
                    <div>
                      <span className="text-[#64748b] font-medium block mb-1">カスタム要望</span>
                      <span className="text-[#1e293b]">{customRequest}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ (Legacy) Step 1: 出題パターン選択 — hidden, used for template data ═══════ */}
      {false && (
        <SectionCard title="出題パターンを選ぶ" icon={<Icons.File />} className="wizard-section-enter">
          <p className="text-xs text-[#64748b] mb-4">
            どんな問題を作りたいですか？科目・分野・レベルが設定済みのパターンから選ぶだけでOKです。
          </p>

          <div className="space-y-3">
            {/* テンプレート一覧 */}
            {templates.length === 0 && !showCreateTemplate ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50/60 mb-3">
                  <svg className="w-7 h-7 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-[#1e293b]">出題パターンがまだありません</p>
                <p className="text-xs text-[#64748b] mt-1">下の「＋ 新しく作る」ボタンから出題パターンを作成しましょう</p>
              </div>
            ) : !showCreateTemplate ? (
              <div className="space-y-3">
                {Object.entries(groupedTemplates).map(([subjName, subjectTemplates]) => {
                  const sc = getSubjectColor(subjName);
                  const isExpanded = expandedSubjects.includes(subjName);
                  const hasActive = subjectTemplates.some((t) => templateId === t.id);

                  return (
                    <div key={subjName} className={`rounded-2xl border overflow-hidden transition-all duration-300 ${hasActive ? `${sc.border} shadow-sm` : 'border-blue-100/60'}`}>
                      {/* 教科ヘッダー（アコーディオン） */}
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

                      {/* テンプレート一覧（展開時） */}
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
                                    {/* 分野 › テーマ */}
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

                                    {/* 難易度ドット */}
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

                                  {/* 削除 */}
                                  <div
                                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#94a3b8] hover:text-red-500 hover:bg-red-50 transition-all duration-200 cursor-pointer opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    title="削除"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                  </div>
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
            ) : null}

            {/* ── テンプレート新規作成フォーム ── */}
            {showCreateTemplate ? (
              <div className="card-glossy">
                <div className="p-6 space-y-4 relative z-10">
                <div className="flex items-center gap-3 mb-1">
                  <div className="icon-glossy w-10 h-10">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">出題パターンを新しく作る</h3>
                    <p className="text-[11px] text-[#64748b]">教科と分野を選ぶだけで自動作成されます</p>
                  </div>
                </div>

                {/* 教科 + 難易度 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField
                    label="教科 *"
                    value={newTplSubject}
                    onChange={(v) => { setNewTplSubject(v); setNewTplField(''); }}
                    options={[
                      { value: '', label: '— 選択してください —' },
                      ...(subjects.length ? subjects : SUBJECTS).map((s) => ({ value: s, label: s })),
                      { value: '__custom', label: 'その他（入力）' },
                    ]}
                  />
                  <SelectField
                    label="難易度 *"
                    value={newTplDifficulty}
                    onChange={setNewTplDifficulty}
                    options={[
                      { value: '', label: '— 選択してください —' },
                      ...DIFFICULTIES.map((d) => ({ value: d.value, label: `${d.label}（${d.description}）` })),
                    ]}
                  />
                </div>

                {/* カスタム教科入力 */}
                {newTplSubject === '__custom' && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2">教科名（入力）</label>
                    <input
                      value={newTplCustomSubject}
                      onChange={(e) => setNewTplCustomSubject(e.target.value)}
                      className="w-full pl-4 pr-4 py-3 rounded-2xl border border-blue-200/60 bg-[#f0f4ff] text-sm text-[#1e293b] font-medium
                        transition-all duration-300 hover:border-blue-300/60 hover:bg-white hover:shadow-md
                        focus:border-[#2563eb]/40 focus:ring-2 focus:ring-[#2563eb]/20 focus:shadow-md
                        outline-none placeholder:text-[#94a3b8] shadow-sm"
                      placeholder="例: 地学"
                      autoFocus
                    />
                  </div>
                )}

                {/* 分野 */}
                {effectiveNewSubject && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2">
                      分野
                      <span className="text-[10px] font-normal text-[#94a3b8] ml-1 normal-case tracking-normal">（任意）</span>
                    </label>
                    {newTplFieldOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {newTplFieldOptions.slice(0, 15).map((f) => (
                          <button key={f} type="button"
                            onClick={() => setNewTplField(newTplField === f ? '' : f)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-300 ${
                              newTplField === f
                                ? 'bg-[#2563eb] text-white border-transparent shadow-md'
                                : 'bg-[#f0f4ff] text-[#64748b] border-blue-200/60 hover:border-[#2563eb]/30 hover:text-[#1e293b] hover:shadow-md'
                            }`}>
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      value={newTplField}
                      onChange={(e) => setNewTplField(e.target.value)}
                      placeholder={newTplFieldOptions.length > 0 ? '候補から選択 or 自由入力' : '分野名を入力（例: 微分法）'}
                      className="w-full pl-4 pr-4 py-3 rounded-2xl border border-blue-200/60 bg-[#f0f4ff] text-sm text-[#1e293b] font-medium
                        transition-all duration-300 hover:border-blue-300/60 hover:bg-white hover:shadow-md
                        focus:border-[#2563eb]/40 focus:ring-2 focus:ring-[#2563eb]/20 focus:shadow-md
                        outline-none placeholder:text-[#94a3b8] shadow-sm"
                    />
                  </div>
                )}

                {/* テーマ */}
                {effectiveNewSubject && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2">
                      テーマ
                      <span className="text-[10px] font-normal text-[#94a3b8] ml-1 normal-case tracking-normal">（任意・さらに細かい分類）</span>
                    </label>
                    <input
                      type="text"
                      value={newTplTheme}
                      onChange={(e) => setNewTplTheme(e.target.value)}
                      placeholder="例: 置換積分、三角関数の合成、運動方程式の立式"
                      className="w-full pl-4 pr-4 py-3 rounded-2xl border border-blue-200/60 bg-[#f0f4ff] text-sm text-[#1e293b] font-medium
                        transition-all duration-300 hover:border-blue-300/60 hover:bg-white hover:shadow-md
                        focus:border-[#2563eb]/40 focus:ring-2 focus:ring-[#2563eb]/20 focus:shadow-md
                        outline-none placeholder:text-[#94a3b8] shadow-sm"
                    />
                  </div>
                )}

                {/* 作成ボタン */}
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={handleCreateTemplate}
                    disabled={creatingTemplate || !effectiveNewSubject || !newTplDifficulty}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-[15px] font-bold
                               text-white manual-pdf-btn
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {creatingTemplate ? '作成中...' : 'このパターンを保存する'}
                  </button>
                  <button
                    onClick={() => { setShowCreateTemplate(false); setNewTplSubject(''); setNewTplCustomSubject(''); setNewTplField(''); setNewTplTheme(''); setNewTplDifficulty(''); }}
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-[#64748b] hover:text-[#1e293b] hover:bg-blue-50/60 transition-all"
                  >
                    キャンセル
                  </button>
                </div>
                {/* 操作ヒント */}
                <div className="flex items-center gap-2 pt-1 px-1">
                  <div className="w-4 h-4 rounded-full bg-[#2563eb]/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-[#1e293b]" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="text-[10px] text-[#94a3b8]">保存後、自動で選択されます。そのまま「次のステップへ」で進めます。</p>
                </div>
              </div>
              </div>
            ) : (
              /* ── 新規作成ボタン ── */
              <button
                onClick={() => setShowCreateTemplate(true)}
                className="w-full p-4 rounded-2xl text-[#64748b] section-frosted
                           hover:text-[#1e293b]
                           transition-all duration-300 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-sm font-bold">出題パターンを新しく作る</span>
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {/* ═══════ (Legacy) Step 2: 設定 — hidden ═══════ */}
      {false && (
        <div className="space-y-6 wizard-section-enter">
            {/* 選択中テンプレート表示（科目・分野・難易度もここに表示） */}
            {selectedTemplate && (() => {
              const meta = selectedTemplate.metadata || {};
              const subj = meta.subject || subject || '';
              const fld = meta.field || field || '';
              const thm = meta.theme || theme || '';
              const diff = meta.difficulty || difficulty || '';
              const sc = getSubjectColor(subj);
              const breadcrumb = [fld, thm].filter(Boolean).join(' › ');
              const diffLevels = { '基礎': 1, '標準': 2, '応用': 3, '発展': 4, '難関': 5, '最難関': 6 };
              const diffLevel = diffLevels[diff] || 0;
              const diffColors = { 1: '#93c5fd', 2: '#60a5fa', 3: '#3b82f6', 4: '#2563eb', 5: '#1d4ed8', 6: '#1e40af' };
              const dotColor = diffColors[diffLevel] || '#cbd5e1';
              return (
              <div className="section-frosted">
                <div className="p-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`icon-glossy w-10 h-10 flex-shrink-0 text-lg text-white`}>
                      <SubjectIcon type={subj} className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-[#1e293b]">{subj || selectedTemplate.name}</span>
                        <span className="px-1.5 py-0.5 bg-[#2563eb]/[0.06] text-[#1e293b] rounded-full text-[9px] font-bold">選択中</span>
                      </div>
                      {breadcrumb && (
                        <p className="text-[12px] text-[#64748b] mt-0.5 truncate">
                          {fld && <span className="font-medium">{fld}</span>}
                          {fld && thm && <span className="text-[#94a3b8] mx-1">›</span>}
                          {thm && <span className="text-[#64748b]">{thm}</span>}
                        </p>
                      )}
                      {diffLevel > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex gap-[3px]">
                            {[1,2,3,4,5,6].map((i) => (
                              <div key={i} className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: i <= diffLevel ? dotColor : '#bfdbfe' }} />
                            ))}
                          </div>
                          <span className="text-[10px] font-medium" style={{ color: dotColor }}>{difficultyLabel(diff)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              );
            })()}
          {/* ── 問題数・参照設定カード ── */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-glossy w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">問題数・参照設定</h3>
                  <p className="text-[11px] text-[#64748b]">何問つくるか、過去問を何件参考にするか</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumberField label="問題数" value={numQuestions} onChange={setNumQuestions} min={1} max={20} />
                <NumberField label="参照する過去問の数" value={topK} onChange={setTopK} min={1} max={20} />
              </div>
            </div>
          </div>

            {/* 過去問参照の仕組み説明（折りたたみ） */}
            <details className="tip-card">
              <summary>
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                <span>「過去問を参考にする」仕組みについて</span>
                <svg className="w-3.5 h-3.5 ml-auto transition-transform duration-300 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </summary>
              <div className="px-4 pb-4 text-xs text-[#64748b] leading-relaxed space-y-1.5 animate-expand">
                <p>登録されている過去問を参考にして、新しい問題を自動で作ります。</p>
                <div className="bg-blue-50/60 rounded-xl p-2 border border-blue-200/60 space-y-1">
                  <div className="flex gap-2"><span className="text-[#1e293b] font-bold">1.</span> <span>選んだ科目・分野をもとに関連する過去問を自動検索</span></div>
                  <div className="flex gap-2"><span className="text-[#1e293b] font-bold">2.</span> <span>似ている問題を自動で見つけ出し、難易度も考慮</span></div>
                  <div className="flex gap-2"><span className="text-[#1e293b] font-bold">3.</span> <span>見つかった過去問を参考に、AIが類似の問題を新しく生成</span></div>
                </div>
                <p className="text-[#64748b]">
                  下の「参考問題」を選ぶと、その問題に似た類題をより正確に生成できます。
                </p>
              </div>
            </details>

          {/* ── 参考問題カード ── */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-glossy w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">参考問題を選択</h3>
                  <p className="text-[11px] text-[#64748b]">選択中のパターンに合致する過去問が表示されます</p>
                </div>
                <span className="ml-auto px-2.5 py-1 bg-blue-100/50 text-[#475569] rounded-full text-[10px] font-bold border border-blue-200/40">任意</span>
              </div>

              {/* 選択済み問題の表示 */}
              {selectedBaseProblem ? (
                <div className="mb-3 relative overflow-hidden rounded-2xl border border-blue-200/60 bg-blue-50/50
                                shadow-sm transition-all duration-300 hover:shadow-lg">
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
                          {selectedBaseProblem.id && (
                            <span className="text-[10px] text-[#475569]/60 font-mono">#{selectedBaseProblem.id}</span>
                          )}
                        </div>
                        <div className="text-[13px] text-[#1e293b] leading-relaxed line-clamp-3 ml-[30px]">
                          <LatexText>{(selectedBaseProblem.stem || selectedBaseProblem.text || '').slice(0, 200)}</LatexText>
                        </div>
                        <div className="flex gap-1.5 mt-2 ml-[30px] flex-wrap">
                          {selectedBaseProblem.subject && (
                            <span className="px-2 py-0.5 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[9px] font-bold">{selectedBaseProblem.subject}</span>
                          )}
                          {(selectedBaseProblem.topic || selectedBaseProblem.metadata?.field) && (
                            <span className="px-2 py-0.5 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[9px] font-bold">{selectedBaseProblem.topic || selectedBaseProblem.metadata?.field}</span>
                          )}
                          {selectedBaseProblem.difficulty != null && (
                            <span className="px-2 py-0.5 bg-blue-100/50 text-[#475569] rounded-full text-[9px] font-bold">{difficultyLabel(selectedBaseProblem.difficulty)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedBaseProblem(null)}
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
              ) : null}

              {/* フィルタバー（科目ラベル + 絞り込み検索） */}
              <div className="flex items-center gap-2 mb-3">
                {/* 科目・分野ラベル */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {subject && (
                    <span className="px-2.5 py-1 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[10px] font-bold">{subject}</span>
                  )}
                  {field && (
                    <span className="px-2.5 py-1 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[10px] font-bold">{field}</span>
                  )}
                </div>
                {/* インライン絞り込み検索 */}
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50/50 border border-blue-200/40
                                focus-within:bg-white focus-within:border-blue-300/50 focus-within:shadow-sm transition-all duration-200">
                  <svg className="w-3.5 h-3.5 text-[#94a3b8] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={baseSearchInputRef}
                    type="text"
                    value={baseFilterQuery}
                    onChange={(e) => setBaseFilterQuery(e.target.value)}
                    placeholder="絞り込み..."
                    className="flex-1 bg-transparent text-xs text-[#1e293b] outline-none placeholder:text-[#94a3b8]"
                  />
                  {baseFilterQuery && (
                    <button onClick={() => setBaseFilterQuery('')} className="text-[#94a3b8] hover:text-[#1e293b] transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* 問題一覧 */}
              {matchedLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <svg className="animate-spin h-5 w-5 text-[#475569]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-[11px] text-[#94a3b8]">過去問を取得中...</p>
                </div>
              ) : filteredProblems.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                  <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider px-1 mb-1">
                    {filteredProblems.length} 件{baseFilterQuery.trim() ? ` / ${matchedProblems.length} 件中` : ''}
                  </div>
                  {filteredProblems.map((item, idx) => {
                    const isSelected = selectedBaseProblem?.id === item.id;
                    return (
                      <button
                        key={item.id ?? idx}
                        onClick={() => setSelectedBaseProblem(item)}
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
                                <span className="px-2 py-0.5 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[9px] font-bold">{item.subject}</span>
                              )}
                              {(item.topic || item.metadata?.field) && (
                                <span className="px-2 py-0.5 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[9px] font-bold">{item.topic || item.metadata?.field}</span>
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
              ) : matchedProblems.length > 0 && baseFilterQuery.trim() ? (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50/60 mb-2">
                    <svg className="w-5 h-5 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-[#94a3b8]">「{baseFilterQuery}」に一致する問題はありません</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50/60 mb-2">
                    <svg className="w-5 h-5 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  </div>
                  <p className="text-xs text-[#94a3b8]">この科目・分野の過去問はまだ登録されていません</p>
                </div>
              )}
            </div>
          </div>

          {/* ── 生成方法カード ── */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-glossy w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">生成方法</h3>
                  <p className="text-[11px] text-[#64748b]">自動生成 or 手動で指示文を使う</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('auto')}
                  className={`selection-card text-left ${
                    mode === 'auto' ? 'active' : ''
                  }`}
                >
                  <div className="relative z-10 flex items-start gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all duration-300 ${
                      mode === 'auto' ? 'bg-[#2563eb] text-white shadow-md' : 'bg-blue-50/60 text-[#64748b]'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1e293b]">AI 自動生成</div>
                      <div className="text-[11px] text-[#64748b] mt-0.5 leading-relaxed">
                        ワンクリックで PDF まで自動作成
                      </div>
                    </div>
                    {mode === 'auto' && (
                      <div className="check-circle checked flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`selection-card text-left ${
                    mode === 'manual' ? 'active' : ''
                  }`}
                >
                  <div className="relative z-10 flex items-start gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all duration-300 ${
                      mode === 'manual' ? 'bg-[#2563eb] text-white shadow-md' : 'bg-blue-50/60 text-[#64748b]'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1e293b]">手動</div>
                      <div className="text-[11px] text-[#64748b] mt-0.5 leading-relaxed">
                        AIへの指示文を取得して自分で AI に送る
                      </div>
                    </div>
                    {mode === 'manual' && (
                      <div className="check-circle checked flex-shrink-0" style={{ '--tw-ring-color': '#3b82f6' }}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* ── カスタム要望カード ── */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-glossy w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">カスタム要望</h3>
                  <p className="text-[11px] text-[#64748b]">問題の内容・形式についての要望を自由に記入</p>
                </div>
                <span className="ml-auto px-2.5 py-1 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[10px] font-bold border border-[#2563eb]/[0.12]">任意</span>
              </div>
              <div className="relative">
                <textarea
                  value={customRequest}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.length <= CUSTOM_REQUEST_MAX_LENGTH) setCustomRequest(val);
                  }}
                  placeholder="例: 数値ではなく文字式で出題してほしい、具体的な数値は使わず一般的な変数で表してほしい ..."
                  rows={3}
                  maxLength={CUSTOM_REQUEST_MAX_LENGTH}
                  className="w-full px-4 py-3 text-[13px] leading-relaxed border border-blue-200/60 bg-[#f0f4ff] rounded-2xl
                    focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20
                    placeholder:text-[#94a3b8] transition-all hover:border-blue-300/60 hover:shadow-md
                    resize-none"
                />
                <div className="flex items-center justify-between mt-1.5 px-1">
                  <div className="flex items-center gap-1.5">
                    {customRequest.trim() && (
                      <button
                        onClick={() => setCustomRequest('')}
                        className="text-[10px] text-[#94a3b8] hover:text-[#1e293b] transition-colors flex items-center gap-0.5"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        クリア
                      </button>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium tabular-nums transition-colors duration-200 ${
                    customRequest.length >= CUSTOM_REQUEST_MAX_LENGTH
                      ? 'text-[#1e293b]'
                      : customRequest.length >= CUSTOM_REQUEST_MAX_LENGTH * 0.8
                        ? 'text-[#475569]'
                        : 'text-[#94a3b8]'
                  }`}>
                    {customRequest.length} / {CUSTOM_REQUEST_MAX_LENGTH}
                  </span>
                </div>
              </div>
              {customRequest.trim() && (
                <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-[#2563eb]/[0.06] rounded-xl border border-[#2563eb]/10">
                  <svg className="w-3.5 h-3.5 text-[#1e293b] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[10px] text-[#1e293b] leading-relaxed">
                    この要望が生成時に AI に伝えられます
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ (Legacy) Step 3: PDF形式選択 — hidden ═══════ */}
      {false && (
        <div className="space-y-6 wizard-section-enter">
          {/* 選択中テンプレート情報 */}
          {selectedTemplate && (
            <div className="mb-6 section-frosted">
              <div className="p-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50/60">
                    <Icons.File className="w-4 h-4 text-[#1e293b]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-0.5">選択中の出題パターン</div>
                    <div className="text-sm font-bold text-[#1e293b]">{selectedTemplate.name}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3 ml-12">
                {subject && (
                  <span className="px-2 py-0.5 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[10px] font-bold">
                    科目: {subject}
                  </span>
                )}
                {field && (
                  <span className="px-2 py-0.5 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-full text-[10px] font-bold">
                    分野: {field}
                  </span>
                )}
                {theme && (
                  <span className="px-2 py-0.5 bg-[#334155]/[0.08] text-[#334155] rounded-full text-[10px] font-bold">
                    テーマ: {theme}
                  </span>
                )}
                {difficulty && (
                  <span className="px-2 py-0.5 bg-blue-100/50 text-[#475569] rounded-full text-[10px] font-bold">
                    難易度: {difficulty}
                  </span>
                )}
                {numQuestions && (
                  <span className="px-2 py-0.5 bg-[#2563eb]/[0.06] text-[#334155] rounded-full text-[10px] font-bold">
                    問題数: {numQuestions}
                  </span>
                )}
                </div>
              </div>
            </div>
          )}

          {/* ── PDF形式カード ── */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-glossy w-10 h-10 text-white">
                  <Icons.Pdf className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">PDF の見た目を選ぶ</h3>
                  <p className="text-[11px] text-[#64748b]">
                    {mode === 'auto'
                      ? '選んだら「PDF を生成」ボタンを押すだけで完成します'
                      : '選んだら「指示文を作成」ボタンを押すとAIへの指示文が作られます'}
                  </p>
                </div>
              </div>

          {latexPresets.length === 0 ? (
            <div className="text-center py-8 text-[#64748b]">
              <Icons.Empty className="mx-auto mb-2" />
              <p className="text-sm">形式を読み込み中...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {latexPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setLatexPreset(p.id);
                    // レイアウト選択後に「生成」ボタンへスクロール
                    setTimeout(() => {
                      nextActionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 400);
                  }}
                  className={`selection-card !p-0 text-left ${
                    latexPreset === p.id ? 'active card-select-ripple' : ''
                  }`}
                >
                  {/* ビジュアルサムネイル */}
                  <PresetThumbnail id={p.id} active={latexPreset === p.id} />
                  {/* ラベル */}
                  <div className="px-4 py-3 relative z-10">
                    <div className="flex items-center gap-2">
                      {latexPreset === p.id && (
                        <div className="check-circle checked !w-5 !h-5">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <div className="text-sm font-bold text-[#1e293b]">{p.name}</div>
                    </div>
                    <div className="text-[10px] text-[#64748b] mt-0.5 leading-tight">
                      {p.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 選択中プレビュー */}
          {selectedPreset && (
            <div className="mt-4 px-4 py-3 bg-blue-50/50 rounded-2xl border border-blue-200/60 flex items-center gap-2.5">
              <div className="check-circle checked !w-5 !h-5">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs font-bold text-[#1e293b]">{selectedPreset.name}</span>
              <span className="text-[11px] text-[#64748b]">{selectedPreset.description}</span>
            </div>
          )}

            </div>
          </div>

          {/* ── 問題形式カード ── */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="icon-glossy w-8 h-8">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[13px] font-extrabold text-[#1e293b] tracking-tight">
                      問題形式を選択してください
                    </div>
                    <div className="text-[10px] text-[#1e293b] font-bold mt-0.5">
                      選択中: {QUESTION_FORMATS.find(f => f.value === questionFormat)?.label || '通常形式'}
                    </div>
                  </div>
                </div>

              {/* 形式カード一覧 */}
              <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUESTION_FORMATS.map((fmt) => {
                  const active = questionFormat === fmt.value;
                  // 各形式のイメージアイコン
                  const icons = {
                    standard: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    ),
                    fill_in_blank: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
                        <rect x="3.5" y="15" width="6" height="4.5" rx="1.5" strokeDasharray="3 2" />
                      </svg>
                    ),
                    choice: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12" />
                        <circle cx="4.5" cy="6.75" r="1.5" />
                        <circle cx="4.5" cy="12" r="1.5" fill="currentColor" />
                        <circle cx="4.5" cy="17.25" r="1.5" />
                      </svg>
                    ),
                    true_false: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ),
                  };
                  return (
                    <button
                      key={fmt.value}
                      type="button"
                      onClick={() => {
                        setQuestionFormat(fmt.value);
                        // 選択後に生成ボタンエリアへスクロール
                        setTimeout(() => {
                          nextActionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 400);
                      }}
                      className={`relative overflow-hidden rounded-xl p-3.5 text-left transition-all duration-300 active:scale-[0.97]
                        ${active
                          ? 'bg-blue-50/60 border-2 border-[#2563eb]/30 shadow-sm'
                          : 'bg-blue-50/50 border-2 border-transparent hover:bg-blue-50/60 hover:border-blue-200/60'
                        }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 transition-all duration-300
                          ${active
                            ? 'bg-[#2563eb] text-white shadow-md'
                            : 'bg-blue-50/60 text-[#64748b]'
                          }`}
                        >
                          {icons[fmt.value] || icons.standard}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[13px] font-bold transition-colors ${active ? 'text-[#334155]' : 'text-[#1e293b]'}`}>
                              {fmt.label}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#64748b] mt-0.5 leading-snug">{fmt.description}</div>
                        </div>
                        {/* チェックマーク */}
                        {active && (
                          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2563eb] flex-shrink-0 mt-0.5">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── 図表パッケージカード ── */}
          <div className="card-glossy">
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-glossy w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5V19.5a1.5 1.5 0 001.5 1.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">図表・イラスト</h3>
                  <p className="text-[11px] text-[#64748b]">図・グラフ・コードが必要な場合に選択。不要なら選ばなくてOK</p>
                </div>
                <span className="ml-auto px-2.5 py-1 bg-[#334155]/[0.08] text-[#334155] rounded-full text-[10px] font-bold border border-blue-200/40">任意</span>
              </div>

            {/* どれを選ぶ？ガイダンス */}
            <details className="tip-card mb-3 group">
              <summary>
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                <span>どれを選べばいい？（初めての方はここを確認）</span>
                <svg className="w-3.5 h-3.5 ml-auto transition-transform duration-300 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </summary>
              <div className="px-4 pb-4 pt-1 text-[10px] text-[#475569] space-y-1 leading-relaxed animate-expand">
                <p className="font-bold">迷ったら「TikZ」だけ選べばほとんどの図が描けます。</p>
                <p>・ 電気回路の問題 → <strong>CircuiTikZ</strong></p>
                <p>・ 関数グラフ・データグラフ → <strong>PGFPlots</strong></p>
                <p>・ プログラミング問題のコード → <strong>Listings</strong></p>
                <p>・ 確率の樹形図 → <strong>Forest</strong></p>
                <p className="text-[#475569]">図が不要な問題（文章・数式のみ）は何も選ばなくて大丈夫です。</p>
              </div>
            </details>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DIAGRAM_PACKAGE_DEFS.map((pkg) => {
                const active = extraPackages.includes(pkg.id);
                const illustration = PACKAGE_ILLUSTRATIONS[pkg.id];
                return (
                  <button
                    key={pkg.id}
                    onClick={() => togglePackage(pkg.id)}
                    className={`selection-card !p-0 text-left ${
                      active ? 'active !border-[#2563eb] !shadow-[0_0_0_3px_rgba(37,99,235,0.06)]' : ''
                    }`}
                  >
                    {/* ASCIIアートプレビュー */}
                    {illustration && (
                      <div className={`px-3 pt-2.5 pb-2 ${active ? 'bg-[#334155]/[0.06]' : 'bg-blue-50/50'}`}>
                        <pre
                          className={`text-[9px] sm:text-[8px] leading-[1.35] font-mono select-none transition-colors ${active ? 'text-[#334155]' : 'text-[#94a3b8]'}`}
                          style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
                        >
                          {illustration}
                        </pre>
                      </div>
                    )}
                    {/* ラベル */}
                    <div className="px-4 py-2.5 relative z-10">
                      <div className="flex items-center gap-2 flex-wrap">
                        {active ? (
                          <div className="check-circle checked !w-5 !h-5 !border-[#2563eb]" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="check-circle !w-5 !h-5" />
                        )}
                        <span className={`text-sm leading-none ${active ? 'text-[#334155]' : 'text-[#94a3b8]'}`}>
                          {pkg.icon}
                        </span>
                        <span className="text-xs font-bold text-[#1e293b]">{pkg.name}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          active ? 'bg-[#334155]/[0.1] text-[#334155]' : 'bg-blue-50/60 text-[#94a3b8]'
                        }`}>
                          {pkg.label}
                        </span>
                        {pkg.recommended && (
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-blue-100/50 text-[#475569]">
                            おすすめ
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#64748b] mt-1 ml-7 leading-tight">{pkg.hint || pkg.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── 「図形・図解」選択時のサブオプション: 大問ごとに図を含める ── */}
            {extraPackages.includes('tikz') && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <button
                  type="button"
                  onClick={() => setIncludeDiagramPerQuestion((v) => !v)}
                  className={`w-full group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 active:scale-[0.98]
                    ${includeDiagramPerQuestion
                      ? 'bg-blue-50/60 border-2 border-[#2563eb]/30 shadow-sm'
                      : 'bg-blue-50/50 border-2 border-transparent hover:bg-blue-50/60 hover:border-blue-200/60'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all duration-300
                      ${includeDiagramPerQuestion
                        ? 'bg-[#2563eb] text-white shadow-md'
                        : 'bg-blue-50/60 text-[#64748b]'
                      }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5V19.5a1.5 1.5 0 001.5 1.5z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1e293b]">大問ごとに図を自動挿入</div>
                      <div className="text-[11px] text-[#64748b] mt-0.5 leading-relaxed">
                        各大問に物理図（力の図示、回路図など）を自動で追加します
                      </div>
                    </div>
                    {/* トグルスイッチ */}
                    <div className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-all duration-300
                      ${includeDiagramPerQuestion
                        ? 'bg-[#2563eb]'
                        : 'bg-blue-100/50'
                      }`}>
                      <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300
                        ${includeDiagramPerQuestion ? 'left-[22px]' : 'left-0.5'}`} />
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* その他の図表タイプを追加 */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customPackage}
                onChange={(e) => setCustomPackage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomPackage()}
                placeholder="その他の図表タイプ名（例: 化学式）"
                className="flex-1 px-4 py-2.5 text-xs border border-blue-200/60 bg-[#f0f4ff] rounded-2xl
                           focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20
                           placeholder:text-[#94a3b8] transition-all hover:border-blue-300/60 hover:shadow-md"
              />
              <button
                onClick={addCustomPackage}
                disabled={!customPackage.trim()}
                className="px-4 py-2.5 text-xs font-bold bg-[#f0f4ff] border border-blue-200/60 text-[#1e293b] rounded-2xl
                           hover:bg-blue-50/60 hover:border-blue-300/60 disabled:opacity-30 transition-all"
              >
                追加
              </button>
            </div>

            {/* 選択中パッケージのタグ表示 */}
            {extraPackages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {extraPackages.map((pkg) => {
                  const def = DIAGRAM_PACKAGE_DEFS.find((d) => d.id === pkg);
                  return (
                    <span
                      key={pkg}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#334155]/[0.08] text-[#334155] rounded-full text-[10px] font-bold"
                    >
                      {def?.name || pkg}
                      <button
                        onClick={() => setExtraPackages((prev) => prev.filter((p) => p !== pkg))}
                        className="ml-0.5 text-[#334155] hover:text-[#64748b] leading-none"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 8: 生成中 ═══════ */}
      {step === 8 && generating && (
        <div className="wizard-section-enter">
          <div className="card-glossy generating-glow">
            <div className="flex flex-col items-center justify-center py-24 px-8 relative z-10">
              {/* スピナー */}
              <div className="relative mb-8">
                <div className="absolute inset-[-12px] rounded-full border-2 border-[#2563eb]/15 animate-pulse" />
                <div className="bg-[#2563eb] relative w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ boxShadow: '0 1px 3px rgba(37,99,235,0.20), 0 4px 12px rgba(37,99,235,0.10)' }}>
                  <svg className="animate-spin h-7 w-7 text-white relative z-10" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              </div>
              <p className="text-lg font-bold text-[#1e293b] mb-2 tracking-[-0.02em]">問題を生成しています</p>
              <p className="text-sm text-[#1e293b] font-medium">{status}</p>
              <p className="text-[13px] text-[#94a3b8] mt-4">しばらくお待ちください...</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 9: 結果表示（完成） ═══════ */}
      {step === 9 && (
        <div className="space-y-6 wizard-section-enter">
          {/* RAG フィードバックカード */}
          {renderContext && (
            <div className={`rounded-2xl border text-xs px-5 py-4 shadow-sm ${
              renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0
                ? 'bg-[#2563eb]/[0.08] border-[#2563eb]/20'
                : renderContext.rag_status === 'no_data'
                  ? 'bg-[#2563eb]/[0.05] border-[#2563eb]/[0.12]'
                  : 'bg-blue-50/60 border-blue-200/60'
            }`}>
              <div className="flex items-center gap-2 flex-wrap">
                {/* ステータスアイコン */}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0
                    ? 'bg-[#2563eb]/[0.06] text-[#1e293b]'
                    : renderContext.rag_status === 'no_data'
                      ? 'bg-blue-100/70 text-[#334155]'
                      : 'bg-blue-100/50 text-[#64748b]'
                }`}>
                  {renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0 ? '✓' : renderContext.rag_status === 'no_data' ? 'i' : '—'}
                </span>

                <div className="flex-1">
                  {renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0 ? (
                    <div>
                      <span className="font-bold text-[#1e293b]">
                        過去問 {renderContext.rag_retrieved}件を参照して生成しました
                      </span>
                      <span className="text-[#1e293b] ml-1">（データ {renderContext.chunk_count}件中）</span>
                    </div>
                  ) : renderContext.rag_status === 'no_data' ? (
                    <div>
                      <span className="font-bold text-[#334155]">AIのみで問題を生成しました</span>
                      <p className="text-[#475569] mt-0.5">
                        過去問を登録すると、それを参考にしてより精度の高い問題を生成できます                      </p>
                    </div>
                  ) : renderContext.rag_status === 'empty' ? (
                    <div>
                      <span className="font-bold text-[#1e293b]">AIのみで問題を生成しました</span>
                      <p className="text-[#64748b] mt-0.5">
                        この条件に合う過去問がデータ内に見つかりませんでした（{renderContext.chunk_count}件を検索）
                      </p>
                    </div>
                  ) : renderContext.rag_status === 'fallback' ? (
                    <div>
                      <span className="font-bold text-[#1e293b]">過去問が見つからず、AIのみで生成しました</span>
                      <p className="text-[#64748b] mt-0.5">
                        この条件に合う過去問がデータ内に見つかりませんでした（{renderContext.chunk_count}件を検索）
                      </p>
                    </div>
                  ) : renderContext.chunk_count > 0 ? (
                    <span className="text-[#1e293b] font-bold">
                      {renderContext.chunk_count}件を参照して生成
                    </span>
                  ) : (
                    <span className="text-[#64748b]">過去問未参照 — AIのみで生成</span>
                  )}
                </div>

                {/* 検索方式バッジ */}
                {renderContext.rag_method && (
                  <span className="px-1.5 py-0.5 rounded bg-[#f0f4ff] text-[#64748b] text-[9px] font-bold uppercase">
                    {renderContext.rag_method === 'hybrid' ? '統合検索' : renderContext.rag_method === 'semantic' ? 'AI検索' : renderContext.rag_method}
                  </span>
                )}
              </div>
              {/* ベース問題使用時の表示 */}
              {sourceText.trim() && (
                <div className="mt-2 pt-2 border-t border-blue-200/60 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#475569] flex-shrink-0" />
                  <span className="text-[10px] text-[#475569] font-bold">参考問題をもとに類題を生成</span>
                  <span className="text-[10px] text-[#475569] truncate max-w-[200px]">
                    — {sourceText.trim().slice(0, 50)}{sourceText.trim().length > 50 ? '...' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* AI自動生成の結果 */}
          {mode === 'auto' && generatedLatex && (
            <div className="card-glossy">
              <div className="p-5 relative z-10">
                {/* ヘッダー */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="icon-glossy w-10 h-10"
                    style={{ background: 'linear-gradient(145deg, #38d260 0%, #30b855 50%, #248a3d 100%)' }}>
                    <Icons.Success className="w-5 h-5 text-white relative z-10" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#1e293b] tracking-tight">生成結果</h3>
                    <p className="text-[11px] text-[#64748b]">AIが生成した問題のプレビュー</p>
                  </div>
                </div>
              <div className="space-y-4">
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-4 bg-[#2563eb]/[0.08] text-[#1e293b] rounded-xl border border-[#2563eb]/20 font-bold hover:bg-[#2563eb]/[0.08] transition-colors"
                  >
                    <Icons.Pdf /> PDF を別タブで開く
                  </a>
                )}

                <details className="group">
                  <summary className="cursor-pointer text-[#64748b] text-xs font-bold hover:text-[#1e293b] transition-colors list-none flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-blue-50/60 flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">
                      ▸
                    </span>
                    ソースを表示・編集
                  </summary>
                  <div className="mt-3">
                    <TextArea
                      value={generatedLatex}
                      onChange={(v) => {
                        setGeneratedLatex(v);
                        setLlmOutput(v);
                      }}
                      rows={10}
                    />
                    <div className="mt-2 flex gap-2">
                      <CopyButton text={generatedLatex} onCopied={setStatus} />
                      <Button variant="ghost" size="sm" onClick={() => compilePdf(generatedLatex)} disabled={pdfWorking}>
                        <Icons.Pdf className="w-4 h-4 mr-1" /> PDFを再作成
                      </Button>
                    </div>
                  </div>
                </details>

                {prompt && (
                  <details className="group">
                    <summary className="cursor-pointer text-[#64748b] text-xs font-bold hover:text-[#1e293b] transition-colors list-none flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-blue-50/60 flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">
                        ▸
                      </span>
                      使用された指示文を確認
                    </summary>
                    <div className="mt-3">
                      <TextArea value={prompt} rows={8} readOnly />
                      <div className="mt-2 flex items-center gap-2">
                        <CopyButton text={prompt} onCopied={setStatus} />
                        {renderContext?.chunk_count > 0 && (
                          <span className="text-xs text-[#1e293b] font-medium">
                            過去問 {renderContext.chunk_count}件を参照
                          </span>
                        )}
                      </div>
                    </div>
                  </details>
                )}
              </div>
              </div>
            </div>
          )}

          {/* 手動モード — 出力貼り付け */}
          {mode === 'manual' && prompt && (
            <div className="manual-output-card">
              {/* コピー完了バナー */}
              <div className="manual-output-banner">
                <div className="manual-output-banner-icon">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-[#1e293b] tracking-tight">
                    指示文をクリップボードにコピー済み
                  </p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">
                    ChatGPT や Claude に貼り付けて実行してください
                  </p>
                </div>
                {renderContext?.chunk_count > 0 && (
                  <span className="text-[11px] font-medium text-[#1e293b] bg-[#2563eb]/[0.06] px-2.5 py-1 rounded-full flex-shrink-0">
                    過去問 {renderContext.chunk_count}件参照
                  </span>
                )}
                <CopyButton text={prompt} onCopied={setStatus} label="再コピー" />
              </div>

              {/* メインエリア */}
              <div className="p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-lg mb-4">
                    <svg className="w-7 h-7 text-white/90" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#1e293b] tracking-tight">AI の出力を貼り付け</h3>
                  <p className="text-[13px] text-[#64748b] mt-1">
                    AI から返ってきた LaTeX コードをここに貼り付けてください
                  </p>
                </div>

                <TextArea
                  label=""
                  value={llmOutput}
                  onChange={setLlmOutput}
                  rows={12}
                  placeholder="AI の出力（LaTeX コード）をここに貼り付け..."
                />

                <div className="mt-5">
                  <button
                    onClick={() => compilePdf()}
                    disabled={!llmOutput || pdfWorking}
                    className="manual-pdf-btn w-full"
                  >
                    {pdfWorking ? (
                      <span className="flex items-center justify-center gap-2.5">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        PDF を生成中...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2.5">
                        <Icons.Pdf className="w-5 h-5" /> PDF を生成
                      </span>
                    )}
                  </button>
                </div>

                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="manual-pdf-success mt-4"
                  >
                    <Icons.Pdf className="w-5 h-5" />
                    PDF を別タブで開く
                    <svg className="w-4 h-4 ml-auto opacity-40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ ナビゲーションボタン ═══════ */}
      <div ref={nextActionRef} className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-8 sm:mt-10 mb-4 sm:mb-0 nav-glow-in">
        <div>
          {step > 1 && step <= 8 && (
            <Button variant="ghost" onClick={goBack} className="w-full sm:w-auto">
              ← 戻る
            </Button>
          )}
          {step === 9 && (
            <Button variant="ghost" onClick={goBack} className="w-full sm:w-auto">
              ← 設定を変更
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {step === 9 && (
            <Button variant="ghost" onClick={resetWizard} className="w-full sm:w-auto">
              最初からやり直す
            </Button>
          )}
          {step >= 1 && step <= 7 && (
            <Button onClick={goNext} disabled={!canNext()} className={`w-full sm:w-auto transition-all duration-500 ${canNext() ? 'cta-glass cta-breathe !py-3.5 !text-base !rounded-2xl' : ''}`}>
              {canNext() ? '次のステップへ →' : (step === 1 ? 'パターンを選んでください' : step === 2 ? '教科を選んでください' : step === 4 ? '難易度を選んでください' : '次へ')}
            </Button>
          )}
          {step === 8 && mode === 'auto' && (
            <Button
              onClick={goNext}
              disabled={generating}
              className={`w-full sm:w-auto px-6 py-3 !text-base !rounded-2xl ${!generating ? 'cta-glass cta-breathe' : ''}`}
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  生成中...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Icons.Pdf className="w-4 h-4" /> PDF を生成
                </span>
              )}
            </Button>
          )}
          {step === 8 && mode === 'manual' && (
            <button
              onClick={goNext}
              disabled={promptGenerating}
              className={`manual-generate-btn ${!promptGenerating ? 'cta-breathe' : ''}`}
            >
              {promptGenerating ? (
                <span className="flex items-center justify-center gap-2.5">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  指示文を作成中...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Icons.Prompt className="w-4 h-4" /> 指示文を作成してコピー
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
