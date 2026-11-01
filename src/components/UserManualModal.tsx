import React, { useState } from 'react';
import {
  BookOpen,
  X,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Smartphone,
  LayoutDashboard,
  Cpu,
  Lock,
  WifiOff,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Search,
  ExternalLink,
  ChevronRight,
  HeartHandshake,
  Layers,
  FileText,
  UserCheck,
  Terminal
} from 'lucide-react';
import { SIMULATION_LABEL_STRING } from '../services/operationalCheckpoints';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerBridgeDispute?: () => void;
  onTriggerViralHoax?: () => void;
  onTriggerStaleShelter?: () => void;
  onTriggerOxygenDedup?: () => void;
  onTriggerCyberBreach?: () => void;
  onToggleLowNetwork?: () => void;
  isLowNetwork?: boolean;
}

type ManualTab = 'quickstart' | 'citizen' | 'responder' | 'curveballs' | 'privacy' | 'kpis';

export const UserManualModal: React.FC<UserManualModalProps> = ({
  isOpen,
  onClose,
  onTriggerBridgeDispute,
  onTriggerViralHoax,
  onTriggerStaleShelter,
  onTriggerOxygenDedup,
  onTriggerCyberBreach,
  onToggleLowNetwork,
  isLowNetwork = false
}) => {
  const [activeTab, setActiveTab] = useState<ManualTab>('quickstart');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="manual-title" className="text-base font-bold text-white tracking-tight">
                  ResQnet Operational Manual &amp; Pitch Guide
                </h2>
                <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono font-bold">
                  v2.6 IMPACTX
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Challenge 16: Multi-Source Resilient Disaster Management Platform
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close manual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('quickstart')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'quickstart'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Quick Start &amp; Pitch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('citizen')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'citizen'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Citizen Flow (POV 1)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('responder')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'responder'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Tactical Responders (POV 2)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('curveballs')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'curveballs'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-200" />
              <span>6 Live Curveballs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'privacy'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Zero-Trust Privacy</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('kpis')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'kpis'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>3 Programmatic KPIs</span>
            </button>
          </div>

          <div className="relative w-full sm:w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search manual..."
              className="w-full pl-8 pr-6 py-1 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Search Jump Results */}
        {searchQuery.trim().length > 0 && (
          <div className="px-6 py-2 bg-indigo-50/90 border-b border-indigo-100 text-xs flex flex-wrap items-center gap-2">
            <span className="font-semibold text-indigo-900">Matches for "{searchQuery}":</span>
            {[
              { tag: 'Oxygen Dedup', tab: 'curveballs' as ManualTab },
              { tag: 'Bridge Dispute', tab: 'curveballs' as ManualTab },
              { tag: '40% Network Drop', tab: 'curveballs' as ManualTab },
              { tag: 'Dam Hoax MTTR', tab: 'curveballs' as ManualTab },
              { tag: 'Stale Shelter', tab: 'curveballs' as ManualTab },
              { tag: 'Demo Passwords', tab: 'quickstart' as ManualTab },
              { tag: 'XAI Scoring Formula', tab: 'responder' as ManualTab },
              { tag: 'Zero-Trust Checkpoints', tab: 'privacy' as ManualTab },
              { tag: 'USSD *1070# & SMS', tab: 'citizen' as ManualTab }
            ]
              .filter((item) => item.tag.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.tab);
                    setSearchQuery('');
                  }}
                  className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-600 hover:text-white font-medium transition-colors"
                >
                  Jump to {item.tag} →
                </button>
              ))}
          </div>
        )}

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1 leading-relaxed">
          {/* TAB 1: QUICK START & PITCH CHEATSHEET */}
          {activeTab === 'quickstart' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950">
                <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>3-Minute Winning Pitch Storyboard (for Evaluators &amp; Judges)</span>
                </div>
                <p className="text-xs text-amber-900/90 mb-3">
                  ResQnet solves the core flaw of modern disaster response: when cellular networks drop, misinformation spreads, and contradictory reports delay boat dispatch. ResQnet fuses multi-source intelligence with zero privacy leaks.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                    <span className="font-mono font-bold text-amber-700 block">Step 1</span>
                    <strong className="block text-slate-800">40% Cell Failure</strong>
                    <span className="text-[11px] text-slate-600">Toggle low signal; offline Store-and-Forward queues messages.</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                    <span className="font-mono font-bold text-amber-700 block">Step 2</span>
                    <strong className="block text-slate-800">Bridge Conflict</strong>
                    <span className="text-[11px] text-slate-600">PWD says open, SDRF says washed out. Auto-downgrades to 45% + SH-12 detour.</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                    <span className="font-mono font-bold text-amber-700 block">Step 3</span>
                    <strong className="block text-slate-800">Oxygen Dedup</strong>
                    <span className="text-[11px] text-slate-600">3 calls merged into 1 incident; ranked #1 priority via Explainable AI.</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                    <span className="font-mono font-bold text-amber-700 block">Step 4</span>
                    <strong className="block text-slate-800">Dam Hoax MTTR</strong>
                    <span className="text-[11px] text-slate-600">Quarantined before citizen leak; 1-click official SMS correction.</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                    <span className="font-mono font-bold text-amber-700 block">Step 5</span>
                    <strong className="block text-slate-800">Shelter Staleness</strong>
                    <span className="text-[11px] text-slate-600">Telemetry &gt;90m old auto-switches to offline survival guide.</span>
                  </div>
                </div>
              </div>

              {/* Access Control & Security */}
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span>Role-Based Access Control &amp; Portal Protection</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Official Responder Access:</span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold">Passkey Protected</span>
                    </div>
                    <p className="text-slate-600">Access is restricted strictly to authorized emergency coordinators with credentials issued by Disaster Incident Command.</p>
                    <p className="text-[11px] text-slate-500 mt-1">Protects citizen PII, Triage Queue overrides, Debunking Console, and Map layers.</p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Public Citizen Access:</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">No Login Required</span>
                    </div>
                    <p className="text-slate-600">Citizens can immediately request emergency SOS relief and track rescue status without creating an account.</p>
                    <p className="text-[11px] text-slate-500 mt-1">Ensures zero friction during live life-or-death emergencies.</p>
                  </div>
                </div>
              </div>

              {/* Layout Switcher Guide */}
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-slate-700" />
                  <span>4 Viewport Modes Explained</span>
                </h3>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono shrink-0">Combined Suite</span>
                    <div>
                      <strong className="text-slate-900 block">Recommended for Presentations:</strong>
                      Displays the Tactical Emergency Dashboard on the left and the Public Citizen Interface on the right in real time. Demonstrates how a distress call submitted on the right instantly reflects on the left without leaking PII.
                    </div>
                  </li>
                  <li className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-900 font-bold shrink-0">Citizen Tab</span>
                    <div>
                      <strong className="text-slate-900 block">Citizen Experience (POV 1):</strong>
                      Distress submission, offline USSD/SMS fallback, shelter capacity status, and survival protocols.
                    </div>
                  </li>
                  <li className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-900 font-bold shrink-0">Officer Tab</span>
                    <div>
                      <strong className="text-slate-900 block">Control Room &amp; Field Responders (POV 2 &amp; 4):</strong>
                      Explainable AI Triage, Human Override Ledger, Misinformation Quarantine, and Media Wire.
                    </div>
                  </li>
                  <li className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold shrink-0">Developer Tab</span>
                    <div>
                      <strong className="text-slate-900 block">Evaluator Sandbox:</strong>
                      Time-travel simulation controls, offline packet sync, and intrusion testing.
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: CITIZEN FLOW (POV 1) */}
          {activeTab === 'citizen' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">Citizen Emergency Flow (POV 1)</h3>
                <p className="text-xs text-slate-600">
                  Designed for rural and flooded environments where 4G/5G mobile towers often collapse.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    1
                  </div>
                  <strong className="block text-slate-900">Distress Reporting</strong>
                  <p className="text-slate-600">
                    Citizens report water rise, trapped families, or oxygen requirements. If GPS is available, high-precision coordinates are leased ephemerally.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    2
                  </div>
                  <strong className="block text-slate-900">2G SMS &amp; USSD Fallback</strong>
                  <p className="text-slate-600">
                    When data drops, citizens use <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">*1070#</code> or SMS to <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">1070</code>. Messages are queued with Store-and-Forward timestamps.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                    3
                  </div>
                  <strong className="block text-slate-900">Offline Survival Protocols</strong>
                  <p className="text-slate-600">
                    If shelter capacity is stale (&gt;90 min), the map automatically hides unverified spots and presents pre-vetted offline water purification and rooftop signaling instructions.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-xl text-xs space-y-2">
                <span className="font-bold text-amber-300 block">Offline Multilingual Checkpoint:</span>
                <p className="text-slate-300">
                  Every survival card, SOS acknowledgment, and shelter advisory is pre-bundled in English, Hindi (हिन्दी), and Assamese (অসমীয়া), requiring zero external network requests to render.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: TACTICAL RESPONDERS (POV 2 & 4) */}
          {activeTab === 'responder' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">Tactical Responder &amp; Control Room (POV 2 &amp; 4)</h3>
                <p className="text-xs text-slate-600">
                  Empowering NDRF/SDRF boat teams and district emergency officers with explainable AI and unalterable human accountability.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    <span>Explainable AI (XAI) Priority Scoring Formula</span>
                  </div>
                  <p className="text-slate-600 font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                    Priority Score = (Severity × 0.45) + (Vulnerability × 0.35) + (Reliability × 0.20)
                  </p>
                  <p className="text-slate-600">
                    Every card renders the mathematical factor breakdown. Bedridden elderly and oxygen-dependent patients immediately earn a 3.0× multiplier.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Append-Only Cryptographic Human Override Ledger</span>
                  </div>
                  <p className="text-slate-600">
                    Responders can manually adjust priority ranks if tactical realities change (e.g. boat approaching nearby child). Every override requires a typed justification, records the Officer badge ID, and is cryptographically hashed into an unalterable audit chain.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Multi-Agency Road Closure Conflict Detection</span>
                  </div>
                  <p className="text-slate-600">
                    If PWD claims a route is "Open" but SDRF water reconnaissance reports "Washed Out", ResQnet flags the conflict, drops confidence to 45%, and directs rescue vehicles to alternate corridors (e.g. SH-12 detour).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 6 LIVE CURVEBALLS */}
          {activeTab === 'curveballs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Challenge 16 Curveball Scenarios</h3>
                  <p className="text-xs text-slate-600">
                    Click any test trigger below to demonstrate system resilience in real time.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* 1. 40% Cell Network Failure */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        1. RESILIENCE
                      </span>
                      <span className="font-bold text-slate-500">40% Cell Drop</span>
                    </div>
                    <strong className="block text-slate-900 mb-1">Offline Store-and-Forward</strong>
                    <p className="text-slate-600 text-[11px]">
                      Simulates flooded cell towers. Local packets are cached with vector clocks; synchronizes automatically when connection pulses.
                    </p>
                  </div>
                  {onToggleLowNetwork && (
                    <button
                      type="button"
                      onClick={onToggleLowNetwork}
                      className={`w-full py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                        isLowNetwork
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <WifiOff className="w-3.5 h-3.5" />
                      <span>{isLowNetwork ? 'Network Dropped (40%)' : 'Trigger 40% Network Drop'}</span>
                    </button>
                  )}
                </div>

                {/* 2. NH-27 Bridge Conflict */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                        2. RECONCILIATION
                      </span>
                      <span className="font-bold text-slate-500">Contradiction</span>
                    </div>
                    <strong className="block text-slate-900 mb-1">NH-27 Bridge Dispute</strong>
                    <p className="text-slate-600 text-[11px]">
                      PWD clearance contradicted by SDRF water patrol. System forces conservative action: flags 45% confidence &amp; SH-12 detour.
                    </p>
                  </div>
                  {onTriggerBridgeDispute && (
                    <button
                      type="button"
                      onClick={onTriggerBridgeDispute}
                      className="w-full py-1.5 px-3 rounded-lg font-semibold text-xs bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Trigger NH-27 Dispute</span>
                    </button>
                  )}
                </div>

                {/* 3. Viral Fake Dam Rumor */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                        3. MISINFORMATION
                      </span>
                      <span className="font-bold text-slate-500">96 fwd/min</span>
                    </div>
                    <strong className="block text-slate-900 mb-1">Viral Dam-Break Hoax</strong>
                    <p className="text-slate-600 text-[11px]">
                      Audio blast claiming Kapili dam burst. Automatically quarantined; 0 citizens misled; MTTR stopwatch triggers for debunking.
                    </p>
                  </div>
                  {onTriggerViralHoax && (
                    <button
                      type="button"
                      onClick={onTriggerViralHoax}
                      className="w-full py-1.5 px-3 rounded-lg font-semibold text-xs bg-purple-600 text-white hover:bg-purple-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Inject Dam-Break Rumor</span>
                    </button>
                  )}
                </div>

                {/* 4. Stale Shelter Telemetry */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        4. FRESHNESS DECAY
                      </span>
                      <span className="font-bold text-slate-500">94m TTL</span>
                    </div>
                    <strong className="block text-slate-900 mb-1">Stale Shelter Telemetry</strong>
                    <p className="text-slate-600 text-[11px]">
                      Bhuragaon shelter report is &gt;90 minutes old. System calculates dynamic age and replaces map pin with static survival guide.
                    </p>
                  </div>
                  {onTriggerStaleShelter && (
                    <button
                      type="button"
                      onClick={onTriggerStaleShelter}
                      className="w-full py-1.5 px-3 rounded-lg font-semibold text-xs bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Age Shelter to 94m</span>
                    </button>
                  )}
                </div>

                {/* 5. COPD Oxygen Patient Dedup */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                        5. DEDUPLICATION
                      </span>
                      <span className="font-bold text-slate-500">3 Channels</span>
                    </div>
                    <strong className="block text-slate-900 mb-1">Oxygen SOS Consolidation</strong>
                    <p className="text-slate-600 text-[11px]">
                      Resident + Neighbor + USSD distress for same COPD patient are unified under Household ID HSH-BAR-892 with 100/100 score.
                    </p>
                  </div>
                  {onTriggerOxygenDedup && (
                    <button
                      type="button"
                      onClick={onTriggerOxygenDedup}
                      className="w-full py-1.5 px-3 rounded-lg font-semibold text-xs bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Unify Oxygen SOS</span>
                    </button>
                  )}
                </div>

                {/* 6. Zero-Trust Cyber Intrusion */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                        6. PRIVACY &amp; SECURITY
                      </span>
                      <span className="font-bold text-slate-500">Zero-Trust</span>
                    </div>
                    <strong className="block text-slate-900 mb-1">Cyber Intrusion Probe</strong>
                    <p className="text-slate-600 text-[11px]">
                      Low-privilege Guest_09 token attempts write mutation on Master Registry. Instant HTTP 403 block and alert logged.
                    </p>
                  </div>
                  {onTriggerCyberBreach && (
                    <button
                      type="button"
                      onClick={onTriggerCyberBreach}
                      className="w-full py-1.5 px-3 rounded-lg font-semibold text-xs bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Simulate Guest DB Breach</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ZERO-TRUST PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">Zero Public Exposure &amp; Privacy Architecture</h3>
                <p className="text-xs text-slate-600">
                  Strict boundaries enforce that distress callers and vulnerable victims are never exposed to public viewers or malicious scrapers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Lock className="w-4 h-4 text-purple-600" />
                    <span>Zero Public Exposure Boundary</span>
                  </div>
                  <p className="text-slate-600">
                    Every data payload routed to public portals or the Media Wire passes through the programmatic check:
                  </p>
                  <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto">
{`function enforceZeroPublicExposure(payload) {
  if (hasRawGPS(payload) || hasExactAddress(payload)) {
    throw new SecurityException("Zero Public Exposure breached!");
  }
  return maskPublicVectors(payload);
}`}
                  </pre>
                  <p className="text-slate-600">
                    Phone numbers are masked to <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">+91 94350 *****</code> and coordinates are grouped to district level.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Ephemeral GPS Leases &amp; Hash Chains</span>
                  </div>
                  <p className="text-slate-600">
                    Exact coordinates are held under a time-bounded lease only visible to the dispatched boat crew.
                  </p>
                  <ul className="space-y-1 list-disc list-inside text-slate-600 text-[11px]">
                    <li>Audit logs are sha256 hash-chained to prevent retroactive tampering.</li>
                    <li>Low-privilege users attempting registry downloads trigger HTTP 403 blocks.</li>
                    <li>Continuous penetration scanner verifies 0 public privacy leaks.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: 3 PROGRAMMATIC KPIS */}
          {activeTab === 'kpis' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">Inline Automated Telemetry KPIs</h3>
                <p className="text-xs text-slate-600">
                  ResQnet features automated metric listeners verifying performance continuously.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded block w-fit">
                    KPI 1 · TARGET: 100%
                  </span>
                  <strong className="block text-emerald-950 text-sm font-bold">Request Ingestion Rate</strong>
                  <p className="text-slate-700 text-[11px]">
                    Compares seeded distress requests against incidents surfaced to tactical responders. 100% is maintained because store-and-forward merges duplicates without losing distinct incidents.
                  </p>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                  <span className="font-mono text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded block w-fit">
                    KPI 2 · MTTR STOPWATCH
                  </span>
                  <strong className="block text-purple-950 text-sm font-bold">Misinformation Latency</strong>
                  <p className="text-slate-700 text-[11px]">
                    Calculates exact Mean Time to Resolution from viral hoax injection to operator quarantine and multi-modal SMS debunk broadcast.
                  </p>
                </div>

                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                  <span className="font-mono text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded block w-fit">
                    KPI 3 · TARGET: 0 LEAKS
                  </span>
                  <strong className="block text-indigo-950 text-sm font-bold">Privacy Leak Auditor</strong>
                  <p className="text-slate-700 text-[11px]">
                    Continuous background scanner auditing public endpoints. If unmasked GPS or phone data leaks, status fails immediately. Currently at <strong>0 ZERO LEAKS</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="px-2 py-0.5 rounded bg-slate-200 font-mono text-[11px] font-bold text-slate-800">
              {SIMULATION_LABEL_STRING}
            </span>
            <span className="hidden sm:inline">IMPACTX 2026 Disaster Management Protocol</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors text-xs shadow-xs"
            >
              Got it, Close Manual
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
