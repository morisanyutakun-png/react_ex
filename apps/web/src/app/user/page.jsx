'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { renderTemplate, generatePdf, fetchLatexPresets, generateWithLlm, searchProblems, createTemplate, DIAGRAM_PACKAGE_DEFS } from '@/lib/api';
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
import { SUBJECTS, SUBJECT_TOPICS, DIFFICULTIES, difficultyLabel, buildTemplatePrompt, buildTemplateId } from '@/lib/constants';
import { LatexText } from '@/components/LatexRenderer';

/* ── ウィザードステップ定義 ── */
const STEPS = ['テンプレート選択', '設定', 'PDF形式', '生成', '結果'];

/* ── 各LaTeX図表パッケージのASCIIアートプレビュー ── */
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

/* ── 各PDF形式のASCIIアートレイアウト図 ── */
const PRESET_ILLUSTRATIONS = {
  exam: `┌─────────────────┐
│  第1問 [10点]   │
│  問題文...      │
│                 │
│  第2問 [15点]   │
│  問題文...      │
│  ─── 解答 ─── │
│  1. 解答...     │
└─────────────────┘`,
  worksheet: `┌─────────────────┐
│名前:____ 日付:__│
│  学習プリント   │
│  1. 問題文...   │
│  解答:          │
│  _____________  │
│  2. 問題文...   │
└─────────────────┘`,
  flashcard: `┌─────────────────┐
│  問題  │  解答  │
│────────┼────── │
│  Q1... │  A1.. │
│  Q2... │  A2.. │
│  Q3... │  A3.. │
│  Q4... │  A4.. │
└─────────────────┘`,
  mock_exam: `┌─────────────────┐
│  模擬試験  60分 │
│ 【注意事項】    │
│ ・解答欄に記入  │
│ 第1問  (30点)   │
│  (1) 問題...    │
│  (2) 問題...    │
└─────────────────┘`,
  report: `┌─────────────────┐
│ 第1問           │
│【問題】問題文.. │
│【解法】         │
│  途中式...      │
│【ポイント】     │
│  重要公式...    │
└─────────────────┘`,
  minimal: `┌─────────────────┐
│                 │
│ 問1. 問題文...  │
│                 │
│ 問2. 問題文...  │
│                 │
│ 解答: ...       │
└─────────────────┘`,
};

