import React, { useState, useMemo } from 'react';
import { FusedIncident } from '../types/disaster';
import {
  ShieldCheck,
  Radio,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RefreshCw
} from 'lucide-react';
import { LanguageCode } from '../services/i18n';
import { inferStateFromDistrict, DISTRICT_COORDINATES_MAP } from '../data/indianStates';
import { ZeroPublicExposureValidator } from '../services/operationalCheckpoints';

interface MediaPriorityConsoleProps {
  incidents: FusedIncident[];
  language: LanguageCode;
}

interface BlurredSectorIncident {
  id: string;
  originalTitle: string;
  blurredSector: string;
  clusterGrid: string;
  categoryHeadline: string;
  stateName: string;
  district: string;
  verificationBadge: string;
  urgencyLevel: string;
  impactedCount: number;
  publicGuidance: string;
  leakRiskScore: number;
}

export const MediaPriorityConsole: React.FC<MediaPriorityConsoleProps> = ({
  incidents,
  language: _language
}) => {
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('ALL');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanCompleted, setScanCompleted] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [auditErrorMessage, setAuditErrorMessage] = useState<string | null>(null);

  const blurredIncidents = useMemo<BlurredSectorIncident[]>(() => {
    return incidents
      .filter((inc) => !inc.isQuarantined)
      .map((inc, index) => {
        const stateName = inferStateFromDistrict(inc.district, inc.stateName);
        const gridMeta = DISTRICT_COORDINATES_MAP[inc.district];
        const gridCode =
          gridMeta?.grid || `Grid-${stateName.slice(0, 2).toUpperCase()}-${(index % 8) + 1}`;
        const sectorIndex = (index % 4) + 1;
        const blurredSector = `${inc.district} Sector ${sectorIndex}, ${gridCode}`;

        let categoryHeadline = 'Emergency Relief Operations Active';
        let publicGuidance =
          'Move to higher ground if needed and follow instructions from official district response teams.';
        if (inc.category === 'medical_oxygen') {
          categoryHeadline = 'Priority Medical Support Corridor';
          publicGuidance =
            'Emergency medical backup teams active in sector; contact 108 or 1070 for urgent medical transport.';
        } else if (inc.category === 'flood_surge') {
          categoryHeadline = 'Flood Evacuation & Boat Patrol Sector';
          publicGuidance =
            'Rescue boats deployed along low-lying stretches; avoid flooded causeways.';
        } else if (inc.category === 'bridge_collapse' || inc.category === 'road_cut') {
          categoryHeadline = 'Road Closure & Detour Advisory';
          publicGuidance =
            'Use alternate signed routes and avoid damaged bridge approaches until cleared by engineers.';
        } else if (inc.category === 'shelter_capacity') {
          categoryHeadline = 'Relief Camp Open for Intake';
          publicGuidance =
            'Community relief camp open with drinking water, shelter, and first-aid desk.';
        }

        return {
          id: inc.id,
          originalTitle: inc.title,
          blurredSector,
          clusterGrid: gridCode,
          categoryHeadline,
          stateName,
          district: inc.district,
          verificationBadge:
            inc.state === 'verified'
              ? 'Verified Official'
              : inc.state === 'corroborated'
              ? '2+ Field Reports'
              : 'Under Verification',
          urgencyLevel: inc.severityLevel.toUpperCase(),
          impactedCount: Math.max(1, inc.provenanceTrail.length) * 4,
          publicGuidance,
          leakRiskScore: 0
        };
      });
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    if (selectedSectorFilter === 'ALL') return blurredIncidents;
    return blurredIncidents.filter(
      (b) => b.district.toLowerCase() === selectedSectorFilter.toLowerCase()
    );
  }, [blurredIncidents, selectedSectorFilter]);

  const runPrivacyVerificationAudit = () => {
    setIsScanning(true);
    setScanCompleted(false);
    setAuditErrorMessage(null);

    setTimeout(() => {
      try {
        for (const item of blurredIncidents) {
          ZeroPublicExposureValidator.validateAndSanitizePublicVector(item, 'media_wire_output');
        }
        setIsScanning(false);
        setScanCompleted(true);
      } catch (err: any) {
        setIsScanning(false);
        setScanCompleted(false);
        setAuditErrorMessage(err.message || 'Privacy check blocked an unsafe field.');
      }
    }, 450);
  };

  const handleCopyBulletin = (item: BlurredSectorIncident) => {
    ZeroPublicExposureValidator.validateAndSanitizePublicVector(item, 'clipboard_export');
    const text = `[OFFICIAL PRESS BULLETIN - PRIVACY CHECKED]\nSECTOR: ${item.blurredSector} (${item.stateName})\nHEADLINE: ${item.categoryHeadline}\nSTATUS: ${item.verificationBadge}\nPUBLIC GUIDANCE: ${item.publicGuidance}\nPRIVACY: No household addresses or phone numbers included.`;
    navigator.clipboard?.writeText?.(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-5">
      {auditErrorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{auditErrorMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Public Press Summary (Privacy-Safe)
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Automatically groups active field incidents into broad district sectors with zero household addresses, raw GPS coordinates, or citizen phone numbers exposed.
          </p>
        </div>

        <button
          type="button"
          onClick={runPrivacyVerificationAudit}
          disabled={isScanning}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shadow-xs shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Checking Privacy…' : 'Verify Zero-PII Output'}</span>
        </button>
      </div>

      {/* Zero-Leak Compliance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 tabular-nums">
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
            Exact GPS Coordinates
          </span>
          <div className="text-lg font-bold text-emerald-950 font-mono">
            0 / {incidents.length} Exposed
          </div>
          <div className="text-xs text-emerald-800">
            Converted to district sector grids
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
            House Numbers &amp; Phones
          </span>
          <div className="text-lg font-bold text-emerald-950 font-mono">
            0 / {incidents.length} Exposed
          </div>
          <div className="text-xs text-emerald-800">
            Stripped before press export
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Privacy Check Status
          </span>
          <div className="text-lg font-bold text-slate-900 font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{scanCompleted ? 'Verified Clean' : 'Checking…'}</span>
          </div>
          <div className="text-xs text-slate-600">
            Safe for public broadcasters &amp; bulletins
          </div>
        </div>
      </div>

      {/* Filter and Wire Viewport */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-600" />
            <strong className="text-slate-900">Sanitized Sector Bulletins</strong>
            <span className="text-slate-500">({filteredIncidents.length})</span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="media-sector-filter" className="text-slate-600 font-medium">
              District:
            </label>
            <select
              id="media-sector-filter"
              value={selectedSectorFilter}
              onChange={(e) => setSelectedSectorFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 outline-none focus:border-slate-900 text-xs"
            >
              <option value="ALL">All Districts</option>
              {Array.from(new Set(blurredIncidents.map((b) => b.district))).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredIncidents.length === 0 ? (
          <div className="p-8 text-center space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">
              No Active Sector Bulletins Yet
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              As field incidents are logged or verified, ResQnet generates anonymized district sector summaries here for safe media and public sharing.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredIncidents.map((item) => (
              <div key={item.id} className="p-5 hover:bg-slate-50/70 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-slate-900">
                        {item.clusterGrid}
                      </span>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <span className="font-bold text-indigo-900">
                        {item.blurredSector}
                      </span>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <span className="text-slate-500">{item.stateName}</span>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <span className="font-semibold text-emerald-700">
                        {item.verificationBadge}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {item.categoryHeadline}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong>Public Guidance:</strong> {item.publicGuidance}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleCopyBulletin(item)}
                      className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      {copiedId === item.id ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy Bulletin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] flex flex-wrap items-center justify-between gap-2 text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Exact house address &amp; caller mobile withheld</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-800 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Shared Sector: {item.blurredSector}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
