'use client';

import { useState, useRef } from 'react';
import { useBranding } from '@/contexts/BrandingContext';
import Link from 'next/link';

export default function SettingsPage() {
  const {
    serviceName,
    primaryColor,
    logoUrl,
    paperTheme,
    setServiceName,
    setPrimaryColor,
    setLogoUrl,
    setPaperTheme,
    resetBranding,
    colorPresets,
    paperThemes,
    resolvedPaperColors,
    defaults,
  } = useBranding();

  const [nameInput, setNameInput] = useState(serviceName);
  const [hexInput, setHexInput] = useState(primaryColor);
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef(null);

  const handleNameSave = () => {
    setServiceName(nameInput.trim() || defaults.serviceName);
    flash();
  };

  const handleColorSelect = (color) => {
    setHexInput(color);
    setPrimaryColor(color);
    flash();
  };

  const handleHexApply = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
      setPrimaryColor(hexInput);
      flash();
    }
  };

  const handleReset = () => {
    resetBranding();
    setNameInput(defaults.serviceName);
    setHexInput(defaults.primaryColor);
    flash();
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      alert('ロゴファイルは512KB以下にしてください');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoUrl(ev.target.result);
      flash();
    };
    reader.readAsDataURL(file);
  };

  const handleLogoRemove = () => {
    setLogoUrl('');
    if (logoInputRef.current) logoInputRef.current.value = '';
    flash();
  };

  const handlePaperThemeSelect = (themeId) => {
    setPaperTheme(themeId);
    flash();
  };

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: primaryColor }}>
          ブランド設定
        </h1>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
          ← ホームに戻る
        </Link>
      </div>

      {/* Live Preview */}
      <div className="rounded-2xl border border-slate-200 p-6 mb-8"
           style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f1f5f9 100%)' }}>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">プレビュー</p>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="ロゴ" className="w-10 h-10 rounded-xl object-contain border border-slate-200 bg-white" />
          ) : (
            <div className="flex items-center justify-center w-10 h-10 rounded-xl text-white text-lg font-bold"
                 style={{ background: primaryColor }}>
              {(serviceName || 'R')[0]}
            </div>
          )}
          <div>
            <p className="text-lg font-bold" style={{ color: primaryColor }}>{serviceName || defaults.serviceName}</p>
            <p className="text-xs text-slate-400">テーマカラーとサービス名がサイト全体に反映されます</p>
          </div>
        </div>
        {/* Color bar preview */}
        <div className="mt-4 h-2 rounded-full" style={{ background: primaryColor }} />
      </div>

      {/* Service Name */}
      <section className="mb-8">
        <label className="block text-sm font-semibold text-slate-700 mb-2">サービス名</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
            placeholder={defaults.serviceName}
            maxLength={20}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                       focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
            style={{ focusRingColor: primaryColor }}
          />
          <button
            onClick={handleNameSave}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: primaryColor }}
          >
            適用
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">ヘッダーやページ上部に表示されるサービス名です（最大20文字）</p>
      </section>

      {/* Color Presets */}
      <section className="mb-8">
        <label className="block text-sm font-semibold text-slate-700 mb-3">テーマカラー</label>
        <div className="grid grid-cols-4 gap-3">
          {colorPresets.map(({ label, value }) => {
            const isActive = primaryColor === value;
            return (
              <button
                key={value}
                onClick={() => handleColorSelect(value)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:scale-105"
                style={{
                  borderColor: isActive ? value : '#e2e8f0',
                  background: isActive ? `${value}08` : 'white',
                  boxShadow: isActive ? `0 0 0 1px ${value}40` : 'none',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full shadow-sm transition-transform"
                  style={{ background: value }}
                />
                <span className="text-xs font-medium" style={{ color: isActive ? value : '#64748b' }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Custom Hex */}
      <section className="mb-8">
        <label className="block text-sm font-semibold text-slate-700 mb-2">カスタムカラー（Hex）</label>
        <div className="flex gap-2 items-center">
          <div
            className="w-10 h-10 rounded-xl border border-slate-200 shrink-0"
            style={{ background: /^#[0-9a-fA-F]{6}$/.test(hexInput) ? hexInput : '#ccc' }}
          />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleHexApply()}
            placeholder="#2563eb"
            maxLength={7}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono
                       focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
          />
          <button
            onClick={handleHexApply}
            disabled={!/^#[0-9a-fA-F]{6}$/.test(hexInput)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{ background: primaryColor }}
          >
            適用
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">#から始まる6桁のHexカラーコード（例: #4f46e5）</p>
      </section>

      {/* Logo Upload */}
      <section className="mb-8">
        <label className="block text-sm font-semibold text-slate-700 mb-2">ロゴ画像</label>
        <p className="text-xs text-slate-400 mb-3">PDFのヘッダーに表示されるロゴ画像をアップロードできます（PNG/JPG/SVG、512KB以下）</p>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <div className="relative group">
              <img src={logoUrl} alt="ロゴ" className="w-20 h-20 rounded-xl object-contain border border-slate-200 bg-white p-1" />
              <button
                onClick={handleLogoRemove}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center
                           opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                title="ロゴを削除"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          )}
          <div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              onClick={() => logoInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: primaryColor }}
            >
              {logoUrl ? 'ロゴを変更' : 'ロゴをアップロード'}
            </button>
            {logoUrl && (
              <button
                onClick={handleLogoRemove}
                className="ml-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                削除
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Paper Color Theme */}
      <section className="mb-8">
        <label className="block text-sm font-semibold text-slate-700 mb-2">PDF 配色テーマ</label>
        <p className="text-xs text-slate-400 mb-3">生成されるPDFの見出し・罫線・アクセントの配色を選べます</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {paperThemes.map((theme) => {
            const isActive = paperTheme === theme.id;
            const displayColor = theme.id === 'brand' ? primaryColor : theme.headerColor;
            return (
              <button
                key={theme.id}
                onClick={() => handlePaperThemeSelect(theme.id)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:scale-105"
                style={{
                  borderColor: isActive ? displayColor : '#e2e8f0',
                  background: isActive ? `${displayColor}08` : 'white',
                  boxShadow: isActive ? `0 0 0 1px ${displayColor}40` : 'none',
                }}
              >
                {/* Mini PDF preview */}
                <div className="w-full h-14 rounded-lg border border-slate-100 bg-white overflow-hidden relative">
                  <div className="h-2" style={{ background: displayColor }} />
                  <div className="px-1.5 pt-1 space-y-0.5">
                    <div className="h-[3px] rounded-full" style={{ background: displayColor, width: '60%', opacity: 0.7 }} />
                    <div className="h-[2px] rounded-full bg-slate-200" style={{ width: '90%' }} />
                    <div className="h-[2px] rounded-full bg-slate-200" style={{ width: '70%' }} />
                    <div className="h-[1px] rounded-full" style={{ background: displayColor, opacity: 0.3 }} />
                    <div className="h-[2px] rounded-full bg-slate-200" style={{ width: '80%' }} />
                  </div>
                </div>
                <span className="text-xs font-bold" style={{ color: isActive ? displayColor : '#64748b' }}>
                  {theme.label}
                </span>
                <span className="text-[9px] text-slate-400 leading-tight text-center">{theme.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Reset + Save Feedback */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-200">
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 border border-slate-200
                     hover:bg-slate-50 transition-colors"
        >
          デフォルトに戻す
        </button>
        <span
          className="text-sm font-medium transition-opacity duration-300"
          style={{ color: primaryColor, opacity: saved ? 1 : 0 }}
        >
          保存しました
        </span>
      </div>
    </div>
  );
}
