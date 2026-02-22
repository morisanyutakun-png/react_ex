'use client';

import { useState, useEffect } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { renderTemplate, generatePdf, fetchLatexPresets, generateWithLlm, DIAGRAM_PACKAGE_DEFS } from '@/lib/api';
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
import { SUBJECTS, DIFFICULTIES } from '@/lib/constants';

/* ── ウィザードステップ定義 ── */
const STEPS = ['テンプレート選択', '設定', 'PDF形式', '生成', '結果'];

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
  const { templates, subjects } = useTemplates();

  /* ── ウィザード状態 ── */
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState('');

  /* ── フォーム状態 ── */
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('数学');
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
      if (first.metadata?.difficulty) setDifficulty(first.metadata.difficulty);
    }
  }, [templates, templateId]);

  const onSelectTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl?.metadata) {
      if (tpl.metadata.subject) setSubject(tpl.metadata.subject);
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
        user_mode: true,
        top_k: topK,
        latex_preset: latexPreset,
        extra_packages: extraPackages,
      });
      generatedPrompt = data.rendered_prompt || data.rendered || '';
      setRenderContext(data.context || null);
      setPrompt(generatedPrompt);
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
        user_mode: true,
        top_k: topK,
        latex_preset: latexPreset,
        extra_packages: extraPackages,
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
  };

  const selectedPreset = latexPresets.find((p) => p.id === latexPreset);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold mb-4 border border-indigo-100">
          <Icons.User className="w-4 h-4" />
          ユーザモード
        </div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
          問題を生成する
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          ステップに沿って操作するだけで、試験問題の PDF が完成します
        </p>
      </div>

      {/* プログレスバー */}
      <div className="mb-8">
        <ProgressSteps steps={STEPS} current={step} />
      </div>

      <StatusBar message={status} />

      {/* ═══════ Step 1: テンプレート選択 ═══════ */}
      {step === 1 && (
        <SectionCard title="Step 1: テンプレートを選ぶ" icon={<Icons.File />}>
          <p className="text-xs text-slate-400 mb-4">
            問題の元となるテンプレートを選んでください。科目や難易度は次のステップで調整できます。
          </p>

          <div className="space-y-3">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-slate-300">
                <Icons.Empty className="mx-auto mb-2" />
                <p className="text-sm">テンプレートがありません</p>
                <p className="text-xs mt-1">データ管理画面からテンプレートを追加してください</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelectTemplate(t.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      templateId === t.id
                        ? 'border-indigo-400 bg-indigo-50/50 shadow-sm'
                        : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-700">
                          {t.name || t.id}
                        </div>
                        {t.description && (
                          <div className="text-xs text-slate-400 mt-0.5">{t.description}</div>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {t.metadata?.subject && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-bold">
                            {t.metadata.subject}
                          </span>
                        )}
                        {t.metadata?.difficulty && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full text-[10px] font-bold">
                            {t.metadata.difficulty}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ═══════ Step 2: 設定 ═══════ */}
      {step === 2 && (
        <SectionCard title="Step 2: 設定を調整" icon={<Icons.Prompt />}>
          <p className="text-xs text-slate-400 mb-5">
            必要に応じて科目・難易度・問題数を変更してください。そのまま進んでもOKです。
          </p>

          <div className="space-y-4">
            {/* 選択中テンプレート表示 */}
            {selectedTemplate && (
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-3">
                <Icons.File className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <div>
                  <div className="text-sm font-bold text-slate-700">{selectedTemplate.name}</div>
                  <div className="text-[11px] text-slate-400">{selectedTemplate.description}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="科目"
                value={subject}
                onChange={setSubject}
                options={(subjects.length ? subjects : SUBJECTS).map((s) => ({ value: s, label: s }))}
              />
              <SelectField
                label="難易度"
                value={difficulty}
                onChange={setDifficulty}
                options={DIFFICULTIES.map((d) => ({ value: d, label: d }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField label="問題数" value={numQuestions} onChange={setNumQuestions} min={1} max={20} />
              <NumberField label="RAG参照数" value={topK} onChange={setTopK} min={1} max={20} />
            </div>

            {/* モード選択 */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">
                生成方法
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('auto')}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    mode === 'auto'
                      ? 'border-indigo-400 bg-indigo-50/50'
                      : 'border-slate-100 hover:border-indigo-200'
                  }`}
                >
                  <div className="text-sm font-bold text-slate-700">AI 自動生成</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    ワンクリックで PDF まで自動作成
                  </div>
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    mode === 'manual'
                      ? 'border-slate-400 bg-slate-50'
                      : 'border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="text-sm font-bold text-slate-700">手動</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
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
          <p className="text-xs text-slate-400 mb-5">
            生成する PDF のレイアウト形式を選んでください。
            {mode === 'auto'
              ? ' 選択後、「PDF を生成」ボタンで自動生成が始まります。'
              : ' 選択後、「プロンプトを生成」ボタンでプロンプトが作成されます。'}
          </p>

          {latexPresets.length === 0 ? (
            <div className="text-center py-8 text-slate-300">
              <Icons.Empty className="mx-auto mb-2" />
              <p className="text-sm">形式を読み込み中...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {latexPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setLatexPreset(p.id)}
                  className={`text-left rounded-xl border-2 transition-all overflow-hidden ${
                    latexPreset === p.id
                      ? 'border-indigo-400 bg-indigo-50/50 shadow-sm'
                      : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50'
                  }`}
                >
                  {/* ASCIIアートイラスト */}
                  <div
                    className={`px-3 pt-3 pb-2 rounded-t-lg ${
                      latexPreset === p.id ? 'bg-indigo-50' : 'bg-slate-50'
                    }`}
                  >
                    <pre
                      className={`text-[9px] leading-[1.4] font-mono select-none ${
                        latexPreset === p.id ? 'text-indigo-500' : 'text-slate-400'
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
                        <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                      )}
                      <div className="text-sm font-bold text-slate-700">{p.name}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                      {p.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 選択中プレビュー */}
          {selectedPreset && (
            <div className="mt-4 px-3 py-2.5 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
              <span className="text-xs font-bold text-indigo-700">{selectedPreset.name}</span>
              <span className="text-[11px] text-indigo-400">{selectedPreset.description}</span>
            </div>
          )}

          {/* ── 図表パッケージ選択 ── */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-[11px] font-black text-slate-400 tracking-[0.1em] uppercase">
                LaTeX 図表パッケージ
              </label>
              <span className="text-[10px] text-slate-300">（任意）</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              回路図・グラフ・コードなどが必要な場合に選択してください。
            </p>

            <div className="grid grid-cols-2 gap-2">
              {DIAGRAM_PACKAGE_DEFS.map((pkg) => {
                const active = extraPackages.includes(pkg.id);
                return (
                  <button
                    key={pkg.id}
                    onClick={() => togglePackage(pkg.id)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      active
                        ? 'border-violet-400 bg-violet-50/60 shadow-sm'
                        : 'border-slate-100 bg-white hover:border-violet-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`text-base leading-none mt-0.5 ${active ? 'text-violet-500' : 'text-slate-300'}`}>
                        {pkg.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-slate-700">{pkg.name}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                            active ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {pkg.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{pkg.description}</p>
                      </div>
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
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 placeholder:text-slate-300"
              />
              <button
                onClick={addCustomPackage}
                disabled={!customPackage.trim()}
                className="px-3 py-2 text-xs font-bold bg-slate-100 text-slate-500 rounded-lg hover:bg-violet-100 hover:text-violet-600 disabled:opacity-40 transition-colors"
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
                      className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-[10px] font-bold"
                    >
                      {def?.name || pkg}
                      <button
                        onClick={() => setExtraPackages((prev) => prev.filter((p) => p !== pkg))}
                        className="ml-0.5 text-violet-400 hover:text-violet-700 leading-none"
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
            <svg className="animate-spin h-10 w-10 text-indigo-400 mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-semibold text-indigo-500">{status}</p>
            <p className="text-xs text-slate-300 mt-2">しばらくお待ちください...</p>
          </div>
        </SectionCard>
      )}

      {/* ═══════ Step 5: 結果表示 ═══════ */}
      {step === 5 && (
        <div className="space-y-4">
          {/* AI自動生成の結果 */}
          {mode === 'auto' && generatedLatex && (
            <SectionCard title="生成結果" icon={<Icons.Success />}>
              <div className="space-y-4">
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <Icons.Pdf /> PDF を別タブで開く
                  </a>
                )}

                <details className="group">
                  <summary className="cursor-pointer text-slate-400 text-xs font-bold hover:text-indigo-500 transition-colors list-none flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">
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
                    <summary className="cursor-pointer text-slate-400 text-xs font-bold hover:text-indigo-500 transition-colors list-none flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">
                        ▸
                      </span>
                      使用されたプロンプトを確認
                    </summary>
                    <div className="mt-3">
                      <TextArea value={prompt} rows={8} readOnly />
                      <div className="mt-2 flex items-center gap-2">
                        <CopyButton text={prompt} onCopied={setStatus} />
                        {renderContext?.chunk_count > 0 && (
                          <span className="text-[11px] text-indigo-500 font-medium">
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
                    <span className="text-[11px] text-indigo-500 font-medium px-3 py-1 bg-indigo-50 rounded-full">
                      RAG {renderContext.chunk_count}件参照
                    </span>
                  )}
                  <CopyButton text={prompt} onCopied={setStatus} />
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400 mb-3">
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
                      className="mt-3 flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 font-bold hover:bg-emerald-100 transition-colors"
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
      <div className="flex items-center justify-between mt-6">
        <div>
          {step > 1 && step < 4 && (
            <Button variant="ghost" onClick={goBack}>
              ← 戻る
            </Button>
          )}
          {step === 5 && (
            <Button variant="ghost" onClick={goBack}>
              ← PDF形式を変更
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step === 5 && (
            <Button variant="ghost" onClick={resetWizard}>
              最初からやり直す
            </Button>
          )}
          {step === 1 && (
            <Button onClick={goNext} disabled={!canNext()}>
              次へ →
            </Button>
          )}
          {step === 2 && (
            <Button onClick={goNext}>
              次へ →
            </Button>
          )}
          {step === 3 && mode === 'auto' && (
            <Button
              onClick={goNext}
              disabled={!templateId || generating}
              className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-lg shadow-indigo-200/50 px-6 py-3"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  生成中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Icons.Pdf className="w-4 h-4" /> PDF を生成
                </span>
              )}
            </Button>
          )}
          {step === 3 && mode === 'manual' && (
            <Button onClick={goNext} disabled={!templateId}>
              <Icons.Prompt className="w-4 h-4 mr-1" /> プロンプトを生成
            </Button>
          )}
        </div>
      </div>

      {/* ヘルプ */}
      {step === 1 && (
        <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <h3 className="text-xs font-bold text-slate-500 mb-2">使い方ガイド</h3>
          <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
            <li>上のリストからテンプレートを選択します</li>
            <li>「次へ」で科目・難易度・問題数と生成方法を設定します</li>
            <li>PDF の出力形式（試験問題・プリント・模試など）を選択します</li>
            <li>「AI 自動生成」なら、ボタン1つで PDF まで完成します</li>
            <li>「手動」なら、プロンプトをコピーして好きな LLM に送れます</li>
          </ol>
        </div>
      )}
    </div>
  );
}
