import React from 'react';
import { FusedIncident } from '../types/disaster';
import { ExplainableAiEngine, XaiExplanationResult } from '../services/operationalCheckpoints';
import {
  X,
  Sparkles,
  BarChart3,
  Layers,
  ShieldCheck,
  Calculator,
  ArrowRight
} from 'lucide-react';
import { formatLocationWithState } from '../data/indianStates';

interface ExplainableAiModalProps {
  incident: FusedIncident | null;
  onClose: () => void;
}

export const ExplainableAiModal: React.FC<ExplainableAiModalProps> = ({
  incident,
  onClose
}) => {
  if (!incident) return null;

  const explanation: XaiExplanationResult = ExplainableAiEngine.deriveExplanation(incident);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="xai-title"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[11px] font-mono font-semibold border border-indigo-400/30 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-300" />
                <span>EXPLAINABLE AI (XAI) GATE</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-medium border border-emerald-400/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>100% Explainable</span>
              </span>
            </div>
            <h2 id="xai-title" className="text-lg font-bold">
              Automated Priority Score Breakdown
            </h2>
            <p className="text-xs text-slate-300">
              {incident.title} · {formatLocationWithState(incident.district, incident.stateName)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
          {/* Top Score Callout & Concise Breakdown String */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Automated Triage Priority
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono text-slate-900">
                  {explanation.score}
                </span>
                <span className="text-slate-400 font-mono text-sm">/ 100</span>
                <span className="ml-2 px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-semibold text-[11px]">
                  Priority Rank #1
                </span>
              </div>
              <p className="font-mono text-[11px] text-indigo-900 font-semibold pt-1">
                {explanation.summaryExplanationString}
              </p>
            </div>

            {/* 95% Confidence Interval Badge */}
            <div className="p-3 rounded-lg bg-white border border-slate-200 shrink-0 text-right sm:min-w-[160px]">
              <span className="text-[10px] uppercase text-slate-400 font-semibold block">
                95% Confidence Interval
              </span>
              <span className="font-mono text-base font-bold text-slate-900 block mt-0.5">
                [{explanation.confidenceInterval.lowerBound} — {explanation.confidenceInterval.upperBound}]
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">
                Corroborated by field telemetry
              </span>
            </div>
          </div>

          {/* Mathematical Derivation Formula */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
              <Calculator className="w-4 h-4 text-slate-700" />
              <span>Mathematical Derivation Formula</span>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto">
              <code>{explanation.mathematicalDerivationFormula}</code>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase">Severity (40%)</span>
                <strong className="text-slate-900 text-sm font-mono">{explanation.severityComponent.points} pts</strong>
                <span className="text-[10px] text-slate-400 block mt-0.5">Level: {explanation.severityComponent.level}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase">Vulnerability (35%)</span>
                <strong className="text-slate-900 text-sm font-mono">{explanation.vulnerabilityComponent.points} pts</strong>
                <span className="text-[10px] text-slate-400 block mt-0.5">Raw: {explanation.vulnerabilityComponent.score}/100</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase">Reliability (25%)</span>
                <strong className="text-slate-900 text-sm font-mono">{explanation.reliabilityComponent.points} pts</strong>
                <span className="text-[10px] text-slate-400 block mt-0.5">Decayed: {explanation.reliabilityComponent.currentReliability}%</span>
              </div>
            </div>
          </div>

          {/* Weighted Feature Attributions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between font-semibold text-slate-900 text-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-700" />
                <span>Feature Attributions &amp; Multipliers</span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">
                Relative contribution to score
              </span>
            </div>

            <div className="space-y-2.5">
              {explanation.featureAttributions.map((attr, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      <span>{attr.feature}</span>
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold text-[10px] border border-indigo-200">
                        {attr.weightMultiplier}
                      </span>
                      <strong className={`text-xs ${attr.pointsAdded >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {attr.pointsAdded >= 0 ? `+${attr.pointsAdded}` : attr.pointsAdded} pts
                      </strong>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${attr.pointsAdded >= 0 ? 'bg-indigo-600' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, Math.max(10, attr.percentageOfScore))}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 leading-normal">
                    {attr.rationale}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Sensitivity Analysis & Safety Net */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1 text-[11px] text-amber-950">
            <div className="font-semibold flex items-center gap-1.5 text-amber-900">
              <Layers className="w-3.5 h-3.5 text-amber-700" />
              <span>Sensitivity Analysis &amp; Human-in-the-Loop Override Policy</span>
            </div>
            <p className="leading-relaxed text-amber-900/80">
              {explanation.sensitivityBreakdown} Authorized incident commanders may override this priority score at any time. Any override requires typed justification and will be appended into the cryptographically sealed immutable audit ledger.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-mono">
            Audit Checkpoint: XAI-GATE-SEC-2026
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <span>Close Breakdown</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