export default function UserModePage() {
  const { templates, subjects, refresh } = useTemplates();

  /* ── ウィザード状態 ── */
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState('');

  /* ── テンプレート新規作成 ── */
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTplSubject, setNewTplSubject] = useState('');
  const [newTplCustomSubject, setNewTplCustomSubject] = useState('');
  const [newTplField, setNewTplField] = useState('');
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
    setStatus(`テンプレート「${label}」を作成中...`);
    try {
      await createTemplate({
        id,
        name: `${label} テンプレート`,
        description: `${label} の問題を生成するテンプレート`,
        prompt: buildTemplatePrompt(effectiveNewSubject, f),
        metadata: { subject: effectiveNewSubject, field: f || null, difficulty: newTplDifficulty, auto_generated: true },
      });
      await refresh();
      setTemplateId(id);
      setSubject(effectiveNewSubject);
      if (f) setField(f);
      setDifficulty(newTplDifficulty);
      setStatus(`テンプレート「${label}」を作成しました`);
      setShowCreateTemplate(false);
      setNewTplSubject(''); setNewTplCustomSubject(''); setNewTplField(''); setNewTplDifficulty('');
    } catch (e) { setStatus(`作成失敗: ${e.message}`); }
    setCreatingTemplate(false);
  };

  /* ── フォーム状態 ── */
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [field, setField] = useState('');
  const [difficulty, setDifficulty] = useState('普通');
  const [numQuestions, setNumQuestions] = useState(1);
  const [topK, setTopK] = useState(5);
  const [latexPresets, setLatexPresets] = useState([]);
  const [latexPreset, setLatexPreset] = useState('exam');

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
  const [baseSearchQuery, setBaseSearchQuery] = useState('');
  const [baseSearchResults, setBaseSearchResults] = useState([]);
  const [baseSearching, setBaseSearching] = useState(false);
  const [selectedBaseProblem, setSelectedBaseProblem] = useState(null);
  const baseSearchInputRef = useRef(null);

  /* ── ベース問題（過去問）参照: 選択された問題のテキストを sourceText として使う ── */
  const sourceText = selectedBaseProblem?.stem || selectedBaseProblem?.text || '';

  /* ── DB検索関数 ── */
  const doBaseSearch = useCallback(async () => {
    const q = baseSearchQuery.trim();
    if (!q) return;
    setBaseSearching(true);
    try {
      const params = { q, limit: 10 };
      // テンプレートの科目でフィルタ
      if (subject) params.subject = subject;
      const data = await searchProblems(params);
      const items = data.results || data.problems || data || [];
      setBaseSearchResults(Array.isArray(items) ? items : []);
    } catch {
      setBaseSearchResults([]);
    }
    setBaseSearching(false);
  }, [baseSearchQuery, subject]);

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

  const onSelectTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl?.metadata) {
      if (tpl.metadata.subject) setSubject(tpl.metadata.subject);
      if (tpl.metadata.field) setField(tpl.metadata.field);
      if (tpl.metadata.difficulty) setDifficulty(tpl.metadata.difficulty);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === templateId) || null;

  /* ── AI自動生成: プロンプト→Groq→LaTeX→PDF ── */
  const handleAutoGenerate = async () => {
    if (!templateId) {
      setStatus('テンプレートを選択してください');
      return;
    }
    setGenerating(true);
    setGeneratedLatex('');
    setPdfUrl('');
    setStep(4);

    setStatus('Step 1/3: プロンプトを生成中...');
    let generatedPrompt = '';
    try {
      const data = await renderTemplate({
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
        ...(sourceText.trim() ? { source_text: sourceText.trim() } : {}),
      });
      generatedPrompt = data.rendered_prompt || data.rendered || '';
      setRenderContext(data.context || null);
      setPrompt(generatedPrompt);

      // RAGフィードバックをステータスに反映
      const ctx = data.context;
      if (ctx?.rag_status === 'ok' && ctx?.rag_retrieved > 0) {
        setStatus(`Step 1/3 完了: 過去問 ${ctx.rag_retrieved}件を参照`);
      } else if (ctx?.rag_status === 'no_data') {
        setStatus('Step 1/3 完了: AIのみで生成（DB登録で精度UP）');
      } else if (ctx?.rag_status === 'fallback') {
        setStatus(`Step 1/3 完了: 過去問 ${ctx?.rag_retrieved || ctx?.chunk_count || 0}件を参照`);
      } else {
        setStatus('Step 1/3 完了');
      }
    } catch (e) {
      setStatus(`プロンプト生成エラー: ${e.message}`);
      setGenerating(false);
      return;
    }

    if (!generatedPrompt?.trim()) {
      setStatus('プロンプトの生成に失敗しました');
      setGenerating(false);
      return;
    }

    setStatus('Step 2/3: AI が問題を生成中...');
    try {
      const data = await generateWithLlm({
        prompt: generatedPrompt,
        latex_preset: latexPreset,
        title: `${subject} - ${difficulty}`,
        extra_packages: extraPackages,
        subject: subject || '',
        field: field || '',
      });

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
        setStep(5);
      } else if (data?.pdf_error) {
        setStatus(`LaTeX 生成成功 / PDF 変換失敗: ${data.pdf_error}`);
        setStep(5);
      } else {
        setStatus('LaTeX 生成完了（PDF エンジン未設定）');
        setStep(5);
      }
    } catch (e) {
      setStatus(`生成エラー: ${e.message}`);
    }
    setGenerating(false);
  };

  /* ── 手動: プロンプト生成のみ ── */
  const generatePrompt = async () => {
    if (!templateId) {
      setStatus('テンプレートを選択してください');
      return;
    }
    setStatus('プロンプトを生成中（RAG含む）...');
    try {
      const data = await renderTemplate({
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
        ...(sourceText.trim() ? { source_text: sourceText.trim() } : {}),
      });
      setRenderContext(data.context || null);
      setPrompt(data.rendered_prompt || data.rendered || '');
      setStatus(
        data.context?.chunk_count
          ? `プロンプト生成完了（RAG: ${data.context.chunk_count}件参照）`
          : 'プロンプト生成完了'
      );
      setStep(5);
    } catch (e) {
      setStatus(`エラー: ${e.message}`);
    }
  };

  /* ── 手動PDF変換 ── */
  const compilePdf = async (latex) => {
    const src = latex || llmOutput;
    if (!src?.trim()) {
      setStatus('LaTeX を入力してください');
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
        setStatus('PDF 生成失敗: サーバーに LaTeX エンジンがインストールされていません');
      }
    } catch (e) {
      setStatus(`PDF 生成失敗: ${e.message}`);
    }
    setPdfWorking(false);
  };

  /* ── 次/前ステップ ── */
  const canNext = () => {
    if (step === 1) return !!templateId;
    if (step === 2) return true;
    if (step === 3) return true;
    return false;
  };

  const goNext = () => {
    if (step === 3 && mode === 'auto') {
      handleAutoGenerate();
    } else if (step === 3 && mode === 'manual') {
      generatePrompt();
    } else if (canNext()) {
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 1 && step < 4) setStep(step - 1);
    if (step === 5) setStep(3);
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
    setBaseSearchQuery('');
    setBaseSearchResults([]);
  };

  const selectedPreset = latexPresets.find((p) => p.id === latexPreset);

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 px-1 sm:px-4">
      {/* ヘッダー */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-bold mb-3 sm:mb-4 border border-black/[0.06]">
          <Icons.User className="w-4 h-4" />
          ユーザモード
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#1d1d1f]">
          問題を生成する
        </h1>
        <p className="text-xs sm:text-sm text-[#6e6e73] mt-1">
          ステップに沿って操作するだけで、試験問題の PDF が完成します
        </p>
      </div>

      {/* プログレスバー */}
      <div className="mb-6 sm:mb-8">
        <ProgressSteps steps={STEPS} current={step} />
      </div>

      <StatusBar message={status} />

      {/* ═══════ Step 1: テンプレート選択 ═══════ */}
      {step === 1 && (
        <SectionCard title="Step 1: テンプレートを選ぶ" icon={<Icons.File />}>
          <p className="text-xs text-[#6e6e73] mb-4">
            問題の元となるテンプレートを選んでください。科目・分野・難易度はテンプレートに含まれています。
          </p>

          <div className="space-y-3">
            {/* テンプレート一覧 */}
            {templates.length === 0 && !showCreateTemplate ? (
              <div className="text-center py-8 text-[#1d1d1f]0">
                <Icons.Empty className="mx-auto mb-2" />
                <p className="text-sm">テンプレートがありません</p>
                <p className="text-xs mt-1">下の「+ 新規作成」ボタンからテンプレートを作成してください</p>
              </div>
            ) : !showCreateTemplate ? (
              <div className="grid gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelectTemplate(t.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      templateId === t.id
                        ? 'border-red-600 bg-red-50'
                        : 'border-black/[0.06] bg-white hover:border-red-600/50 hover:bg-black/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-[#1d1d1f]">
                          {t.name || t.id}
                        </div>
                        {t.description && (
                          <div className="text-xs text-[#6e6e73] mt-0.5">{t.description}</div>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {t.metadata?.subject && (
                          <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-bold">
                            {t.metadata.subject}
                          </span>
                        )}
                        {t.metadata?.field && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
                            {t.metadata.field}
                          </span>
                        )}
                        {t.metadata?.difficulty && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">
                            {t.metadata.difficulty}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {/* ── テンプレート新規作成フォーム ── */}
            {showCreateTemplate ? (
              <div className="p-5 bg-[#f5f5f7] rounded-xl border border-black/[0.06] space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-[#1d1d1f]">テンプレートを新規作成</h3>
                </div>
                <p className="text-xs text-[#6e6e73]">
                  教科と分野を選ぶだけで、テンプレートが自動生成されます。
                </p>

                {/* 教科 + 難易度 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField
                    label="教科 *"
                    value={newTplSubject}
                    onChange={(v) => { setNewTplSubject(v); setNewTplField(''); }}
                    options={[
                      { value: '', label: '— 選択してください —' },
                      ...(subjects.length ? subjects : SUBJECTS).map((s) => ({ value: s, label: s })),
                      { value: '__custom', label: '✏️ その他（入力）' },
                    ]}
                  />
                  <SelectField
                    label="難易度 *"
                    value={newTplDifficulty}
                    onChange={setNewTplDifficulty}
                    options={[
                      { value: '', label: '— 選択してください —' },
                      ...DIFFICULTIES.map((d) => ({ value: d, label: d })),
                    ]}
                  />
                </div>

                {/* カスタム教科入力 */}
                {newTplSubject === '__custom' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#6e6e73] mb-1.5">教科名（入力）</label>
                    <input
                      value={newTplCustomSubject}
                      onChange={(e) => setNewTplCustomSubject(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] bg-white text-sm text-[#1d1d1f] outline-none
                        hover:border-black/[0.12] focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all placeholder:text-[#aeaeb2]"
                      placeholder="例: 地学"
                      autoFocus
                    />
                  </div>
                )}

                {/* 分野 */}
                {newTplFieldOptions.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-[#6e6e73] mb-1.5">
                      分野
                      <span className="text-[10px] font-normal text-[#1d1d1f]0 ml-1">（任意）</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {newTplFieldOptions.slice(0, 15).map((f) => (
                        <button key={f} type="button"
                          onClick={() => setNewTplField(newTplField === f ? '' : f)}
                          className={`px-2.5 py-1 text-xs rounded-xl border transition-all ${
                            newTplField === f
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-[#6e6e73] border-black/[0.08] hover:border-red-600 hover:text-red-600'
                          }`}>
                          {f}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={newTplField}
                      onChange={(e) => setNewTplField(e.target.value)}
                      placeholder="候補から選択 or 自由入力"
                      className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] bg-white text-sm text-[#1d1d1f] outline-none
                        hover:border-black/[0.12] focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all placeholder:text-[#aeaeb2]"
                    />
                  </div>
                )}

                {/* 作成ボタン */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleCreateTemplate}
                    disabled={creatingTemplate || !effectiveNewSubject || !newTplDifficulty}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold
                               bg-red-600 text-white
                               hover:bg-red-700
                               disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {creatingTemplate ? '作成中...' : 'テンプレートを作成'}
                  </button>
                  <button
                    onClick={() => { setShowCreateTemplate(false); setNewTplSubject(''); setNewTplCustomSubject(''); setNewTplField(''); setNewTplDifficulty(''); }}
                    className="px-4 py-3 rounded-xl text-sm font-medium text-[#6e6e73] hover:text-[#424245] hover:bg-black/[0.04] transition-all"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              /* ── 新規作成ボタン ── */
              <button
                onClick={() => setShowCreateTemplate(true)}
                className="w-full p-4 rounded-xl border border-dashed border-black/[0.08] text-[#6e6e73]
                           hover:border-red-600 hover:text-red-600 hover:bg-red-50
                           transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-sm font-bold">テンプレートを新規作成</span>
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {/* ═══════ Step 2: 設定 ═══════ */}
      {step === 2 && (
        <SectionCard title="Step 2: 生成設定" icon={<Icons.Prompt />}>
          <p className="text-xs text-[#6e6e73] mb-5">
            問題数やRAG参照数を設定し、必要に応じてベースにする過去問をDBから選択してください。
          </p>

          <div className="space-y-4">
            {/* 選択中テンプレート表示（科目・分野・難易度もここに表示） */}
            {selectedTemplate && (
              <div className="p-3 bg-[#f5f5f7] rounded-xl border border-black/[0.06]">
                <div className="flex items-center gap-3">
                  <Icons.File className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[#1d1d1f]">{selectedTemplate.name}</div>
                    <div className="text-xs text-[#6e6e73]">{selectedTemplate.description}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                  {subject && (
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-bold">
                      科目: {subject}
                    </span>
                  )}
                  {field && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
                      分野: {field}
                    </span>
                  )}
                  {difficulty && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">
                      難易度: {difficulty}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 問題数 + RAG参照数 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField label="問題数" value={numQuestions} onChange={setNumQuestions} min={1} max={20} />
              <NumberField label="参照する過去問数（RAG）" value={topK} onChange={setTopK} min={1} max={20} />
            </div>

            {/* RAG の仕組み説明（折りたたみ） */}
            <details className="rounded-xl border border-black/[0.06] bg-[#f5f5f7]">
              <summary className="px-3 py-2 cursor-pointer text-xs font-bold text-[#6e6e73] hover:text-red-600 select-none">
                💡 「過去問参照（RAG）」の仕組みを見る
              </summary>
              <div className="px-3 pb-3 text-xs text-[#6e6e73] leading-relaxed space-y-1.5">
                <p>このシステムは、DBに登録された過去問を参考にして新しい問題を作ります。</p>
                <div className="bg-white rounded-xl p-2 border border-black/[0.06] space-y-1">
                  <div className="flex gap-2"><span className="text-red-600 font-bold">1.</span> <span>テンプレートの科目・分野を基にDBから関連する過去問を検索</span></div>
                  <div className="flex gap-2"><span className="text-red-600 font-bold">2.</span> <span>最も似ている問題を自動でランク付け（難易度も考慮）</span></div>
                  <div className="flex gap-2"><span className="text-red-600 font-bold">3.</span> <span>上位の過去問をAIに参考資料として渡し、類題を生成</span></div>
                </div>
                <p className="text-[#1d1d1f]0">
                  下の「ベース過去問」を選択すると、その問題に沿った類題をさらに正確に生成できます。
                </p>
              </div>
            </details>

            {/* ── ベース過去問選択（DB検索） ── */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-xs font-semibold text-[#6e6e73]">
                  ベース過去問を選択
                </label>
                <span className="text-[10px] text-[#1d1d1f]0">（任意）</span>
              </div>
              <p className="text-xs text-[#6e6e73] mb-2">
                DBから過去問を検索して選択すると、その問題に沿った類題を生成します。
              </p>

              {/* 選択済み問題の表示 */}
              {selectedBaseProblem ? (
                <div className="mb-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="text-[10px] text-amber-600 font-bold">選択中のベース問題</span>
                        {selectedBaseProblem.id && (
                          <span className="text-[10px] text-amber-500 font-mono">#{selectedBaseProblem.id}</span>
                        )}
                      </div>
                      <div className="text-xs text-[#1d1d1f] leading-relaxed line-clamp-3">
                        <LatexText>{(selectedBaseProblem.stem || selectedBaseProblem.text || '').slice(0, 200)}</LatexText>
                      </div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {selectedBaseProblem.subject && (
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[9px] font-bold">{selectedBaseProblem.subject}</span>
                        )}
                        {(selectedBaseProblem.topic || selectedBaseProblem.metadata?.field) && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold">{selectedBaseProblem.topic || selectedBaseProblem.metadata?.field}</span>
                        )}
                        {selectedBaseProblem.difficulty != null && (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-bold">{difficultyLabel(selectedBaseProblem.difficulty)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedBaseProblem(null)}
                      className="px-2 py-1 text-[10px] text-amber-600 hover:text-amber-300 bg-amber-50 hover:bg-amber-900/50 rounded-xl font-bold transition-colors flex-shrink-0"
                    >
                      解除
                    </button>
                  </div>
                </div>
              ) : null}

              {/* DB検索フォーム */}
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1d1d1f]0 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={baseSearchInputRef}
                    type="text"
                    value={baseSearchQuery}
                    onChange={(e) => setBaseSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') doBaseSearch(); }}
                    placeholder="キーワードで過去問を検索..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs
                               text-[#1d1d1f] transition-all hover:border-black/[0.12] focus:border-red-500
                               focus:ring-4 focus:ring-red-600/10 outline-none placeholder:text-[#aeaeb2]"
                  />
                </div>
                <button
                  onClick={doBaseSearch}
                  disabled={baseSearching || !baseSearchQuery.trim()}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-50 text-red-600
                             hover:bg-red-900/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed
                             flex items-center gap-1.5"
                >
                  {baseSearching ? (
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

              {/* 検索結果一覧 */}
              {baseSearchResults.length > 0 && (
                <div className="border border-black/[0.06] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  {baseSearchResults.map((item, idx) => {
                    const isSelected = selectedBaseProblem?.id === item.id;
                    return (
                      <button
                        key={item.id ?? idx}
                        onClick={() => {
                          setSelectedBaseProblem(item);
                          setBaseSearchResults([]);
                          setBaseSearchQuery('');
                        }}
                        className={`w-full text-left px-3 py-2.5 border-b border-black/[0.06] last:border-b-0
                                    transition-all hover:bg-red-50 ${
                                      isSelected ? 'bg-amber-50' : 'bg-white'
                                    }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] text-[#1d1d1f]0 font-mono mt-0.5 flex-shrink-0">#{item.id ?? idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-[#1d1d1f] leading-relaxed line-clamp-2">
                              <LatexText>{(item.stem || item.text || '').slice(0, 150)}</LatexText>
                            </div>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {item.subject && (
                                <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[9px] font-bold">{item.subject}</span>
                              )}
                              {(item.topic || item.metadata?.field) && (
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold">{item.topic || item.metadata?.field}</span>
                              )}
                              {item.difficulty != null && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-bold">{difficultyLabel(item.difficulty)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 検索結果が0件の場合 */}
              {baseSearchResults.length === 0 && baseSearchQuery && !baseSearching && baseSearchResults !== null && (
                <div className="text-center py-3 text-xs text-[#6e6e73]">
                  該当する問題が見つかりません
                </div>
              )}
            </div>

            {/* モード選択 */}
            <div>
              <label className="block text-xs font-semibold text-[#6e6e73] mb-2">
                生成方法
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('auto')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    mode === 'auto'
                      ? 'border-red-600 bg-red-50'
                      : 'border-black/[0.06] hover:border-red-600/50'
                  }`}
                >
                  <div className="text-sm font-bold text-[#1d1d1f]">AI 自動生成</div>
                  <div className="text-xs text-[#6e6e73] mt-0.5">
                    ワンクリックで PDF まで自動作成
                  </div>
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    mode === 'manual'
                      ? 'border-[#6e6e73] bg-[#f5f5f7]'
                      : 'border-black/[0.06] hover:border-black/[0.12]'
                  }`}
                >
                  <div className="text-sm font-bold text-[#1d1d1f]">手動</div>
                  <div className="text-xs text-[#6e6e73] mt-0.5">
                    プロンプトを取得して自分で LLM に送る
                  </div>
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ═══════ Step 3: PDF形式選択 ═══════ */}
      {step === 3 && (
        <SectionCard title="Step 3: PDF の出力形式を選ぶ" icon={<Icons.Pdf />}>
          {/* 選択中テンプレート情報 */}
          {selectedTemplate && (
            <div className="mb-5 p-3 bg-[#f5f5f7] rounded-xl border border-black/[0.06]">
              <div className="flex items-center gap-3">
                <Icons.File className="w-4 h-4 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-[#6e6e73] mb-0.5">選択中のテンプレート</div>
                  <div className="text-sm font-bold text-[#1d1d1f]">{selectedTemplate.name}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                {subject && (
                  <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-bold">
                    科目: {subject}
                  </span>
                )}
                {field && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
                    分野: {field}
                  </span>
                )}
                {difficulty && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">
                    難易度: {difficulty}
                  </span>
                )}
                {numQuestions && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">
                    問題数: {numQuestions}
                  </span>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-[#6e6e73] mb-5">
            生成する PDF のレイアウト形式を選んでください。
            {mode === 'auto'
              ? ' 選択後、「PDF を生成」ボタンで自動生成が始まります。'
              : ' 選択後、「プロンプトを生成」ボタンでプロンプトが作成されます。'}
          </p>

          {latexPresets.length === 0 ? (
            <div className="text-center py-8 text-[#1d1d1f]0">
              <Icons.Empty className="mx-auto mb-2" />
              <p className="text-sm">形式を読み込み中...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {latexPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setLatexPreset(p.id)}
                  className={`text-left rounded-xl border transition-all overflow-hidden ${
                    latexPreset === p.id
                      ? 'border-red-600 bg-red-50'
                      : 'border-black/[0.06] bg-white hover:border-red-600/50 hover:bg-black/[0.04]'
                  }`}
                >
                  {/* ASCIIアートイラスト */}
                  <div
                    className={`px-3 pt-3 pb-2 rounded-t-lg ${
                      latexPreset === p.id ? 'bg-red-50' : 'bg-[#f5f5f7]'
                    }`}
                  >
                    <pre
                      className={`text-[9px] leading-[1.4] font-mono select-none ${
                        latexPreset === p.id ? 'text-red-600' : 'text-[#1d1d1f]0'
                      }`}
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
                    >
                      {PRESET_ILLUSTRATIONS[p.id] || ''}
                    </pre>
                  </div>
                  {/* ラベル */}
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {latexPreset === p.id && (
                        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                      )}
                      <div className="text-sm font-bold text-[#1d1d1f]">{p.name}</div>
                    </div>
                    <div className="text-[10px] text-[#6e6e73] mt-0.5 leading-tight">
                      {p.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 選択中プレビュー */}
          {selectedPreset && (
            <div className="mt-4 px-3 py-2.5 bg-red-50 rounded-xl border border-red-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              <span className="text-xs font-bold text-red-600">{selectedPreset.name}</span>
              <span className="text-xs text-red-600">{selectedPreset.description}</span>
            </div>
          )}

          {/* ── 図表パッケージ選択 ── */}
          <div className="mt-6 border-t border-black/[0.06] pt-5">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-xs font-semibold text-[#6e6e73]">
                LaTeX 図表パッケージ
              </label>
              <span className="text-[10px] text-[#1d1d1f]0">（任意）</span>
            </div>
            <p className="text-xs text-[#6e6e73] mb-3">
              図・グラフ・コードが必要な場合に選択してください。不要なら選ばなくてOKです。
            </p>

            {/* どれを選ぶ？ガイダンス */}
            <details className="mb-3 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden group">
              <summary className="px-3 py-2 text-xs font-bold text-amber-600 cursor-pointer list-none flex items-center gap-1.5 select-none">
                <span>💡</span>
                <span>どれを選べばいい？（初めての方はここを確認）</span>
                <span className="ml-auto text-amber-500 text-[9px] group-open:hidden">▶ 開く</span>
                <span className="ml-auto text-amber-500 text-[9px] hidden group-open:inline">▼ 閉じる</span>
              </summary>
              <div className="px-3 pb-3 pt-1 text-[10px] text-amber-600 space-y-1 leading-relaxed">
                <p className="font-bold">迷ったら「TikZ」だけ選べばほとんどの図が描けます。</p>
                <p>・ 電気回路の問題 → <strong>CircuiTikZ</strong></p>
                <p>・ 関数グラフ・データグラフ → <strong>PGFPlots</strong></p>
                <p>・ プログラミング問題のコード → <strong>Listings</strong></p>
                <p>・ 確率の樹形図 → <strong>Forest</strong></p>
                <p className="text-amber-500">図が不要な問題（文章・数式のみ）は何も選ばなくて大丈夫です。</p>
              </div>
            </details>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DIAGRAM_PACKAGE_DEFS.map((pkg) => {
                const active = extraPackages.includes(pkg.id);
                const illustration = PACKAGE_ILLUSTRATIONS[pkg.id];
                return (
                  <button
                    key={pkg.id}
                    onClick={() => togglePackage(pkg.id)}
                    className={`text-left rounded-xl border transition-all overflow-hidden ${
                      active
                        ? 'border-violet-400 bg-violet-50'
                        : 'border-black/[0.06] bg-white hover:border-violet-400/50 hover:bg-black/[0.04]'
                    }`}
                  >
                    {/* ASCIIアートプレビュー */}
                    {illustration && (
                      <div className={`px-3 pt-2 pb-1.5 ${active ? 'bg-violet-50' : 'bg-[#f5f5f7]'}`}>
                        <pre
                          className={`text-[8px] leading-[1.35] font-mono select-none ${
                            active ? 'text-violet-600' : 'text-[#1d1d1f]0'
                          }`}
                          style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
                        >
                          {illustration}
                        </pre>
                      </div>
                    )}
                    {/* ラベル */}
                    <div className="px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm leading-none ${active ? 'text-violet-600' : 'text-[#1d1d1f]0'}`}>
                          {pkg.icon}
                        </span>
                        <span className="text-xs font-bold text-[#1d1d1f]">{pkg.name}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          active ? 'bg-violet-50 text-violet-600' : 'bg-[#f5f5f7] text-[#1d1d1f]0'
                        }`}>
                          {pkg.label}
                        </span>
                        {pkg.recommended && (
                          <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-600">
                            おすすめ
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#6e6e73] mt-1 leading-tight">{pkg.hint || pkg.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* カスタムパッケージ入力 */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customPackage}
                onChange={(e) => setCustomPackage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomPackage()}
                placeholder="カスタムパッケージ名（例: chemfig）"
                className="flex-1 px-3 py-2 text-xs border border-black/[0.08] bg-white rounded-xl focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/40 placeholder:text-[#aeaeb2]"
              />
              <button
                onClick={addCustomPackage}
                disabled={!customPackage.trim()}
                className="px-3 py-2 text-xs font-bold bg-[#f5f5f7] text-[#6e6e73] rounded-xl hover:bg-violet-50 hover:text-violet-600 disabled:opacity-40 transition-colors"
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
                      className="inline-flex items-center gap-1 px-2 py-1 bg-violet-50 text-violet-600 rounded-full text-[10px] font-bold"
                    >
                      {def?.name || pkg}
                      <button
                        onClick={() => setExtraPackages((prev) => prev.filter((p) => p !== pkg))}
                        className="ml-0.5 text-violet-500 hover:text-violet-300 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ═══════ Step 4: 生成中 ═══════ */}
      {step === 4 && generating && (
        <SectionCard>
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="animate-spin h-10 w-10 text-red-600 mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-semibold text-red-600">{status}</p>
            <p className="text-xs text-[#1d1d1f]0 mt-2">しばらくお待ちください...</p>
          </div>
        </SectionCard>
      )}

      {/* ═══════ Step 5: 結果表示 ═══════ */}
      {step === 5 && (
        <div className="space-y-4">
          {/* RAG フィードバックカード */}
          {renderContext && (
            <div className={`px-4 py-3 rounded-xl border text-xs ${
              renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0
                ? 'bg-emerald-50 border-emerald-200'
                : renderContext.rag_status === 'no_data'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-[#f5f5f7] border-black/[0.06]'
            }`}>
              <div className="flex items-center gap-2 flex-wrap">
                {/* ステータスアイコン */}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0
                    ? 'bg-emerald-900/50 text-emerald-600'
                    : renderContext.rag_status === 'no_data'
                      ? 'bg-blue-900/50 text-blue-400'
                      : 'bg-[#e5e5ea] text-[#6e6e73]'
                }`}>
                  {renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0 ? '✓' : renderContext.rag_status === 'no_data' ? 'i' : '—'}
                </span>

                <div className="flex-1">
                  {renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0 ? (
                    <div>
                      <span className="font-bold text-emerald-600">
                        過去問 {renderContext.rag_retrieved}件を参照して生成しました
                      </span>
                      <span className="text-emerald-600 ml-1">（DB {renderContext.chunk_count}件中）</span>
                    </div>
                  ) : renderContext.rag_status === 'no_data' ? (
                    <div>
                      <span className="font-bold text-blue-400">AIのみで問題を生成しました</span>
                      <p className="text-blue-500 mt-0.5">
                        💡 DB に問題を登録すると、過去問を参照してより精度の高い問題を生成できます
                      </p>
                    </div>
                  ) : renderContext.rag_status === 'empty' ? (
                    <div>
                      <span className="font-bold text-[#424245]">AIのみで問題を生成しました</span>
                      <p className="text-[#6e6e73] mt-0.5">
                        この条件に合う過去問がDB内に見つかりませんでした（{renderContext.chunk_count}件を検索）
                      </p>
                    </div>
                  ) : renderContext.rag_status === 'fallback' ? (
                    <div>
                      <span className="font-bold text-[#424245]">過去問を参照して生成しました</span>
                      <p className="text-[#6e6e73] mt-0.5">
                        DB内の問題をベースに生成しています（{renderContext.rag_retrieved || renderContext.chunk_count || 0}件参照）
                      </p>
                    </div>
                  ) : renderContext.chunk_count > 0 ? (
                    <span className="text-[#424245] font-bold">
                      {renderContext.chunk_count}件を参照して生成
                    </span>
                  ) : (
                    <span className="text-[#1d1d1f]0">RAG未使用 — AIのみで生成</span>
                  )}
                </div>

                {/* 検索方式バッジ */}
                {renderContext.rag_method && (
                  <span className="px-1.5 py-0.5 rounded bg-[#f5f5f7] text-[#1d1d1f]0 text-[9px] font-bold uppercase">
                    {renderContext.rag_method}
                  </span>
                )}
              </div>
              {/* ベース問題使用時の表示 */}
              {sourceText.trim() && (
                <div className="mt-2 pt-2 border-t border-black/[0.06] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-[10px] text-amber-600 font-bold">ベース問題を参照して類題を生成</span>
                  <span className="text-[10px] text-amber-500 truncate max-w-[200px]">
                    — {sourceText.trim().slice(0, 50)}{sourceText.trim().length > 50 ? '...' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* AI自動生成の結果 */}
          {mode === 'auto' && generatedLatex && (
            <SectionCard title="生成結果" icon={<Icons.Success />}>
              <div className="space-y-4">
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200 font-bold hover:bg-emerald-900/50 transition-colors"
                  >
                    <Icons.Pdf /> PDF を別タブで開く
                  </a>
                )}

                <details className="group">
                  <summary className="cursor-pointer text-[#6e6e73] text-xs font-bold hover:text-red-600 transition-colors list-none flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-[#f5f5f7] flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">
                      ▸
                    </span>
                    LaTeX を表示・編集
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
                        <Icons.Pdf className="w-4 h-4 mr-1" /> 再コンパイル
                      </Button>
                    </div>
                  </div>
                </details>

                {prompt && (
                  <details className="group">
                    <summary className="cursor-pointer text-[#6e6e73] text-xs font-bold hover:text-red-600 transition-colors list-none flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-[#f5f5f7] flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">
                        ▸
                      </span>
                      使用されたプロンプトを確認
                    </summary>
                    <div className="mt-3">
                      <TextArea value={prompt} rows={8} readOnly />
                      <div className="mt-2 flex items-center gap-2">
                        <CopyButton text={prompt} onCopied={setStatus} />
                        {renderContext?.chunk_count > 0 && (
                          <span className="text-xs text-red-600 font-medium">
                            RAG {renderContext.chunk_count}件参照
                          </span>
                        )}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            </SectionCard>
          )}

          {/* 手動モードの結果 */}
          {mode === 'manual' && prompt && (
            <SectionCard title="生成されたプロンプト" icon={<Icons.Prompt />}>
              <div className="space-y-4">
                <TextArea value={prompt} onChange={setPrompt} rows={12} />
                <div className="flex items-center justify-between gap-3">
                  {renderContext?.chunk_count > 0 && (
                    <span className="text-xs text-red-600 font-medium px-3 py-1 bg-red-50 rounded-full">
                      RAG {renderContext.chunk_count}件参照
                    </span>
                  )}
                  <CopyButton text={prompt} onCopied={setStatus} />
                </div>

                <div className="border-t border-black/[0.06] pt-4">
                  <p className="text-xs text-[#6e6e73] mb-3">
                    上のプロンプトを ChatGPT 等に送って、得られた LaTeX を下に貼り付けてください。
                  </p>
                  <TextArea
                    label="LLM の出力（LaTeX）"
                    value={llmOutput}
                    onChange={setLlmOutput}
                    rows={8}
                    placeholder="LaTeX コードをここに貼り付け..."
                  />
                  <div className="mt-3">
                    <Button
                      onClick={() => compilePdf()}
                      disabled={!llmOutput || pdfWorking}
                      variant="success"
                      className="w-full py-3"
                    >
                      {pdfWorking ? (
                        <span className="flex items-center gap-2">
                          <Icons.Info className="animate-pulse" /> 生成中...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Icons.Pdf /> PDF を生成
                        </span>
                      )}
                    </Button>
                  </div>

                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200 font-bold hover:bg-emerald-900/50 transition-colors"
                    >
                      <Icons.Pdf /> PDF を別タブで開く
                    </a>
                  )}
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ═══════ ナビゲーションボタン ═══════ */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 sm:mt-6 mb-4 sm:mb-0">
        <div>
          {step > 1 && step < 4 && (
            <Button variant="ghost" onClick={goBack} className="w-full sm:w-auto">
              ← 戻る
            </Button>
          )}
          {step === 5 && (
            <Button variant="ghost" onClick={goBack} className="w-full sm:w-auto">
              ← PDF形式を変更
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {step === 5 && (
            <Button variant="ghost" onClick={resetWizard} className="w-full sm:w-auto">
              最初からやり直す
            </Button>
          )}
          {step === 1 && (
            <Button onClick={goNext} disabled={!canNext()} className="w-full sm:w-auto">
              次へ →
            </Button>
          )}
          {step === 2 && (
            <Button onClick={goNext} className="w-full sm:w-auto">
              次へ →
            </Button>
          )}
          {step === 3 && mode === 'auto' && (
            <Button
              onClick={goNext}
              disabled={!templateId || generating}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-3"
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
          {step === 3 && mode === 'manual' && (
            <Button onClick={goNext} disabled={!templateId} className="w-full sm:w-auto">
              <Icons.Prompt className="w-4 h-4 mr-1" /> プロンプトを生成
            </Button>
          )}
        </div>
      </div>

      {/* ヘルプ */}
      {step === 1 && (
        <div className="mt-8 p-4 bg-[#f5f5f7] rounded-xl border border-black/[0.06]">
          <h3 className="text-xs font-bold text-[#6e6e73] mb-2">使い方ガイド</h3>
          <ol className="text-xs text-[#6e6e73] space-y-1.5 list-decimal list-inside">
            <li>上のリストからテンプレートを選択します（科目・分野・難易度はテンプレートに含まれています）</li>
            <li>「次へ」で問題数・RAG参照数・ベース過去問と生成方法を設定します</li>
            <li>PDF の出力形式（試験問題・プリント・模試など）を選択します</li>
            <li>「AI 自動生成」なら、ボタン1つで PDF まで完成します</li>
            <li>「手動」なら、プロンプトをコピーして好きな LLM に送れます</li>
          </ol>
        </div>
      )}
    </div>
  );
}
