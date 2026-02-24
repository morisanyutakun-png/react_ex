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
  EmptyState,
  PageHeader,
  Icons,
} from '@/components/ui';

/**
 * LLM 出力テキストから JSON を抽出するヘルパー。
 */
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

/* ─── RAG ミキサーコンポーネント ─── */
function RagMixer({ textWeight, diffWeight, trickWeight, onText, onDiff, onTrick }) {
  const total = textWeight + diffWeight + trickWeight || 1;
  const pcts = [
    { label: '類似度', value: textWeight, color: 'bg-blue-500', onChange: onText },
    { label: '難易度', value: diffWeight, color: 'bg-emerald-500', onChange: onDiff },
    { label: 'ひっかけ', value: trickWeight, color: 'bg-amber-500', onChange: onTrick },
  ];
  return (
    <div className="space-y-4">
      {/* ビジュアルバー */}
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
      {/* スライダー */}
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

/* ─── 品質レーティング ─── */
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

export default function TuningPage() {
  const { templates, subjects, refresh } = useTemplates();
  const [status, setStatus] = useState('');

  // テンプレート & パラメータ
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('数学');
  const [field, setField] = useState('');
  const [difficulty, setDifficulty] = useState('普通');
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
  const [showRefInput, setShowRefInput] = useState(false);

  // UI状態
  const [activeSection, setActiveSection] = useState('configure'); // configure | execute | evaluate

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
      setStatus('プロンプト生成完了 → RAGを注入するか、そのままコピーしてLLMへ');
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
      setStatus(`RAG注入完了（${(data.retrieved || []).length}件の関連データを参照）`);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('empty vocabulary') || msg.includes('retrieval failed')) {
        setStatus('RAGデータが未登録です。「スキップ」で進めます。');
      } else if (msg.includes('502') || msg.includes('504') || msg.includes('タイムアウト') || msg.includes('backend_timeout') || msg.includes('backend_unavailable')) {
        setStatus('RAGエラー: バックエンドが一時的に利用できません。数秒後に再試行してください。');
      } else {
        setStatus(`RAGエラー: ${msg}`);
      }
    }
  };

  const skipRag = () => {
    setRagSkipped(true);
    setRagPrompt('');
    setRetrievedChunks([]);
    setStatus('RAGをスキップ — プロンプトをそのまま使用');
  };

  // ── LLM 出力パース ──
  const parseLlmOutput = () => {
    if (!llmOutput.trim()) { setParseError('LLM出力が空です'); return; }
    setParseError('');
    const parsed = extractJson(llmOutput);
    if (parsed) {
      if (typeof parsed.final_answer === 'string') {
        const numMatch = parsed.final_answer.match(/^[^\d-]*(-?[\d]+(?:\.\d+)?)/);
        if (numMatch && parsed.final_answer.length > 20) {
          parsed.final_answer = numMatch[1];
        }
      }
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
        while (parsed.checks.length < 2) {
          parsed.checks.push({ desc: '自動補完 — 未検証', ok: false });
        }
      }
      setParsedProblem(parsed);
      setParseError('');
      setStatus('パース成功');
    } else {
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
      setStatus('テキストとして読み取りました（JSON形式推奨）');
    }
  };

  // ── DB 保存 ──
  const saveToProblemsDb = async () => {
    if (!parsedProblem) { setStatus('まず「パース」してください'); return; }
    setStatus('検算して保存中...');
    setVerificationResult(null);
    try {
      const extraMeta = {
        subject: subject || null, field: field || null,
        template_id: templateId || null, difficulty_label: difficulty || null,
        source: 'dev_mode',
      };
      const data = await saveProblem(parsedProblem, extraMeta);
      if (data.verification) setVerificationResult(data.verification);
      setSavedProblemId(data.inserted_id || null);
      setStatus(`保存完了 (id: ${data.inserted_id || '—'})`);
    } catch (e) {
      const detail = e.message || '';
      const errData = e.data || {};
      if (errData.error === 'verification_failed' && errData.verification) {
        setVerificationResult(errData.verification);
        setStatus(`検算不一致 — 保存をブロックしました`);
        return;
      }
      setStatus(`保存エラー: ${detail}`);
    }
  };

  // ── PDF 生成 ──
  const compilePdf = async () => {
    if (!llmOutput?.trim()) { setStatus('出力を貼り付けてください'); return; }
    setPdfWorking(true);
    setStatus('PDF を生成中...');
    try {
      const data = await generatePdf(llmOutput);
      if (data?.pdf_url) {
        setPdfUrl(data.pdf_url);
        window.open(data.pdf_url, '_blank');
        setStatus('PDF を開きました');
      } else {
        setStatus(`PDF 生成失敗: ${data?.error || 'LaTeXエンジンが見つかりません'}`);
      }
    } catch (e) { setStatus(`PDF 生成失敗: ${e.message}`); }
    setPdfWorking(false);
  };

  // ── チューニングログ保存 ──
  const saveLog = async () => {
    if (!llmOutput) { setStatus('LLM出力がありません'); return; }
    setStatus('評価を記録中...');
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
      setStatus(`評価を記録しました (id: ${data.id || '—'})`);
      setTuningScore(''); setTuningNotes(''); setExpectedOutput('');
    } catch (e) { setStatus(`保存エラー: ${e.message}`); }
  };

  const resetAll = () => {
    setBasePrompt(''); setRagPrompt(''); setRetrievedChunks([]);
    setRagSkipped(false);
    setLlmOutput(''); setParsedProblem(null); setParseError('');
    setSavedProblemId(null); setVerificationResult(null);
    setReferenceStem(''); setReferenceAnswer('');
    setPdfUrl(''); setTuningScore(''); setTuningNotes('');
    setExpectedOutput(''); setActiveSection('configure'); setStatus('リセットしました');
  };

  const finalPrompt = ragPrompt || basePrompt;
  const hasPrompt = !!basePrompt;
  const hasOutput = !!llmOutput.trim();

  // ── セクションタブ ──
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
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: '調整する' }]}
      />

      <StatusBar message={status} />

      {/* ── セクションナビ ── */}
      <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md p-2 rounded-2xl border border-slate-100 shadow-sm">
        {sections.map((s) => (
          <button key={s.id} onClick={() => s.enabled && setActiveSection(s.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200
              ${activeSection === s.id
                ? 'bg-white text-slate-800 shadow-sm'
                : s.enabled
                  ? 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                  : 'text-slate-200 cursor-not-allowed'
              }`}
            disabled={!s.enabled}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
            {!s.enabled && s.id !== 'configure' && (
              <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">
                {s.id === 'execute' ? 'プロンプト生成後' : '出力貼付後'}
              </span>
            )}
          </button>
        ))}
        <button onClick={resetAll}
          className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all">
          リセット
        </button>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* ⚙️ 設定セクション                          */}
      {/* ════════════════════════════════════════════ */}
      {activeSection === 'configure' && (
        <div className="space-y-6">
          {/* テンプレート選択 */}
          <SectionCard title="テンプレート & 条件" icon={<Icons.File />}
            subtitle="問題生成の元となるテンプレートと条件を設定">
            <TemplateSelector templates={templates} selectedId={templateId}
              onSelectTemplate={onSelectTemplate} subject={subject}
              onSubjectChange={(v) => { setSubject(v); setTemplateId(''); setField(''); }}
              difficulty={difficulty} onDifficultyChange={setDifficulty}
              numQuestions={numQuestions} onNumQuestionsChange={setNumQuestions}
              field={field} onFieldChange={setField} showFieldInput showSubjectFilter
              allSubjects={subjects} setStatus={setStatus} onRefresh={refresh} />

            {/* 参考問題（折りたたみ） */}
            <div className="mt-4">
              <button onClick={() => setShowRefInput(!showRefInput)}
                className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                <svg className={`w-4 h-4 transition-transform ${showRefInput ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                参考問題を追加（類題を作りたい場合）
                {referenceStem && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">設定済み</span>}
              </button>
              {showRefInput && (
                <div className="mt-3 p-4 bg-violet-50/60 rounded-xl border border-violet-200/40 space-y-3">
                  <p className="text-xs text-violet-600">
                    基本となる問題を入力すると、同パターンの類題を生成します。
                  </p>
                  <TextArea label="参考問題文" value={referenceStem} onChange={setReferenceStem} rows={3}
                    placeholder="例: 2次関数 f(x)=x^2-6x+5 の最小値とそのときのxの値を求めよ。" />
                  <TextArea label="参考解答（任意）" value={referenceAnswer} onChange={setReferenceAnswer} rows={2}
                    placeholder="例: f(x)=(x-3)^2-4 より、x=3のとき最小値-4" />
                </div>
              )}
            </div>
          </SectionCard>

          {/* RAG チューニング */}
          <SectionCard title="RAG ミキサー" icon={<Icons.Search />}
            subtitle="過去問データベースからの情報注入バランスを調整">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 左: ミキサー */}
              <div>
                <RagMixer
                  textWeight={textWeight} diffWeight={difficultyMatchWeight} trickWeight={trickinessWeight}
                  onText={setTextWeight} onDiff={setDifficultyMatchWeight} onTrick={setTrickinessWeight}
                />
                <div className="mt-4">
                  <NumberField label="参照件数 (Top-K)" value={topK} onChange={setTopK} min={1} max={20} />
                </div>
              </div>
              {/* 右: 説明 */}
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

          {/* プロンプト生成ボタン */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={generateBasePrompt} disabled={!templateId} className="shadow-lg shadow-indigo-200/30">
              <Icons.Prompt className="w-4 h-4" /> プロンプトを生成
            </Button>
            {basePrompt && (
              <>
                <Button onClick={injectRag} variant="secondary">
                  <Icons.Search className="w-4 h-4" /> RAGを注入
                </Button>
                <Button onClick={skipRag} variant="ghost">
                  RAGをスキップ
                </Button>
              </>
            )}
          </div>

          {/* RAG スキップ通知 */}
          {ragSkipped && (
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/40 text-xs text-amber-700 flex items-center gap-2">
              <Icons.Info className="w-3.5 h-3.5 flex-shrink-0" />
              RAGスキップ中 — ベースプロンプトをそのまま使用します。
            </div>
          )}

          {/* 取得チャンク表示 */}
          {retrievedChunks.length > 0 && (
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 max-h-48 overflow-y-auto custom-scrollbar">
              <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                参照データ ({retrievedChunks.length}件)
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

          {/* プロンプトプレビュー */}
          {basePrompt && (
            <SectionCard title="生成されたプロンプト" subtitle={`${finalPrompt.length.toLocaleString()} 文字${ragSkipped ? '（RAGなし）' : ragPrompt ? '（RAG注入済み）' : ''}`}>
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

      {/* ════════════════════════════════════════════ */}
      {/* ▶️ 実行セクション                           */}
      {/* ════════════════════════════════════════════ */}
      {activeSection === 'execute' && (
        <div className="space-y-6">
          {/* コピー & LLM リンク */}
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

          {/* LLM出力の貼り付け */}
          <SectionCard title="LLMの出力を貼り付け" icon={<Icons.File />}
            subtitle="LLMが生成した結果をここに貼り付けてください">
            <TextArea value={llmOutput}
              onChange={(v) => {
                setLlmOutput(v);
                setParsedProblem(null);
                setParseError('');
                setSavedProblemId(null);
              }}
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

            {/* パース結果プレビュー */}
            {parsedProblem && (
              <div className="mt-4 p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/40 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Icons.Success className="w-4 h-4" /> パース結果
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    ['問題文 (stem)', parsedProblem.stem],
                    ['LaTeX', parsedProblem.stem_latex],
                    ['解法', parsedProblem.solution_outline],
                    ['最終解答', parsedProblem.final_answer],
                    ['難易度', parsedProblem.difficulty],
                    ['確信度', parsedProblem.confidence],
                    ['解説', parsedProblem.explanation],
                    ['解答要約', parsedProblem.answer_brief],
                  ].filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (
                    <div key={k} className="flex gap-2 items-start">
                      <span className="font-medium text-emerald-600 flex-shrink-0 min-w-[100px]">{k}:</span>
                      <span className="text-slate-600 break-all">
                        {typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 200)}
                        {String(v).length > 200 ? '...' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* ✅ 評価・保存セクション                      */}
      {/* ════════════════════════════════════════════ */}
      {activeSection === 'evaluate' && (
        <div className="space-y-6">
          {/* 品質評価 */}
          <SectionCard title="品質を評価" icon={<Icons.Chart />}
            subtitle="この出力の品質を評価して記録（次回の改善に活用されます）">
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-black text-slate-400 mb-3 tracking-[0.1em] uppercase">
                  品質スコア
                </label>
                <QualityRating score={tuningScore ? Number(tuningScore) : ''} onChange={(v) => setTuningScore(String(v))} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">
                    メモ（何が良かった / 悪かった？）
                  </label>
                  <input value={tuningNotes} onChange={(e) => setTuningNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/50 text-sm text-slate-700
                      transition-all hover:border-indigo-200 focus:border-indigo-500 focus:bg-white outline-none shadow-sm"
                    placeholder="例: 難易度は適切だが解説が冗長" />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 mb-2 tracking-[0.1em] uppercase">
                    期待していた出力（任意）
                  </label>
                  <input value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/50 text-sm text-slate-700
                      transition-all hover:border-indigo-200 focus:border-indigo-500 focus:bg-white outline-none shadow-sm"
                    placeholder="期待される出力の要約" />
                </div>
              </div>

              <Button onClick={saveLog} disabled={!llmOutput}>
                <Icons.Success className="w-4 h-4" /> 評価を記録する
              </Button>
            </div>
          </SectionCard>

          {/* DBに保存 */}
          <SectionCard title="問題をDBに保存" icon={<Icons.Data />}
            subtitle="パースした問題データをDBに保存（検算を自動実行）">
            {parsedProblem ? (
              <div className="space-y-4">
                {/* プレビュー */}
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
                      : <span className="flex items-center gap-2"><Icons.Pdf className="w-4 h-4" /> PDF</span>
                    }
                  </Button>
                </div>

                {/* 検算結果 */}
                {verificationResult && !verificationResult.skipped && (
                  <div className={`p-3 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
                    verificationResult.verified
                      ? 'bg-emerald-50/80 border-emerald-200/50 text-emerald-700'
                      : 'bg-rose-50/80 border-rose-200/50 text-rose-700'
                  }`}>
                    {verificationResult.verified ? (
                      <><Icons.Success className="w-4 h-4" /> 検算OK: {verificationResult.expected} = {verificationResult.computed}</>
                    ) : (
                      <><Icons.Info className="w-4 h-4" /> 検算NG: 期待={verificationResult.expected}, 計算={verificationResult.computed} — 保存ブロック</>
                    )}
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
              <EmptyState
                title="パース済みデータがありません"
                description="「実行」タブでLLM出力を貼り付けてパースしてください" />
            )}
          </SectionCard>

          {/* 次のイテレーションへ */}
          <div className="flex items-center justify-center gap-4 py-4">
            <Button variant="ghost" onClick={() => setActiveSection('configure')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              設定に戻って再調整
            </Button>
            <span className="text-xs text-slate-300">|</span>
            <Button variant="ghost" onClick={resetAll}>
              最初からやり直す
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
