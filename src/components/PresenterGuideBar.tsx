import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Radio,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Send,
  Zap,
  Smartphone,
  LayoutDashboard,
  BookOpen
} from 'lucide-react';
import { FusedIncident, MisinformationItem, StoreForwardMessage } from '../types/disaster';
import { SIMULATION_LABEL_STRING } from '../services/operationalCheckpoints';

interface PresenterGuideBarProps {
  portalMode: 'citizen' | 'official' | 'developer' | 'combined';
  onSelectPortalMode: (mode: 'citizen' | 'official' | 'developer' | 'combined') => void;
  isLowNetwork: boolean;
  setIsLowNetwork: (low: boolean) => void;
  onTriggerBridgeDispute: () => void;
  onTriggerViralHoax: () => void;
  onTriggerStaleShelter: () => void;
  onTriggerOxygenDedup: () => void;
  onTriggerCyberBreach: () => void;
  onDebunkHoax: () => void;
  onResetAllScenarios: () => void;
  onOpenUserManual?: () => void;
  onOpenExplainerModal?: () => void;
  incidents: FusedIncident[];
  misinfoList: MisinformationItem[];
  storeForwardMessages: StoreForwardMessage[];
  globalSupervisorAlert: { id: string; requestedScope: string } | null;
}

export const PresenterGuideBar: React.FC<PresenterGuideBarProps> = ({
  portalMode,
  onSelectPortalMode,
  isLowNetwork,
  setIsLowNetwork,
  onTriggerBridgeDispute,
  onTriggerViralHoax,
  onTriggerStaleShelter,
  onTriggerOxygenDedup,
  onTriggerCyberBreach,
  onDebunkHoax,
  onResetAllScenarios,
  onOpenUserManual,
  onOpenExplainerModal,
  incidents,
  misinfoList,
  storeForwardMessages,
  globalSupervisorAlert
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeStoryStep, setActiveStoryStep] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Challenge 16 Ready: Click any curveball below to demonstrate how ResQnet solves live disaster anomalies.'
  );

  // Status checks for quick badges
  const hasDispute = incidents.some((i) => i.id === 'INC-BRIDGE-01' && i.conflictingReports !== null);
  const hasHoaxQuarantined = misinfoList.some((m) => m.id === 'MIS-01' && m.isQuarantined);
  const hasHoaxDebunked = misinfoList.some((m) => m.id === 'MIS-01' && m.humanReviewDecision === 'CONFIRMED_HOAX');
  const isShelterStale = incidents.some(
    (i) => (i.id === 'INC-SHELTER-04' || i.district === 'Morigaon') && (i.ageMinutes >= 90 || i.freshnessStatus === 'stale')
  );
  const hasOxygenPatient = incidents.some(
    (i) => i.category === 'medical_oxygen' && i.triagePriorityScore >= 95
  );

  // Quick action feedback helper
  const handleActionClick = (name: string, fn: () => void, feedback: string) => {
    fn();
    setStatusMessage(`⚡ ${name}: ${feedback}`);
  };

  // Storyboard Auto-Runner for live presentation walkthrough
  const runStoryboardStep = (step: number) => {
    setActiveStoryStep(step);
    if (step === 1) {
      setIsLowNetwork(true);
      setStatusMessage('Scenario 1/5: 40% Cell Network Down. Mobile towers flooded; offline Store-and-Forward activates.');
    } else if (step === 2) {
      onTriggerBridgeDispute();
      setStatusMessage('Scenario 2/5: NH-27 Bridge Dispute. PWD says open, SDRF reports washed out -> 45% disputed confidence & SH-12 detour.');
    } else if (step === 3) {
      onTriggerOxygenDedup();
      setStatusMessage('Scenario 3/5: COPD Oxygen Patient. 3 duplicate channels merged; 100/100 emergency priority guaranteed.');
    } else if (step === 4) {
      onTriggerViralHoax();
      setStatusMessage('Scenario 4/5: Viral Dam-Break Hoax. 96 forwards/min quarantined; 0 citizen leak; MTTR stopwatch running.');
    } else if (step === 5) {
      onTriggerStaleShelter();
      setStatusMessage('Scenario 5/5: Stale Shelter Telemetry. Capacity >90 min old -> fallback switch to offline survival instructions.');
    }
  };

  return (
    <aside aria-label="Presenter & Evaluator Quick Demo Toolbar" className="bg-black border-b border-neutral-900 text-white shadow-md relative z-30">
      {/* Top Bar / Header */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs bg-black">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-mono font-bold text-[10px] tracking-wide">
            {SIMULATION_LABEL_STRING}
          </span>
          <div className="flex items-center gap-1.5 font-bold text-neutral-100 text-xs">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>IMPACTX 2026 Evaluator &amp; Presenter Bar</span>
          </div>
          <span className="text-neutral-600 hidden md:inline">|</span>
          <span className="text-neutral-400 hidden md:inline font-mono text-[11px]">
            Challenge 16 Assam Flood Protocol
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Portal Switchers */}
          <div className="flex items-center bg-black rounded-lg p-0.5 border border-neutral-800 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => onSelectPortalMode('combined')}
              className={`px-2 py-0.5 rounded transition-colors ${
                portalMode === 'combined'
                  ? 'bg-amber-400 text-black font-bold'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              Dual Suite
            </button>
            <button
              type="button"
              onClick={() => onSelectPortalMode('official')}
              className={`px-2 py-0.5 rounded transition-colors ${
                portalMode === 'official'
                  ? 'bg-white text-black font-bold'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              Responders
            </button>
            <button
              type="button"
              onClick={() => onSelectPortalMode('citizen')}
              className={`px-2 py-0.5 rounded transition-colors ${
                portalMode === 'citizen'
                  ? 'bg-emerald-400 text-black font-bold'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              Citizens
            </button>
          </div>

          {onOpenUserManual && (
            <button
              type="button"
              onClick={onOpenUserManual}
              className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-amber-300 font-semibold text-[11px] flex items-center gap-1.5 transition-colors shadow-xs"
              title="Open ResQnet Operational Manual & Pitch Guide"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Manual</span>
            </button>
          )}

          {onOpenExplainerModal && (
            <button
              type="button"
              onClick={onOpenExplainerModal}
              className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-black font-bold text-[11px] flex items-center gap-1.5 transition-colors shadow-xs"
              title="Open ResQnet Automated Pipeline Explainer"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>How Automation Works</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-neutral-900 rounded text-neutral-400 hover:text-white transition-colors"
            title={isExpanded ? 'Collapse Presenter Bar' : 'Expand Presenter Bar'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Quick-Action Strip */}
      {isExpanded && (
        <div className="border-t border-neutral-900 bg-black px-4 py-3 text-xs">
          <div className="max-w-7xl mx-auto space-y-3">
            {/* Live Status / Prompt Explanation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-neutral-950 rounded-lg border border-neutral-900">
              <div className="flex items-center gap-2 text-neutral-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-medium text-xs">{statusMessage}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onResetAllScenarios}
                  className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-medium text-[11px] border border-neutral-800 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset State</span>
                </button>
              </div>
            </div>

            {/* 6 1-Click Hard-Mode Demo Triggers */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* 1. 40% Network Packet Drop */}
              <button
                type="button"
                onClick={() =>
                  handleActionClick(
                    '40% Network Drop',
                    () => setIsLowNetwork(!isLowNetwork),
                    isLowNetwork ? 'Network restored to normal.' : '40% mobile packet drop simulated. Local Store-and-Forward queued.'
                  )
                }
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between h-full ${
                  isLowNetwork
                    ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
                    : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-mono text-[10px] font-bold text-amber-400">1. NETWORK</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      isLowNetwork ? 'bg-amber-400 text-black' : 'bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    {isLowNetwork ? '40% DROP' : 'ACTIVE'}
                  </span>
                </div>
                <div className="font-bold text-xs leading-tight">40% Cell Drop</div>
                <div className="text-[10px] text-neutral-400 mt-1">Store-and-Forward sync</div>
              </button>

              {/* 2. NH-27 Bridge Dispute */}
              <button
                type="button"
                onClick={() =>
                  handleActionClick(
                    'NH-27 Bridge Dispute',
                    onTriggerBridgeDispute,
                    'PWD clearance contradicted by SDRF boat patrol. Reliability forced to 45% with SH-12 detour.'
                  )
                }
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between h-full ${
                  hasDispute
                    ? 'bg-rose-950/60 border-rose-500/80 text-rose-200'
                    : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-mono text-[10px] font-bold text-rose-400">2. CONFLICT</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      hasDispute ? 'bg-rose-500 text-white' : 'bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    {hasDispute ? 'DISPUTED' : 'READY'}
                  </span>
                </div>
                <div className="font-bold text-xs leading-tight">Bridge Dispute</div>
                <div className="text-[10px] text-neutral-400 mt-1">PWD vs SDRF / SH-12 detour</div>
              </button>

              {/* 3. Viral Fake Dam Rumor */}
              <button
                type="button"
                onClick={() =>
                  handleActionClick(
                    'Viral Fake Dam Rumor',
                    onTriggerViralHoax,
                    '96 fwd/min fake dam order isolated in quarantine. 0 leaked to citizens. MTTR timer running.'
                  )
                }
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between h-full ${
                  hasHoaxQuarantined
                    ? 'bg-purple-950/60 border-purple-500/80 text-purple-200'
                    : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-mono text-[10px] font-bold text-purple-400">3. MISINFO</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      hasHoaxDebunked
                        ? 'bg-emerald-500 text-white'
                        : hasHoaxQuarantined
                        ? 'bg-purple-500 text-white'
                        : 'bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    {hasHoaxDebunked ? 'DEBUNKED' : hasHoaxQuarantined ? 'QUARANTINE' : 'READY'}
                  </span>
                </div>
                <div className="font-bold text-xs leading-tight">Dam Hoax MTTR</div>
                <div className="text-[10px] text-neutral-400 mt-1">Quarantine &amp; 1-click SMS</div>
              </button>

              {/* 4. Stale Shelter Switch */}
              <button
                type="button"
                onClick={() =>
                  handleActionClick(
                    'Stale Shelter Telemetry',
                    onTriggerStaleShelter,
                    'Bhuragaon capacity >90m old. Live age calculated & citizen view auto-switched to static survival protocol.'
                  )
                }
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between h-full ${
                  isShelterStale
                    ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
                    : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-mono text-[10px] font-bold text-amber-400">4. FRESHNESS</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      isShelterStale ? 'bg-amber-400 text-black' : 'bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    {isShelterStale ? 'STALE 94m' : 'READY'}
                  </span>
                </div>
                <div className="font-bold text-xs leading-tight">Stale Shelter TTL</div>
                <div className="text-[10px] text-neutral-400 mt-1">Fallback to offline protocol</div>
              </button>

              {/* 5. Oxygen Patient #1 Priority (Dedup) */}
              <button
                type="button"
                onClick={() =>
                  handleActionClick(
                    'Oxygen Patient Dedup',
                    onTriggerOxygenDedup,
                    'Self + neighbor + USSD calls merged. Provenance united with 100/100 medical priority guaranteed.'
                  )
                }
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between h-full ${
                  hasOxygenPatient
                    ? 'bg-red-950/60 border-red-500/80 text-red-200'
                    : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-mono text-[10px] font-bold text-red-400">5. DEDUP &amp; XAI</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-red-600 text-white">
                    #1 RANK
                  </span>
                </div>
                <div className="font-bold text-xs leading-tight">Oxygen SOS #1</div>
                <div className="text-[10px] text-neutral-400 mt-1">COPD patient prioritized</div>
              </button>

              {/* 6. Cyber Privilege Escalation Block */}
              <button
                type="button"
                onClick={() =>
                  handleActionClick(
                    'Cyber Intrusion Test',
                    onTriggerCyberBreach,
                    'Guest_09 attempted DB write. Blocked HTTP 403, amber alert glow triggered, logged in ledger.'
                  )
                }
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between h-full ${
                  globalSupervisorAlert
                    ? 'bg-amber-950/60 border-amber-500/80 text-amber-200 animate-pulse'
                    : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-mono text-[10px] font-bold text-amber-400">6. ZERO-TRUST</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      globalSupervisorAlert ? 'bg-amber-400 text-black' : 'bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    {globalSupervisorAlert ? 'BLOCKED 403' : 'READY'}
                  </span>
                </div>
                <div className="font-bold text-xs leading-tight">Cyber Intrusion</div>
                <div className="text-[10px] text-neutral-400 mt-1">Zero Public Exposure rule</div>
              </button>
            </div>

            {/* Quick 1-Click Storyboard Buttons for Pitching */}
            <div className="pt-2 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
              <span className="font-semibold text-neutral-300">
                1-Click Presentation Pitch Sequence:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { step: 1, label: '1. Cell Failure' },
                  { step: 2, label: '2. Bridge Conflict' },
                  { step: 3, label: '3. Oxygen Patient' },
                  { step: 4, label: '4. Quash Hoax' },
                  { step: 5, label: '5. Shelter Fallback' }
                ].map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => runStoryboardStep(s.step)}
                    className={`px-2 py-1 rounded font-medium border transition-colors ${
                      activeStoryStep === s.step
                        ? 'bg-amber-400 text-black border-amber-300 font-bold'
                        : 'bg-black border-neutral-800 hover:border-neutral-700 text-neutral-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
