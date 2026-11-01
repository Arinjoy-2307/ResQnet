import React, { useState } from 'react';
import {
  Zap,
  Sparkles,
  RotateCcw,
  BookOpen,
  Info,
  ShieldCheck,
  Cpu,
  Layers,
  Columns,
  LayoutDashboard,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Play,
  Flame,
  Radio,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { FusedIncident, MisinformationItem, StoreForwardMessage, ReportPacket } from '../types/disaster';
import { AutoPilotController } from './AutoPilotController';
import { AutomatedSuccessMetricsAuditor } from './AutomatedSuccessMetricsAuditor';
import { CombinedControlSuite } from './CombinedControlSuite';
import { LanguageCode } from '../services/i18n';
import { SIMULATION_LABEL_STRING } from '../services/operationalCheckpoints';

interface SolutionModelSegmentProps {
  incidents: FusedIncident[];
  storeForwardMessages: StoreForwardMessage[];
  misinfoList: MisinformationItem[];
  simulatedTime: number;
  language: LanguageCode;
  isLowNetwork: boolean;
  setIsLowNetwork: (low: boolean) => void;
  onTriggerBridgeDispute: () => void;
  onTriggerViralHoax: () => void;
  onTriggerStaleShelter: () => void;
  onTriggerOxygenDedup: () => void;
  onTriggerCyberBreach: () => void;
  onDebunkHoax: () => void;
  onSyncAllStoreForward: () => void;
  onResetAllScenarios: () => void;
  onOpenExplainerModal: () => void;
  onOpenUserManual: () => void;
  onIngestCitizenReport: (packet: ReportPacket) => void;
  onUpdateIncidentOverride: (
    incidentId: string,
    newScore: number,
    reason: string,
    responderName: string
  ) => void;
  onOpenProvenance: (inc: FusedIncident) => void;
  onOpenOfficialLogin: () => void;
  selectedStateFilter: string;
  setSelectedStateFilter: (state: string) => void;
  isOfficerRealtimeConnected: boolean;
  liveConnectedOfficerTabs: number;
  globalSupervisorAlert: { id: string; requestedScope: string } | null;
}

export const SolutionModelSegment: React.FC<SolutionModelSegmentProps> = ({
  incidents,
  storeForwardMessages,
  misinfoList,
  simulatedTime,
  language,
  isLowNetwork,
  setIsLowNetwork,
  onTriggerBridgeDispute,
  onTriggerViralHoax,
  onTriggerStaleShelter,
  onTriggerOxygenDedup,
  onTriggerCyberBreach,
  onDebunkHoax,
  onSyncAllStoreForward,
  onResetAllScenarios,
  onOpenExplainerModal,
  onOpenUserManual,
  onIngestCitizenReport,
  onUpdateIncidentOverride,
  onOpenProvenance,
  onOpenOfficialLogin,
  selectedStateFilter,
  setSelectedStateFilter,
  isOfficerRealtimeConnected,
  liveConnectedOfficerTabs,
  globalSupervisorAlert
}) => {
  const [activeSubView, setActiveSubView] = useState<'autopilot' | 'metrics' | 'dual' | 'curveballs'>('autopilot');
  const [suitePortalMode, setSuitePortalMode] = useState<'combined' | 'official' | 'citizen'>('combined');
  const [suiteOfficialTab, setSuiteOfficialTab] = useState<'map' | 'triage' | 'misinfo' | 'storeforward' | 'privacy'>('map');

  return (
    <div className="space-y-6">
      {/* 1. Solution Segment Top Header Banner */}
      <section aria-label="Solution Model Overview" className="bg-slate-950 text-white rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[11px] font-extrabold uppercase tracking-wide">
                AUTONOMOUS SOLUTION SUITE
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-mono text-[11px] font-semibold border border-indigo-800 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>Challenge 16 Disaster Fusion Engine</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-400 font-mono text-[10px]">
                {SIMULATION_LABEL_STRING}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              End-to-End Autonomous Disaster Relief Model
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
              Dedicated solution testbed and evaluation suite. Watch ResQnet autonomously resolve multi-channel packet drops, contradictory intelligence, medical oxygen triage, viral misinformation, and zero-trust security in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenExplainerModal}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              title="Open architectural walkthrough & diagram"
            >
              <Info className="w-4 h-4" />
              <span>How Automation Works</span>
            </button>

            <button
              type="button"
              onClick={onOpenUserManual}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              title="Open operational pitch guide"
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span>Manual &amp; Pitch</span>
            </button>

            <button
              type="button"
              onClick={onResetAllScenarios}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
              title="Reset state to initial scenario"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset State</span>
            </button>
          </div>
        </div>

        {/* Sub-View Navigation Tabs inside Solution Segment */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveSubView('autopilot')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                activeSubView === 'autopilot'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>1. Auto-Pilot Simulation &amp; Explainer HUD</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubView('metrics')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                activeSubView === 'metrics'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>2. 3 Programmatic Success KPIs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubView('dual')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                activeSubView === 'dual'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>3. Live Dual-Viewport (Responders + Citizens)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubView('curveballs')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                activeSubView === 'curveballs'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-200" />
              <span>4. Individual Curveball Sandbox</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 hidden lg:block">
            All 28 States &amp; 8 UTs Enabled · Google Maps Platform Active
          </div>
        </div>
      </section>

      {/* 2. SUB-VIEW A: AUTONOMOUS AUTO-PILOT & EXPLAINER HUD */}
      {activeSubView === 'autopilot' && (
        <div className="space-y-6">
          <AutoPilotController
            portalMode={suitePortalMode}
            onSelectPortalMode={(mode) => {
              if (mode === 'combined' || mode === 'official' || mode === 'citizen') {
                setSuitePortalMode(mode);
              }
            }}
            onSelectOfficialTab={(tab) => {
              if (tab === 'map' || tab === 'triage' || tab === 'misinfo' || tab === 'storeforward' || tab === 'privacy') {
                setSuiteOfficialTab(tab);
              }
            }}
            isLowNetwork={isLowNetwork}
            setIsLowNetwork={setIsLowNetwork}
            onTriggerBridgeDispute={onTriggerBridgeDispute}
            onTriggerViralHoax={onTriggerViralHoax}
            onTriggerStaleShelter={onTriggerStaleShelter}
            onTriggerOxygenDedup={onTriggerOxygenDedup}
            onTriggerCyberBreach={onTriggerCyberBreach}
            onDebunkHoax={onDebunkHoax}
            onSyncAllStoreForward={onSyncAllStoreForward}
            onResetAllScenarios={onResetAllScenarios}
            onOpenExplainerModal={onOpenExplainerModal}
            incidents={incidents}
            misinfoList={misinfoList}
            storeForwardMessages={storeForwardMessages}
            globalSupervisorAlert={globalSupervisorAlert}
          />

          {/* Synchronized live viewport showing the effect right beneath the Auto-Pilot */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
              <span>Live System State During Autonomous Simulation:</span>
              <span className="font-mono text-slate-500">
                Mode: {suitePortalMode.toUpperCase()} {suiteOfficialTab ? `(${suiteOfficialTab.toUpperCase()})` : ''}
              </span>
            </div>

            <CombinedControlSuite
              incidents={incidents}
              onIngestCitizenReport={onIngestCitizenReport}
              onUpdateIncidentOverride={onUpdateIncidentOverride}
              language={language}
              isLowNetwork={isLowNetwork}
              onOpenProvenance={onOpenProvenance}
              onOpenOfficialLogin={onOpenOfficialLogin}
              selectedStateFilter={selectedStateFilter}
              setSelectedStateFilter={setSelectedStateFilter}
              isOfficerRealtimeConnected={isOfficerRealtimeConnected}
              liveConnectedOfficerTabs={liveConnectedOfficerTabs}
            />
          </div>
        </div>
      )}

      {/* 3. SUB-VIEW B: THE 3 PROGRAMMATIC SUCCESS KPIS AUDITOR */}
      {activeSubView === 'metrics' && (
        <div className="space-y-6">
          <AutomatedSuccessMetricsAuditor
            incidents={incidents}
            storeForwardMessages={storeForwardMessages}
            misinfoList={misinfoList}
            simulatedTime={simulatedTime}
          />
        </div>
      )}

      {/* 4. SUB-VIEW C: LIVE DUAL VIEWPORT */}
      {activeSubView === 'dual' && (
        <div className="space-y-4">
          <CombinedControlSuite
            incidents={incidents}
            onIngestCitizenReport={onIngestCitizenReport}
            onUpdateIncidentOverride={onUpdateIncidentOverride}
            language={language}
            isLowNetwork={isLowNetwork}
            onOpenProvenance={onOpenProvenance}
            onOpenOfficialLogin={onOpenOfficialLogin}
            selectedStateFilter={selectedStateFilter}
            setSelectedStateFilter={setSelectedStateFilter}
            isOfficerRealtimeConnected={isOfficerRealtimeConnected}
            liveConnectedOfficerTabs={liveConnectedOfficerTabs}
          />
        </div>
      )}

      {/* 5. SUB-VIEW D: 6 DISASTER CURVEBALL SANDBOX */}
      {activeSubView === 'curveballs' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              Manual Curveball &amp; Disruption Sandbox
            </h3>
            <p className="text-xs text-slate-500">
              Trigger any of the 6 core disaster challenges manually to examine individual state transitions and fail-safe logic.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 1. 40% Network Packet Drop */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="font-mono text-[10px] font-bold text-amber-600 block">
                  CHALLENGE 1: CONNECTIVITY
                </span>
                <h4 className="font-bold text-sm text-slate-900">40% Cell Network Drop</h4>
                <p className="text-xs text-slate-600">
                  Simulates flooded mobile towers dropping standard HTTP packets; activates local Store-and-Forward queue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLowNetwork(!isLowNetwork)}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
                  isLowNetwork
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {isLowNetwork ? 'Network Drop Active (Toggle Off)' : 'Trigger 40% Network Drop'}
              </button>
            </div>

            {/* 2. NH-27 Bridge Dispute */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="font-mono text-[10px] font-bold text-rose-600 block">
                  CHALLENGE 2: DECONFLICTION
                </span>
                <h4 className="font-bold text-sm text-slate-900">NH-27 Bridge Contradiction</h4>
                <p className="text-xs text-slate-600">
                  PWD says open, SDRF reports pier washed away. Drops confidence to 45% and renders safe SH-12 detour.
                </p>
              </div>
              <button
                type="button"
                onClick={onTriggerBridgeDispute}
                className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 transition-colors shadow-xs"
              >
                Trigger Bridge Dispute
              </button>
            </div>

            {/* 3. Viral Fake Dam Rumor */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="font-mono text-[10px] font-bold text-purple-600 block">
                  CHALLENGE 3: MISINFORMATION
                </span>
                <h4 className="font-bold text-sm text-slate-900">Fake Dam Collapse Hoax</h4>
                <p className="text-xs text-slate-600">
                  96 forwards/min voice note quarantined with 0 public leak; sensor-checked counter-broadcast sent in &lt;3s.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onTriggerViralHoax}
                  className="py-2 px-2 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition-colors"
                >
                  Inject Hoax
                </button>
                <button
                  type="button"
                  onClick={onDebunkHoax}
                  className="py-2 px-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                >
                  Debunk Hoax
                </button>
              </div>
            </div>

            {/* 4. Stale Shelter Switch */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="font-mono text-[10px] font-bold text-amber-600 block">
                  CHALLENGE 4: FRESHNESS DECAY
                </span>
                <h4 className="font-bold text-sm text-slate-900">Stale Shelter Telemetry (&gt;90m)</h4>
                <p className="text-xs text-slate-600">
                  Bhuragaon camp capacity &gt;90m stale. Half-life decay drops reliability to 38% and switches to offline protocol.
                </p>
              </div>
              <button
                type="button"
                onClick={onTriggerStaleShelter}
                className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-500 transition-colors shadow-xs"
              >
                Age Shelter &gt;90 Mins
              </button>
            </div>

            {/* 5. Oxygen Patient #1 Priority */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="font-mono text-[10px] font-bold text-red-600 block">
                  CHALLENGE 5: DEDUP &amp; XAI
                </span>
                <h4 className="font-bold text-sm text-slate-900">COPD Oxygen Patient Triage</h4>
                <p className="text-xs text-slate-600">
                  Merges 3 duplicate distress calls into 1 incident and pushes it to Rank #1 with 100/100 emergency priority.
                </p>
              </div>
              <button
                type="button"
                onClick={onTriggerOxygenDedup}
                className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition-colors shadow-xs"
              >
                Prioritize Oxygen SOS
              </button>
            </div>

            {/* 6. Cyber Privilege Escalation Block */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="font-mono text-[10px] font-bold text-slate-700 block">
                  CHALLENGE 6: ZERO-TRUST
                </span>
                <h4 className="font-bold text-sm text-slate-900">Unauthorized Database Probe</h4>
                <p className="text-xs text-slate-600">
                  Guest_09 attempts write mutation; blocked HTTP 403 Forbidden and logged in SHA-256 audit ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={onTriggerCyberBreach}
                className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
              >
                Test Intrusion Probe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
