import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Sparkles,
  ShieldCheck,
  Radio,
  GitCompare,
  HeartPulse,
  ShieldAlert,
  Clock,
  Lock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info,
  ArrowRight,
  Zap,
  HelpCircle
} from 'lucide-react';
import { FusedIncident, MisinformationItem, StoreForwardMessage } from '../types/disaster';
import { SIMULATION_LABEL_STRING } from '../services/operationalCheckpoints';

export interface AutoPilotStage {
  id: number;
  label: string;
  shortTag: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  problem: string;
  automatedAction: string;
  mathLogic: string;
  lifeImpact: string;
  recommendedView: 'combined' | 'official' | 'citizen';
  officialTab?: 'map' | 'triage' | 'misinfo' | 'storeforward' | 'privacy';
}

export const AUTO_PILOT_STAGES: AutoPilotStage[] = [
  {
    id: 1,
    label: 'Stage 1: Packet Loss & Ingestion',
    shortTag: '1. Ingestion',
    icon: Radio,
    title: '40% Mobile Network Outage & Store-and-Forward Buffering',
    problem:
      'Monsoon floodwaters submerge cell towers in Barpeta and Morigaon, dropping 40% of standard HTTP mobile packets. In typical apps, citizen SOS requests vanish into network timeouts.',
    automatedAction:
      'ResQnet automatically engages the local SQLite/IndexedDB Store-and-Forward queue. Distress SMS and USSD (*1070#) packets are buffered locally with zero packet loss and synchronized the millisecond a tower signal pulses.',
    mathLogic:
      'Packet Loss Tolerance = 100% | Ingestion Protocol: Store-and-Forward with Idempotent Deduplication Hash',
    lifeImpact:
      'Elderly residents and flood-cut households remain connected to the National Disaster Response Force even with zero broadband.',
    recommendedView: 'combined',
    officialTab: 'storeforward'
  },
  {
    id: 2,
    label: 'Stage 2: Intelligence Deconfliction',
    shortTag: '2. Deconfliction',
    icon: GitCompare,
    title: 'NH-27 Bridge Conflict & Automated Safe Detour Rerouting',
    problem:
      'Public Works Department (PWD) marks NH-27 Puthimari Bridge as "Open", but SDRF boat reconnaissance spots the northern pier foundation washed away. Conflicting data leads rescue ambulances into floodwaters.',
    automatedAction:
      'ResQnet detects conflicting claims between official sources. It drops route confidence to 45% (Disputed Status), enforces safety-first conservative protocol, auto-renders the Google Maps Routes SH-12 detour, and flags a joint verification taskforce.',
    mathLogic:
      'Dispute Penalty: BaseReliability × 0.45 | Detour Trigger: IF (ConflictingReports ≠ NULL) THEN BypassPrimary = TRUE',
    lifeImpact:
      'Emergency ambulances and supply convoys are automatically diverted via safe highland routes, preventing bridge collapse casualties.',
    recommendedView: 'official',
    officialTab: 'map'
  },
  {
    id: 3,
    label: 'Stage 3: Deduplication & Oxygen Triage',
    shortTag: '3. Triage Dedup',
    icon: HeartPulse,
    title: 'Multi-Source Signal Deduplication & 100/100 Life-Safety Triage',
    problem:
      'A bedridden COPD patient in Milan Nagar has only 1.5 hours of oxygen left. Three frantic reports arrive from different channels: daughter (SMS), neighbor (USSD), and village head (radio). Disorganized teams would dispatch 3 separate boats.',
    automatedAction:
      'ResQnet matches geohash coordinates and vulnerability markers, fusing all 3 reports into a single consolidated record. It computes medical priority, pushes the incident to Rank #1 with a score of 100/100, and directs the nearest boat asset.',
    mathLogic:
      'Triage Priority = Severity(100) × 0.40 + Vulnerability(100) × 0.40 + Reliability(100) × 0.20 = 100.0 (Rank #1)',
    lifeImpact:
      'Prevents redundant boat deployment and guarantees critical oxygen delivery before battery exhaustion.',
    recommendedView: 'official',
    officialTab: 'triage'
  },
  {
    id: 4,
    label: 'Stage 4: Rumor Quarantine & MTTR',
    shortTag: '4. Rumor MTTR',
    icon: ShieldAlert,
    title: 'High-Velocity Dam Collapse Hoax Quarantine & Instant Broadcast',
    problem:
      'A panic voice note claiming "Kapili river dam gates collapsed, 10ft wall of water coming!" spreads at 96 forwards/minute across WhatsApp and 2G SMS, causing panic stampedes on wet river dykes.',
    automatedAction:
      'ResQnet flags unauthenticated origin keys and isolates the rumor in quarantine with 0 public exposure. It verifies Kapili river sensors (water levels normal) and automatically pushes an official geo-targeted SMS & IVR debunk broadcast to 1,420 exposed citizens.',
    mathLogic:
      'Zero Public Leakage: ExposedCount_Public = 0 | MTTR (Mean Time to Respond) < 3.0 Seconds',
    lifeImpact:
      'Halted dangerous mass stampedes and kept evacuation corridors clear for genuine emergency operations.',
    recommendedView: 'official',
    officialTab: 'misinfo'
  },
  {
    id: 5,
    label: 'Stage 5: Time-Decay & Graceful Fallback',
    shortTag: '5. Time Decay',
    icon: Clock,
    title: 'Mathematical Half-Life Decay & Offline Shelter Fallback',
    problem:
      'Telemetry for Bhuragaon Relief Camp has had no sensor heartbeat for >90 minutes. Stale data in traditional dashboards misleads fleeing citizens to overcrowded or compromised shelters.',
    automatedAction:
      'ResQnet applies half-life mathematical decay: reliability drops from 85% to 38% (Stale 94m). The Citizen Portal automatically switches to static life-safety survival protocols and redirects evacuees to the backup Morigaon Polytechnic shelter.',
    mathLogic:
      'R(t) = R₀ × (0.5)^(Δt / t_half) | Stale Threshold: Δt > 90 min => Trigger Alternate Shelter Routing',
    lifeImpact:
      'Families are prevented from arriving at an overwhelmed shelter in heavy rain and guided safely to verified backup camps.',
    recommendedView: 'citizen'
  },
  {
    id: 6,
    label: 'Stage 6: Zero-Trust Security Ledger',
    shortTag: '6. Zero Trust',
    icon: Lock,
    title: 'Unauthorized Penetration Block & Immutable Non-Repudiation Audit',
    problem:
      'During crisis chaos, an unauthorized probe (Guest_09) attempts an escalated database mutation against the central rescue asset registry to divert relief supplies.',
    automatedAction:
      'ResQnet\'s Zero-Trust guard intercepts the write, blocks it with HTTP 403 Forbidden, illuminates the emergency supervisor amber alert, and appends a tamper-evident SHA-256 cryptographic audit record to the permanent ledger.',
    mathLogic:
      'Zero-Trust Rule: Allow Write ONLY IF Role ∈ {SUPERVISOR, AUTHORIZED_OFFICER} ELSE Return 403 & Log Ledger',
    lifeImpact:
      'Guarantees relief food, medicines, and rescue boats cannot be tampered with or diverted by bad actors.',
    recommendedView: 'official',
    officialTab: 'privacy'
  },
  {
    id: 7,
    label: 'Stage 7: Mission Success & Audit',
    shortTag: '7. Final Audit',
    icon: CheckCircle2,
    title: '100% Ingestion Completeness & Automated Compliance Verification',
    problem:
      'Post-disaster oversight committees struggle to verify whether emergency systems met National Disaster Management Authority (NDMA) standards without tampering or missing records.',
    automatedAction:
      'The Automated Success Metrics Auditor performs a continuous automated scan across all vectors: 100% Request Ingestion Rate (0 critical requests lost), <3s Misinformation Latency (MTTR), 0 Public Data Leaks, and 100% Audit Compliance.',
    mathLogic:
      'Compliance Score: (IngestionScore × 0.35) + (MTTRScore × 0.35) + (ZeroLeakScore × 0.30) = 100% (AUDIT PASSED)',
    lifeImpact:
      'Complete end-to-end transparency, non-repudiation, and verifiable operational excellence across all response vectors.',
    recommendedView: 'combined'
  }
];

