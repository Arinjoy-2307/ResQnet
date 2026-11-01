import React from 'react';
import { FusedIncident, ReportPacket, SourceChannel } from '../types/disaster';
import { X } from 'lucide-react';
import { formatLocationWithState } from '../data/indianStates';

interface ProvenanceInspectorModalProps {
  incident: FusedIncident | null;
  onClose: () => void;
}

function formatReadableSource(ch: SourceChannel): string {
  switch (ch) {
    case 'citizen_sms': return 'Citizen SMS';
    case 'citizen_ussd': return 'Phone (*1070#)';
    case 'citizen_web': return 'Citizen Web Request';
    case 'sdrf_radio': return 'SDRF Field Team';
    case 'ndrf_agent': return 'NDRF Officer';
    case 'pwd_official': return 'PWD Roads';
    case 'cwc_gauge': return 'River Sensor';
    case 'imd_feed': return 'Weather Radar';
    case 'district_magistrate': return 'District Control';
    default: return ch;
  }
}

export const ProvenanceInspectorModal: React.FC<ProvenanceInspectorModalProps> = ({
  incident,
  onClose
}) => {
  if (!incident) return null;

  const friendlyStatus =
    incident.state === 'verified'
      ? 'Verified'
      : incident.state === 'corroborated'
      ? '2+ Reports'
      : incident.state === 'disputed'
      ? 'Conflicting'
      : 'Needs Check';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-300 flex items-center gap-2">
              <span className="font-semibold text-white">{friendlyStatus}</span>
              <span aria-hidden="true">·</span>
              <span>
                {incident.landmark ? `${incident.landmark}, ` : ''}
                {formatLocationWithState(incident.district, incident.stateName)}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white mt-0.5 leading-snug">
              {incident.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Strip */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 tabular-nums">
          <span>
            Reports received: <strong className="text-slate-900">{incident.provenanceTrail.length}</strong>
          </span>
          <span>
            Last update: <strong className="text-slate-900">{incident.ageMinutes} mins ago</strong> ({incident.currentReliability}% confidence)
          </span>
        </div>

        {/* Body: Clean Timeline of Who Reported What */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {incident.freshnessStatus === 'stale' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-950">
              <strong className="block mb-0.5">Outdated Report — Safe Action:</strong>
              <span>{incident.fallbackInstructions}</span>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {incident.provenanceTrail.map((packet: ReportPacket, index: number) => {
              const timeStr = new Date(packet.timestamp).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div key={packet.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-slate-900">Report #{index + 1}</strong>
                      <span aria-hidden="true">·</span>
                      <span>{formatReadableSource(packet.channel)}</span>
                      {packet.fromLiveDevice && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-emerald-700">Live Connected Device</span>
                        </>
                      )}
                      {(packet.isAuthorizedFieldAgent || packet.isOfficial) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-emerald-700">Official Team</span>
                        </>
                      )}
                    </div>

                    <span className="font-mono tabular-nums">{timeStr}</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">
                      {packet.headline}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {packet.details}
                    </p>
                  </div>

                  {packet.emergencyFormDetails && packet.emergencyFormDetails.length > 0 && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      {packet.emergencyFormDetails.map((item, idx) => (
                        <div key={idx}>
                          <span className="text-slate-400 block">{item.label}</span>
                          <strong className="text-slate-900">{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      From: <strong className="text-slate-800">{packet.reporterName}</strong> ({packet.reporterRole})
                    </span>
                    {packet.exactAddress && (
                      <span>
                        Address (For Rescue Team only):{' '}
                        <strong className="text-slate-800">{packet.exactAddress}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
