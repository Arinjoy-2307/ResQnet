import React, { useState, useEffect } from 'react';
import { FusedIncident, RouteMatrixDispatchEntry } from '../types/disaster';
import {
  Sliders,
  History,
  X,
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  Key,
  Ship,
  RefreshCw,
  Info
} from 'lucide-react';
import { LanguageCode } from '../services/i18n';
import { formatLocationWithState } from '../data/indianStates';
import { computeOfficerRouteMatrix, recordAuditLogOnServer } from '../services/realtimeClient';

interface OverrideLogEntry {
  blockIndex: number;
  incidentId: string;
  incidentTitle: string;
  responderName: string;
  originalScore: number;
  overriddenScore: number;
  justificationText: string;
  timestamp: number;
  signatureHex: string;
}

function buildOverrideHash(payload: string): string {
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `0x${(hash >>> 0).toString(16).padStart(8, '0').toUpperCase()}${payload.length
    .toString(16)
    .padStart(4, '0')
    .toUpperCase()}`;
}

interface TriageConsoleProps {
  incidents: FusedIncident[];
  onUpdateIncidentOverride: (
    incidentId: string,
    newScore: number,
    reason: string,
    responderName: string
  ) => void;
  language: LanguageCode;
  onOpenProvenance: (inc: FusedIncident) => void;
  authenticatedOfficerName?: string;
}