interface AutoPilotControllerProps {
  portalMode: 'citizen' | 'official' | 'developer' | 'combined';
  onSelectPortalMode: (mode: 'citizen' | 'official' | 'developer' | 'combined') => void;
  onSelectOfficialTab: (tab: 'map' | 'feed' | 'triage' | 'misinfo' | 'storeforward' | 'privacy' | 'media') => void;
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
  incidents: FusedIncident[];
  misinfoList: MisinformationItem[];
  storeForwardMessages: StoreForwardMessage[];
  globalSupervisorAlert: { id: string; requestedScope: string } | null;
}

export const AutoPilotController: React.FC<AutoPilotControllerProps> = ({
  portalMode,
  onSelectPortalMode,
  onSelectOfficialTab,
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
  incidents,
  misinfoList,
  storeForwardMessages,
  globalSupervisorAlert
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStageId, setCurrentStageId] = useState<number>(1);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1); // 1 = 6s, 2 = 3s, 0.5 = 12s
  const [countdownSeconds, setCountdownSeconds] = useState<number>(6);
  const [isHudExpanded, setIsHudExpanded] = useState<boolean>(true);
  const [hasCompletedLoop, setHasCompletedLoop] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStage = AUTO_PILOT_STAGES.find((s) => s.id === currentStageId) || AUTO_PILOT_STAGES[0];

  // Execute the actions associated with a stage
  const executeStageActions = (stageId: number) => {
    setCurrentStageId(stageId);
    const stage = AUTO_PILOT_STAGES.find((s) => s.id === stageId);
    if (!stage) return;

    // View adaptation so user sees the action live
    if (stage.recommendedView === 'combined') {
      onSelectPortalMode('combined');
    } else if (stage.recommendedView === 'official') {
      onSelectPortalMode('official');
      if (stage.officialTab) {
        onSelectOfficialTab(stage.officialTab);
      }
    } else if (stage.recommendedView === 'citizen') {
      onSelectPortalMode('citizen');
    }

    // Trigger state machines
    if (stageId === 1) {
      setIsLowNetwork(true);
    } else if (stageId === 2) {
      setIsLowNetwork(false);
      onTriggerBridgeDispute();
      onSelectOfficialTab('map');
    } else if (stageId === 3) {
      onTriggerOxygenDedup();
      onSelectOfficialTab('triage');
    } else if (stageId === 4) {
      onTriggerViralHoax();
      onSelectOfficialTab('misinfo');
      // Automatically debunk after brief pause to show MTTR
      setTimeout(() => {
        onDebunkHoax();
      }, 1600);
    } else if (stageId === 5) {
      onTriggerStaleShelter();
    } else if (stageId === 6) {
      onTriggerCyberBreach();
      onSelectOfficialTab('privacy');
    } else if (stageId === 7) {
      onSyncAllStoreForward();
      onSelectPortalMode('combined');
      setHasCompletedLoop(true);
    }
  };

  // Auto-play timer effect
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalTime = 1000;
    const stepDuration = Math.round(6 / speedMultiplier);

    setCountdownSeconds(stepDuration);

    timerRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          // Advance to next stage
          setCurrentStageId((curr) => {
            if (curr >= AUTO_PILOT_STAGES.length) {
              setIsPlaying(false);
              setHasCompletedLoop(true);
              return 1;
            }
            const next = curr + 1;
            executeStageActions(next);
            return next;
          });
          return stepDuration;
        }
        return prev - 1;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speedMultiplier]);

  const handleStartAutoPilot = () => {
    setIsPlaying(true);
    executeStageActions(currentStageId);
  };

  const handlePauseAutoPilot = () => {
    setIsPlaying(false);
  };

  const handleNextStage = () => {
    const next = currentStageId >= AUTO_PILOT_STAGES.length ? 1 : currentStageId + 1;
    executeStageActions(next);
    setCountdownSeconds(Math.round(6 / speedMultiplier));
  };

  const handlePrevStage = () => {
    const prev = currentStageId <= 1 ? AUTO_PILOT_STAGES.length : currentStageId - 1;
    executeStageActions(prev);
    setCountdownSeconds(Math.round(6 / speedMultiplier));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStageId(1);
    setHasCompletedLoop(false);
    onResetAllScenarios();
    setCountdownSeconds(Math.round(6 / speedMultiplier));
  };

  const handleSelectStageDirectly = (stageId: number) => {
    executeStageActions(stageId);
    setCountdownSeconds(Math.round(6 / speedMultiplier));
  };

  const IconComp = currentStage.icon;

  return (
    <section
      aria-label="ResQnet Autonomous Disaster Relief Engine"
      className="bg-black text-white border-b-2 border-amber-400 shadow-xl relative z-30 transition-all"
    >
      {/* 1. Controller Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Engine Identity & Auto-Play Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-mono font-black text-[11px] tracking-wider uppercase">
              AUTO-PILOT
            </span>
            <div className="flex items-center gap-1.5 font-extrabold text-neutral-100 text-xs">
              <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Automated Disaster Engine</span>
            </div>
          </div>

          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 shadow-xs">
            {isPlaying ? (
              <button
                type="button"
                onClick={handlePauseAutoPilot}
                className="px-3 py-1 bg-amber-400 text-black rounded font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                title="Pause automated walkthrough"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Auto-Pilot</span>
                <span className="font-mono text-[10px] bg-black/20 px-1.5 py-0.2 rounded ml-1">
                  {countdownSeconds}s
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartAutoPilot}
                className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-black rounded font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                title="Start autonomous end-to-end simulation"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Auto-Pilot</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrevStage}
              className="p-1 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded transition-colors"
              title="Previous phase"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleNextStage}
              className="p-1 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded transition-colors"
              title="Next phase"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors ml-0.5"
              title="Reset state to initial scenario"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Toggles */}
          <div className="hidden sm:flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-[11px] font-mono">
            {[
              { val: 0.5, label: '0.5x' },
              { val: 1, label: '1x' },
              { val: 2, label: '2x' }
            ].map((s) => (
              <button
                key={s.val}
                type="button"
                onClick={() => setSpeedMultiplier(s.val)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  speedMultiplier === s.val
                    ? 'bg-neutral-700 text-white font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Explainer Guide Modal Button & HUD Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenExplainerModal}
            className="px-3 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-amber-300 font-bold text-xs border border-amber-400/40 hover:border-amber-400 flex items-center gap-1.5 transition-colors shadow-xs"
            title="Read how ResQnet automates the entire disaster cycle"
          >
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>How ResQnet Automates It</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHudExpanded(!isHudExpanded)}
            className="p-1 hover:bg-neutral-900 rounded text-neutral-400 hover:text-white transition-colors"
            title={isHudExpanded ? 'Collapse Explainer HUD' : 'Expand Explainer HUD'}
          >
            {isHudExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Interactive Stage Timeline Rail */}
      <div className="border-t border-neutral-900 bg-neutral-950 px-4 py-2 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 min-w-[700px]">
          {AUTO_PILOT_STAGES.map((stage) => {
            const isActive = stage.id === currentStageId;
            const isPassed = stage.id < currentStageId || hasCompletedLoop;
            const StageIcon = stage.icon;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => handleSelectStageDirectly(stage.id)}
                className={`flex-1 flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${
                  isActive
                    ? 'bg-amber-400 text-black border-amber-300 font-bold shadow-md scale-[1.02]'
                    : isPassed
                    ? 'bg-neutral-900 text-neutral-200 border-neutral-800 hover:border-neutral-700'
                    : 'bg-black text-neutral-400 border-neutral-900 hover:border-neutral-800'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'bg-black text-amber-300 font-bold'
                      : isPassed
                      ? 'bg-emerald-950 text-emerald-400 font-medium'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {isPassed && !isActive ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <StageIcon className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="truncate">
                  <div className="text-[10px] uppercase font-mono tracking-wider opacity-80">
                    {stage.shortTag}
                  </div>
                  <div className="text-xs truncate font-semibold leading-tight">
                    {stage.label.split(': ')[1] || stage.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Understandable Live Explainer HUD Card */}
      {isHudExpanded && (
        <div className="border-t border-neutral-800 bg-gradient-to-b from-neutral-950 to-black px-4 py-3.5 text-xs">
          <div className="max-w-7xl mx-auto space-y-3">
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="font-mono text-amber-400 font-bold text-xs">
                  {currentStage.label}
                </span>
                <span className="text-neutral-500">|</span>
                <h3 className="font-bold text-white text-sm">{currentStage.title}</h3>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 font-mono text-[10px] border border-neutral-800">
                  Auto-View: {currentStage.recommendedView.toUpperCase()}
                  {currentStage.officialTab ? ` (${currentStage.officialTab.toUpperCase()})` : ''}
                </span>
              </div>
            </div>

            {/* The 4-Part Understandable Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Box 1: The Disaster Problem */}
              <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-red-300 font-bold text-[11px] uppercase tracking-wider">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>The Real Crisis Problem</span>
                </div>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  {currentStage.problem}
                </p>
              </div>

              {/* Box 2: What ResQnet Automated */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-[11px] uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>What ResQnet Automated</span>
                </div>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  {currentStage.automatedAction}
                </p>
              </div>

              {/* Box 3: Decision Logic / Formula */}
              <div className="p-3 bg-blue-950/20 border border-blue-900/50 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-blue-300 font-bold text-[11px] uppercase tracking-wider">
                  <Cpu className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Underlying Decision Formula</span>
                </div>
                <p className="text-blue-200/90 font-mono text-[10px] leading-relaxed break-words bg-blue-950/40 p-1.5 rounded border border-blue-900/60">
                  {currentStage.mathLogic}
                </p>
              </div>

              {/* Box 4: Human Life Outcome */}
              <div className="p-3 bg-amber-950/20 border border-amber-900/50 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px] uppercase tracking-wider">
                  <HeartPulse className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Human Life Impact</span>
                </div>
                <p className="text-neutral-300 text-[11px] leading-relaxed font-medium">
                  {currentStage.lifeImpact}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
