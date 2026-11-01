import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Radio,
  GitCompare,
  HeartPulse,
  ShieldAlert,
  Clock,
  Lock,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Info,
  PhoneCall,
  MapPin,
  Flame,
  FileCheck2
} from 'lucide-react';
import { AUTO_PILOT_STAGES } from './AutoPilotController';

interface AutomatedProcessExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchStageFromModal: (stageId: number) => void;
}

export const AutomatedProcessExplainerModal: React.FC<AutomatedProcessExplainerModalProps> = ({
  isOpen,
  onClose,
  onLaunchStageFromModal
}) => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'stages' | 'math' | 'faq'>('pipeline');
  const [selectedStageId, setSelectedStageId] = useState<number>(1);

  if (!isOpen) return null;

  const currentStage = AUTO_PILOT_STAGES.find((s) => s.id === selectedStageId) || AUTO_PILOT_STAGES[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explainer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-950 text-white p-5 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-extrabold uppercase tracking-wide">
                SYSTEM EXPLAINER
              </span>
              <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                ResQnet Autonomous Disaster Response Pipeline
              </span>
            </div>
            <h2 id="explainer-modal-title" className="text-lg sm:text-xl font-bold text-white">
              How ResQnet Automates Disaster Relief in Seconds
            </h2>
            <p className="text-xs text-slate-400">
              Plain-language overview of the end-to-end multi-source fusion engine, mathematical safeguards, and automated life-safety decisions.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
            aria-label="Close explainer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 flex items-center gap-2 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'pipeline', label: '1. Autonomous Pipeline Diagram' },
            { id: 'stages', label: '2. Step-by-Step Walkthrough' },
            { id: 'math', label: '3. Mathematical Safeguards' },
            { id: 'faq', label: '4. Traditional vs ResQnet' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-amber-500 text-slate-950 font-bold bg-white -mb-px rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 text-sm text-slate-700">
          {/* TAB 1: PIPELINE DIAGRAM */}
          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-bold text-amber-900">Why ResQnet Was Built:</strong>
                  <p>
                    In severe disasters like the Assam Brahmaputra floods, cell towers collapse, phone lines flood with duplicate cries for help, opposing field reports cause dangerous bottlenecks, and panic rumors spread across WhatsApp.
                    ResQnet automates the entire ingestion, corroboration, deconfliction, and dispatch pipeline without human delay.
                  </p>
                </div>
              </div>

              {/* Visual Pipeline Flow */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                {[
                  {
                    step: 1,
                    title: 'Multi-Channel Ingest',
                    desc: 'SMS, USSD (*1070#), HF Radio, Satellite Beacons',
                    color: 'border-emerald-500 bg-emerald-50 text-emerald-950'
                  },
                  {
                    step: 2,
                    title: 'Geohash Dedup',
                    desc: 'Fuses 3+ duplicates of same victim into 1 record',
                    color: 'border-blue-500 bg-blue-50 text-blue-950'
                  },
                  {
                    step: 3,
                    title: 'Dispute Detection',
                    desc: 'Catches PWD vs SDRF opposing claims instantly',
                    color: 'border-rose-500 bg-rose-50 text-rose-950'
                  },
                  {
                    step: 4,
                    title: 'Anti-Hoax Quarantine',
                    desc: 'Isolates fake dam collapse rumors in 0s with 0 leak',
                    color: 'border-purple-500 bg-purple-50 text-purple-950'
                  },
                  {
                    step: 5,
                    title: 'Time-Decay Filter',
                    desc: 'Decays stale (>90m) camp data to safe offline advice',
                    color: 'border-amber-500 bg-amber-50 text-amber-950'
                  },
                  {
                    step: 6,
                    title: 'Zero-Trust Audit',
                    desc: 'Blocks rogue DB writes & appends SHA-256 ledger',
                    color: 'border-indigo-500 bg-indigo-50 text-indigo-950'
                  }
                ].map((item, idx) => (
                  <div
                    key={item.step}
                    className={`p-3 rounded-xl border-2 ${item.color} flex flex-col justify-between space-y-2 relative`}
                  >
                    <div>
                      <div className="font-mono text-[10px] font-bold opacity-75">
                        PHASE {item.step}
                      </div>
                      <div className="font-bold text-xs mt-0.5 leading-snug">{item.title}</div>
                      <p className="text-[11px] opacity-85 mt-1 leading-tight">{item.desc}</p>
                    </div>
                    {idx < 5 && (
                      <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-slate-400">
                        →
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Three Core Guarantees Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Zero Data Loss (100% Ingestion)</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Store-and-forward SQLite/IndexedDB buffers guarantee no citizen text message or USSD ping is ever dropped, even with 40% cell packet loss.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <ShieldAlert className="w-4 h-4 text-purple-600" />
                    <span>Zero Public Hoax Exposure</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    High-velocity unverified rumors are automatically quarantined before reaching public maps, quashed via SMS/IVR counter-broadcasts in &lt;3 seconds.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <HeartPulse className="w-4 h-4 text-red-600" />
                    <span>Deterministic Medical Triage</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Oxygen-dependent patients and bedridden citizens automatically leapfrog general property damage to Rank #1 with 100/100 priority score.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STEP-BY-STEP WALKTHROUGH */}
          {activeTab === 'stages' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Stage Selector */}
              <div className="space-y-1.5 md:border-r md:border-slate-200 md:pr-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Select a Simulation Stage:
                </h4>
                {AUTO_PILOT_STAGES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStageId(s.id)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                      selectedStageId === s.id
                        ? 'bg-slate-950 text-white border-slate-950 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-xs font-bold shrink-0 opacity-75">
                        #{s.id}
                      </span>
                      <span className="text-xs font-medium truncate">{s.shortTag}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  </button>
                ))}
              </div>

              {/* Right Column: Detailed Card for Selected Stage */}
              <div className="md:col-span-2 space-y-4">
                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-1">
                  <span className="font-mono text-[11px] text-amber-400 font-bold uppercase">
                    {currentStage.label}
                  </span>
                  <h3 className="text-base font-bold text-white">{currentStage.title}</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                    <strong className="text-red-900 font-bold block">The Disaster Problem:</strong>
                    <p className="text-red-950">{currentStage.problem}</p>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                    <strong className="text-emerald-900 font-bold block">What ResQnet Automates:</strong>
                    <p className="text-emerald-950">{currentStage.automatedAction}</p>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1 text-xs">
                  <strong className="text-blue-900 font-bold block">Algorithmic Formulation:</strong>
                  <code className="block p-2 bg-blue-100/70 border border-blue-200 rounded font-mono text-[11px] text-blue-950">
                    {currentStage.mathLogic}
                  </code>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs">
                  <strong className="text-amber-900 font-bold block">Human Life Impact:</strong>
                  <p className="text-amber-950">{currentStage.lifeImpact}</p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onLaunchStageFromModal(currentStage.id);
                      onClose();
                    }}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Run This Stage Live in App</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MATHEMATICAL SAFEGUARDS */}
          {activeTab === 'math' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h3 className="font-bold text-sm text-slate-900">
                  1. Half-Life Time-Decay Equation (Physics-Inspired Information Decay)
                </h3>
                <p className="text-slate-600">
                  Disaster information has an expiration date. An open road at 10:00 AM may be submerged by 11:30 AM. Rather than trusting static numbers, ResQnet dynamically decays credibility score continuously:
                </p>
                <div className="p-3 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-900">
                  R(t) = R_base × (0.5)^(Δt / HalfLife)
                </div>
                <p className="text-slate-500">
                  When age Δt &gt; 90 minutes, reliability drops below 40%, flagging the incident as STALE and triggering automated offline life-safety survival advice.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h3 className="font-bold text-sm text-slate-900">
                  2. Life-Safety Medical Triage Priority Weighting
                </h3>
                <p className="text-slate-600">
                  Priorities are never arbitrary. ResQnet applies a multi-factor triage priority score out of 100:
                </p>
                <div className="p-3 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-900">
                  Score = (SeverityScore × 0.40) + (VulnerabilityScore × 0.40) + (ReliabilityScore × 0.20)
                </div>
                <p className="text-slate-500">
                  Critical medical emergencies (e.g. COPD patient with &lt;2 hours oxygen) receive maximum severity and vulnerability multipliers (100 and 100), guaranteeing Rank #1 status over property or road issues.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h3 className="font-bold text-sm text-slate-900">
                  3. Conservative Dispute Penalty Factor
                </h3>
                <p className="text-slate-600">
                  When two official agencies submit contradictory status reports (e.g., PWD vs SDRF on bridge usability), ResQnet never "averages" them. It adopts a conservative life-safety rule:
                </p>
                <div className="p-3 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-900">
                  Reliability = min(Reliability_A, Reliability_B) × 0.45 | Status = "Disputed" | Detour = Required
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TRADITIONAL VS RESQNET */}
          {activeTab === 'faq' && (
            <div className="space-y-4 text-xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 rounded-lg">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 text-left font-bold">
                      <th className="p-3 border-b border-slate-200">Disaster Challenge</th>
                      <th className="p-3 border-b border-slate-200 text-red-900 bg-red-50/50">
                        Traditional Response
                      </th>
                      <th className="p-3 border-b border-slate-200 text-emerald-900 bg-emerald-50/50">
                        ResQnet Autonomous Engine
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Mobile Towers Flooded</td>
                      <td className="p-3 text-red-900 bg-red-50/20">
                        Citizen apps fail with "No Internet" errors; calls drop.
                      </td>
                      <td className="p-3 text-emerald-900 bg-emerald-50/20">
                        Store-and-forward SQLite buffer stores SMS &amp; *1070# pings; auto-syncs on signal pulse.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Conflicting Road Reports</td>
                      <td className="p-3 text-red-900 bg-red-50/20">
                        Ambulances drive onto washed-out bridges based on outdated morning reports.
                      </td>
                      <td className="p-3 text-emerald-900 bg-emerald-50/20">
                        Immediate contradiction detection; drops confidence to 45% &amp; renders safe Google Maps detour.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Duplicate Distress Calls</td>
                      <td className="p-3 text-red-900 bg-red-50/20">
                        3 rescue boats dispatched to the same house while other sectors drown.
                      </td>
                      <td className="p-3 text-emerald-900 bg-emerald-50/20">
                        Geohash &amp; signature deduplication merges multiple calls into 1 incident with Rank #1 priority.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Fake Dam Collapse Rumor</td>
                      <td className="p-3 text-red-900 bg-red-50/20">
                        Takes 4 hours to debunk while panicking crowds cause stampedes.
                      </td>
                      <td className="p-3 text-emerald-900 bg-emerald-50/20">
                        Auto-quarantine keeps rumor at 0 public leak; sensor-checked counter-broadcast sent in &lt;3 seconds.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Complies with NDMA National Disaster Response Guidelines</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors shadow-xs"
            >
              Close Explainer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
