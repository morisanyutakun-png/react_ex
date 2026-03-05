'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const BrandingContext = createContext(null);

const DEFAULT_SERVICE_NAME = 'REM';
const DEFAULT_PRIMARY_COLOR = '#2563eb';

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
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('rem_service_name');
      const savedColor = localStorage.getItem('rem_primary_color');
      if (savedName) setServiceNameState(savedName);
      if (savedColor) setPrimaryColorState(savedColor);
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

  const resetBranding = useCallback(() => {
    setServiceName(DEFAULT_SERVICE_NAME);
    setPrimaryColor(DEFAULT_PRIMARY_COLOR);
    try {
      localStorage.removeItem('rem_service_name');
      localStorage.removeItem('rem_primary_color');
    } catch {}
  }, [setServiceName, setPrimaryColor]);

  return (
    <BrandingContext.Provider value={{
      serviceName,
      primaryColor,
      setServiceName,
      setPrimaryColor,
      resetBranding,
      loaded,
      colorPresets: COLOR_PRESETS,
      defaults: { serviceName: DEFAULT_SERVICE_NAME, primaryColor: DEFAULT_PRIMARY_COLOR },
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
      setServiceName: () => {},
      setPrimaryColor: () => {},
      resetBranding: () => {},
      loaded: false,
      colorPresets: COLOR_PRESETS,
      defaults: { serviceName: DEFAULT_SERVICE_NAME, primaryColor: DEFAULT_PRIMARY_COLOR },
    };
  }
  return ctx;
}
