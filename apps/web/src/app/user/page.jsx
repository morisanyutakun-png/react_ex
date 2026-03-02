'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { renderTemplate, generatePdf, fetchLatexPresets, generateWithLlm, searchProblems, createTemplate, deleteTemplate, DIAGRAM_PACKAGE_DEFS } from '@/lib/api';
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

/* ── ウィザードステップ定義 ── */
const STEPS = ['出題パターン', '詳細設定', 'レイアウト・図表', '生成', '完成'];

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
  const base = active ? 'text-[#0071e3]' : 'text-[#86868b]';
  const bg = active ? 'bg-[#0071e3]/[0.08]' : 'bg-black/[0.04]';
  const accent = active ? 'bg-red-200' : 'bg-[#c7c7cc]';
  const accentStrong = active ? 'bg-red-400' : 'bg-[#aeaeb2]';
  const borderC = active ? 'border-[#0071e3]/20' : 'border-[#e5e5ea]';

  const thumbnails = {
    exam: (
      <div className={`${bg} rounded-lg p-3 h-28 flex flex-col gap-1.5 border ${borderC}`}>
        <div className="flex items-center justify-between">
          <div className={`h-2.5 w-16 rounded ${accentStrong}`} />
          <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${active ? 'bg-[#0071e3]/[0.12] text-[#0071e3]' : 'bg-[#e5e5ea] text-[#86868b]'}`}>100点</div>
        </div>
        <div className={`h-1 w-full rounded ${accent} opacity-40`} />
        <div className="flex-1 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-4 h-4 rounded-full ${accentStrong} flex items-center justify-center text-[#1d1d1f] text-[7px] font-bold`}>1</div>
              <div className={`h-1.5 flex-1 rounded ${accent}`} />
            </div>
            <div className={`ml-5.5 h-1 w-3/4 rounded ${accent} opacity-60`} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-4 h-4 rounded-full ${accentStrong} flex items-center justify-center text-[#1d1d1f] text-[7px] font-bold`}>2</div>
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
        <div className="grid grid-cols-2 gap-0 flex-1 rounded overflow-hidden border" style={{ borderColor: active ? '#fca5a5' : '#c7c7cc' }}>
          <div className={`text-[7px] font-bold text-center py-1 ${active ? 'bg-[#0071e3]/[0.12] text-[#0071e3]' : 'bg-[#e5e5ea] text-[#86868b]'} border-r ${borderC}`}>問題</div>
          <div className={`text-[7px] font-bold text-center py-1 ${active ? 'bg-[#0071e3]/[0.12] text-[#0071e3]' : 'bg-[#e5e5ea] text-[#86868b]'}`}>解答</div>
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
          <div className={`text-[7px] px-1.5 py-0.5 rounded ${active ? 'bg-[#0071e3]/[0.12] text-[#0071e3]' : 'bg-[#e5e5ea] text-[#86868b]'} font-bold`}>60分</div>
        </div>
        <div className={`p-1.5 rounded ${active ? 'bg-[#0071e3]/[0.12]/50' : 'bg-[#e5e5ea]/50'} text-[6px] ${base}`}>
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
              <div className={`text-[6px] font-bold px-1 py-0.5 rounded ${active ? 'bg-[#0071e3]/[0.12] text-[#0071e3]' : 'bg-[#e5e5ea] text-[#86868b]'} inline-block`}>
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

  /* ── ウィザード状態 ── */
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState('');

  /* ── テンプレート新規作成 ── */
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
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
      if (tpl.metadata.subject) setSubject(tpl.metadata.subject);
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

  /* ── AI自動生成: プロンプト→Groq→LaTeX→PDF ── */
  const handleAutoGenerate = async () => {
    if (!templateId) {
      setStatus('出題パターンを選んでください');
      return;
    }
    setGenerating(true);
    setGeneratedLatex('');
    setPdfUrl('');
    setStep(4);

    setStatus('ステップ 1/3: AIへの指示文を作成中...');
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
        question_format: questionFormat,
        sub_topic: theme || undefined,
        include_diagram_per_question: extraPackages.includes('tikz') && includeDiagramPerQuestion,
        custom_request: customRequest.trim() || undefined,
        ...(sourceText.trim() ? { source_text: sourceText.trim() } : {}),
      });
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
      const data = await generateWithLlm({
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
        setStatus(`問題の生成は成功 / PDF 変換失敗: ${data.pdf_error}`);
        setStep(5);
      } else {
        setStatus('問題の生成完了（PDF エンジン未設定）');
        setStep(5);
      }
    } catch (e) {
      setStatus(`生成エラー: ${e.message}`);
    }
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
        question_format: questionFormat,
        sub_topic: theme || undefined,
        include_diagram_per_question: extraPackages.includes('tikz') && includeDiagramPerQuestion,
        custom_request: customRequest.trim() || undefined,
        ...(sourceText.trim() ? { source_text: sourceText.trim() } : {}),
      });
      setRenderContext(data.context || null);
      const generatedText = data.rendered_prompt || data.rendered || '';
      setPrompt(generatedText);

      // 自動でクリップボードにコピー
      try {
        await navigator.clipboard.writeText(generatedText);
        setPromptCopied(true);
      } catch { /* clipboard blocked — ユーザーが手動コピー可能 */ }

      setStatus(
        data.context?.chunk_count
          ? `指示文をコピーしました（過去問 ${data.context.chunk_count}件を参考）`
          : '指示文をクリップボードにコピーしました'
      );
      setPromptGenerating(false);
      setStep(5);
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
    setBaseFilterQuery('');
    setMatchedProblems([]);
    setQuestionFormat('standard');
    setIncludeDiagramPerQuestion(false);
    setCustomRequest('');
  };

  const selectedPreset = latexPresets.find((p) => p.id === latexPreset);

  return (
    <div ref={wizardTopRef} className="max-w-2xl mx-auto px-4 sm:px-5 py-6 sm:py-10 pb-28 sm:pb-12">
      {/* ヘッダー */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-[#86868b] rounded-full text-[11px] font-semibold mb-3 sm:mb-4 border border-black/[0.04]"
             style={{ boxShadow: '0 0.5px 1px rgba(0,0,0,0.02)' }}>
          <Icons.User className="w-3 h-3" />
          かんたんモード
        </div>
        <h1 className="text-[22px] sm:text-[28px] font-black tracking-tight text-[#1d1d1f] mb-1.5 leading-tight">
          問題をつくる
        </h1>
        <p className="text-[13px] text-[#86868b] leading-relaxed max-w-sm mx-auto">
          ステップに沿って進むだけで、試験問題の PDF が完成します
        </p>
      </div>

      {/* プログレスバー */}
      <div className="mb-5 sm:mb-7">
        <ProgressSteps steps={STEPS} current={step} />
      </div>

      <StatusBar message={status} />

      {/* ── ウィザードアシスト（各ステップのガイダンス） ── */}
      {step <= 3 && (
        <div className="relative overflow-hidden rounded-2xl surface-glass mb-4">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-[10px] text-white text-[11px] font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(145deg, #0077ed 0%, #0071e3 100%)', boxShadow: '0 1px 3px rgba(0,113,227,0.20)' }}>
              {step}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#1d1d1f] leading-snug">
                {step === 1 && (templateId ? '出題パターンを選びました — 次のステップへ進めます' : 'まず、作りたい問題のパターンを選んでください')}
                {step === 2 && '問題数や参照数はそのままでもOK。お好みで調整してください'}
                {step === 3 && (mode === 'auto' ? 'PDFの見た目を選んだら「PDF を生成」で完成！' : 'レイアウトを選んだら「指示文を作成」で次へ')}
              </p>
              <p className="text-[11px] text-[#aeaeb2] mt-0.5">
                ステップ {step} / {STEPS.length}
                {step === 1 && !templateId && ' — 下のカードをタップするだけ'}
                {step === 1 && templateId && ' — 右下の「次のステップへ」をタップ'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 1: 出題パターン選択 ═══════ */}
      {step === 1 && (
        <SectionCard title="出題パターンを選ぶ" icon={<Icons.File />} className="wizard-section-enter">
          <p className="text-xs text-[#86868b] mb-4">
            どんな問題を作りたいですか？科目・分野・レベルが設定済みのパターンから選ぶだけでOKです。
          </p>

          <div className="space-y-3">
            {/* テンプレート一覧 */}
            {templates.length === 0 && !showCreateTemplate ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-black/[0.04] mb-3">
                  <svg className="w-7 h-7 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-[#1d1d1f]">出題パターンがまだありません</p>
                <p className="text-xs text-[#86868b] mt-1">下の「＋ 新しく作る」ボタンから出題パターンを作成しましょう</p>
              </div>
            ) : !showCreateTemplate ? (
              <div className="space-y-2">
                {templates.map((t) => {
                  const isActive = templateId === t.id;
                  const meta = t.metadata || {};
                  const subj = meta.subject || '';
                  const fld = meta.field || '';
                  const thm = meta.theme || '';
                  const diff = meta.difficulty || '';

                  // 科目に応じたカラーとアイコン
                  const subjectColors = {
                    '数学': { bg: 'from-[#007aff] to-[#5856d6]', light: '#007aff', icon: '∑' },
                    '物理': { bg: 'from-[#ff9500] to-[#ff6723]', light: '#ff9500', icon: '⚛' },
                    '化学': { bg: 'from-[#34c759] to-[#30d158]', light: '#34c759', icon: 'Ch' },
                    '英語': { bg: 'from-[#af52de] to-[#bf5af2]', light: '#af52de', icon: 'En' },
                    '生物': { bg: 'from-[#00c7be] to-[#64d2ff]', light: '#00c7be', icon: 'Bi' },
                    '情報': { bg: 'from-[#5856d6] to-[#007aff]', light: '#5856d6', icon: 'CS' },
                    '国語': { bg: 'from-[#ff2d55] to-[#ff6482]', light: '#ff2d55', icon: '国' },
                    '社会': { bg: 'from-[#ff9500] to-[#ffcc00]', light: '#ff9500', icon: '社' },
                    '地学': { bg: 'from-[#64d2ff] to-[#5ac8fa]', light: '#64d2ff', icon: '地' },
                    '理科': { bg: 'from-[#30d158] to-[#00c7be]', light: '#30d158', icon: 'Sc' },
                  };
                  const sc = subjectColors[subj] || { bg: 'from-[#8e8e93] to-[#636366]', light: '#8e8e93', icon: '—' };

                  // 難易度ドット数（6段階）
                  const diffLevels = { '基礎': 1, '標準': 2, '応用': 3, '発展': 4, '難関': 5, '最難関': 6 };
                  const diffLevel = diffLevels[diff] || 0;
                  const diffColors = {
                    1: '#34c759', 2: '#34c759', 3: '#ff9500',
                    4: '#ff6723', 5: '#ff3b30', 6: '#ff2d55',
                  };
                  const dotColor = diffColors[diffLevel] || '#c7c7cc';

                  // パンくずサブタイトル: 分野 › テーマ
                  const breadcrumb = [fld, thm].filter(Boolean).join(' › ');

                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelectTemplate(t.id)}
                      className={`group relative w-full text-left rounded-2xl overflow-hidden transition-all duration-300 active:scale-[0.98]
                        ${isActive
                          ? 'bg-white shadow-lg shadow-black/[0.08] ring-2 ring-[#0071e3]/30 select-bounce'
                          : 'bg-white/60 shadow-sm shadow-black/[0.02] hover:shadow-md hover:shadow-black/[0.06] ring-1 ring-black/[0.04] hover:ring-black/[0.08]'
                        }`}
                    >
                      {/* アクティブ時のトップアクセント */}
                      {isActive && (
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-black/[0.06]" />
                      )}

                      <div className="p-3.5 sm:p-4 flex items-center gap-3">
                        {/* 科目アイコン */}
                        <div className={`flex items-center justify-center w-11 h-11 rounded-[14px] flex-shrink-0 text-lg
                          bg-[#1d1d1f] text-white shadow-md
                          transition-transform duration-300 ${isActive ? 'scale-105' : 'group-hover:scale-105'}`}
                        >
                          {sc.icon}
                        </div>

                        {/* テンプレート情報 — 3行構成 */}
                        <div className="flex-1 min-w-0">
                          {/* 1行目: 科目名 */}
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-bold text-[#1d1d1f] leading-tight">
                              {subj || t.name || t.id}
                            </span>
                            {isActive && (
                              <div className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#0071e3] flex-shrink-0 shadow-sm shadow-[#0071e3]/30">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* 2行目: 分野 › テーマ（パンくず） */}
                          {breadcrumb && (
                            <p className="text-[12px] text-[#6e6e73] mt-0.5 truncate leading-snug">
                              {fld && <span className="font-medium">{fld}</span>}
                              {fld && thm && <span className="text-[#c7c7cc] mx-1">›</span>}
                              {thm && <span className="text-[#86868b]">{thm}</span>}
                            </p>
                          )}

                          {/* 3行目: 難易度ドットバー */}
                          {diffLevel > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div className="flex gap-[3px]">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                  <div
                                    key={i}
                                    className="w-[5px] h-[5px] rounded-full transition-colors"
                                    style={{
                                      backgroundColor: i <= diffLevel ? dotColor : '#e5e5ea',
                                    }}
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] font-medium leading-none" style={{ color: dotColor }}>
                                {difficultyLabel(diff)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 右: 削除 + 矢印 */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          <div
                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#c7c7cc]
                                       hover:text-[#ff3b30] hover:bg-[#ff3b30]/[0.08] transition-all duration-200 cursor-pointer opacity-0 group-hover:opacity-100"
                            title="この出題パターンを削除"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </div>
                          {!isActive && (
                            <svg className="w-4 h-4 text-[#c7c7cc] transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* ── テンプレート新規作成フォーム ── */}
            {showCreateTemplate ? (
              <div className="rounded-3xl bg-white border border-black/[0.06] shadow-sm overflow-hidden">
                {/* 緑のアクセントライン（保存アクション = 緑で統一） */}
                <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="icon-premium w-10 h-10">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">出題パターンを新しく作る</h3>
                    <p className="text-[11px] text-[#86868b]">教科と分野を選ぶだけで自動作成されます</p>
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
                    <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-2">教科名（入力）</label>
                    <input
                      value={newTplCustomSubject}
                      onChange={(e) => setNewTplCustomSubject(e.target.value)}
                      className="w-full pl-4 pr-4 py-3 rounded-2xl border border-black/[0.06] bg-white text-sm text-[#1d1d1f] font-medium
                        transition-all duration-300 hover:border-black/[0.10] hover:bg-white hover:shadow-md
                        focus:border-black/[0.15] focus:ring-2 focus:ring-black/[0.05] focus:shadow-md
                        outline-none placeholder:text-[#c7c7cc] shadow-sm"
                      placeholder="例: 地学"
                      autoFocus
                    />
                  </div>
                )}

                {/* 分野 */}
                {effectiveNewSubject && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-2">
                      分野
                      <span className="text-[10px] font-normal text-[#aeaeb2] ml-1 normal-case tracking-normal">（任意）</span>
                    </label>
                    {newTplFieldOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {newTplFieldOptions.slice(0, 15).map((f) => (
                          <button key={f} type="button"
                            onClick={() => setNewTplField(newTplField === f ? '' : f)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-300 ${
                              newTplField === f
                                ? 'bg-[#1d1d1f] text-white border-transparent shadow-md'
                                : 'bg-white/80 text-[#6e6e73] border-black/[0.06] hover:border-[#0071e3]/30 hover:text-[#0071e3] hover:shadow-sm'
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
                      className="w-full pl-4 pr-4 py-3 rounded-2xl border border-black/[0.06] bg-white text-sm text-[#1d1d1f] font-medium
                        transition-all duration-300 hover:border-black/[0.10] hover:bg-white hover:shadow-md
                        focus:border-black/[0.15] focus:ring-2 focus:ring-black/[0.05] focus:shadow-md
                        outline-none placeholder:text-[#c7c7cc] shadow-sm"
                    />
                  </div>
                )}

                {/* テーマ */}
                {effectiveNewSubject && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider mb-2">
                      テーマ
                      <span className="text-[10px] font-normal text-[#aeaeb2] ml-1 normal-case tracking-normal">（任意・さらに細かい分類）</span>
                    </label>
                    <input
                      type="text"
                      value={newTplTheme}
                      onChange={(e) => setNewTplTheme(e.target.value)}
                      placeholder="例: 置換積分、三角関数の合成、運動方程式の立式"
                      className="w-full pl-4 pr-4 py-3 rounded-2xl border border-black/[0.06] bg-white text-sm text-[#1d1d1f] font-medium
                        transition-all duration-300 hover:border-black/[0.10] hover:bg-white hover:shadow-md
                        focus:border-black/[0.15] focus:ring-2 focus:ring-black/[0.05] focus:shadow-md
                        outline-none placeholder:text-[#c7c7cc] shadow-sm"
                    />
                  </div>
                )}

                {/* 作成ボタン */}
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={handleCreateTemplate}
                    disabled={creatingTemplate || !effectiveNewSubject || !newTplDifficulty}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-[15px] font-bold
                               bg-[#1d1d1f] text-white
                               shadow-lg shadow-black/[0.15]
                               hover:shadow-xl hover:shadow-black/[0.20] hover:-translate-y-0.5
                               disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 active:scale-[0.97]"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {creatingTemplate ? '作成中...' : 'このパターンを保存する'}
                  </button>
                  <button
                    onClick={() => { setShowCreateTemplate(false); setNewTplSubject(''); setNewTplCustomSubject(''); setNewTplField(''); setNewTplTheme(''); setNewTplDifficulty(''); }}
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-[#86868b] hover:text-[#424245] hover:bg-black/[0.03] transition-all"
                  >
                    キャンセル
                  </button>
                </div>
                {/* 操作ヒント */}
                <div className="flex items-center gap-2 pt-1 px-1">
                  <div className="w-4 h-4 rounded-full bg-[#34c759]/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-[#34c759]" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="text-[10px] text-[#aeaeb2]">保存後、自動で選択されます。そのまま「次のステップへ」で進めます。</p>
                </div>
              </div>
              </div>
            ) : (
              /* ── 新規作成ボタン ── */
              <button
                onClick={() => setShowCreateTemplate(true)}
                className="w-full p-4 rounded-2xl border border-black/[0.06] text-[#86868b]
                           hover:border-[#0071e3]/30 hover:text-[#0071e3] hover:bg-[#0071e3]/[0.04]
                           transition-all duration-300 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
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

      {/* ═══════ Step 2: 設定 ═══════ */}
      {step === 2 && (
        <div className="space-y-5 wizard-section-enter">
            {/* 選択中テンプレート表示（科目・分野・難易度もここに表示） */}
            {selectedTemplate && (() => {
              const meta = selectedTemplate.metadata || {};
              const subj = meta.subject || subject || '';
              const fld = meta.field || field || '';
              const thm = meta.theme || theme || '';
              const diff = meta.difficulty || difficulty || '';
              const subjectColors = {
                '数学': { bg: 'from-[#007aff] to-[#5856d6]', icon: '∑' },
                '物理': { bg: 'from-[#ff9500] to-[#ff6723]', icon: '⚛' },
                '化学': { bg: 'from-[#34c759] to-[#30d158]', icon: 'Ch' },
                '英語': { bg: 'from-[#af52de] to-[#bf5af2]', icon: 'En' },
                '生物': { bg: 'from-[#00c7be] to-[#64d2ff]', icon: 'Bi' },
                '情報': { bg: 'from-[#5856d6] to-[#007aff]', icon: 'CS' },
                '国語': { bg: 'from-[#ff2d55] to-[#ff6482]', icon: '国' },
                '社会': { bg: 'from-[#ff9500] to-[#ffcc00]', icon: '社' },
                '地学': { bg: 'from-[#64d2ff] to-[#5ac8fa]', icon: '地' },
                '理科': { bg: 'from-[#30d158] to-[#00c7be]', icon: 'Sc' },
              };
              const sc = subjectColors[subj] || { bg: 'from-[#8e8e93] to-[#636366]', icon: '—' };
              const breadcrumb = [fld, thm].filter(Boolean).join(' › ');
              const diffLevels = { '基礎': 1, '標準': 2, '応用': 3, '発展': 4, '難関': 5, '最難関': 6 };
              const diffLevel = diffLevels[diff] || 0;
              const diffColors = { 1: '#34c759', 2: '#34c759', 3: '#ff9500', 4: '#ff6723', 5: '#ff3b30', 6: '#ff2d55' };
              const dotColor = diffColors[diffLevel] || '#c7c7cc';
              return (
              <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-black/[0.06]" />
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`icon-premium w-10 h-10 flex-shrink-0 text-lg text-white`}>
                      {sc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-[#1d1d1f]">{subj || selectedTemplate.name}</span>
                        <span className="px-1.5 py-0.5 bg-[#0071e3]/[0.06] text-[#0071e3] rounded-full text-[9px] font-bold">選択中</span>
                      </div>
                      {breadcrumb && (
                        <p className="text-[12px] text-[#6e6e73] mt-0.5 truncate">
                          {fld && <span className="font-medium">{fld}</span>}
                          {fld && thm && <span className="text-[#c7c7cc] mx-1">›</span>}
                          {thm && <span className="text-[#86868b]">{thm}</span>}
                        </p>
                      )}
                      {diffLevel > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex gap-[3px]">
                            {[1,2,3,4,5,6].map((i) => (
                              <div key={i} className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: i <= diffLevel ? dotColor : '#e5e5ea' }} />
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
          <div className="relative overflow-hidden rounded-3xl bg-white border border-black/[0.06] shadow-sm">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-premium w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">問題数・参照設定</h3>
                  <p className="text-[11px] text-[#86868b]">何問つくるか、過去問を何件参考にするか</p>
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
              <div className="px-4 pb-4 text-xs text-[#86868b] leading-relaxed space-y-1.5 animate-expand">
                <p>登録されている過去問を参考にして、新しい問題を自動で作ります。</p>
                <div className="bg-black/[0.04] rounded-xl p-2 border border-black/[0.06] space-y-1">
                  <div className="flex gap-2"><span className="text-[#0071e3] font-bold">1.</span> <span>選んだ科目・分野をもとに関連する過去問を自動検索</span></div>
                  <div className="flex gap-2"><span className="text-[#0071e3] font-bold">2.</span> <span>似ている問題を自動で見つけ出し、難易度も考慮</span></div>
                  <div className="flex gap-2"><span className="text-[#0071e3] font-bold">3.</span> <span>見つかった過去問を参考に、AIが類似の問題を新しく生成</span></div>
                </div>
                <p className="text-[#86868b]">
                  下の「参考問題」を選ぶと、その問題に似た類題をより正確に生成できます。
                </p>
              </div>
            </details>

          {/* ── 参考問題カード ── */}
          <div className="relative overflow-hidden rounded-3xl bg-white border border-black/[0.06] shadow-sm">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-premium w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">参考問題を選択</h3>
                  <p className="text-[11px] text-[#86868b]">選択中のパターンに合致する過去問が表示されます</p>
                </div>
                <span className="ml-auto px-2.5 py-1 bg-[#ff9500]/[0.08] text-[#ff9500] rounded-full text-[10px] font-bold border border-[#ff9500]/[0.12]">任意</span>
              </div>

              {/* 選択済み問題の表示 */}
              {selectedBaseProblem ? (
                <div className="mb-3 relative overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.02]
                                shadow-sm transition-all duration-300 hover:shadow-md">
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-black/[0.06]" />
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
                          {selectedBaseProblem.id && (
                            <span className="text-[10px] text-[#ff9500]/60 font-mono">#{selectedBaseProblem.id}</span>
                          )}
                        </div>
                        <div className="text-[13px] text-[#1d1d1f] leading-relaxed line-clamp-3 ml-[30px]">
                          <LatexText>{(selectedBaseProblem.stem || selectedBaseProblem.text || '').slice(0, 200)}</LatexText>
                        </div>
                        <div className="flex gap-1.5 mt-2 ml-[30px] flex-wrap">
                          {selectedBaseProblem.subject && (
                            <span className="px-2 py-0.5 bg-[#0071e3]/[0.08] text-[#0071e3] rounded-full text-[9px] font-bold">{selectedBaseProblem.subject}</span>
                          )}
                          {(selectedBaseProblem.topic || selectedBaseProblem.metadata?.field) && (
                            <span className="px-2 py-0.5 bg-[#34c759]/[0.08] text-[#34c759] rounded-full text-[9px] font-bold">{selectedBaseProblem.topic || selectedBaseProblem.metadata?.field}</span>
                          )}
                          {selectedBaseProblem.difficulty != null && (
                            <span className="px-2 py-0.5 bg-[#ff9500]/[0.08] text-[#ff9500] rounded-full text-[9px] font-bold">{difficultyLabel(selectedBaseProblem.difficulty)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedBaseProblem(null)}
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
              ) : null}

              {/* フィルタバー（科目ラベル + 絞り込み検索） */}
              <div className="flex items-center gap-2 mb-3">
                {/* 科目・分野ラベル */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {subject && (
                    <span className="px-2.5 py-1 bg-[#0071e3]/[0.08] text-[#0071e3] rounded-full text-[10px] font-bold">{subject}</span>
                  )}
                  {field && (
                    <span className="px-2.5 py-1 bg-[#34c759]/[0.08] text-[#34c759] rounded-full text-[10px] font-bold">{field}</span>
                  )}
                </div>
                {/* インライン絞り込み検索 */}
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/[0.03] border border-black/[0.04]
                                focus-within:bg-white focus-within:border-[#ff9500]/30 focus-within:shadow-sm transition-all duration-200">
                  <svg className="w-3.5 h-3.5 text-[#c7c7cc] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={baseSearchInputRef}
                    type="text"
                    value={baseFilterQuery}
                    onChange={(e) => setBaseFilterQuery(e.target.value)}
                    placeholder="絞り込み..."
                    className="flex-1 bg-transparent text-xs text-[#1d1d1f] outline-none placeholder:text-[#c7c7cc]"
                  />
                  {baseFilterQuery && (
                    <button onClick={() => setBaseFilterQuery('')} className="text-[#aeaeb2] hover:text-[#ff3b30] transition-colors">
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
                  <svg className="animate-spin h-5 w-5 text-[#ff9500]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-[11px] text-[#aeaeb2]">過去問を取得中...</p>
                </div>
              ) : filteredProblems.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                  <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-wider px-1 mb-1">
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
                              <span className="text-[10px] text-[#aeaeb2] font-mono">#{item.id ?? idx + 1}</span>
                            </div>
                            <div className="text-[13px] text-[#1d1d1f] leading-relaxed line-clamp-2">
                              <LatexText>{(item.stem || item.text || '').slice(0, 150)}</LatexText>
                            </div>
                            <div className="flex gap-1.5 mt-1.5 flex-wrap">
                              {item.subject && (
                                <span className="px-2 py-0.5 bg-[#0071e3]/[0.08] text-[#0071e3] rounded-full text-[9px] font-bold">{item.subject}</span>
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
              ) : matchedProblems.length > 0 && baseFilterQuery.trim() ? (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-black/[0.04] mb-2">
                    <svg className="w-5 h-5 text-[#c7c7cc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-[#aeaeb2]">「{baseFilterQuery}」に一致する問題はありません</p>
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
            </div>
          </div>

          {/* ── 生成方法カード ── */}
          <div className="relative overflow-hidden rounded-3xl bg-white border border-black/[0.06] shadow-sm">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-premium w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">生成方法</h3>
                  <p className="text-[11px] text-[#86868b]">自動生成 or 手動で指示文を使う</p>
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
                      mode === 'auto' ? 'bg-[#1d1d1f] text-white shadow-md' : 'bg-black/[0.04] text-[#86868b]'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1d1d1f]">AI 自動生成</div>
                      <div className="text-[11px] text-[#86868b] mt-0.5 leading-relaxed">
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
                      mode === 'manual' ? 'bg-[#1d1d1f] text-white shadow-md' : 'bg-black/[0.04] text-[#86868b]'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1d1d1f]">手動</div>
                      <div className="text-[11px] text-[#86868b] mt-0.5 leading-relaxed">
                        AIへの指示文を取得して自分で AI に送る
                      </div>
                    </div>
                    {mode === 'manual' && (
                      <div className="check-circle checked flex-shrink-0" style={{ '--tw-ring-color': '#6e6e73' }}>
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
          <div className="relative overflow-hidden rounded-3xl bg-white border border-black/[0.06] shadow-sm">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-premium w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">カスタム要望</h3>
                  <p className="text-[11px] text-[#86868b]">問題の内容・形式についての要望を自由に記入</p>
                </div>
                <span className="ml-auto px-2.5 py-1 bg-[#34c759]/[0.08] text-[#34c759] rounded-full text-[10px] font-bold border border-[#34c759]/[0.12]">任意</span>
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
                  className="w-full px-4 py-3 text-[13px] leading-relaxed border border-black/[0.06] bg-white rounded-2xl
                    focus:outline-none focus:border-[#34c759] focus:ring-2 focus:ring-[#34c759]/20
                    placeholder:text-[#c7c7cc] transition-all hover:border-black/[0.10] hover:shadow-sm
                    resize-none"
                />
                <div className="flex items-center justify-between mt-1.5 px-1">
                  <div className="flex items-center gap-1.5">
                    {customRequest.trim() && (
                      <button
                        onClick={() => setCustomRequest('')}
                        className="text-[10px] text-[#aeaeb2] hover:text-[#ff3b30] transition-colors flex items-center gap-0.5"
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
                      ? 'text-[#ff3b30]'
                      : customRequest.length >= CUSTOM_REQUEST_MAX_LENGTH * 0.8
                        ? 'text-[#ff9500]'
                        : 'text-[#aeaeb2]'
                  }`}>
                    {customRequest.length} / {CUSTOM_REQUEST_MAX_LENGTH}
                  </span>
                </div>
              </div>
              {customRequest.trim() && (
                <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-[#34c759]/[0.06] rounded-xl border border-[#34c759]/10">
                  <svg className="w-3.5 h-3.5 text-[#34c759] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[10px] text-[#34c759] leading-relaxed">
                    この要望が生成時に AI に伝えられます
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 3: PDF形式選択 ═══════ */}
      {step === 3 && (
        <div className="space-y-5 wizard-section-enter">
          {/* 選択中テンプレート情報 */}
          {selectedTemplate && (
            <div className="mb-5 relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-black/[0.06]" />
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-black/[0.04]">
                    <Icons.File className="w-4 h-4 text-[#0071e3]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-[#aeaeb2] uppercase tracking-wider mb-0.5">選択中の出題パターン</div>
                    <div className="text-sm font-bold text-[#1d1d1f]">{selectedTemplate.name}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3 ml-12">
                {subject && (
                  <span className="px-2 py-0.5 bg-[#0071e3]/[0.08] text-[#0071e3] rounded-full text-[10px] font-bold">
                    科目: {subject}
                  </span>
                )}
                {field && (
                  <span className="px-2 py-0.5 bg-[#34c759]/[0.08] text-[#34c759] rounded-full text-[10px] font-bold">
                    分野: {field}
                  </span>
                )}
                {theme && (
                  <span className="px-2 py-0.5 bg-[#af52de]/[0.08] text-[#af52de] rounded-full text-[10px] font-bold">
                    テーマ: {theme}
                  </span>
                )}
                {difficulty && (
                  <span className="px-2 py-0.5 bg-[#ff9500]/[0.08] text-[#ff9500] rounded-full text-[10px] font-bold">
                    難易度: {difficulty}
                  </span>
                )}
                {numQuestions && (
                  <span className="px-2 py-0.5 bg-[#007aff]/[0.08] text-[#007aff] rounded-full text-[10px] font-bold">
                    問題数: {numQuestions}
                  </span>
                )}
                </div>
              </div>
            </div>
          )}

          {/* ── PDF形式カード ── */}
          <div className="relative overflow-hidden rounded-3xl bg-white border border-black/[0.06] shadow-sm">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-premium w-10 h-10 text-white">
                  <Icons.Pdf className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">PDF の見た目を選ぶ</h3>
                  <p className="text-[11px] text-[#86868b]">
                    {mode === 'auto'
                      ? '選んだら「PDF を生成」ボタンを押すだけで完成します'
                      : '選んだら「指示文を作成」ボタンを押すとAIへの指示文が作られます'}
                  </p>
                </div>
              </div>

          {latexPresets.length === 0 ? (
            <div className="text-center py-8 text-[#86868b]">
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
                      <div className="text-sm font-bold text-[#1d1d1f]">{p.name}</div>
                    </div>
                    <div className="text-[10px] text-[#86868b] mt-0.5 leading-tight">
                      {p.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 選択中プレビュー */}
          {selectedPreset && (
            <div className="mt-4 px-4 py-3 bg-black/[0.02] rounded-2xl border border-black/[0.06] flex items-center gap-2.5">
              <div className="check-circle checked !w-5 !h-5">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs font-bold text-[#0071e3]">{selectedPreset.name}</span>
              <span className="text-[11px] text-[#86868b]">{selectedPreset.description}</span>
            </div>
          )}

            </div>
          </div>

          {/* ── 問題形式カード ── */}
          <div className="relative overflow-hidden rounded-3xl bg-white border border-black/[0.06] shadow-sm">
            <div className="p-5">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="icon-premium w-8 h-8">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[13px] font-extrabold text-[#1d1d1f] tracking-tight">
                      問題形式を選択してください
                    </div>
                    <div className="text-[10px] text-[#0071e3] font-bold mt-0.5">
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
                          ? 'bg-black/[0.04] border-2 border-[#1d1d1f]/30 shadow-sm'
                          : 'bg-black/[0.02] border-2 border-transparent hover:bg-black/[0.04] hover:border-black/[0.06]'
                        }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 transition-all duration-300
                          ${active
                            ? 'bg-[#1d1d1f] text-white shadow-md'
                            : 'bg-black/[0.05] text-[#86868b]'
                          }`}
                        >
                          {icons[fmt.value] || icons.standard}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[13px] font-bold transition-colors ${active ? 'text-[#af52de]' : 'text-[#1d1d1f]'}`}>
                              {fmt.label}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#86868b] mt-0.5 leading-snug">{fmt.description}</div>
                        </div>
                        {/* チェックマーク */}
                        {active && (
                          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1d1d1f] flex-shrink-0 mt-0.5">
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
          <div className="relative overflow-hidden rounded-3xl bg-white border border-black/[0.06] shadow-sm">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-premium w-10 h-10 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5V19.5a1.5 1.5 0 001.5 1.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">図表・イラスト</h3>
                  <p className="text-[11px] text-[#86868b]">図・グラフ・コードが必要な場合に選択。不要なら選ばなくてOK</p>
                </div>
                <span className="ml-auto px-2.5 py-1 bg-[#5e5ce6]/[0.08] text-[#5e5ce6] rounded-full text-[10px] font-bold border border-[#5e5ce6]/[0.12]">任意</span>
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
              <div className="px-4 pb-4 pt-1 text-[10px] text-[#ff9500] space-y-1 leading-relaxed animate-expand">
                <p className="font-bold">迷ったら「TikZ」だけ選べばほとんどの図が描けます。</p>
                <p>・ 電気回路の問題 → <strong>CircuiTikZ</strong></p>
                <p>・ 関数グラフ・データグラフ → <strong>PGFPlots</strong></p>
                <p>・ プログラミング問題のコード → <strong>Listings</strong></p>
                <p>・ 確率の樹形図 → <strong>Forest</strong></p>
                <p className="text-amber-500">図が不要な問題（文章・数式のみ）は何も選ばなくて大丈夫です。</p>
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
                      active ? 'active !border-[#af52de] !shadow-[0_0_0_3px_rgba(175,82,222,0.08)]' : ''
                    }`}
                  >
                    {/* ASCIIアートプレビュー */}
                    {illustration && (
                      <div className={`px-3 pt-2.5 pb-2 ${active ? 'bg-[#af52de]/[0.06]' : 'bg-black/[0.03]'}`}>
                        <pre
                          className={`text-[9px] sm:text-[8px] leading-[1.35] font-mono select-none transition-colors ${active ? 'text-[#af52de]' : 'text-[#c7c7cc]'}`}
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
                          <div className="check-circle checked !w-5 !h-5 !border-[#af52de]" style={{ background: 'linear-gradient(135deg, #af52de, #8944ab)' }}>
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="check-circle !w-5 !h-5" />
                        )}
                        <span className={`text-sm leading-none ${active ? 'text-[#af52de]' : 'text-[#c7c7cc]'}`}>
                          {pkg.icon}
                        </span>
                        <span className="text-xs font-bold text-[#1d1d1f]">{pkg.name}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          active ? 'bg-[#af52de]/[0.1] text-[#af52de]' : 'bg-black/[0.04] text-[#aeaeb2]'
                        }`}>
                          {pkg.label}
                        </span>
                        {pkg.recommended && (
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-[#ff9500]/[0.08] text-[#ff9500]">
                            おすすめ
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#86868b] mt-1 ml-7 leading-tight">{pkg.hint || pkg.description}</p>
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
                      ? 'bg-black/[0.04] border-2 border-[#1d1d1f]/30 shadow-sm'
                      : 'bg-black/[0.02] border-2 border-transparent hover:bg-black/[0.04] hover:border-black/[0.06]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all duration-300
                      ${includeDiagramPerQuestion
                        ? 'bg-[#1d1d1f] text-white shadow-md'
                        : 'bg-black/[0.05] text-[#86868b]'
                      }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5V19.5a1.5 1.5 0 001.5 1.5z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1d1d1f]">大問ごとに図を自動挿入</div>
                      <div className="text-[11px] text-[#86868b] mt-0.5 leading-relaxed">
                        各大問に物理図（力の図示、回路図など）を自動で追加します
                      </div>
                    </div>
                    {/* トグルスイッチ */}
                    <div className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-all duration-300
                      ${includeDiagramPerQuestion
                        ? 'bg-[#1d1d1f]'
                        : 'bg-[#e5e5ea]'
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
                className="flex-1 px-4 py-2.5 text-xs border border-black/[0.06] bg-white rounded-2xl
                           focus:outline-none focus:border-[#af52de] focus:ring-2 focus:ring-[#af52de]/20
                           placeholder:text-[#c7c7cc] transition-all hover:border-black/[0.10] hover:shadow-sm"
              />
              <button
                onClick={addCustomPackage}
                disabled={!customPackage.trim()}
                className="px-4 py-2.5 text-xs font-bold bg-white border border-black/[0.06] text-[#1d1d1f] rounded-2xl
                           hover:bg-black/[0.04] hover:border-black/[0.10] disabled:opacity-30 transition-all"
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
                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#af52de]/[0.08] text-[#af52de] rounded-full text-[10px] font-bold"
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
          </div>
        </div>
      )}

      {/* ═══════ Step 4: 生成中 ═══════ */}
      {step === 4 && generating && (
        <div className="wizard-section-enter">
          <div className="rounded-3xl bg-white border border-black/[0.06] shadow-sm overflow-hidden">
            <div className="flex flex-col items-center justify-center py-20 px-6">
              {/* パルスリング */}
              <div className="relative mb-6">
                <div className="absolute inset-0 w-16 h-16 rounded-full bg-[#0071e3]/10 animate-ping" />
                <div className="icon-premium relative w-16 h-16">
                  <svg className="animate-spin h-7 w-7 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              </div>
              <p className="text-base font-bold text-[#1d1d1f] mb-1">問題を生成しています</p>
              <p className="text-sm text-[#0071e3] font-medium">{status}</p>
              <p className="text-xs text-[#86868b] mt-3">しばらくお待ちください...</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Step 5: 結果表示 ═══════ */}
      {step === 5 && (
        <div className="space-y-5 wizard-section-enter">
          {/* RAG フィードバックカード */}
          {renderContext && (
            <div className={`rounded-2xl border text-xs px-5 py-4 shadow-sm ${
              renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0
                ? 'bg-[#34c759]/[0.08] border-[#34c759]/20'
                : renderContext.rag_status === 'no_data'
                  ? 'bg-[#007aff]/[0.08] border-blue-200'
                  : 'bg-black/[0.04] border-black/[0.06]'
            }`}>
              <div className="flex items-center gap-2 flex-wrap">
                {/* ステータスアイコン */}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0
                    ? 'bg-emerald-900/50 text-[#34c759]'
                    : renderContext.rag_status === 'no_data'
                      ? 'bg-blue-900/50 text-blue-400'
                      : 'bg-[#e5e5ea] text-[#86868b]'
                }`}>
                  {renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0 ? '✓' : renderContext.rag_status === 'no_data' ? 'i' : '—'}
                </span>

                <div className="flex-1">
                  {renderContext.rag_status === 'ok' && renderContext.rag_retrieved > 0 ? (
                    <div>
                      <span className="font-bold text-[#34c759]">
                        過去問 {renderContext.rag_retrieved}件を参照して生成しました
                      </span>
                      <span className="text-[#34c759] ml-1">（データ {renderContext.chunk_count}件中）</span>
                    </div>
                  ) : renderContext.rag_status === 'no_data' ? (
                    <div>
                      <span className="font-bold text-blue-400">AIのみで問題を生成しました</span>
                      <p className="text-blue-500 mt-0.5">
                        過去問を登録すると、それを参考にしてより精度の高い問題を生成できます                      </p>
                    </div>
                  ) : renderContext.rag_status === 'empty' ? (
                    <div>
                      <span className="font-bold text-[#424245]">AIのみで問題を生成しました</span>
                      <p className="text-[#86868b] mt-0.5">
                        この条件に合う過去問がデータ内に見つかりませんでした（{renderContext.chunk_count}件を検索）
                      </p>
                    </div>
                  ) : renderContext.rag_status === 'fallback' ? (
                    <div>
                      <span className="font-bold text-[#424245]">過去問が見つからず、AIのみで生成しました</span>
                      <p className="text-[#86868b] mt-0.5">
                        この条件に合う過去問がデータ内に見つかりませんでした（{renderContext.chunk_count}件を検索）
                      </p>
                    </div>
                  ) : renderContext.chunk_count > 0 ? (
                    <span className="text-[#424245] font-bold">
                      {renderContext.chunk_count}件を参照して生成
                    </span>
                  ) : (
                    <span className="text-[#86868b]">過去問未参照 — AIのみで生成</span>
                  )}
                </div>

                {/* 検索方式バッジ */}
                {renderContext.rag_method && (
                  <span className="px-1.5 py-0.5 rounded bg-white text-[#86868b] text-[9px] font-bold uppercase">
                    {renderContext.rag_method === 'hybrid' ? '統合検索' : renderContext.rag_method === 'semantic' ? 'AI検索' : renderContext.rag_method}
                  </span>
                )}
              </div>
              {/* ベース問題使用時の表示 */}
              {sourceText.trim() && (
                <div className="mt-2 pt-2 border-t border-black/[0.06] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-[10px] text-[#ff9500] font-bold">参考問題をもとに類題を生成</span>
                  <span className="text-[10px] text-amber-500 truncate max-w-[200px]">
                    — {sourceText.trim().slice(0, 50)}{sourceText.trim().length > 50 ? '...' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* AI自動生成の結果 */}
          {mode === 'auto' && generatedLatex && (
            <div className="rounded-3xl bg-white border border-black/[0.06] shadow-sm overflow-hidden">
              <div className="p-5">
                {/* ヘッダー */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#1d1d1f] flex items-center justify-center shadow-md">
                    <Icons.Success className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#1d1d1f] tracking-tight">生成結果</h3>
                    <p className="text-[11px] text-[#86868b]">AIが生成した問題のプレビュー</p>
                  </div>
                </div>
              <div className="space-y-4">
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-4 bg-[#34c759]/[0.08] text-[#34c759] rounded-xl border border-[#34c759]/20 font-bold hover:bg-emerald-900/50 transition-colors"
                  >
                    <Icons.Pdf /> PDF を別タブで開く
                  </a>
                )}

                <details className="group">
                  <summary className="cursor-pointer text-[#86868b] text-xs font-bold hover:text-[#0071e3] transition-colors list-none flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-black/[0.04] flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">
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
                    <summary className="cursor-pointer text-[#86868b] text-xs font-bold hover:text-[#0071e3] transition-colors list-none flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-black/[0.04] flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">
                        ▸
                      </span>
                      使用された指示文を確認
                    </summary>
                    <div className="mt-3">
                      <TextArea value={prompt} rows={8} readOnly />
                      <div className="mt-2 flex items-center gap-2">
                        <CopyButton text={prompt} onCopied={setStatus} />
                        {renderContext?.chunk_count > 0 && (
                          <span className="text-xs text-[#0071e3] font-medium">
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
                  <p className="text-[13px] font-semibold text-[#1d1d1f] tracking-tight">
                    指示文をクリップボードにコピー済み
                  </p>
                  <p className="text-[11px] text-[#86868b] mt-0.5">
                    ChatGPT や Claude に貼り付けて実行してください
                  </p>
                </div>
                {renderContext?.chunk_count > 0 && (
                  <span className="text-[11px] font-medium text-[#0071e3] bg-[#0071e3]/[0.06] px-2.5 py-1 rounded-full flex-shrink-0">
                    過去問 {renderContext.chunk_count}件参照
                  </span>
                )}
                <CopyButton text={prompt} onCopied={setStatus} label="再コピー" />
              </div>

              {/* メインエリア */}
              <div className="p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-b from-[#3a3a3c] to-[#1d1d1f] shadow-lg mb-4">
                    <svg className="w-7 h-7 text-white/90" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#1d1d1f] tracking-tight">AI の出力を貼り付け</h3>
                  <p className="text-[13px] text-[#86868b] mt-1">
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
      <div ref={nextActionRef} className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 sm:mt-8 mb-4 sm:mb-0 nav-glow-in">
        <div>
          {step > 1 && step < 4 && (
            <Button variant="ghost" onClick={goBack} className="w-full sm:w-auto">
              ← 戻る
            </Button>
          )}
          {step === 5 && (
            <Button variant="ghost" onClick={goBack} className="w-full sm:w-auto">
              ← レイアウトを変更
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {step === 5 && (
            <Button variant="ghost" onClick={resetWizard} className="w-full sm:w-auto">
              最初からやり直す
            </Button>
          )}
          {step === 1 && !showCreateTemplate && (
            <Button onClick={goNext} disabled={!canNext()} className={`w-full sm:w-auto transition-all duration-500 ${canNext() ? 'cta-breathe !py-3.5 !text-base' : ''}`}>
              {canNext() ? '次のステップへ →' : 'パターンを選んでください'}
            </Button>
          )}
          {step === 2 && (
            <Button onClick={goNext} className="w-full sm:w-auto cta-breathe !py-3.5 !text-base">
              次のステップへ →
            </Button>
          )}
          {step === 3 && mode === 'auto' && (
            <Button
              onClick={goNext}
              disabled={!templateId || generating}
              className={`w-full sm:w-auto px-6 py-3 !text-base ${!generating ? 'cta-breathe' : ''}`}
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
            <button
              onClick={goNext}
              disabled={!templateId || promptGenerating}
              className={`manual-generate-btn ${!promptGenerating && templateId ? 'cta-breathe' : ''}`}
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
