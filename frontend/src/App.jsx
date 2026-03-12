import React, { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

/* ────────────────────────────────────────────
   SVG Icons (inline, no dep needed)
   ──────────────────────────────────────────── */
const Ico = {
  Check: (p) => <svg width={p?.s||18} height={p?.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Copy: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Upload: () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  FileText: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  ArrowRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  ArrowLeft: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  ExternalLink: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  RotateCcw: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
  Star: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Help: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Database: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  Pdf: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-2h2a1 1 0 1 0 0-2H9v6"/></svg>,
  Skip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>,
  Zap: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  ChevronDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ChevronUp: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>,
  Clock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Shield: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  WifiOff: () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Play: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  BarChart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  Target: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  BookOpen: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  Camera: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
}

/* ────────────────────────────────────────────
   Stats / Gamification System
   ──────────────────────────────────────────── */
const STATS_KEY = 'examgen_stats'
const DEFAULT_STATS = {
  totalProblems: 0, totalSessions: 0, currentStreak: 0, maxStreak: 0,
  lastActiveDate: null, weeklyActivity: {}, subjectBreakdown: {},
  totalTimeSeconds: 0, xp: 0, sessionLog: [],
}

function loadStats() {
  try { return { ...DEFAULT_STATS, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') } }
  catch { return { ...DEFAULT_STATS } }
}
function saveStats(s) { localStorage.setItem(STATS_KEY, JSON.stringify(s)) }
function getToday() { return new Date().toISOString().slice(0, 10) }

function updateStreak(stats) {
  const today = getToday()
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (stats.lastActiveDate === today) return stats
  if (stats.lastActiveDate === yesterday) {
    return { ...stats, currentStreak: stats.currentStreak + 1, maxStreak: Math.max(stats.maxStreak, stats.currentStreak + 1), lastActiveDate: today }
  }
  return { ...stats, currentStreak: 1, maxStreak: Math.max(stats.maxStreak, 1), lastActiveDate: today }
}

function addSessionToStats(stats, session) {
  const today = getToday()
  const wa = { ...stats.weeklyActivity }
  wa[today] = (wa[today] || 0) + session.numQuestions
  const sb = { ...stats.subjectBreakdown }
  if (session.subject) sb[session.subject] = (sb[session.subject] || 0) + session.numQuestions
  const log = [...(stats.sessionLog || []), { ...session, date: new Date().toISOString() }].slice(-100)
  const xpGain = session.numQuestions * 10 + Math.floor(session.duration / 60) * 5
  const updated = {
    ...updateStreak(stats), totalProblems: stats.totalProblems + session.numQuestions,
    totalSessions: stats.totalSessions + 1, totalTimeSeconds: stats.totalTimeSeconds + (session.duration || 0),
    weeklyActivity: wa, subjectBreakdown: sb, xp: stats.xp + xpGain, sessionLog: log,
  }
  saveStats(updated)
  return updated
}

function getLevel(xp) {
  const levels = [
    { min: 0, name: '入門', rank: 'D', emoji: '🌱' },
    { min: 50, name: '初級', rank: 'C', emoji: '📘' },
    { min: 150, name: '中級', rank: 'B', emoji: '📗' },
    { min: 400, name: '上級', rank: 'A', emoji: '📕' },
    { min: 800, name: '達人', rank: 'S', emoji: '⭐' },
    { min: 1500, name: '極', rank: 'SS', emoji: '🏆' },
    { min: 3000, name: '神', rank: 'SSS', emoji: '👑' },
  ]
  let lvl = levels[0]
  for (const l of levels) { if (xp >= l.min) lvl = l }
  const idx = levels.indexOf(lvl)
  const next = levels[idx + 1]
  const progress = next ? ((xp - lvl.min) / (next.min - lvl.min)) * 100 : 100
  return { ...lvl, progress: Math.min(100, progress), nextXp: next?.min || lvl.min, currentXp: xp }
}

function getLast7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10))
  return days
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
}

const MOTIVATIONAL = [
  '努力は裏切らない。今日も1問、差をつけよう。',
  '合格への最短距離は、今日の1問から。',
  '周りが休んでいる時こそ、差がつく。',
  'この1問が、本番の1点を生む。',
  '昨日の自分を超えろ。',
  '量は質に転化する。手を動かせ。',
  'やった分だけ、自信になる。',
  '本番で「やっておけばよかった」と思わないために。',
  '誰かが今日もやっている。あなたは？',
  'あと1問。それが合否を分ける。',
]

function getTodayMotivation() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  return MOTIVATIONAL[dayOfYear % MOTIVATIONAL.length]
}

/* ────────────────────────────────────────────
   Onboarding
   ──────────────────────────────────────────── */
const ONBOARDING_SLIDES = [
  { emoji: '🔥', title: '受験を制するのは、\n圧倒的な演習量。', desc: 'AIが物理・数学・英語の類題を瞬時に生成。あらゆる分野を無限に演習できます。' },
  { emoji: '📊', title: '努力を「見える化」する', desc: '学習量・連続日数・到達レベルをすべて記録。成長を数字で実感し、スクショでシェアしよう。' },
  { emoji: '📝', title: 'かんたん4ステップ', desc: '1. パターンを選ぶ → 2. 問題数を設定 → 3. AIに依頼 → 4. PDF完成！\n最短30秒で類題が手に入る。' },
  { emoji: '🚀', title: '今日から差をつけろ。', desc: '合格する人は、今日始める人。\nまずは1問、類題を作ってみよう。' },
]

function OnboardingScreen({ onComplete }) {
  const [si, setSi] = useState(0)
  const s = ONBOARDING_SLIDES[si]
  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card anim-scale-in">
        <div className="onboarding-slide anim-fade-up" key={si}>
          <div className="onboarding-emoji">{s.emoji}</div>
          <h2 className="onboarding-title">{s.title}</h2>
          <p className="onboarding-desc">{s.desc}</p>
        </div>
        <div className="onboarding-dots">
          {ONBOARDING_SLIDES.map((_, i) => <div key={i} className={`onboarding-dot ${i === si ? 'active' : ''}`} />)}
        </div>
        <div className="onboarding-actions">
          {si > 0 && <button className="btn btn-ghost" onClick={() => setSi(i => i - 1)}>戻る</button>}
          <button className="btn btn-primary btn-lg btn-block" onClick={si === ONBOARDING_SLIDES.length - 1 ? onComplete : () => setSi(i => i + 1)}>
            {si === ONBOARDING_SLIDES.length - 1 ? '演習を始める' : '次へ'} <Ico.ArrowRight />
          </button>
        </div>
        <button className="onboarding-skip" onClick={onComplete}>スキップ</button>
      </div>
    </div>
  )
}

