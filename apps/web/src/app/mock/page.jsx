'use client';

import React, { useState, useEffect } from 'react';
import { generateMockExamPrompt, generatePdf } from '@/lib/api';
import {
  StatusBar,
  SectionCard,
  TextArea,
  TextField,
  SelectField,
  NumberField,
  Button,
  CopyButton,
  ProgressSteps,
  Icons,
  MobileNavLinks,
} from '@/components/ui';

const STEPS = ['設定', 'AIに依頼', '完成'];

const DIFFICULTY_OPTIONS = [
  '標準（平均55〜65点想定）',
  'やや易しめ（基礎中心・平均65点超）',
  'やや難しめ（考察重視・平均50点前後）',
  '難（70点超をねらう層向け）',
];

export default function MockExamPage() {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);

  // ── 入力（最小構成） ──
  const [roundNo, setRoundNo] = useState(1);
  const [difficulty, setDifficulty] = useState(DIFFICULTY_OPTIONS[0]);
  const [theme, setTheme] = useState('');
  const [numAnswers, setNumAnswers] = useState(22);
  const [customReq, setCustomReq] = useState('');

  // ── 生成物 ──
  const [prompt, setPrompt] = useState('');
  const [llmOutput, setLlmOutput] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  // ── モバイル: PDFをページ画像で表示 ──
  const [isMobile, setIsMobile] = useState(false);
  const [pdfPageImages, setPdfPageImages] = useState([]);
  const [pdfImagesLoading, setPdfImagesLoading] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isMobile || !pdfUrl) return;
    setPdfImagesLoading(true);
    fetch(`${pdfUrl}/images`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPdfPageImages(d?.pages || []))
      .catch(() => {})
      .finally(() => setPdfImagesLoading(false));
  }, [isMobile, pdfUrl]);

  const buildPrompt = async () => {
    setWorking(true);
    setStatus('共通テスト模試の指示文を作成中…');
    try {
      const data = await generateMockExamPrompt({
        subject: '物理',
        round_no: Number(roundNo) || 1,
        difficulty,
        theme,
        custom_request: customReq,
        num_answers: Number(numAnswers) || 22,
      });
      const p = data.rendered_prompt || data.rendered || '';
      setPrompt(p);
      setStep(2);
      setStatus('指示文を生成しました。ChatGPT / Claude に貼り付けてください。');
    } catch (e) {
      setStatus('エラー: 指示文の生成に失敗しました。' + (e?.message || ''));
    }
    setWorking(false);
  };

  const buildPdf = async () => {
    if (!llmOutput.trim()) {
      setStatus('AIが出力したLaTeXを貼り付けてください。');
      return;
    }
    setWorking(true);
    setStatus('模試PDFを生成中…（図が多い場合は時間がかかります）');
    try {
      const data = await generatePdf(llmOutput, `共通テスト予想模試 第${roundNo}回 物理`);
      if (data?.pdf_url) {
        setPdfUrl(data.pdf_url);
        setStep(3);
        setStatus('模試PDFが完成しました！');
      } else {
        setStatus('PDF生成に失敗しました。LaTeXを確認してください。');
      }
    } catch (e) {
      setStatus('PDF生成エラー: ' + (e?.message || ''));
    }
    setWorking(false);
  };

  const reset = () => {
    setStep(1);
    setPrompt('');
    setLlmOutput('');
    setPdfUrl('');
    setPdfPageImages([]);
    setStatus('');
  };

  const hasDocClass = llmOutput.includes('\\documentclass');
  const hasEndDoc = llmOutput.includes('\\end{document}');

  return (
    <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-14 pb-8 sm:pb-16">
      {/* ── ヘッダー ── */}
      <div className="text-center mb-4 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-[#fff5f7] border border-[#ffd1d9] text-[12px] font-bold text-[#ff2d55]">
          <Icons.Chart className="w-3.5 h-3.5" /> 共通テスト模試作成モード
        </div>
        <h1 className="text-[24px] sm:text-[40px] font-black tracking-[-0.03em] leading-[1.08] mb-1 sm:mb-3 gradient-text-hero-animated">
          模試をつくる
        </h1>
        <p className="hidden sm:block text-[15px] text-[#515154] leading-relaxed max-w-md mx-auto font-medium tracking-[-0.01em]">
          共通テスト風の模試PDF（問題冊子・マークシート・自己採点欄・解答解説）を作成します
        </p>
      </div>

      {/* ── 進捗 ── */}
      <div className="hidden sm:block mb-8">
        <ProgressSteps steps={STEPS} current={step} />
      </div>
      <div className="sm:hidden mb-3">
        <div className="flex items-center justify-center gap-2">
          <span className="text-[13px] font-bold text-[#ff375f]">{step}/{STEPS.length}</span>
          <span className="text-[13px] font-medium text-[#515154]">{STEPS[step - 1] || ''}</span>
        </div>
        <div className="mt-1.5 h-[3px] bg-[#fff5f7] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
               style={{ width: `${(step / STEPS.length) * 100}%`, background: 'linear-gradient(90deg, #ff375f, #ff8094)' }} />
        </div>
      </div>

      <StatusBar message={status} />

      {/* ════ STEP 1: 設定 ════ */}
      {step === 1 && (
        <SectionCard
          title="模試の設定"
          subtitle="初期対応科目：物理 ／ 大問I〜IVの4題・各25点・合計100点・60分"
          icon={<Icons.Settings className="w-4 h-4" />}
        >
          <div className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-[#515154] uppercase tracking-wider mb-2">回数（タイトル）</label>
              <NumberField value={roundNo} onChange={setRoundNo} min={1} max={20} />
              <p className="mt-1.5 text-[12px] text-[#86868b]">表紙に「第{roundNo}回 予想問題」と表示されます。</p>
            </div>

            <SelectField
              label="難易度の方針"
              value={difficulty}
              onChange={setDifficulty}
              options={DIFFICULTY_OPTIONS}
            />

            <TextField
              label="出題テーマ・分野（任意）"
              value={theme}
              onChange={setTheme}
              placeholder="例: 力学・波動・電磁気・原子をバランスよく／探究活動を多めに"
            />

            <div>
              <label className="block text-[11px] font-bold text-[#515154] uppercase tracking-wider mb-2">解答番号の総数（目安）</label>
              <NumberField value={numAnswers} onChange={setNumAnswers} min={10} max={36} />
              <p className="mt-1.5 text-[12px] text-[#86868b]">物理は概ね 22〜28。マークシート・自己採点欄の行数の目安になります。</p>
            </div>

            <TextArea
              label="追加要望（任意）"
              value={customReq}
              onChange={setCustomReq}
              rows={3}
              placeholder="例: 第2問は気柱共鳴の探究にしてほしい／グラフ選択問題を多めに"
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={buildPrompt} disabled={working}>
              <Icons.Prompt className="w-4 h-4 mr-1.5" /> 指示文を作成
            </Button>
          </div>
        </SectionCard>
      )}

      {/* ════ STEP 2: AIに依頼 → 貼り付け ════ */}
      {step === 2 && (
        <div className="space-y-5">
          <SectionCard
            title="① 指示文をコピーしてAIに送信"
            subtitle="ChatGPT / Claude に貼り付けて、完全なLaTeXを生成させてください"
            icon={<Icons.Prompt className="w-4 h-4" />}
          >
            <div className="flex flex-wrap gap-2 mb-3">
              <CopyButton text={prompt} onCopied={setStatus} label="指示文をコピー" />
              <a href="https://chat.openai.com/" target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-black/10 bg-white text-[13px] font-semibold text-[#515154] hover:bg-[#fff5f7] transition-colors">
                <Icons.ArrowRight className="w-3.5 h-3.5" /> ChatGPT
              </a>
              <a href="https://claude.ai/" target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-black/10 bg-white text-[13px] font-semibold text-[#515154] hover:bg-[#fff5f7] transition-colors">
                <Icons.ArrowRight className="w-3.5 h-3.5" /> Claude
              </a>
            </div>
            <details className="group">
              <summary className="cursor-pointer text-[#515154] text-xs font-bold hover:text-[#1d1d1f] transition-colors list-none flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#fff5f7] flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">▸</span>
                指示文を表示する
              </summary>
              <div className="mt-3">
                <TextArea value={prompt} onChange={() => {}} rows={12} readOnly />
              </div>
            </details>
          </SectionCard>

          <SectionCard
            title="② AIの出力（LaTeX）を貼り付け"
            subtitle="\\documentclass から \\end{document} までをそのまま貼り付け"
            icon={<Icons.File className="w-4 h-4" />}
          >
            <TextArea
              value={llmOutput}
              onChange={setLlmOutput}
              rows={10}
              placeholder={'\\documentclass[b5paper,11pt,twoside]{ltjsarticle}\n...\n\\end{document}'}
            />
            {llmOutput.trim() && (
              <div className="mt-2 flex flex-wrap gap-3 text-[12px] font-semibold">
                <span className={hasDocClass ? 'text-[#34c759]' : 'text-[#ff9500]'}>
                  {hasDocClass ? '✓' : '⚠'} documentclass
                </span>
                <span className={hasEndDoc ? 'text-[#34c759]' : 'text-[#ff9500]'}>
                  {hasEndDoc ? '✓' : '⚠'} end&#123;document&#125;
                </span>
              </div>
            )}
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={working}>
                <Icons.ArrowRight className="w-4 h-4 mr-1.5 rotate-180" /> 設定に戻る
              </Button>
              <Button onClick={buildPdf} disabled={working || !llmOutput.trim()}>
                <Icons.Pdf className="w-4 h-4 mr-1.5" /> 模試PDFを生成
              </Button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ════ STEP 3: 完成 ════ */}
      {step === 3 && (
        <SectionCard
          title="模試が完成しました"
          subtitle={`共通テスト予想模試 第${roundNo}回 物理`}
          icon={<Icons.Success className="w-4 h-4" />}
        >
          {pdfUrl ? (
            <div className="space-y-3">
              {isMobile ? (
                <div className="w-full rounded-xl border border-[#ff375f]/20 bg-gray-100 overflow-y-auto p-2 space-y-2"
                     style={{ maxHeight: '70vh', WebkitOverflowScrolling: 'touch' }}>
                  {pdfImagesLoading && (
                    <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-xs">
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#ff375f' }} />
                      <span>ページ画像を読み込み中…</span>
                    </div>
                  )}
                  {pdfPageImages.map((p) => (
                    <img key={p.page} src={p.url} alt={`ページ ${p.page}`} className="w-full rounded-lg shadow-sm" loading="lazy" />
                  ))}
                </div>
              ) : (
                <iframe src={pdfUrl} className="w-full rounded-xl border border-[#ff375f]/20"
                        style={{ height: '70vh', minHeight: 400 }} title="生成された模試PDF" />
              )}
              <a href={pdfUrl} target="_blank" rel="noreferrer"
                 className="flex items-center justify-center gap-2 p-3 bg-[#fff5f7] text-[#515154] rounded-xl border border-[#ffd1b5] text-sm font-medium hover:bg-[#ff9500] hover:text-white transition-colors">
                <Icons.Pdf className="w-4 h-4" /> 別タブで開く
              </a>
            </div>
          ) : (
            <p className="text-[13px] text-[#86868b]">PDFがありません。</p>
          )}

          <details className="group mt-4">
            <summary className="cursor-pointer text-[#515154] text-xs font-bold hover:text-[#1d1d1f] transition-colors list-none flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-[#fff5f7] flex items-center justify-center group-open:rotate-90 transition-transform text-[10px]">▸</span>
              LaTeXソースを表示・編集
            </summary>
            <div className="mt-3">
              <TextArea value={llmOutput} onChange={setLlmOutput} rows={10} />
              <div className="mt-2 flex gap-2">
                <CopyButton text={llmOutput} onCopied={setStatus} />
                <Button variant="ghost" size="sm" onClick={buildPdf} disabled={working}>
                  <Icons.Pdf className="w-4 h-4 mr-1" /> PDFを再作成
                </Button>
              </div>
            </div>
          </details>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={reset}>もう一度つくる</Button>
            <Button onClick={() => setStep(2)} variant="secondary">貼り付けに戻る</Button>
          </div>
        </SectionCard>
      )}

      <MobileNavLinks currentPath="/mock" />
    </div>
  );
}
