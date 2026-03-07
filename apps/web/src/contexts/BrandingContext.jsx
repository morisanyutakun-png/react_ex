'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const BrandingContext = createContext(null);

const DEFAULT_SERVICE_NAME = 'REM';
const DEFAULT_PRIMARY_COLOR = '#2563eb';
const DEFAULT_LOGO_URL = '';
const DEFAULT_PAPER_THEME = 'default';

const COLOR_PRESETS = [
  { label: 'ブルー', value: '#2563eb' },
  { label: 'インディゴ', value: '#4f46e5' },
  { label: 'パープル', value: '#7c3aed' },
  { label: 'ティール', value: '#0d9488' },
  { label: 'グリーン', value: '#16a34a' },
  { label: 'オレンジ', value: '#ea580c' },
  { label: 'レッド', value: '#dc2626' },
  { label: 'ピンク', value: '#db2777' },
];

const PAPER_THEMES = [
  { id: 'default',  label: 'スタンダード', description: '白背景・ブルー基調のシンプルな配色', headerColor: '#1A5276', accentColor: '#2563eb', ruleColor: '#2C3E50' },
  { id: 'forest',   label: 'フォレスト',   description: '深緑の落ち着いた配色（理系向き）', headerColor: '#1B4332', accentColor: '#2D6A4F', ruleColor: '#40916C' },
  { id: 'burgundy', label: 'バーガンディ', description: 'ワインレッドの格調高い配色', headerColor: '#6B1D1D', accentColor: '#922B21', ruleColor: '#C0392B' },
  { id: 'navy',     label: 'ネイビー',     description: '紺色ベースのフォーマルな配色', headerColor: '#1B2631', accentColor: '#1F3A5F', ruleColor: '#2E4057' },
  { id: 'violet',   label: 'バイオレット', description: '紫ベースのモダンな配色', headerColor: '#4A1A6B', accentColor: '#6C3483', ruleColor: '#8E44AD' },
  { id: 'sepia',    label: 'セピア',       description: '温かみのある古典的な配色', headerColor: '#5D4E37', accentColor: '#7D6B52', ruleColor: '#A0926B' },
  { id: 'mono',     label: 'モノクロ',     description: '白黒のみの印刷向き配色', headerColor: '#1a1a1a', accentColor: '#333333', ruleColor: '#666666' },
  { id: 'brand',    label: 'ブランドカラー', description: 'ブランド設定のテーマカラーに連動', headerColor: null, accentColor: null, ruleColor: null },
];

function hexToHSL(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyThemeToDOM(color) {
  const root = document.documentElement;
  const { h, s, l } = hexToHSL(color);

  root.style.setProperty('--color-accent', color);
  root.style.setProperty('--color-accent-h', String(h));
  root.style.setProperty('--color-accent-s', `${s}%`);
  root.style.setProperty('--color-accent-l', `${l}%`);
  // Derived colors
  root.style.setProperty('--color-accent-hover', `hsl(${h}, ${s}%, ${Math.max(l - 8, 10)}%)`);
  root.style.setProperty('--color-accent-subtle', `hsl(${h}, ${s}%, 97%)`);
  root.style.setProperty('--color-accent-glow', `hsla(${h}, ${s}%, ${l}%, 0.14)`);
}

export function BrandingProvider({ children }) {
  const [serviceName, setServiceNameState] = useState(DEFAULT_SERVICE_NAME);
  const [primaryColor, setPrimaryColorState] = useState(DEFAULT_PRIMARY_COLOR);
  const [logoUrl, setLogoUrlState] = useState(DEFAULT_LOGO_URL);
  const [paperTheme, setPaperThemeState] = useState(DEFAULT_PAPER_THEME);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('rem_service_name');
      const savedColor = localStorage.getItem('rem_primary_color');
      const savedLogo = localStorage.getItem('rem_logo_url');
      const savedPaperTheme = localStorage.getItem('rem_paper_theme');
      if (savedName) setServiceNameState(savedName);
      if (savedColor) setPrimaryColorState(savedColor);
      if (savedLogo) setLogoUrlState(savedLogo);
      if (savedPaperTheme) setPaperThemeState(savedPaperTheme);
      applyThemeToDOM(savedColor || DEFAULT_PRIMARY_COLOR);
    } catch {}
    setLoaded(true);
  }, []);

  const setServiceName = useCallback((name) => {
    setServiceNameState(name);
    try { localStorage.setItem('rem_service_name', name); } catch {}
  }, []);

  const setPrimaryColor = useCallback((color) => {
    setPrimaryColorState(color);
    applyThemeToDOM(color);
    try { localStorage.setItem('rem_primary_color', color); } catch {}
  }, []);

  const setLogoUrl = useCallback((url) => {
    setLogoUrlState(url);
    try { localStorage.setItem('rem_logo_url', url); } catch {}
  }, []);

  const setPaperTheme = useCallback((theme) => {
    setPaperThemeState(theme);
    try { localStorage.setItem('rem_paper_theme', theme); } catch {}
  }, []);

  const resetBranding = useCallback(() => {
    setServiceName(DEFAULT_SERVICE_NAME);
    setPrimaryColor(DEFAULT_PRIMARY_COLOR);
    setLogoUrl(DEFAULT_LOGO_URL);
    setPaperTheme(DEFAULT_PAPER_THEME);
    try {
      localStorage.removeItem('rem_service_name');
      localStorage.removeItem('rem_primary_color');
      localStorage.removeItem('rem_logo_url');
      localStorage.removeItem('rem_paper_theme');
    } catch {}
  }, [setServiceName, setPrimaryColor, setLogoUrl, setPaperTheme]);

  // Resolve paper theme colors (for 'brand' theme, use primaryColor)
  const resolvedPaperTheme = PAPER_THEMES.find((t) => t.id === paperTheme) || PAPER_THEMES[0];
  const resolvedPaperColors = resolvedPaperTheme.id === 'brand'
    ? { headerColor: primaryColor, accentColor: primaryColor, ruleColor: primaryColor }
    : { headerColor: resolvedPaperTheme.headerColor, accentColor: resolvedPaperTheme.accentColor, ruleColor: resolvedPaperTheme.ruleColor };

  return (
    <BrandingContext.Provider value={{
      serviceName,
      primaryColor,
      logoUrl,
      paperTheme,
      setServiceName,
      setPrimaryColor,
      setLogoUrl,
      setPaperTheme,
      resetBranding,
      loaded,
      colorPresets: COLOR_PRESETS,
      paperThemes: PAPER_THEMES,
      resolvedPaperColors,
      defaults: { serviceName: DEFAULT_SERVICE_NAME, primaryColor: DEFAULT_PRIMARY_COLOR, logoUrl: DEFAULT_LOGO_URL, paperTheme: DEFAULT_PAPER_THEME },
    }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      serviceName: DEFAULT_SERVICE_NAME,
      primaryColor: DEFAULT_PRIMARY_COLOR,
      logoUrl: DEFAULT_LOGO_URL,
      paperTheme: DEFAULT_PAPER_THEME,
      setServiceName: () => {},
      setPrimaryColor: () => {},
      setLogoUrl: () => {},
      setPaperTheme: () => {},
      resetBranding: () => {},
      loaded: false,
      colorPresets: COLOR_PRESETS,
      paperThemes: PAPER_THEMES,
      resolvedPaperColors: PAPER_THEMES[0],
      defaults: { serviceName: DEFAULT_SERVICE_NAME, primaryColor: DEFAULT_PRIMARY_COLOR, logoUrl: DEFAULT_LOGO_URL, paperTheme: DEFAULT_PAPER_THEME },
    };
  }
  return ctx;
}
