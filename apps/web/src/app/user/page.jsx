'use client';

import { useState, useEffect } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import { renderTemplate, generatePdf } from '@/lib/api';
import TemplateSelector from '@/components/TemplateSelector';
import {
  StatusBar,
  SectionCard,
  TextArea,
  Button,
  CopyButton,
  NumberField,
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
      }
    } catch (e) {
      setStatus(`PDF 生成失敗: ${e.message}`);
    }
    setPdfWorking(false);
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左カラム: 設定 & 出力入力 */}
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
                <Button onClick={generatePrompt} disabled={!templateId} className="w-full py-4 shadow-lg shadow-indigo-200/50">
                  <Icons.Prompt className="mr-2" />
                  プロンプトを生成
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="PDF 変換" icon={<Icons.Pdf />}>
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

              {pdfUrl && (
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
        </div>

        {/* 右カラム: 生成結果プロンプト */}
        <div className="lg:col-span-8 flex flex-col min-h-[600px]">
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
        </div>
      </div>
    </div>
  );
}
