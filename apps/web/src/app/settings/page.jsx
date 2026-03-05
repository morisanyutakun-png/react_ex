'use client';

import { useState } from 'react';
import { useBranding } from '@/contexts/BrandingContext';
import Link from 'next/link';

export default function SettingsPage() {
  const {
    serviceName,
    primaryColor,
    setServiceName,
    setPrimaryColor,
    resetBranding,
    colorPresets,
    defaults,
  } = useBranding();

  const [nameInput, setNameInput] = useState(serviceName);
  const [hexInput, setHexInput] = useState(primaryColor);
  const [saved, setSaved] = useState(false);

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
          <div className="flex items-center justify-center w-10 h-10 rounded-xl text-white text-lg font-bold"
               style={{ background: primaryColor }}>
            {(serviceName || 'R')[0]}
          </div>
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