/* ── Offline Banner ── */
function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const off = () => setIsOffline(true), on = () => setIsOffline(false)
    window.addEventListener('offline', off); window.addEventListener('online', on)
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [])
  if (!isOffline) return null
  return <div className="offline-banner"><Ico.WifiOff /><div><div className="offline-title">オフラインです</div><div className="offline-desc">接続を確認してください。</div></div></div>
}

/* ── LocalStorage helpers ── */
const HISTORY_KEY = 'examgen_history', MAX_HISTORY = 50
function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] } }
function saveToHistory(entry) { const h = loadHistory(); h.unshift({ ...entry, id: Date.now(), createdAt: new Date().toISOString() }); if (h.length > MAX_HISTORY) h.length = MAX_HISTORY; localStorage.setItem(HISTORY_KEY, JSON.stringify(h)) }
function deleteFromHistory(id) { localStorage.setItem(HISTORY_KEY, JSON.stringify(loadHistory().filter(h => h.id !== id))) }
function clearHistory() { localStorage.removeItem(HISTORY_KEY) }

const SETTINGS_KEY = 'examgen_settings'
const DEFAULT_SETTINGS = { defaultNumQuestions: 3, defaultLatexPreset: 'exam', defaultBaseMode: 'skip' }
function loadSettings() { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } } catch { return { ...DEFAULT_SETTINGS } } }
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) }

