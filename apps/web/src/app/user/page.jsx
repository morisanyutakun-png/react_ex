'use client';

import { useState, useEffect } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { renderTemplate, generatePdf, fetchLatexPresets, generateWithLlm } from '@/lib/api';
import TemplateSelector from '@/components/TemplateSelector';
import {
  StatusBar,
  SectionCard,
  TextArea,
  Button,
  CopyButton,
  NumberField,
  SelectField,
  PageHeader,
  Icons,
} from '@/components/ui';

export default function UserModePage() {
  const { templates, subjects, refresh } = useTemplates();
  const [status, setStatus] = useState('');

  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('数学');
  const [difficulty, setDifficulty] = useState('普通');
  const [numQuestions, setNumQuestions] = useState(1);
  const [topK, setTopK] = useState(5);
  const [prompt, setPrompt] = useState('');
  const [renderContext, setRenderContext] = useState(null);
  const [llmOutput, setLlmOutput] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfWorking, setPdfWorking] = useState(false);

  // LaTeX出力形式プリセット
  const [latexPresets, setLatexPresets] = useState([]);
  const [latexPreset, setLatexPreset] = useState('exam');

  // ワンクリック生成 state
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [generatedLatex, setGeneratedLatex] = useState('');
  const [autoMode, setAutoMode] = useState('auto'); // 'auto' or 'manual'

  useEffect(() => {
    fetchLatexPresets()
      .then((presets) => setLatexPresets(presets))
      .catch(() => {
        // フォールバック
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
      });
      setRenderContext(data.context || null);
      setPrompt(data.rendered_prompt || data.rendered || '');
      if (data.context?.chunk_count || data.context?.rag_summary?.length > 0) {
        setStatus(`プロンプト生成完了（RAG: ${data.context.chunk_count || 0}件参照）`);
      } else {
        setStatus('プロンプト生成完了');
      }
    } catch (e) {
      setStatus(`エラー: ${e.message}`);
    }
  };

  const compilePdf = async () => {
    if (!llmOutput?.trim()) {
      setStatus('LaTeX を貼り付けてください');
      return;
    }
    setPdfWorking(true);
    setStatus('PDF を生成中...');
    try {
      const data = await generatePdf(llmOutput);
      if (data?.pdf_url) {
        setPdfUrl(data.pdf_url);
        window.open(data.pdf_url, '_blank');
        setStatus('PDF を開きました');
      } else if (data?.error) {
        setStatus(`PDF 生成失敗: ${data.error} — ${data.detail || data.stderr || ''}`);
      } else {
        setStatus('PDF 生成失敗: サーバーに LaTeX エンジンがインストールされていません');
      }
    } catch (e) {
      setStatus(`PDF 生成失敗: ${e.message}`);
    }
    setPdfWorking(false);
  };

  // ── ワンクリック: プロンプト生成 → Gemini → LaTeX → PDF ──
  const handleAutoGenerate = async () => {
    if (!templateId) {
      setStatus('テンプレートを選択してください');
      return;
    }
    setAutoGenerating(true);
    setGeneratedLatex('');
    setPdfUrl('');

    // Step 1: プロンプト生成（内部で自動実行）
    setStatus('Step 1/3: プロンプトを生成中...');
    let generatedPrompt = prompt;
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
      });
      generatedPrompt = data.rendered_prompt || data.rendered || '';
      setRenderContext(data.context || null);
      setPrompt(generatedPrompt);
    } catch (e) {
      setStatus(`プロンプト生成エラー: ${e.message}`);
      setAutoGenerating(false);
      return;
    }

    if (!generatedPrompt?.trim()) {
      setStatus('プロンプトの生成に失敗しました');
      setAutoGenerating(false);
      return;
    }

    // Step 2-3: Gemini → LaTeX → PDF
    setStatus('Step 2/3: Gemini 2.5 Flash で問題を生成中...');
    try {
      const data = await generateWithLlm({
        prompt: generatedPrompt,
        latex_preset: latexPreset,
        title: `${subject} - ${difficulty}`,
      });

      if (data?.error) {
        setStatus(`生成エラー: ${data.error}`);
        setAutoGenerating(false);
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
      } else if (data?.pdf_error) {
        setStatus(`LaTeX 生成成功 / PDF 変換失敗: ${data.pdf_error}`);
      } else {
        setStatus('LaTeX 生成完了（PDF エンジン未設定）');
      }
    } catch (e) {
      setStatus(`生成エラー: ${e.message}`);
    }
    setAutoGenerating(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="生成・プレビュー"
        description="テンプレートと RAG を活用し、LLM 用の高品質なプロンプトを生成。"
        icon={<Icons.User />}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'User Mode' }]}
      />

      <StatusBar message={status} />

      {/* モード切替タブ */}
      <div className="flex gap-2 bg-white/60 backdrop-blur-md p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit">
        <button
          onClick={() => setAutoMode('auto')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            autoMode === 'auto'
              ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          AI 自動生成
        </button>
        <button
          onClick={() => setAutoMode('manual')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            autoMode === 'manual'
              ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          手動（従来）
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左カラム: 設定 */}
        <div className="lg:col-span-4 space-y-6">
          <SectionCard title="生成設定" icon={<Icons.Prompt />}>
            <div className="space-y-4">
              <TemplateSelector
                templates={templates}
                selectedId={templateId}
                onSelectTemplate={onSelectTemplate}
                subject={subject}
                onSubjectChange={setSubject}
                difficulty={difficulty}
                onDifficultyChange={setDifficulty}
                numQuestions={numQuestions}
                onNumQuestionsChange={setNumQuestions}
                allSubjects={subjects}
                setStatus={setStatus}
                onRefresh={refresh}
                compact
              />

              <div className="pt-2 flex flex-col gap-3">
                <NumberField label="RAG Top-K" value={topK} onChange={setTopK} min={1} max={20} />

                <SelectField
                  label="PDF出力形式"
                  value={latexPreset}
                  onChange={setLatexPreset}
                  options={latexPresets.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                />
                {latexPresets.length > 0 && (
                  <div className="px-3 py-2 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[11px] text-indigo-600">
                    {latexPresets.find((p) => p.id === latexPreset)?.description || ''}
                  </div>
                )}

                {autoMode === 'auto' ? (
                  <Button
                    onClick={handleAutoGenerate}
                    disabled={!templateId || autoGenerating}
                    className="w-full py-5 shadow-lg shadow-violet-200/50 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white text-base"
                  >
                    {autoGenerating ? (
                      <span className="flex items-center gap-3">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        AI が生成中...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Icons.Pdf className="w-5 h-5" />
                        PDF を生成
                      </span>
                    )}
                  </Button>
                ) : (
                  <Button onClick={generatePrompt} disabled={!templateId} className="w-full py-4 shadow-lg shadow-indigo-200/50">
                    <Icons.Prompt className="mr-2" />
                    プロンプトを生成
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>

          {/* ═══ AI 自動生成モード: 生成結果 ═══ */}
          {autoMode === 'auto' && (generatedLatex || pdfUrl) && (
            <SectionCard
              title="生成結果"
              icon={<Icons.ArrowRight />}
              className="border-2 border-violet-200/60"
            >
              <div className="space-y-4">
                {generatedLatex && (
                  <details className="group" open>
                    <summary className="cursor-pointer text-slate-400 text-[11px] font-bold uppercase tracking-wider hover:text-violet-500 transition-colors list-none flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center group-open:rotate-90 transition-transform">
                        ▸
                      </span>
                      生成された LaTeX を表示
                    </summary>
                    <div className="mt-3">
                      <TextArea
                        label="生成 LaTeX（編集可）"
                        value={generatedLatex}
                        onChange={(v) => {
                          setGeneratedLatex(v);
                          setLlmOutput(v);
                        }}
                        rows={12}
                        inputClassName="font-mono text-[12px]"
                      />
                      <div className="mt-2 flex gap-2">
                        <CopyButton text={generatedLatex} onCopied={setStatus} />
                        <Button variant="ghost" size="sm" onClick={compilePdf} disabled={!generatedLatex || pdfWorking}>
                          <Icons.Pdf className="w-4 h-4 mr-1" /> 再コンパイル
                        </Button>
                      </div>
                    </div>
                  </details>
                )}

                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <Icons.Pdf /> PDF を別タブで開く
                  </a>
                )}
              </div>
            </SectionCard>
          )}

          {/* ═══ 手動モード: PDF 変換 ═══ */}
          {autoMode === 'manual' && (
            <SectionCard title="PDF 変換（手動）" icon={<Icons.Pdf />}>
              <div className="space-y-4">
                <TextArea
                  label="LLMの出力を貼り付け"
                  value={llmOutput}
                  onChange={setLlmOutput}
                  rows={10}
                  placeholder="LaTeXコードをここに貼り付け"
                />
                <Button
                  onClick={compilePdf}
                  disabled={!llmOutput || pdfWorking}
                  variant="success"
                  className="w-full py-4 shadow-lg shadow-emerald-200/50"
                >
                  {pdfWorking ? (
                    <span className="flex items-center gap-2">
                      <Icons.Info className="animate-pulse" /> 生成中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Icons.Pdf /> PDFを生成・表示
                    </span>
                  )}
                </Button>

                {pdfUrl && autoMode === 'manual' && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <Icons.Pdf /> プレビューを別タブで開く
                  </a>
                )}
              </div>
            </SectionCard>
          )}
        </div>

        {/* 右カラム: 手動モードではプロンプト表示 / 自動モードでは使い方ガイド */}
        <div className="lg:col-span-8 flex flex-col min-h-[600px]">
          {autoMode === 'auto' ? (
            <SectionCard
              title="AI 自動生成モード"
              icon={<Icons.ArrowRight />}
              className="flex-1 flex flex-col"
            >
              {!generatedLatex && !autoGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 h-64 lg:h-full">
                  <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center mb-4">
                    <Icons.Pdf className="w-10 h-10 text-violet-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-400 text-center">
                    テンプレートを選んで「PDF を生成」を押すだけ
                  </p>
                  <p className="text-xs text-slate-300 mt-2 text-center max-w-sm">
                    Gemini 2.5 Flash が問題を生成し、自動で PDF に変換します。
                    生成後は LaTeX の編集・再コンパイルも可能です。
                  </p>
                </div>
              ) : autoGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10">
                  <svg className="animate-spin h-12 w-12 text-violet-400 mb-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm font-semibold text-violet-500">{status}</p>
                </div>
              ) : (
                <div className="flex flex-col h-full space-y-4">
                  {prompt && (
                    <details className="group">
                      <summary className="cursor-pointer text-slate-400 text-[11px] font-bold uppercase tracking-wider hover:text-violet-500 transition-colors list-none flex items-center gap-2">
                        <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center group-open:rotate-90 transition-transform">▸</span>
                        使用されたプロンプトを確認
                      </summary>
                      <div className="mt-3">
                        <TextArea
                          label="LLMに送信されたプロンプト"
                          value={prompt}
                          onChange={setPrompt}
                          rows={12}
                          inputClassName="font-mono text-[12px] leading-relaxed"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <CopyButton text={prompt} onCopied={setStatus} />
                          {renderContext && (
                            <span className="text-[11px] text-indigo-500 font-medium">
                              RAG {renderContext.chunk_count || 0}件参照
                            </span>
                          )}
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </SectionCard>
          ) : (
            <SectionCard
              title="生成されたプロンプト"
              icon={<Icons.ArrowRight />}
              className="flex-1 flex flex-col"
            >
              {!prompt ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 h-64 lg:h-full">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Icons.Prompt className="w-10 h-10 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">設定を完了して「プロンプトを生成」を押してください</p>
                </div>
              ) : (
                <div className="flex flex-col h-full space-y-4">
                  <div className="flex-1 min-h-0">
                    <TextArea
                      label="LLMに送信する内容"
                      value={prompt}
                      onChange={setPrompt}
                      rows={15}
                      className="h-full"
                      inputClassName="font-mono text-[13px] leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-2">
                    <div className="flex-1">
                      {renderContext && (
                        <div className="px-4 py-2 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[11px] text-indigo-700 flex items-center gap-2 font-medium">
                          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                          参照チャンク: {renderContext.chunk_count || 0}件
                        </div>
                      )}
                    </div>
                    <CopyButton text={prompt} onCopied={setStatus} className="shadow-md" />
                  </div>

                  {renderContext?.rag_summary && (
                    <details className="group">
                      <summary className="cursor-pointer text-slate-400 text-[11px] font-bold uppercase tracking-wider hover:text-indigo-500 transition-colors list-none flex items-center gap-2">
                        <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center group-open:rotate-90 transition-transform">▸</span>
                        RAG Context Summary
                      </summary>
                      <div className="mt-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 text-[12px] font-mono text-slate-500 max-h-40 overflow-auto custom-scrollbar leading-relaxed">
                        {renderContext.rag_summary}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