export const TriageConsole: React.FC<TriageConsoleProps> = ({
  incidents,
  onUpdateIncidentOverride,
  language: _language,
  onOpenProvenance,
  authenticatedOfficerName = 'Duty Officer'
}) => {
  const [selectedIncidentForOverride, setSelectedIncidentForOverride] =
    useState<FusedIncident | null>(null);
  const [selectedIncidentForFactors, setSelectedIncidentForFactors] =
    useState<FusedIncident | null>(null);
  const [overrideScore, setOverrideScore] = useState<number>(90);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [responderName, setResponderName] = useState<string>(authenticatedOfficerName);
  const [showAuditHistory, setShowAuditHistory] = useState<boolean>(false);
  const [overrideLogs, setOverrideLogs] = useState<OverrideLogEntry[]>([]);
  const [unlockedIncidentIds, setUnlockedIncidentIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setResponderName(authenticatedOfficerName);
  }, [authenticatedOfficerName]);

  const triageQueue = [...incidents]
    .filter((i) => !i.isQuarantined)
    .sort((a, b) => b.triagePriorityScore - a.triagePriorityScore);

  const [matrixEntries, setMatrixEntries] = useState<RouteMatrixDispatchEntry[]>([]);
  const [isComputingMatrix, setIsComputingMatrix] = useState<boolean>(false);

  const runDispatchRouteMatrix = async () => {
    const topTargets = triageQueue.slice(0, 3);
    if (topTargets.length === 0) {
      setMatrixEntries([]);
      return;
    }
    setIsComputingMatrix(true);

    const anchor = topTargets[0].coordinates;
    const districtLabel = topTargets[0].district || 'District';

    const origins = [
      {
        id: 'ASSET-BOAT-OXY-1',
        name: `${districtLabel} NDRF Boat 1 (Oxygen + Stretcher)`,
        assetType: 'rescue_boat' as const,
        hasOxygenSupply: true,
        lat: Number((anchor.lat + 0.024).toFixed(4)),
        lng: Number((anchor.lng - 0.018).toFixed(4))
      },
      {
        id: 'ASSET-BOAT-SDRF-2',
        name: `${districtLabel} SDRF High-Water Boat 2`,
        assetType: 'rescue_boat' as const,
        hasOxygenSupply: false,
        lat: Number((anchor.lat - 0.026).toFixed(4)),
        lng: Number((anchor.lng + 0.022).toFixed(4))
      },
      {
        id: 'ASSET-AMB-NDRF-3',
        name: `${districtLabel} Paramedic Van 3 (Oxygen)`,
        assetType: 'paramedic_van' as const,
        hasOxygenSupply: true,
        lat: Number((anchor.lat + 0.035).toFixed(4)),
        lng: Number((anchor.lng + 0.031).toFixed(4))
      }
    ];

    const destinations = topTargets.map((inc) => ({
      id: inc.id,
      title: inc.title,
      needsOxygen: inc.provenanceTrail.some((p) => p.vulnerabilityFactors?.needsOxygen),
      lat: inc.coordinates.lat,
      lng: inc.coordinates.lng
    }));

    const result = await computeOfficerRouteMatrix({ origins, destinations });
    if (result?.entries) {
      setMatrixEntries(result.entries);
    }
    setIsComputingMatrix(false);
  };

  useEffect(() => {
    void runDispatchRouteMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triageQueue.length]);

  const handleToggleAddressReveal = async (incident: FusedIncident) => {
    const currentlyUnlocked = Boolean(unlockedIncidentIds[incident.id]);
    const nextState = !currentlyUnlocked;
    setUnlockedIncidentIds((prev) => ({ ...prev, [incident.id]: nextState }));

    if (nextState) {
      await recordAuditLogOnServer({
        userId: authenticatedOfficerName,
        userName: authenticatedOfficerName,
        role: 'Rescue Coordinator',
        requestedScope: `Viewed pickup location for ${incident.id}`,
        outcome: 'granted',
        reason: 'Priority dispatch pickup coordination'
      });
    }
  };

  const handleApplyOverride = () => {
    if (!selectedIncidentForOverride) return;

    const trimmed = overrideReason.trim();
    if (trimmed.length < 15) {
      setOverrideError('Please enter a brief operational reason (at least 15 characters).');
      return;
    }

    const now = Date.now();
    const prevHash = overrideLogs[0]?.signatureHex || '0x000000000000';
    const sig = buildOverrideHash(
      `${prevHash}|${selectedIncidentForOverride.id}|${overrideScore}|${trimmed}|${now}`
    );

    const nextEntry: OverrideLogEntry = {
      blockIndex: overrideLogs.length + 1,
      incidentId: selectedIncidentForOverride.id,
      incidentTitle: selectedIncidentForOverride.title,
      responderName: responderName.trim() || authenticatedOfficerName,
      originalScore: selectedIncidentForOverride.triagePriorityScore,
      overriddenScore: overrideScore,
      justificationText: trimmed,
      timestamp: now,
      signatureHex: sig
    };

    setOverrideLogs((prev) => [nextEntry, ...prev]);
    onUpdateIncidentOverride(
      selectedIncidentForOverride.id,
      overrideScore,
      trimmed,
      responderName.trim() || authenticatedOfficerName
    );
    setSelectedIncidentForOverride(null);
    setOverrideReason('');
    setOverrideError(null);
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Priority Rescue &amp; Dispatch Queue
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Orders live emergency requests by medical urgency, vulnerability, and report verification so critical pickups go first.
          </p>
        </div>

        <button
          onClick={() => setShowAuditHistory(!showAuditHistory)}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto shadow-xs tabular-nums"
        >
          <History className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {showAuditHistory
              ? 'Hide Priority Change Log'
              : `Priority Change Log (${overrideLogs.length})`}
          </span>
        </button>
      </div>

      {/* Multi-Origin Boat & Ambulance Dispatch Matrix */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl space-y-3.5 text-xs shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Ship className="w-4 h-4 text-slate-900" />
              <strong className="text-sm font-bold text-slate-900">
                Boat &amp; Ambulance Route ETAs
              </strong>
              <span className="text-[11px] text-slate-500">
                · Google Maps Routes Matrix
              </span>
            </div>
            <p className="text-slate-600 mt-0.5">
              Calculates travel distances and estimated arrival times from nearby staging units to top-priority emergencies.
            </p>
          </div>

          {triageQueue.length > 0 && (
            <button
              type="button"
              onClick={() => void runDispatchRouteMatrix()}
              disabled={isComputingMatrix}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isComputingMatrix ? 'animate-spin' : ''}`} />
              <span>{isComputingMatrix ? 'Calculating…' : 'Refresh ETAs'}</span>
            </button>
          )}
        </div>

        {triageQueue.length === 0 ? (
          <div className="text-slate-500 py-3">
            No active emergencies in the queue yet. Route ETAs will appear automatically as soon as a citizen SOS or field report arrives.
          </div>
        ) : matrixEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Staging Rescue Unit</th>
                  <th className="py-2 px-3 font-semibold">Emergency Request</th>
                  <th className="py-2 px-3 font-semibold text-right">Distance</th>
                  <th className="py-2 px-3 font-semibold text-right">Estimated ETA</th>
                  <th className="py-2 pl-3 font-semibold text-right">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {matrixEntries
                  .filter((e) => e.recommended)
                  .concat(matrixEntries.filter((e) => !e.recommended).slice(0, 3))
                  .slice(0, 6)
                  .map((entry, idx) => (
                    <tr
                      key={`${entry.originId}-${entry.destinationId}-${idx}`}
                      className={entry.recommended ? 'bg-emerald-50/50' : ''}
                    >
                      <td className="py-2.5 pr-3 font-medium text-slate-900">
                        <div>{entry.originName}</div>
                        <div className="text-[11px] text-slate-500 font-normal">
                          {entry.hasOxygenSupply ? 'Oxygen Cylinders Onboard' : 'Standard High-Water Boat'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 max-w-[240px] truncate">
                        {entry.destinationTitle}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                        {entry.distanceKm} km
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ~{entry.durationMinutes} min
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {entry.recommended ? (
                          <span className="font-semibold text-emerald-700">Best Match</span>
                        ) : (
                          <span className="text-slate-400">Standby</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-slate-500 py-2">
            Calculating optimal boat and ambulance routes…
          </div>
        )}
      </div>

      {/* Priority Override Log */}
      {showAuditHistory && (
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 text-xs shadow-xs">
          <div className="border-b border-slate-100 pb-2.5">
            <strong className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Officer Priority Change Log</span>
            </strong>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Records every manual priority adjustment made during this operational watch with officer name and written reason.
            </p>
          </div>

          {overrideLogs.length === 0 ? (
            <div className="py-4 text-slate-500">
              No manual priority changes have been recorded in this session yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overrideLogs.map((entry) => (
                <div key={entry.blockIndex} className="py-3 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[10px]">
                        #{entry.blockIndex}
                      </span>
                      <strong className="text-slate-900">{entry.incidentTitle}</strong>
                    </div>
                    <div className="font-mono text-xs tabular-nums shrink-0">
                      <span className="text-slate-400 line-through mr-2">{entry.originalScore}</span>
                      <strong className="text-emerald-700">{entry.overriddenScore}/100</strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 space-y-1">
                    <div>
                      <span className="text-slate-500 font-semibold">Reason: </span>
                      <span className="text-slate-900">"{entry.justificationText}"</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 font-mono tabular-nums">
                      <span>Officer: <strong className="text-slate-800">{entry.responderName}</strong></span>
                      <span>Time: {new Date(entry.timestamp).toLocaleTimeString('en-IN')}</span>
                      <span>Audit Hash: <code className="text-emerald-800 font-bold">{entry.signatureHex}</code></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prioritized Dispatch Queue */}
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-xs">
        {triageQueue.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <h3 className="text-sm font-bold text-slate-900">
              Priority Queue Is Clear
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Incoming citizen SOS requests and field reports are automatically ranked here by medical urgency, vulnerability, and source reliability.
            </p>
          </div>
        ) : (
          triageQueue.map((incident, index) => {
            const hasOverride = !!incident.responderOverride;
            const needsOxygen = incident.provenanceTrail.some((p) => p.vulnerabilityFactors?.needsOxygen);
            const isElderly = incident.provenanceTrail.some((p) => p.vulnerabilityFactors?.isElderlyAlone);
            const isBedridden = incident.provenanceTrail.some((p) => p.vulnerabilityFactors?.isBedridden);
            const callCount = incident.provenanceTrail.length;
            const isUnlocked = Boolean(unlockedIncidentIds[incident.id]);
            const rawAddress =
              incident.provenanceTrail[0]?.exactAddress || `${incident.landmark}, ${incident.district}`;

            return (
              <div key={incident.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        #{index + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {incident.landmark ? `${incident.landmark}, ` : ''}
                        {formatLocationWithState(incident.district, incident.stateName)}
                      </span>
                      {callCount > 1 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-600 font-medium tabular-nums">
                            {callCount} reports combined
                          </span>
                        </>
                      )}
                      {hasOverride && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-amber-700">Adjusted by Officer</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      {incident.title}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {incident.provenanceTrail[0]?.details || incident.title}
                    </p>

                    {/* Plain-language Priority Scoring Breakdown */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-700 tabular-nums">
                        <span>
                          Severity: <strong className="text-slate-900 uppercase">{incident.severityLevel}</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Vulnerability: <strong className="text-slate-900">{incident.vulnerabilityScore}/100</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Confidence: <strong className="text-slate-900">{incident.currentReliability}%</strong>
                        </span>
                        {(needsOxygen || isElderly || isBedridden) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-red-700 font-semibold">
                              {[
                                needsOxygen ? 'Oxygen Needed' : null,
                                isBedridden ? 'Bedridden' : null,
                                isElderly ? 'Senior Citizen' : null
                              ]
                                .filter(Boolean)
                                .join(' + ')}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedIncidentForFactors(incident)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <Info className="w-3 h-3 text-slate-500" />
                        <span>Score Factors</span>
                      </button>
                    </div>

                    {/* Protected Pickup Address Panel */}
                    <div
                      className={`mt-2 p-3 rounded-lg border text-xs space-y-2 transition-colors ${
                        isUnlocked
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {isUnlocked ? (
                            <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>
                            {isUnlocked ? 'Pickup Location Unlocked (Logged)' : 'Pickup Location Protected'}
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() => void handleToggleAddressReveal(incident)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${
                            isUnlocked
                              ? 'bg-white hover:bg-slate-100 border border-slate-300 text-slate-700'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          {isUnlocked ? (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>Hide Address</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 text-amber-400" />
                              <span>Show Pickup Address</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 font-mono tabular-nums">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-sans">
                            GPS Coordinates
                          </span>
                          <span className="font-semibold text-slate-900">
                            {isUnlocked
                              ? `${incident.coordinates.lat.toFixed(4)}° N, ${incident.coordinates.lng.toFixed(4)}° E`
                              : `${incident.coordinates.lat.toFixed(2)}••° N, ${incident.coordinates.lng.toFixed(2)}••° E`}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-sans">
                            Exact Pickup Address
                          </span>
                          <span className="font-semibold text-slate-900 font-sans">
                            {isUnlocked
                              ? rawAddress
                              : `${incident.landmark || incident.district} (Exact house hidden)`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="mr-2 tabular-nums">
                      <span className="text-slate-400 block text-[11px]">Priority</span>
                      <strong className="text-lg font-mono text-slate-900">
                        {incident.triagePriorityScore}/100
                      </strong>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedIncidentForOverride(incident);
                        setOverrideScore(incident.triagePriorityScore);
                        setOverrideError(null);
                      }}
                      className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-2xs"
                    >
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      <span>Adjust Priority</span>
                    </button>

                    <button
                      onClick={() => onOpenProvenance(incident)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shadow-xs"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Adjust Priority Modal */}
      {selectedIncidentForOverride && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Adjust Rescue Priority</h3>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-sm">
                  {selectedIncidentForOverride.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedIncidentForOverride(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between font-mono tabular-nums">
                <span>
                  Current Score: <strong>{selectedIncidentForOverride.triagePriorityScore}/100</strong>
                </span>
                <span className="text-slate-400">→</span>
                <span className="text-emerald-700 font-bold">New Score: {overrideScore}/100</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1.5 tabular-nums">
                  Updated Priority Score:{' '}
                  <strong className="text-slate-900 font-mono">{overrideScore}/100</strong>
                </label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(Number(e.target.value))}
                  className="w-full accent-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 tabular-nums">
                  <label className="font-semibold text-slate-800">
                    Operational Reason (Min 15 characters)
                  </label>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      overrideReason.trim().length >= 15 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {overrideReason.trim().length} / 15
                  </span>
                </div>
                <textarea
                  value={overrideReason}
                  onChange={(e) => {
                    setOverrideReason(e.target.value);
                    if (overrideError) setOverrideError(null);
                  }}
                  placeholder="Describe why this request needs higher or lower dispatch priority..."
                  rows={3}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900 font-sans"
                  required
                />
                {overrideError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{overrideError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Officer Name
                </label>
                <input
                  type="text"
                  value={responderName}
                  onChange={(e) => setResponderName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900 font-sans"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedIncidentForOverride(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyOverride}
                  disabled={overrideReason.trim().length < 15}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Save Priority Change</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plain-Language Score Factors Modal */}
      {selectedIncidentForFactors && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Priority Score Breakdown</h3>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                  {selectedIncidentForFactors.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedIncidentForFactors(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Close breakdown"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs tabular-nums">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Base Incident Severity</span>
                <strong className="text-slate-900 uppercase">
                  {selectedIncidentForFactors.severityLevel}
                </strong>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Household Vulnerability Factor</span>
                <strong className="text-slate-900">
                  {selectedIncidentForFactors.vulnerabilityScore} / 100
                </strong>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Source Confidence &amp; Freshness</span>
                <strong className="text-slate-900">
                  {selectedIncidentForFactors.currentReliability}% ({selectedIncidentForFactors.ageMinutes}m ago)
                </strong>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Corroborating Reports</span>
                <strong className="text-slate-900">
                  {selectedIncidentForFactors.provenanceTrail.length}
                </strong>
              </div>
              {selectedIncidentForFactors.responderOverride && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                  <strong className="block">Manual Officer Adjustment Active</strong>
                  <p>{selectedIncidentForFactors.responderOverride.reason}</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-slate-900">Final Queue Priority</span>
                <strong className="text-base font-mono text-slate-900">
                  {selectedIncidentForFactors.triagePriorityScore} / 100
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