/* ── Small components ── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return <div className="toast-wrap"><div className={`toast ${type}`}>{type === 'success' && <Ico.Check />}{type === 'error' && <span style={{fontSize:16}}>✕</span>}{type === 'info' && <span style={{fontSize:16}}>ℹ</span>}<span>{msg}</span></div></div>
}

function LoadingOverlay({ text }) {
  return <div className="loading-overlay"><div className="spinner" /><div className="loading-text">{text || '処理中...'}</div></div>
}

/* ── Shareable Stats Card ── */
function ShareableCard({ stats, level }) {
  const d = new Date()
  const dateStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`
  return (
    <div className="shareable-card">
      <div className="shareable-bg" />
      <div className="shareable-content">
        <div className="shareable-header">
          <div className="shareable-app-name">⚛️ 物理AI</div>
          <div className="shareable-date">{dateStr}</div>
        </div>
        <div className="shareable-level-badge">
          <span className="shareable-level-emoji">{level.emoji}</span>
          <span className="shareable-level-rank">Rank {level.rank}</span>
          <span className="shareable-level-name">{level.name}</span>
        </div>
        <div className="shareable-stats-row">
          <div className="shareable-stat"><div className="shareable-stat-value">{stats.currentStreak}</div><div className="shareable-stat-label">日連続</div></div>
          <div className="shareable-stat-divider" />
          <div className="shareable-stat"><div className="shareable-stat-value">{stats.totalProblems}</div><div className="shareable-stat-label">問演習</div></div>
          <div className="shareable-stat-divider" />
          <div className="shareable-stat"><div className="shareable-stat-value">{formatTime(stats.totalTimeSeconds)}</div><div className="shareable-stat-label">総学習</div></div>
        </div>
        <div className="shareable-motivation">{getTodayMotivation()}</div>
        <div className="shareable-footer">#物理AI #受験勉強 #努力の証明</div>
      </div>
    </div>
  )
}

/* ── Weekly Activity ── */
function WeeklyActivity({ weeklyActivity }) {
  const days = getLast7Days()
  const dayNames = ['月', '火', '水', '木', '金', '土', '日']
  const max = Math.max(1, ...days.map(d => weeklyActivity[d] || 0))
  return (
    <div className="weekly-activity">
      <div className="weekly-bars">
        {days.map((d) => {
          const count = weeklyActivity[d] || 0
          const height = count > 0 ? Math.max(12, (count / max) * 100) : 4
          return (
            <div key={d} className={`weekly-bar-group ${d === getToday() ? 'today' : ''}`}>
              <div className="weekly-bar-count">{count > 0 ? count : ''}</div>
              <div className="weekly-bar-track"><div className={`weekly-bar-fill ${count > 0 ? 'active' : ''}`} style={{ height: `${height}%` }} /></div>
              <div className="weekly-bar-label">{dayNames[(new Date(d).getDay() + 6) % 7]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Session Timer Hook ── */
function useSessionTimer(isActive) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)
  useEffect(() => {
    if (isActive) {
      startRef.current = Date.now()
      const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
      return () => clearInterval(iv)
    } else { setElapsed(0); startRef.current = null }
  }, [isActive])
  return elapsed
}

function formatTimer(s) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

/* ════════════════════════════════════════════
   Main App
   ════════════════════════════════════════════ */
const PRESET_EMOJI = { exam: '📝', worksheet: '📋', flashcard: '🃏', mock_exam: '📊', report: '📖', simple: '✏️', default: '📄' }
const presetEmoji = (id) => PRESET_EMOJI[id] || PRESET_EMOJI.default

export default function App() {
  const [toast, setToast] = useState(null)
  const [templates, setTemplates] = useState([])
  const [latexPresets, setLatexPresets] = useState([])
  const [screen, setScreen] = useState('home')
  const [legalTab, setLegalTab] = useState('terms')
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('examgen_onboarded'))
  const [history, setHistory] = useState(() => loadHistory())
  const [settings, setSettings] = useState(() => loadSettings())
  const [stats, setStats] = useState(() => loadStats())

  const [step, setStep] = useState(1)
  const initS = loadSettings()
  const [form, setForm] = useState({ templateId: '', numQuestions: initS.defaultNumQuestions, latexPreset: initS.defaultLatexPreset })
  const [prompt, setPrompt] = useState('')
  const [ragCtx, setRagCtx] = useState(null)
  const [llmOutput, setLlmOutput] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [answerPdfUrl, setAnswerPdfUrl] = useState('')
  const [answerLatex, setAnswerLatex] = useState('')
  const [answerLoading, setAnswerLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [showPromptSection, setShowPromptSection] = useState(true)
  const [baseMode, setBaseMode] = useState(initS.defaultBaseMode || 'skip')
  const [baseProblems, setBaseProblems] = useState([])
  const [selectedBaseProblem, setSelectedBaseProblem] = useState(null)
  const [basePdfData, setBasePdfData] = useState(null)
  const [basePdfDragOver, setBasePdfDragOver] = useState(false)
  const basePdfRef = useRef(null)
  const [selfRating, setSelfRating] = useState(0)
  const [showShareCard, setShowShareCard] = useState(false)
  const [sessionXpGain, setSessionXpGain] = useState(0)

  const isPracticing = screen === 'practice' && step >= 1 && step <= 3
  const sessionTime = useSessionTimer(isPracticing)

  const notify = (msg, type = 'info') => setToast({ msg, type })
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const level = getLevel(stats.xp)

  const completeOnboarding = () => { localStorage.setItem('examgen_onboarded', '1'); setShowOnboarding(false) }

  const fetchTemplates = useCallback(async () => {
    try { const r = await fetch('/api/templates'); const d = await r.json(); if (r.ok && d.templates?.length) { setTemplates(d.templates); if (!form.templateId) upd('templateId', d.templates[0].id) } } catch (e) { console.error(e) }
  }, [])
  const fetchPresets = useCallback(async () => {
    try { const r = await fetch('/api/latex_presets'); const d = await r.json(); if (r.ok && d.presets?.length) setLatexPresets(d.presets) } catch (e) { console.error(e) }
  }, [])
  useEffect(() => { fetchTemplates(); fetchPresets() }, [])

  const fetchBaseProblems = useCallback(async (tid) => {
    if (!tid) return
    try { const r = await fetch(`/api/problems_by_pattern?template_id=${encodeURIComponent(tid)}&limit=20`); const d = await r.json(); if (r.ok) setBaseProblems(d.problems || []) } catch (e) { console.error(e) }
  }, [])

  const uploadBasePdf = async (file) => {
    if (!file) return; if (!file.name.toLowerCase().endsWith('.pdf')) return notify('PDFファイルのみ可能です', 'error')
    setLoading(true); setLoadingMsg('PDFを検証中...')
    const fd = new FormData(); fd.append('file', file)
    try { const r = await fetch('/api/validate_base_pdf', { method: 'POST', body: fd }); const d = await r.json(); if (r.ok) { setBasePdfData(d); notify(`${d.filename}を読み込みました`, 'success') } else notify(d.detail || '検証失敗', 'error') } catch { notify('アップロードエラー', 'error') }
    setLoading(false); if (basePdfRef.current) basePdfRef.current.value = ''
  }
  const onBasePdfDrop = (e) => { e.preventDefault(); setBasePdfDragOver(false); uploadBasePdf(e.dataTransfer.files?.[0]) }

  const generatePrompt = async () => {
    if (!form.templateId) return notify('テンプレートを選んでください', 'error')
    setLoading(true); setLoadingMsg('AIへの指示文を作成中...')
    try {
      let sourceText = ''
      if (baseMode === 'db' && selectedBaseProblem) sourceText = `【ベース問題】\n${selectedBaseProblem.stem || ''}\n${selectedBaseProblem.solution_outline || ''}`
      else if (baseMode === 'pdf' && basePdfData?.extracted_text) sourceText = basePdfData.extracted_text
      const body = { template_id: form.templateId, num_questions: form.numQuestions, rag_inject: true, source_text: sourceText || undefined, user_mode: true, latex_preset: form.latexPreset || 'exam' }
      const r = await fetch('/api/template_render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (r.ok) {
        let rp = d.rendered_prompt || d.rendered
        if (baseMode === 'pdf' && basePdfData) rp += '\n\n【重要：添付PDFについて】\n添付PDFがベースライン問題です。同じスタイルで新しい類似問題を作成してください。'
        setPrompt(rp); setRagCtx(d.context); setStep(3); setShowPromptSection(true); notify('指示文を生成しました', 'success')
      } else notify('エラー: ' + (d.detail || r.statusText), 'error')
    } catch { notify('通信エラー', 'error') }
    setLoading(false)
  }

  const copyPrompt = async () => { try { await navigator.clipboard.writeText(prompt); notify('コピーしました', 'success') } catch { notify('コピー失敗', 'error') } }

  const generatePdf = async () => {
    if (!llmOutput.trim()) return notify('LaTeXコードを貼り付けてください', 'error')
    setLoading(true); setLoadingMsg('問題PDFを生成中...')
    try {
      // まず構造化マーカー形式としてパース試行
      const subject = templateMeta?.subject || ''
      const parseR = await fetch('/api/practice/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: llmOutput, subject, difficulty: '応用' })
      })
      if (parseR.ok) {
        const parsed = await parseR.json()
        if (parsed.latex_problems && parsed.latex_answers) {
          // 問題のみPDFを生成
          const r = await fetch('/api/generate_pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex: parsed.latex_problems, title: '練習問題', return_url: true }) })
          if (r.ok) {
            const d = await r.json().catch(() => null); const url = d?.pdf_url || URL.createObjectURL(await r.blob())
            setPdfUrl(url)
            setAnswerLatex(parsed.latex_answers)
            setAnswerPdfUrl('')
            setStep(4)
            saveToHistory({ templateName: selectedTemplate?.name || form.templateId, numQuestions: form.numQuestions, latexPreset: form.latexPreset, pdfUrl: url })
            setHistory(loadHistory())
            const session = { templateName: selectedTemplate?.name || form.templateId, subject, numQuestions: form.numQuestions, duration: sessionTime }
            const xpG = session.numQuestions * 10 + Math.floor(session.duration / 60) * 5
            setSessionXpGain(xpG); setStats(addSessionToStats(stats, session)); notify(`+${xpG} XP 獲得！`, 'success')
          } else { const d = await r.json().catch(() => null); notify('PDF生成失敗: ' + (d?.detail || d?.error || ''), 'error') }
          setLoading(false); return
        }
      }
      // パース失敗時: 従来通り生LaTeXを直接コンパイル
      const r = await fetch('/api/generate_pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex: llmOutput, title: 'Generated Problem', return_url: true, latex_preset: form.latexPreset || 'exam' }) })
      if (r.ok) {
        const d = await r.json().catch(() => null); const url = d?.pdf_url || URL.createObjectURL(await r.blob())
        setPdfUrl(url); setAnswerLatex(''); setAnswerPdfUrl(''); setStep(4)
        saveToHistory({ templateName: selectedTemplate?.name || form.templateId, numQuestions: form.numQuestions, latexPreset: form.latexPreset, pdfUrl: url })
        setHistory(loadHistory())
        const session = { templateName: selectedTemplate?.name || form.templateId, subject: templateMeta?.subject || '', numQuestions: form.numQuestions, duration: sessionTime }
        const xpG = session.numQuestions * 10 + Math.floor(session.duration / 60) * 5
        setSessionXpGain(xpG); setStats(addSessionToStats(stats, session)); notify(`+${xpG} XP 獲得！`, 'success')
      } else { const d = await r.json().catch(() => null); notify('PDF生成失敗: ' + (d?.detail || d?.error || ''), 'error') }
    } catch { notify('PDF生成エラー', 'error') }
    setLoading(false)
  }

  const generateAnswerPdf = async () => {
    if (!answerLatex) return
    setAnswerLoading(true)
    try {
      const r = await fetch('/api/generate_pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex: answerLatex, title: '解答・解説', return_url: true }) })
      if (r.ok) {
        const d = await r.json().catch(() => null); const url = d?.pdf_url || URL.createObjectURL(await r.blob())
        setAnswerPdfUrl(url)
      } else { const d = await r.json().catch(() => null); notify('解答PDF生成失敗: ' + (d?.detail || ''), 'error') }
    } catch { notify('解答PDF生成エラー', 'error') }
    setAnswerLoading(false)
  }

  const resetWizard = () => { setStep(1); setPrompt(''); setRagCtx(null); setLlmOutput(''); setPdfUrl(''); setAnswerPdfUrl(''); setAnswerLatex(''); setBaseMode('skip'); setBaseProblems([]); setSelectedBaseProblem(null); setBasePdfData(null); setShowPromptSection(true); setSelfRating(0); setSessionXpGain(0); setShowShareCard(false) }
  const startPractice = () => { resetWizard(); setScreen('practice') }

  const currentPreset = latexPresets.find(p => p.id === form.latexPreset)
  const selectedTemplate = templates.find(t => t.id === form.templateId)
  const templateMeta = selectedTemplate?.metadata || {}
  const STEPS = [{ n: 1, label: 'パターン選択' }, { n: 2, label: '問題設定' }, { n: 3, label: 'AI依頼' }, { n: 4, label: '完了' }]

  return (
    <div className="app-shell">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {loading && <LoadingOverlay text={loadingMsg} />}
      {showOnboarding && <OnboardingScreen onComplete={completeOnboarding} />}
      <OfflineBanner />

      {/* ── HEADER (desktop) ── */}
      <header className="header desktop-only">
        <div className="header-inner">
          <div className="logo" style={{cursor:'pointer'}} onClick={() => setScreen('home')}>
            <div className="logo-mark">
              <svg width="24" height="24" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round">
                <circle cx="50" cy="50" r="7" fill="currentColor" stroke="none"/><ellipse cx="50" cy="50" rx="42" ry="16"/><ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(-60 50 50)"/>
              </svg>
            </div>
            <div><div className="logo-text">物理AI</div><div className="logo-sub">受験生のための類題生成</div></div>
          </div>
          <div className="header-actions">
            <div className="header-xp-badge"><span>{level.emoji}</span><span className="header-xp-rank">{level.rank}</span><span className="header-xp-val">{stats.xp} XP</span></div>
            <button className="btn btn-ghost" onClick={() => { setScreen('history'); setHistory(loadHistory()) }} title="履歴"><Ico.Clock /></button>
            <button className="btn btn-ghost" onClick={() => setScreen('settings')} title="設定"><Ico.Settings /></button>
          </div>
        </div>
      </header>

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-top-bar mobile-only">
        <div className="mobile-top-inner">
          {screen === 'home' ? (
            <div className="mobile-top-home"><span className="mobile-top-logo">⚛️ 物理AI</span><div className="mobile-top-xp"><span>{level.emoji}</span><span>{stats.xp} XP</span></div></div>
          ) : (
            <div className="mobile-top-title">{screen === 'history' ? '生成履歴' : screen === 'settings' ? '設定' : screen === 'legal' ? (legalTab === 'terms' ? '利用規約' : 'プライバシーポリシー') : screen === 'practice' ? (STEPS[step - 1]?.label || '演習') : ''}</div>
          )}
          {screen === 'practice' && (
            <>
              <div className="mobile-progress-line"><div className="mobile-progress-fill" style={{width: `${(step / STEPS.length) * 100}%`}} /></div>
              {step <= 3 && <div className="mobile-timer"><Ico.Clock /> {formatTimer(sessionTime)}</div>}
            </>
          )}
        </div>
      </div>

      <div className="main-content">

        {/* ══ HOME ダッシュボード ══ */}
        {screen === 'home' && (
          <div className="home-screen anim-fade-up">
            <div className="home-hero">
              <div className="home-hero-bg" />
              <div className="home-hero-content">
                <div className="home-hero-greeting">{new Date().getHours() < 12 ? 'おはよう' : new Date().getHours() < 18 ? 'こんにちは' : 'おつかれさま'}、受験生。</div>
                <div className="home-hero-motivation">{getTodayMotivation()}</div>
                <button className="btn btn-hero" onClick={startPractice}><Ico.Play /> 演習を始める</button>
              </div>
            </div>

            <div className="streak-card">
              <div className="streak-main"><div className="streak-fire">🔥</div><div className="streak-info"><div className="streak-count">{stats.currentStreak}</div><div className="streak-label">日連続</div></div></div>
              <div className="streak-sub">{stats.currentStreak === 0 ? '今日から連続記録を始めよう！' : stats.currentStreak >= 7 ? `${stats.currentStreak}日連続！周りと差がついてる。` : stats.currentStreak >= 3 ? `${stats.currentStreak}日連続！この調子。` : '連続記録スタート！明日もやれば2日目。'}</div>
              {stats.maxStreak > stats.currentStreak && <div className="streak-max">最高記録: {stats.maxStreak}日連続</div>}
            </div>

            <div className="quick-stats">
              <div className="quick-stat-card"><div className="quick-stat-icon"><Ico.BookOpen /></div><div className="quick-stat-value">{stats.totalProblems}</div><div className="quick-stat-label">総演習問題</div></div>
              <div className="quick-stat-card"><div className="quick-stat-icon"><Ico.Clock /></div><div className="quick-stat-value">{formatTime(stats.totalTimeSeconds)}</div><div className="quick-stat-label">総学習時間</div></div>
              <div className="quick-stat-card"><div className="quick-stat-icon"><Ico.Target /></div><div className="quick-stat-value">{stats.totalSessions}</div><div className="quick-stat-label">セッション</div></div>
            </div>

            <div className="level-card">
              <div className="level-header"><div className="level-info"><span className="level-emoji">{level.emoji}</span><span className="level-rank-badge">Rank {level.rank}</span><span className="level-name">{level.name}</span></div><div className="level-xp">{stats.xp} XP</div></div>
              <div className="level-progress-bar"><div className="level-progress-fill" style={{width: `${level.progress}%`}} /></div>
              <div className="level-progress-label">{level.progress < 100 ? `次のランクまで あと ${level.nextXp - stats.xp} XP` : '最高ランク到達！'}</div>
            </div>

            <div className="section-card"><div className="section-card-header"><Ico.BarChart /><span>今週の演習量</span></div><WeeklyActivity weeklyActivity={stats.weeklyActivity} /></div>

            {Object.keys(stats.subjectBreakdown).length > 0 && (
              <div className="section-card">
                <div className="section-card-header"><Ico.Target /><span>科目別演習</span></div>
                <div className="subject-bars">
                  {Object.entries(stats.subjectBreakdown).sort(([,a],[,b]) => b - a).map(([subj, count]) => {
                    const mx = Math.max(...Object.values(stats.subjectBreakdown))
                    return <div key={subj} className="subject-bar-row"><div className="subject-bar-label">{subj}</div><div className="subject-bar-track"><div className="subject-bar-fill" style={{width: `${(count / mx) * 100}%`}} /></div><div className="subject-bar-count">{count}問</div></div>
                  })}
                </div>
              </div>
            )}

            <div className="section-card shareable-section">
              <div className="section-card-header"><Ico.Camera /><span>努力の証明カード</span></div>
              <p className="shareable-instruction">スクショしてSNSでシェアしよう！</p>
              <ShareableCard stats={stats} level={level} />
            </div>

            {stats.sessionLog?.length > 0 && (
              <div className="section-card">
                <div className="section-card-header"><Ico.Clock /><span>最近のセッション</span></div>
                <div className="recent-sessions">
                  {stats.sessionLog.slice(-5).reverse().map((s, i) => (
                    <div key={i} className="recent-session-item">
                      <div className="recent-session-info"><div className="recent-session-name">{s.templateName}</div><div className="recent-session-meta">{s.numQuestions}問 ・ {s.duration ? formatTime(s.duration) : '-'} ・ {new Date(s.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</div></div>
                      <div className="recent-session-xp">+{s.numQuestions * 10 + Math.floor((s.duration||0) / 60) * 5} XP</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="home-cta"><button className="btn btn-primary btn-block btn-lg" onClick={startPractice}><Ico.Zap /> 今すぐ演習する</button><div className="home-cta-sub">1セッション5分〜。スキマ時間で差をつけろ。</div></div>
          </div>
        )}

        {/* ══ HISTORY ══ */}
        {screen === 'history' && (
          <div className="card anim-fade-up">
            <div className="card-header"><span className="card-emoji">🕐</span><div className="card-title">生成履歴</div><div className="card-desc">過去に生成したPDFの一覧</div></div>
            {history.length > 0 ? (
              <>
                <div className="history-list">
                  {history.map(h => (
                    <div key={h.id} className="history-item">
                      <div className="history-item-info"><div className="history-item-name">{presetEmoji(h.latexPreset)} {h.templateName}</div><div className="history-item-meta">{h.numQuestions}問 ・ {new Date(h.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>
                      <div className="history-item-actions">
                        {h.pdfUrl && <a href={h.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-outline" style={{padding:'6px 12px',fontSize:12}}><Ico.ExternalLink /> 開く</a>}
                        <button className="btn btn-ghost" style={{padding:'6px 8px',color:'var(--c-danger)'}} onClick={() => { deleteFromHistory(h.id); setHistory(loadHistory()) }}><Ico.Trash /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-outline btn-block" style={{marginTop: 16}} onClick={() => { if (window.confirm('全ての履歴を削除しますか？')) { clearHistory(); setHistory([]) } }}>履歴をすべて削除</button>
              </>
            ) : <div className="base-empty"><div className="base-empty-icon"><Ico.Clock /></div><div>まだ生成履歴がありません</div><div className="field-hint">PDFを生成すると記録されます</div></div>}
            <div className="mobile-sticky-action"><button className="btn btn-primary btn-block btn-lg" onClick={() => setScreen('home')}><Ico.ArrowLeft /> ホームに戻る</button></div>
          </div>
        )}

        {/* ══ SETTINGS ══ */}
        {screen === 'settings' && (
          <div className="card anim-fade-up">
            <div className="card-header"><span className="card-emoji">⚙️</span><div className="card-title">設定</div><div className="card-desc">アプリの動作をカスタマイズ</div></div>
            <div className="field" style={{marginBottom:20}}><label className="field-label">デフォルト問題数</label><div className="num-questions-selector">{[1,2,3,5,10].map(n => <button key={n} className={`num-btn ${settings.defaultNumQuestions===n?'active':''}`} onClick={() => { const s = { ...settings, defaultNumQuestions: n }; setSettings(s); saveSettings(s) }}>{n}問</button>)}</div></div>
            <div className="field" style={{marginBottom:20}}><label className="field-label">デフォルト出力形式</label><div className="preset-chips">{latexPresets.map(p => <button key={p.id} className={`preset-chip ${settings.defaultLatexPreset===p.id?'active':''}`} onClick={() => { const s = { ...settings, defaultLatexPreset: p.id }; setSettings(s); saveSettings(s) }}><span className="preset-chip-emoji">{presetEmoji(p.id)}</span><span className="preset-chip-label">{p.name}</span></button>)}</div></div>
            <div className="field" style={{marginBottom:20}}><label className="field-label">デフォルトベース問題モード</label><div className="base-mode-tabs">{[{key:'db',icon:<Ico.Database />,label:'DB'},{key:'pdf',icon:<Ico.Pdf />,label:'PDF'},{key:'skip',icon:<Ico.Skip />,label:'スキップ'}].map(m => <button key={m.key} className={`base-mode-tab ${settings.defaultBaseMode===m.key?'active':''}`} onClick={() => { const s = { ...settings, defaultBaseMode: m.key }; setSettings(s); saveSettings(s) }}>{m.icon}<span>{m.label}</span></button>)}</div></div>
            <div className="settings-divider" />
            <div className="field" style={{marginBottom:20}}><label className="field-label">データ管理</label><button className="btn btn-outline btn-block" style={{marginBottom:8}} onClick={() => { if(window.confirm('学習データをリセットしますか？')) { setStats(DEFAULT_STATS); saveStats(DEFAULT_STATS); notify('リセットしました','info') } }}>学習データをリセット</button></div>
            <div className="settings-divider" />
            <div className="field" style={{marginBottom:20}}><label className="field-label">その他</label><button className="btn btn-outline btn-block" style={{marginBottom:8}} onClick={() => { setScreen('legal'); setLegalTab('terms') }}><Ico.Shield /> 利用規約</button><button className="btn btn-outline btn-block" style={{marginBottom:8}} onClick={() => { setScreen('legal'); setLegalTab('privacy') }}><Ico.Shield /> プライバシーポリシー</button><button className="btn btn-outline btn-block" onClick={() => setShowOnboarding(true)}>チュートリアルを再表示</button></div>
            <div className="settings-app-info"><div className="settings-app-version">⚛️ 物理AI v2.0</div><div className="field-hint">受験生のための類題生成AI</div></div>
            <div className="mobile-sticky-action"><button className="btn btn-primary btn-block btn-lg" onClick={() => setScreen('home')}><Ico.ArrowLeft /> ホームに戻る</button></div>
          </div>
        )}

        {/* ══ LEGAL ══ */}
        {screen === 'legal' && (
          <div className="card anim-fade-up">
            <div className="legal-tabs"><button className={`legal-tab ${legalTab==='terms'?'active':''}`} onClick={() => setLegalTab('terms')}>利用規約</button><button className={`legal-tab ${legalTab==='privacy'?'active':''}`} onClick={() => setLegalTab('privacy')}>プライバシーポリシー</button></div>
            {legalTab === 'terms' && <div className="legal-content anim-fade-up"><h3>利用規約</h3><p className="legal-date">最終更新日: 2025年1月1日</p><h4>第1条</h4><p>本規約は本アプリの利用条件を定めるものです。</p><h4>第2条</h4><p>本サービスは教育目的で問題の類題を生成するためのツールです。</p><h4>第3条</h4><p>法令違反、運営妨害、不正利用を禁じます。</p><h4>第4条</h4><p>本サービスは「現状有姿」で提供されます。</p></div>}
            {legalTab === 'privacy' && <div className="legal-content anim-fade-up"><h3>プライバシーポリシー</h3><p className="legal-date">最終更新日: 2025年1月1日</p><p>生成履歴や設定はローカルストレージに保存されます。サーバーに個人情報は保存しません。</p></div>}
            <div className="mobile-sticky-action"><button className="btn btn-primary btn-block btn-lg" onClick={() => setScreen('settings')}><Ico.ArrowLeft /> 設定に戻る</button></div>
          </div>
        )}

        {/* ══ PRACTICE (演習モード) ══ */}
        {screen === 'practice' && (
          <>
            {step <= 3 && <div className="session-timer-bar desktop-only"><div className="session-timer-inner"><Ico.Clock /><span>セッション: {formatTimer(sessionTime)}</span></div></div>}
            <div className="progress-bar desktop-only">
              {STEPS.map((s, i) => (
                <React.Fragment key={s.n}>
                  <div className={`progress-step ${step===s.n?'active':''} ${step>s.n?'done clickable':''}`} onClick={() => step > s.n && setStep(s.n)}>
                    <div className="progress-dot">{step > s.n ? <Ico.Check s={14} /> : s.n}</div><div className="progress-name">{s.label}</div>
                  </div>
                  {i < STEPS.length - 1 && <div className={`progress-line ${step > s.n ? 'filled' : ''}`} />}
                </React.Fragment>
              ))}
            </div>

            {/* STEP 1 */}
            {step === 1 && (
              <div className="card anim-fade-up mobile-card">
                <div className="card-header mobile-card-header"><span className="card-emoji">⚛️</span><div className="card-title">出題パターンを選ぶ</div><div className="card-desc mobile-card-desc">得意分野を伸ばす？ 苦手を潰す？ 戦略的に選べ。</div></div>
                <div className="physics-hero-banner"><div className="physics-hero-content"><div className="physics-hero-title">⚛️ 物理の類題生成</div><div className="physics-hero-subtitle">受験生の武器になる</div></div><div className="physics-hero-pills"><span>力学</span><span>電磁気</span><span>波動</span><span>熱力学</span></div></div>
                <div className="tip mobile-tip-compact"><span className="tip-icon">💡</span><div>苦手分野から攻めるのが合格への近道。5問以上で定着率UP</div></div>
                <div className="pattern-grid">
                  {[...templates].sort((a,b) => {const aP=(a.metadata?.subject||'').includes('物理')?-1:0;const bP=(b.metadata?.subject||'').includes('物理')?-1:0;return aP-bP}).map(t => {
                    const m = t.metadata||{}, sel = form.templateId===t.id, phys = (m.subject||'').includes('物理')
                    return <div key={t.id} className={`pattern-card ${sel?'selected':''} ${phys?'physics':''}`} onClick={() => upd('templateId',t.id)}><div className="pattern-card-header"><div className="pattern-card-name">{t.name||t.id}</div>{sel && <div className="pattern-check"><Ico.Check s={14}/></div>}</div>{t.description && <div className="pattern-card-desc">{t.description}</div>}<div className="pattern-card-tags">{m.subject && <span className={`pattern-tag ${phys?'physics-tag':''}`}>{m.subject}</span>}{m.field && <span className="pattern-tag">{m.field}</span>}</div></div>
                  })}
                </div>
                <div className="mobile-sticky-action"><button className="btn btn-primary btn-block btn-lg" onClick={() => { if(form.templateId){fetchBaseProblems(form.templateId);setStep(2)} }} disabled={!form.templateId}>次へ進む <Ico.ArrowRight /></button></div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="card anim-fade-up">
                <div className="card-header"><span className="card-emoji">⚙️</span><div className="card-title">問題数・ベース問題を設定</div><div className="card-desc">量は質に転化する。多めがコツ。</div></div>
                {selectedTemplate && <div className="selected-pattern-badge"><span>選択中：</span><strong>{selectedTemplate.name||selectedTemplate.id}</strong>{templateMeta.subject && <span className="pattern-tag">{templateMeta.subject}</span>}</div>}
                <div className="field" style={{marginBottom:20}}>
                  <label className="field-label">問題数</label>
                  <div className="num-questions-selector">{[1,2,3,5,10].map(n => <button key={n} className={`num-btn ${form.numQuestions===n?'active':''}`} onClick={() => upd('numQuestions',n)}>{n}問</button>)}</div>
                  <div className="field-hint" style={{marginTop:8}}>カスタム：<input className="input" type="number" min={1} max={10} value={form.numQuestions} onChange={e=>upd('numQuestions',Math.min(10,Math.max(1,Number(e.target.value))))} style={{width:80,display:'inline-block',marginLeft:8,padding:'6px 10px'}}/></div>
                </div>
                <div className="field" style={{marginBottom:20}}>
                  <label className="field-label">出力形式</label>
                  <div className="preset-chips">{latexPresets.map(p => <button key={p.id} className={`preset-chip ${form.latexPreset===p.id?'active':''}`} onClick={() => upd('latexPreset',p.id)} title={p.description}><span className="preset-chip-emoji">{presetEmoji(p.id)}</span><span className="preset-chip-label">{p.name}</span></button>)}</div>
                  {currentPreset && <div className="field-hint">{currentPreset.description}</div>}
                </div>
                <div className="field" style={{marginBottom:20}}>
                  <label className="field-label">ベース問題</label>
                  <div className="card-desc" style={{marginBottom:12,fontSize:13}}>参考にする問題を選ぶか、スキップも可能です。</div>
                  <div className="base-mode-tabs">
                    <button className={`base-mode-tab ${baseMode==='db'?'active':''}`} onClick={() => setBaseMode('db')}><Ico.Database /><span>DB</span></button>
                    <button className={`base-mode-tab ${baseMode==='pdf'?'active':''}`} onClick={() => setBaseMode('pdf')}><Ico.Pdf /><span>PDF</span></button>
                    <button className={`base-mode-tab ${baseMode==='skip'?'active':''}`} onClick={() => {setBaseMode('skip');setSelectedBaseProblem(null);setBasePdfData(null)}}><Ico.Skip /><span>スキップ</span></button>
                  </div>
                  {baseMode==='db' && <div className="base-content anim-fade-up">{baseProblems.length > 0 ? <><div className="base-db-hint">同じパターンから1つ選択</div><div className="base-problem-list">{baseProblems.map(p => <div key={p.id} className={`base-problem-card ${selectedBaseProblem?.id===p.id?'selected':''}`} onClick={() => setSelectedBaseProblem(selectedBaseProblem?.id===p.id?null:p)}><div className="base-problem-stem">{p.stem}</div><div className="base-problem-meta">{p.subject && <span className="pattern-tag">{p.subject}</span>}{p.topic && <span className="pattern-tag">{p.topic}</span>}{p.difficulty!=null && <span className="pattern-tag">難易度:{(p.difficulty*100).toFixed(0)}%</span>}</div>{selectedBaseProblem?.id===p.id && <div className="base-problem-check"><Ico.Check s={16}/></div>}</div>)}</div></> : <div className="base-empty"><div className="base-empty-icon"><Ico.Database /></div><div>この分野の問題がありません</div><div className="field-hint">PDFかスキップを選択してください</div></div>}</div>}
                  {baseMode==='pdf' && <div className="base-content anim-fade-up"><div className="tip tip-info" style={{marginBottom:16}}><span className="tip-icon">📋</span><div>PDF<strong>3ページ以下</strong>のみ</div></div>{!basePdfData ? <div className={`upload-area ${basePdfDragOver?'drag-over':''}`} onClick={() => basePdfRef.current?.click()} onDrop={onBasePdfDrop} onDragOver={e=>{e.preventDefault();setBasePdfDragOver(true)}} onDragLeave={() => setBasePdfDragOver(false)}><input ref={basePdfRef} type="file" accept=".pdf" onChange={e=>uploadBasePdf(e.target.files?.[0])}/><div className="upload-icon"><Ico.Upload /></div><div className="upload-label"><strong>タップ</strong>or<strong>ドラッグ</strong></div><div className="upload-formats">PDF（3ページ以下）</div></div> : <div className="base-pdf-preview"><div className="base-pdf-info"><div className="base-pdf-filename"><Ico.FileText /> {basePdfData.filename}</div><div className="base-pdf-pages">{basePdfData.page_count}ページ</div><button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:12}} onClick={() => setBasePdfData(null)}>削除</button></div>{basePdfData.images?.length > 0 && <div className="base-pdf-thumbnails">{basePdfData.images.map((img,i) => <div key={i} className="base-pdf-thumb"><img src={`data:image/png;base64,${img}`} alt={`P${i+1}`}/><div className="base-pdf-thumb-label">P{i+1}</div></div>)}</div>}</div>}</div>}
                  {baseMode==='skip' && <div className="base-content anim-fade-up"><div className="base-skip-notice"><Ico.Skip /><div><strong>ベース問題なしで生成</strong><div className="field-hint">RAGのみで指示文を作成</div></div></div></div>}
                </div>
                <div className="mobile-sticky-action"><div className="btn-row btn-row-2"><button className="btn btn-outline btn-lg" onClick={() => setStep(1)}><Ico.ArrowLeft /> 戻る</button><button className="btn btn-primary btn-lg" onClick={generatePrompt} disabled={loading||(baseMode==='db'&&!selectedBaseProblem)||(baseMode==='pdf'&&!basePdfData)}>指示文を作成 <Ico.ArrowRight /></button></div></div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="card anim-fade-up mobile-card">
                <div className="card-header mobile-card-header"><span className="card-emoji">🤖</span><div className="card-title">AIに依頼 → 結果を入力</div><div className="card-desc mobile-card-desc">ここが一番大事。AIの出力を貼り付けよう。</div></div>
                <div className="mobile-section">
                  <div className="mobile-section-label"><span className="mobile-section-badge">A</span>指示文をコピーしてAIに送信</div>
                  <div className="mobile-action-group">
                    <button className="btn btn-primary btn-block btn-lg" onClick={copyPrompt}><Ico.Copy /> 指示文をコピー</button>
                    <div className="mobile-ai-links"><a href="https://chat.openai.com/" target="_blank" rel="noreferrer" className="mobile-ai-link"><Ico.ExternalLink /> ChatGPT</a><a href="https://claude.ai/" target="_blank" rel="noreferrer" className="mobile-ai-link"><Ico.ExternalLink /> Claude</a></div>
                  </div>
                  {baseMode==='pdf'&&basePdfData && <div className="mobile-alert"><span className="mobile-alert-icon">📎</span>PDF「{basePdfData.filename}」もAIに添付</div>}
                  <button className="mobile-toggle-preview" onClick={() => setShowPromptSection(p=>!p)}>{showPromptSection?'指示文を隠す':'指示文を見る'} {showPromptSection?<Ico.ChevronUp />:<Ico.ChevronDown />}</button>
                  {showPromptSection && <div className="prompt-preview anim-fade-up">{prompt}</div>}
                  <div className="step4-badges">{ragCtx?.chunk_count>0 && <span className="rag-badge">📚 {ragCtx.chunk_count}件参照</span>}{currentPreset && <span className="rag-badge">📄 {currentPreset.name}</span>}{baseMode==='db'&&selectedBaseProblem && <span className="rag-badge">🎯 ベース問題済</span>}</div>
                </div>
                <div className="mobile-divider" />
                <div className="mobile-section">
                  <div className="mobile-section-label"><span className="mobile-section-badge mobile-section-badge-b">B</span>AIの出力を貼り付け</div>
                  <div className="field"><textarea className="input manual-textarea" placeholder={"\\documentclass{article}\n...\n\\end{document}"} value={llmOutput} onChange={e=>setLlmOutput(e.target.value)} />{llmOutput.trim() && <div className="latex-validation-hints"><span className={llmOutput.includes('\\documentclass')?'hint-ok':'hint-warn'}>{llmOutput.includes('\\documentclass')?'✅':'⚠️'} documentclass</span><span className={llmOutput.includes('\\end{document}')?'hint-ok':'hint-warn'}>{llmOutput.includes('\\end{document}')?'✅':'⚠️'} end</span></div>}</div>
                </div>
                <div className="mobile-sticky-action"><button className="btn btn-success btn-block btn-lg" onClick={generatePdf} disabled={loading||!llmOutput.trim()}><Ico.Zap /> PDF を生成する</button><button className="btn btn-outline btn-block" onClick={() => setStep(2)}><Ico.ArrowLeft /> 戻る</button></div>
              </div>
            )}

            {/* STEP 4 - 完了 */}
            {step === 4 && (
              <div className="card anim-fade-up mobile-card completion-card">
                <div className="completion-hero">
                  <div className="success-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                  <div className="completion-title">演習完了！</div>
                  <div className="completion-subtitle">おつかれさま。この1セッションが合格に近づく1歩。</div>
                </div>
                <div className="completion-stats">
                  <div className="completion-stat"><div className="completion-stat-value">{form.numQuestions}</div><div className="completion-stat-label">問題数</div></div>
                  <div className="completion-stat"><div className="completion-stat-value">{formatTimer(sessionTime)}</div><div className="completion-stat-label">所要時間</div></div>
                  <div className="completion-stat xp-stat"><div className="completion-stat-value">+{sessionXpGain}</div><div className="completion-stat-label">XP獲得</div></div>
                </div>
                <div className="completion-level">
                  <div className="completion-level-header"><span>{level.emoji} Rank {level.rank} — {level.name}</span><span>{stats.xp} XP</span></div>
                  <div className="level-progress-bar"><div className="level-progress-fill" style={{width:`${level.progress}%`}} /></div>
                </div>
                <div className="completion-streak"><span className="completion-streak-fire">🔥</span><span>{stats.currentStreak}日連続</span>{stats.currentStreak > 1 && <span className="completion-streak-bonus">継続ボーナス！</span>}</div>
                <div className="completion-rating">
                  <div className="completion-rating-label">この演習の手応えは？</div>
                  <div className="completion-rating-stars">{[1,2,3,4,5].map(n => <button key={n} className={`rating-star ${selfRating>=n?'active':''}`} onClick={() => setSelfRating(n)}>★</button>)}</div>
                  <div className="completion-rating-hint">{selfRating===0?'':selfRating<=2?'苦手分野を重点的にやろう':selfRating<=4?'いい調子！続けよう':'完璧！次のパターンに挑戦しよう'}</div>
                </div>
                <button className="btn btn-outline btn-block" onClick={() => setShowShareCard(v=>!v)}><Ico.Camera /> {showShareCard?'共有カードを隠す':'努力の証明カードを表示'}</button>
                {showShareCard && <div className="completion-share anim-fade-up"><ShareableCard stats={stats} level={level} /><div className="completion-share-hint">↑ スクショしてSNSでシェアしよう！</div></div>}
                <div className="mobile-sticky-action">
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-success btn-block btn-lg"><Ico.ExternalLink /> 問題PDFを開く</a>
                  {answerLatex && !answerPdfUrl && (
                    <button className="btn btn-primary btn-block btn-lg" onClick={generateAnswerPdf} disabled={answerLoading}>
                      {answerLoading ? '解答PDF生成中...' : '📖 回答解説を見る'}
                    </button>
                  )}
                  {answerPdfUrl && (
                    <a href={answerPdfUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-block btn-lg"><Ico.ExternalLink /> 解答・解説PDFを開く</a>
                  )}
                  <button className="btn btn-primary btn-block btn-lg" onClick={() => { resetWizard(); setStep(1) }}><Ico.Zap /> 続けて演習する</button>
                  <button className="btn btn-outline btn-block" onClick={() => { resetWizard(); setScreen('home') }}><Ico.Home /> ホームに戻る</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Help FAB ── */}
      <button className="help-floating desktop-only" onClick={() => setShowHelp(true)} title="ヘルプ"><Ico.Help /></button>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="mobile-bottom-nav mobile-only">
        <button className={`mobile-nav-item ${screen==='home'?'active':''}`} onClick={() => setScreen('home')}><span className="mobile-nav-icon">🏠</span><span className="mobile-nav-label">ホーム</span></button>
        <button className={`mobile-nav-item ${screen==='practice'?'active':''}`} onClick={startPractice}><span className="mobile-nav-icon">📝</span><span className="mobile-nav-label">演習</span></button>
        <button className={`mobile-nav-item ${screen==='history'?'active':''}`} onClick={() => { setScreen('history'); setHistory(loadHistory()) }}><span className="mobile-nav-icon">🕐</span><span className="mobile-nav-label">履歴</span></button>
        <button className={`mobile-nav-item ${screen==='settings'||screen==='legal'?'active':''}`} onClick={() => setScreen('settings')}><span className="mobile-nav-icon">⚙️</span><span className="mobile-nav-label">設定</span></button>
        <button className="mobile-nav-item" onClick={() => setShowHelp(true)}><span className="mobile-nav-icon">❓</span><span className="mobile-nav-label">ヘルプ</span></button>
      </nav>

      {/* ── Help Modal ── */}
      {showHelp && (
        <div className="help-modal-overlay" onClick={() => setShowHelp(false)}><div className="help-modal" onClick={e => e.stopPropagation()}>
          <div className="help-header"><h2>ヘルプ</h2><button onClick={() => setShowHelp(false)}>×</button></div>
          <div className="help-content"><dl>
            <dt>Q: 外部AIは必須？</dt><dd>はい。問題の生成はChatGPT/Claude等の外部AIが行います。</dd>
            <dt>Q: XPの仕組みは？</dt><dd>1問=10XP、演習1分=5XP。継続でランクUP。</dd>
            <dt>Q: ストリークとは？</dt><dd>毎日PDF生成で連続日数カウント。1日休むとリセット。</dd>
            <dt>Q: PDF生成失敗する</dt><dd>コードブロック記号(```)を削除し、\\documentclass〜\\end&#123;document&#125;を確認。</dd>
          </dl></div>
        </div></div>
      )}
    </div>
  )
}