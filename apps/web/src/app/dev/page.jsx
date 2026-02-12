'use client';

import { useState } from 'react';
import { useTemplates } from '@/hooks/useTemplates';
import {
  renderTemplate,
  assemblePrompt,
  saveProblem,
  saveTuningLog,
  generatePdf,
} from '@/lib/api';
import { DIFFICULTY_MAP, difficultyLabel, OUTPUT_FORMAT_INSTRUCTION, buildReferencePromptSection } from '@/lib/constants';
import TemplateSelector from '@/components/TemplateSelector';
import {
  StatusBar,
  SectionCard,
  TextArea,
  Button,
  CopyButton,
  NumberField,
  Slider,
  ProgressSteps,
  EmptyState,
  PageHeader,
  Icons,
} from '@/components/ui';

const WORKFLOW_STEPS = ['プロンプト生成', 'RAG（任意）', '外部 LLM 実行', '結果パース・DB 保存', 'チューニング記録'];

/**
 * LLM 出力テキストから JSON を抽出するヘルパー。
 * コードブロック (```json ... ```) の中身を優先し、
 * なければ先頭の { ... } を探す。
 */
function extractJson(text) {
  // Try ```json ... ``` block
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }
  // Try first { ... }
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

export default function DevModePage() {
  const { templates, subjects, refresh } = useTemplates();
  const [status, setStatus] = useState('');

  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('数学');
  const [field, setField] = useState('');
  const [difficulty, setDifficulty] = useState('普通');
  const [numQuestions, setNumQuestions] = useState(1);

  const [basePrompt, setBasePrompt] = useState('');
  const [ragPrompt, setRagPrompt] = useState('');
  const [retrievedChunks, setRetrievedChunks] = useState([]);
  const [topK, setTopK] = useState(5);
  const [textWeight, setTextWeight] = useState(0.5);
  const [difficultyMatchWeight, setDifficultyMatchWeight] = useState(0.6);
  const [trickinessWeight, setTrickinessWeight] = useState(0.0);
  const [ragSkipped, setRagSkipped] = useState(false);

  const [llmOutput, setLlmOutput] = useState('');
  const [parsedProblem, setParsedProblem] = useState(null);
  const [parseError, setParseError] = useState('');
  const [savedProblemId, setSavedProblemId] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfWorking, setPdfWorking] = useState(false);

  const [tuningScore, setTuningScore] = useState('');
  const [tuningNotes, setTuningNotes] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');

  const [currentStep, setCurrentStep] = useState(1);
  const [showRagSettings, setShowRagSettings] = useState(false);

  // 参考問題（類題生成の基準）
  const [referenceStem, setReferenceStem] = useState('');
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [showRefInput, setShowRefInput] = useState(false);

  const onSelectTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl?.metadata) {
      if (tpl.metadata.subject) setSubject(tpl.metadata.subject);
      if (tpl.metadata.field) setField(tpl.metadata.field);
      if (tpl.metadata.difficulty) setDifficulty(tpl.metadata.difficulty);
    } else {
      setField('');
    }
    setBasePrompt('');
    setRagPrompt('');
    setRetrievedChunks([]);
    setRagSkipped(false);
    setCurrentStep(1);
  };

  // ── Step 1: ベースプロンプト生成 ──
  const generateBasePrompt = async () => {
    if (!templateId) { setStatus('テンプレートを選択してください'); return; }
    setStatus('テンプレートをレンダリング中...');
    try {
      const data = await renderTemplate({
        template_id: templateId, subject, difficulty,
        num_questions: numQuestions, rag_inject: false,
      });
      const rendered = data.rendered_prompt || data.rendered || '';
      // テンプレートに出力形式が含まれていなければ自動付加
      const hasOutputSpec = /出力形式.*json|json.*形式|必ず.*json/i.test(rendered);
      // 参考問題があればプロンプトに組み込み
      const refSection = buildReferencePromptSection(referenceStem, referenceAnswer);
      setBasePrompt((hasOutputSpec ? rendered : rendered + OUTPUT_FORMAT_INSTRUCTION) + refSection);
      setRagPrompt('');
      setRetrievedChunks([]);
      setRagSkipped(false);
      setCurrentStep(2);
      setStatus('ベースプロンプト生成完了');
    } catch (e) { setStatus(`エラー: ${e.message}`); }
  };

  // ── Step 2: RAG 注入（任意） ──
  const injectRag = async () => {
    if (!basePrompt) { setStatus('まずベースプロンプトを生成してください'); return; }
    setStatus('RAG取得中...');
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
      setCurrentStep(3);
      setStatus(`RAG注入完了（${(data.retrieved || []).length}件参照）`);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('empty vocabulary') || msg.includes('retrieval failed')) {
        setStatus('RAGデータが未登録のためスキップ可能です。「RAG をスキップ」ボタンで次へ進めます。');
      } else {
        setStatus(`RAGエラー: ${msg}`);
      }
    }
  };

  const skipRag = () => {
    setRagSkipped(true);
    setRagPrompt('');
    setRetrievedChunks([]);
    setCurrentStep(3);
    setStatus('RAG をスキップしました（ベースプロンプトをそのまま使用）');
  };

  // ── Step 4: LLM 出力パース ──
  const parseLlmOutput = () => {
    if (!llmOutput.trim()) { setParseError('LLM出力が空です'); return; }
    setParseError('');

    const parsed = extractJson(llmOutput);
    if (parsed) {
      // ── DB 整合のための正規化 ──
      // final_answer: 複合文字列なら数値部分だけ抽出を試みる
      if (typeof parsed.final_answer === 'string') {
        const numMatch = parsed.final_answer.match(/^[^\d-]*(-?[\d]+(?:\.\d+)?)/); 
        if (numMatch && parsed.final_answer.length > 20) {
          // 長い説明文の場合、数値だけ抽出
          parsed.final_answer = numMatch[1];
        }
      }
      // checks: 配列でなければデフォルト生成
      if (!Array.isArray(parsed.checks)) {
        parsed.checks = [
          { desc: '自動生成 — 未検証', ok: false },
          { desc: '自動生成 — 未検証', ok: false },
        ];
      } else {
        parsed.checks = parsed.checks.map((c, i) => ({
          desc: c?.desc || `check ${i + 1}`,
          ok: c?.ok ?? false,
        }));
        if (parsed.checks.length < 2) {
          while (parsed.checks.length < 2) {
            parsed.checks.push({ desc: '自動補完 — 未検証', ok: false });
          }
        }
      }
      setParsedProblem(parsed);
      setParseError('');
      setStatus('JSON パース成功（正規化済み）');
    } else {
      // JSON ではない場合 — テキスト/LaTeX として stem に格納
      setParsedProblem({
        stem: llmOutput.trim(),
        stem_latex: llmOutput.trim(),
        final_answer: '',
        checks: [
          { desc: '自動生成 — 未検証', ok: false },
          { desc: '自動生成 — 未検証', ok: false },
        ],
      });
      setParseError('');
      setStatus('テキストとして stem にマッピングしました（JSON 形式推奨）');
    }
  };

  // ── Step 4: problems テーブルへ保存 ──
  const saveToProblemsDb = async () => {
    if (!parsedProblem) { setStatus('まず「出力をパース」してください'); return; }
    setStatus('problems テーブルに保存中...');
    try {
      const extraMeta = {
        subject: subject || null,
        field: field || null,
        template_id: templateId || null,
        difficulty_label: difficulty || null,
        source: 'dev_mode',
      };
      const data = await saveProblem(parsedProblem, extraMeta);
      setSavedProblemId(data.inserted_id || null);
      setCurrentStep(5);
      setStatus(`problems テーブルに保存完了 (id: ${data.inserted_id || '—'})`);
    } catch (e) {
      const detail = e.message || '';
      if (detail.includes('missing_stem')) {
        setStatus('保存エラー: stem フィールドが必要です。LLM 出力を確認してください。');
      } else if (detail.includes('validation_failed')) {
        setStatus(`バリデーションエラー: ${detail}（final_answer, checks が必要な場合があります）`);
      } else {
        setStatus(`保存エラー: ${detail}`);
      }
    }
  };

  // ── PDF 生成 ──
  const compilePdf = async () => {
    if (!llmOutput?.trim()) { setStatus('LaTeX を貼り付けてください'); return; }
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
    } catch (e) { setStatus(`PDF 生成失敗: ${e.message}`); }
    setPdfWorking(false);
  };

  // ── Step 5: チューニングログ保存 ──
  const saveLog = async () => {
    if (!llmOutput) { setStatus('LLM出力がありません'); return; }
    setStatus('チューニングログを保存中...');
    try {
      const tpl = templates.find((t) => t.id === templateId) || {};
      const body = {
        prompt: ragPrompt || basePrompt, model_output: llmOutput,
        expected_output: expectedOutput || undefined,
        score: tuningScore !== '' ? Number(tuningScore) : undefined,
        notes: tuningNotes || undefined,
        metadata: {
          template_id: templateId || null, subject: subject || null,
          difficulty: difficulty || null,
          field: field || tpl.metadata?.field || null,
          saved_problem_id: savedProblemId || null,
        },
      };
      const data = await saveTuningLog(body);
      setStatus(`チューニングログ保存完了 (id: ${data.id || '—'})`);
      setTuningScore(''); setTuningNotes(''); setExpectedOutput('');
    } catch (e) { setStatus(`保存エラー: ${e.message}`); }
  };

  const resetAll = () => {
    setBasePrompt(''); setRagPrompt(''); setRetrievedChunks([]);
    setRagSkipped(false);
    setLlmOutput(''); setParsedProblem(null); setParseError('');
    setSavedProblemId(null); setReferenceStem(''); setReferenceAnswer('');
    setPdfUrl(''); setTuningScore(''); setTuningNotes('');
    setExpectedOutput(''); setCurrentStep(1); setStatus('リセットしました');
  };

  const finalPrompt = ragPrompt || basePrompt;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="開発・チューニング"
        description="テンプレート → RAG（任意）→ 外部 LLM → DB 保存 → チューニング記録。RAG データがなくても開始できます。"
        icon={<Icons.Dev />}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Dev Mode' }]}
      />

      <div className="flex items-center justify-between bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <ProgressSteps steps={WORKFLOW_STEPS} current={currentStep} />
        <Button variant="ghost" size="sm" onClick={resetAll} className="text-slate-400 hover:text-rose-500 ml-4 flex-shrink-0">
          リセット
        </Button>
      </div>

      <StatusBar message={status} />

      {/* ═══ STEP 1: プロンプト生成 ═══ */}
      <SectionCard title="Step 1 — プロンプト生成" icon={<Icons.Prompt />}
        subtitle="テンプレートと科目・難易度からベースプロンプトを生成">
        <TemplateSelector templates={templates} selectedId={templateId}
          onSelectTemplate={onSelectTemplate} subject={subject}
          onSubjectChange={(v) => { setSubject(v); setTemplateId(''); setField(''); }}
          difficulty={difficulty} onDifficultyChange={setDifficulty}
          numQuestions={numQuestions} onNumQuestionsChange={setNumQuestions}
          field={field} onFieldChange={setField} showFieldInput showSubjectFilter
          allSubjects={subjects} setStatus={setStatus} onRefresh={refresh} />
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowRefInput(!showRefInput)}>
              <Icons.Prompt className="w-4 h-4 mr-1" />
              {showRefInput ? '参考問題を閉じる' : '参考問題を追加（任意）'}
            </Button>
            {referenceStem && (
              <span className="text-xs text-emerald-600 font-semibold">✓ 参考問題設定済み</span>
            )}
          </div>
          {showRefInput && (
            <div className="p-4 bg-violet-50/60 rounded-xl border border-violet-200/40 space-y-3">
              <div className="text-xs font-semibold text-violet-700 flex items-center gap-2">
                <Icons.Prompt className="w-3.5 h-3.5" />
                参考問題（類題生成の基準）
              </div>
              <p className="text-xs text-violet-600">
                基本となる問題と解答を入力すると、LLM が同じパターンで類題を生成します。
              </p>
              <TextArea label="参考問題文" value={referenceStem} onChange={setReferenceStem} rows={3}
                placeholder="例: 2次関数 f(x)=x^2-6x+5 の最小値とそのときのxの値を求めよ。" />
              <TextArea label="参考解答（任意）" value={referenceAnswer} onChange={setReferenceAnswer} rows={2}
                placeholder="例: f(x)=(x-3)^2-4 より、x=3のとき最小値-4" />
            </div>
          )}
          <Button onClick={generateBasePrompt} disabled={!templateId}>
            <Icons.Prompt className="w-4 h-4 mr-2" /> ベースプロンプトを生成
          </Button>
        </div>
        {basePrompt && (
          <div className="mt-4">
            <TextArea label="生成されたプロンプト" value={basePrompt} onChange={setBasePrompt} rows={5} />
            <div className="mt-2"><CopyButton text={basePrompt} onCopied={setStatus} /></div>
          </div>
        )}
      </SectionCard>

      {/* ═══ STEP 2: RAG チューニング（任意） ═══ */}
      <SectionCard title="Step 2 — RAG チューニング（任意）" icon={<Icons.Search />}
        subtitle="DBに問題データがあれば類似情報を注入。なければスキップして OK"
        className={`transition-opacity ${currentStep >= 2 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <Button onClick={injectRag} disabled={!basePrompt}>
            <Icons.Search className="w-4 h-4 mr-2" />
            RAG 注入（{subject}{field ? ` / ${field}` : ''}）
          </Button>
          <Button variant="ghost" onClick={skipRag} disabled={!basePrompt}>
            <Icons.ArrowRight className="w-4 h-4 mr-2" />
            RAG をスキップ
          </Button>
          <NumberField label="Top-K" value={topK} onChange={setTopK} min={1} max={20} />
          <Button variant="ghost" size="sm" onClick={() => setShowRagSettings(!showRagSettings)}>
            <Icons.Dev className="w-4 h-4 mr-1" />
            {showRagSettings ? '設定を閉じる' : '重み設定'}
          </Button>
        </div>

        {ragSkipped && (
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/40 text-xs text-amber-700 mb-4">
            <div className="flex items-center gap-2 font-semibold">
              <Icons.Info className="w-3.5 h-3.5" />
              RAG をスキップしました — ベースプロンプトをそのまま使用します。
              問題データが蓄積されたら RAG を有効にできます。
            </div>
          </div>
        )}

        {showRagSettings && (
          <div className="p-4 bg-slate-50/80 rounded-xl mb-4 space-y-2 border border-slate-100">
            <Slider label="テキスト類似度" value={textWeight} onChange={setTextWeight} />
            <Slider label="難易度マッチ" value={difficultyMatchWeight} onChange={setDifficultyMatchWeight} />
            <Slider label="ひっかけ度" value={trickinessWeight} onChange={setTrickinessWeight} />
          </div>
        )}
        {retrievedChunks.length > 0 && (
          <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
            <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              参照候補 ({retrievedChunks.length}件)
            </div>
            {retrievedChunks.map((c, i) => (
              <div key={i} className="py-2 border-b border-slate-100 last:border-0 text-xs flex items-start gap-2">
                <span className="text-slate-300 font-mono flex-shrink-0">#{i + 1}</span>
                <span className="text-slate-600 flex-1 leading-relaxed">
                  {(c.text || '').slice(0, 150).replace(/\n/g, ' ')}
                  {(c.text || '').length > 150 ? '...' : ''}
                </span>
                <span className="text-slate-400 flex-shrink-0 tabular-nums">
                  {c.final_score !== undefined ? Number(c.final_score).toFixed(2)
                    : c.score !== undefined ? Number(c.score).toFixed(2) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
        {ragPrompt && (
          <div>
            <TextArea label="RAG注入済みプロンプト" value={ragPrompt} onChange={setRagPrompt} rows={7} />
            <div className="mt-2"><CopyButton text={ragPrompt} onCopied={setStatus} /></div>
          </div>
        )}
      </SectionCard>

      {/* ═══ STEP 3: 外部 LLM で実行 ═══ */}
      <SectionCard title="Step 3 — 外部 LLM で実行" icon={<Icons.ArrowRight />}
        subtitle="プロンプトを外部 LLM（ChatGPT / Claude / Gemini 等）にコピーして実行"
        className={`transition-opacity ${currentStep >= 3 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        {finalPrompt ? (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center">
                  <Icons.Copy className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700">送信用プロンプト</div>
                  <div className="text-xs text-slate-400">
                    {finalPrompt.length.toLocaleString()} 文字
                    {ragSkipped && ' （RAG なし）'}
                  </div>
                </div>
                <div className="ml-auto">
                  <CopyButton text={finalPrompt} onCopied={setStatus} label="プロンプトをコピー" />
                </div>
              </div>
              <pre className="text-xs text-slate-600 bg-white/60 rounded-lg p-3 max-h-32 overflow-auto custom-scrollbar font-mono leading-relaxed">
                {finalPrompt.slice(0, 500)}{finalPrompt.length > 500 ? '\n...' : ''}
              </pre>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { name: 'ChatGPT', url: 'https://chat.openai.com', color: 'from-green-500 to-emerald-600' },
                { name: 'Claude', url: 'https://claude.ai', color: 'from-amber-500 to-orange-500' },
                { name: 'Gemini', url: 'https://gemini.google.com', color: 'from-blue-500 to-indigo-600' },
              ].map(({ name, url, color }) => (
                <a key={name} href={url} target="_blank" rel="noreferrer"
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r ${color} text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]`}>
                  <Icons.ArrowRight className="w-4 h-4" /> {name} を開く
                </a>
              ))}
            </div>
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/40 text-xs text-emerald-700">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <Icons.Success className="w-3.5 h-3.5" /> DB 保存用の JSON 出力形式がプロンプトに組み込み済み
              </div>
              <p className="text-emerald-600 mt-1">
                プロンプト末尾に出力形式指定（stem, final_answer, checks 等）が自動付加されています。
                LLM は JSON 形式で回答するため、Step 4 でそのままパース・保存できます。
              </p>
            </div>
          </div>
        ) : (
          <EmptyState icon={<Icons.Empty />}
            title="プロンプトが未生成です"
            description="Step 1 を完了すると送信用プロンプトが表示されます（RAG はスキップ可）" />
        )}
      </SectionCard>

      {/* ═══ STEP 4: 結果パース・DB 保存 ═══ */}
      <SectionCard title="Step 4 — 結果パース・DB 保存" icon={<Icons.Data />}
        subtitle="LLM 出力をパースして problems テーブルに保存（RAG データ源を蓄積）"
        className={`transition-opacity ${currentStep >= 3 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <TextArea label="LLM 出力を貼り付け" value={llmOutput}
          onChange={(v) => {
            setLlmOutput(v);
            setParsedProblem(null);
            setParseError('');
            setSavedProblemId(null);
            if (v && currentStep < 4) setCurrentStep(4);
          }}
          rows={10} placeholder="LLM の出力（JSON 推奨 / LaTeX / テキスト可）をここに貼り付け" />

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Button onClick={parseLlmOutput} disabled={!llmOutput}>
            <Icons.Search className="w-4 h-4 mr-2" /> 出力をパース
          </Button>
          <Button variant="success" onClick={saveToProblemsDb}
            disabled={!parsedProblem}
            className="shadow-lg shadow-emerald-200/50">
            <Icons.Data className="w-4 h-4 mr-2" /> problems テーブルに保存
          </Button>
          <Button variant="ghost" onClick={compilePdf} disabled={!llmOutput || pdfWorking}>
            {pdfWorking ? (
              <span className="flex items-center gap-2"><Icons.Info className="animate-pulse" /> 生成中...</span>
            ) : (
              <span className="flex items-center gap-2"><Icons.Pdf className="w-4 h-4" /> PDF 生成</span>
            )}
          </Button>
        </div>

        {/* パース結果プレビュー */}
        {parsedProblem && (
          <div className="mt-4 p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/40 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Icons.Success className="w-4 h-4" /> パース結果プレビュー
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                ['stem', parsedProblem.stem],
                ['stem_latex', parsedProblem.stem_latex],
                ['solution_outline', parsedProblem.solution_outline],
                ['final_answer', parsedProblem.final_answer],
                ['difficulty', parsedProblem.difficulty],
                ['confidence', parsedProblem.confidence],
                ['explanation', parsedProblem.explanation],
                ['answer_brief', parsedProblem.answer_brief],
              ].filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (
                <div key={k} className="flex gap-2 items-start">
                  <span className="font-mono text-emerald-600 flex-shrink-0 min-w-[120px]">{k}:</span>
                  <span className="text-slate-600 break-all">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 200)}
                    {String(v).length > 200 ? '...' : ''}
                  </span>
                </div>
              ))}
              {parsedProblem.checks && (
                <div className="col-span-full flex gap-2 items-start">
                  <span className="font-mono text-emerald-600 flex-shrink-0 min-w-[120px]">checks:</span>
                  <span className="text-slate-600">
                    {Array.isArray(parsedProblem.checks)
                      ? `${parsedProblem.checks.length} 件`
                      : JSON.stringify(parsedProblem.checks)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {parseError && (
          <div className="mt-3 p-3 bg-rose-50/60 rounded-xl border border-rose-200/40 text-xs text-rose-700">
            <Icons.Info className="w-3.5 h-3.5 inline mr-1" /> {parseError}
          </div>
        )}

        {savedProblemId && (
          <div className="mt-3 p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/50 text-sm text-emerald-700 font-semibold flex items-center gap-2">
            <Icons.Success className="w-4 h-4" />
            problems テーブルに保存済み — ID: {savedProblemId}
          </div>
        )}

        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-bold hover:bg-emerald-100 transition-colors">
            <Icons.Pdf className="w-5 h-5" /> PDF プレビューを開く
          </a>
        )}
      </SectionCard>

      {/* ═══ STEP 5: チューニング記録 ═══ */}
      <SectionCard title="Step 5 — チューニング記録" icon={<Icons.Chart />}
        subtitle="品質スコアとメモを記録して、プロンプト改善に活用"
        className={`transition-opacity ${currentStep >= 5 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex flex-wrap gap-2 mb-4">
          {templateId && <span className="badge badge-primary">{templates.find((t) => t.id === templateId)?.name || templateId}</span>}
          {subject && <span className="badge badge-neutral">{subject}</span>}
          {field && <span className="badge badge-neutral">{field}</span>}
          {savedProblemId && <span className="badge badge-success">problem: {savedProblemId}</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">スコア (0-1)</label>
            <input type="number" value={tuningScore} onChange={(e) => setTuningScore(e.target.value)}
              min={0} max={1} step={0.1}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm input-ring" placeholder="0.8" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">期待出力</label>
            <input value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm input-ring" placeholder="期待される出力の要約" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">メモ</label>
            <input value={tuningNotes} onChange={(e) => setTuningNotes(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm input-ring" placeholder="短いメモ" />
          </div>
        </div>
        <Button onClick={saveLog} disabled={!llmOutput}>
          <Icons.Success className="w-4 h-4 mr-2" /> チューニングログを保存
        </Button>
      </SectionCard>
    </div>
  );
}
