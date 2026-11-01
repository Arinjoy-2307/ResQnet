import React, { useState } from 'react';
import {
  FusedIncident,
  CredibilityState,
  SourceChannel
} from '../types/disaster';
import {
  Search,
  RefreshCw,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { LanguageCode, translations } from '../services/i18n';
import {
  INDIAN_STATES_ONLY,
  INDIAN_UTS_ONLY,
  inferStateFromDistrict,
  formatLocationWithState
} from '../data/indianStates';

interface FusionFeedProps {
  incidents: FusedIncident[];
  onOpenProvenance: (inc: FusedIncident) => void;
  onRefreshIncidentPing: (incidentId: string) => void;
  language: LanguageCode;
  selectedStateFilter: string;
  setSelectedStateFilter: (state: string) => void;
  isRealtimeConnected?: boolean;
  connectedOfficerTabs?: number;
  onOpenIngestModal?: () => void;
}

export const FusionFeed: React.FC<FusionFeedProps> = ({
  incidents,
  onOpenProvenance,
  onRefreshIncidentPing,
  language,
  selectedStateFilter,
  setSelectedStateFilter,
  isRealtimeConnected = false,
  connectedOfficerTabs = 1,
  onOpenIngestModal
}) => {
  const t = translations[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedIndianState, setSelectedIndianState] = useState<string>('ALL');

  const liveDeviceIncidentsCount = incidents.filter((inc) =>
    inc.provenanceTrail.some((p) => p.fromLiveDevice)
  ).length;

  const filteredIncidents = incidents.filter((inc) => {
    if (selectedStateFilter === 'live_devices') {
      if (!inc.provenanceTrail.some((p) => p.fromLiveDevice)) return false;
    } else if (selectedStateFilter !== 'all' && inc.state !== selectedStateFilter) {
      return false;
    }

    if (selectedIndianState !== 'ALL') {
      const incState = inferStateFromDistrict(inc.district, inc.stateName);
      if (incState.toLowerCase() !== selectedIndianState.toLowerCase()) return false;
    }

    if (selectedChannel !== 'all') {
      const hasChannel = inc.provenanceTrail.some((p) => p.channel === selectedChannel);
      if (!hasChannel) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const incState = inferStateFromDistrict(inc.district, inc.stateName).toLowerCase();
      const matchTitle = inc.title.toLowerCase().includes(q);
      const matchLandmark = inc.landmark.toLowerCase().includes(q);
      const matchDistrict = inc.district.toLowerCase().includes(q);
      const matchState = incState.includes(q);
      const matchPacket = inc.provenanceTrail.some(
        (p) =>
          p.reporterName.toLowerCase().includes(q) ||
          p.headline.toLowerCase().includes(q) ||
          p.exactAddress.toLowerCase().includes(q)
      );
      if (!matchTitle && !matchLandmark && !matchDistrict && !matchState && !matchPacket) {
        return false;
      }
    }

    return true;
  });

  const getStateDisplay = (state: CredibilityState) => {
    switch (state) {
      case 'verified':
        return { label: t.statusVerified, color: 'text-emerald-700' };
      case 'corroborated':
        return { label: t.statusCorroborated, color: 'text-amber-700' };
      case 'unconfirmed':
        return { label: t.statusUnconfirmed, color: 'text-sky-700' };
      case 'disputed':
        return { label: t.statusDisputed, color: 'text-rose-700' };
    }
  };

  const getReliabilityProgressClasses = (score: number) => {
    if (score >= 70) {
      return '[&::-webkit-progress-value]:bg-emerald-600 [&::-moz-progress-bar]:bg-emerald-600';
    }
    if (score >= 45) {
      return '[&::-webkit-progress-value]:bg-amber-500 [&::-moz-progress-bar]:bg-amber-500';
    }
    return '[&::-webkit-progress-value]:bg-rose-600 [&::-moz-progress-bar]:bg-rose-600';
  };

  const formatChannelName = (ch: SourceChannel) => {
    switch (ch) {
      case 'citizen_sms': return 'SMS';
      case 'citizen_ussd': return 'Phone (*1070#)';
      case 'citizen_web': return 'Citizen Request';
      case 'sdrf_radio': return 'SDRF Team';
      case 'ndrf_agent': return 'NDRF Officer';
      case 'pwd_official': return 'PWD Roads';
      case 'cwc_gauge': return 'River Sensor';
      case 'imd_feed': return 'Weather';
      case 'district_magistrate': return 'District Desk';
      default: return ch;
    }
  };

  return (
    <div className="space-y-5">
      {/* Section Header + Live Officer Sync Strip */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Live Emergency &amp; Field Reports
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Incoming citizen SOS requests and field updates stream here in real time across connected Officer screens.
          </p>
        </div>

        <div className="text-xs text-slate-600 flex items-center gap-2 shrink-0 tabular-nums">
          <span
            className={`w-2 h-2 rounded-full ${
              isRealtimeConnected ? 'bg-emerald-500' : 'bg-amber-400'
            }`}
          />
          <span className="font-medium text-slate-800">
            {isRealtimeConnected ? 'Live Sync Connected' : 'Connecting…'}
          </span>
          <span className="text-slate-400" aria-hidden="true">·</span>
          <span>
            {Math.max(1, connectedOfficerTabs)} Officer {connectedOfficerTabs === 1 ? 'screen' : 'screens'}
          </span>
        </div>
      </div>

      {/* Search & Pan-India State + Source Filter Controls */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-slate-900"
            />
          </div>

          <div className="md:col-span-4">
            <select
              value={selectedIndianState}
              onChange={(e) => setSelectedIndianState(e.target.value)}
              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-slate-900"
              aria-label="Filter by Indian State or Union Territory"
            >
              <option value="ALL">All States &amp; UTs (India)</option>
              <optgroup label="States (28)">
                {INDIAN_STATES_ONLY.map((st) => (
                  <option key={st.code} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Union Territories (8)">
                {INDIAN_UTS_ONLY.map((ut) => (
                  <option key={ut.code} value={ut.name}>
                    {ut.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-slate-900"
              aria-label="Filter by source"
            >
              <option value="all">All Sources</option>
              <option value="citizen_web">Citizen Emergency Form</option>
              <option value="citizen_sms">Citizen SMS</option>
              <option value="citizen_ussd">Phone (*1070#)</option>
              <option value="sdrf_radio">SDRF Team</option>
              <option value="ndrf_agent">NDRF Officer</option>
              <option value="pwd_official">PWD Roads</option>
              <option value="district_magistrate">District Desk</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto text-xs w-fit max-w-full">
          {([
            { id: 'all', label: t.filterAll, count: incidents.length },
            { id: 'live_devices', label: 'Citizen SOS', count: liveDeviceIncidentsCount },
            { id: 'verified', label: t.statusVerified, count: incidents.filter((i) => i.state === 'verified').length },
            { id: 'corroborated', label: t.statusCorroborated, count: incidents.filter((i) => i.state === 'corroborated').length },
            { id: 'unconfirmed', label: t.statusUnconfirmed, count: incidents.filter((i) => i.state === 'unconfirmed').length },
            { id: 'disputed', label: t.statusDisputed, count: incidents.filter((i) => i.state === 'disputed').length }
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStateFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                selectedStateFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Report List */}
      {filteredIncidents.length === 0 ? (
        <div className="p-8 rounded-xl border border-slate-200 bg-white text-center space-y-3">
          <div className="text-sm font-bold text-slate-900">
            {incidents.length === 0
              ? 'No emergency reports logged yet'
              : 'No reports match your current filters'}
          </div>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            {incidents.length === 0
              ? 'When citizens submit emergency help requests from the Public Map / Get Help view, or when officers log field updates, they appear here in real time.'
              : 'Try clearing your search query or switching the State/Source filter to view all active reports.'}
          </p>
          {incidents.length === 0 && onOpenIngestModal && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onOpenIngestModal}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Field Report</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((incident) => {
            const hasConflict = incident.state === 'disputed';
            const isStale = incident.freshnessStatus === 'stale';
            const stateInfo = getStateDisplay(incident.state);
            const latestPacket = incident.provenanceTrail[0];
            const isFromLiveDevice = incident.provenanceTrail.some((p) => p.fromLiveDevice);
            const locationLabel = formatLocationWithState(incident.district, incident.stateName);

            return (
              <div
                key={incident.id}
                className={`p-5 rounded-xl border space-y-3 bg-white ${
                  hasConflict
                    ? 'border-rose-200'
                    : isFromLiveDevice
                    ? 'border-emerald-300'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {isFromLiveDevice && (
                        <>
                          <span className="font-semibold text-emerald-700">
                            Live Citizen Request
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className={`font-semibold ${stateInfo.color}`}>
                        {stateInfo.label}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {incident.landmark ? `${incident.landmark}, ` : ''}
                        {locationLabel}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {incident.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <div className="w-36">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">{incident.ageMinutes}m ago</span>
                        <strong className="text-slate-900">{incident.currentReliability}% confidence</strong>
                      </div>
                      <progress
                        value={incident.currentReliability}
                        max={100}
                        className={`w-full h-1.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full ${getReliabilityProgressClasses(
                          incident.currentReliability
                        )}`}
                      />
                    </div>

                    <button
                      onClick={() => onRefreshIncidentPing(incident.id)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      title="Confirm this report is still current"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Mark Checked</span>
                    </button>
                  </div>
                </div>

                {latestPacket?.details && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {latestPacket.details}
                  </p>
                )}

                {latestPacket?.emergencyFormDetails && latestPacket.emergencyFormDetails.length > 0 && (
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {latestPacket.emergencyFormType || 'Emergency Form'} Details
                      </span>
                      <span className="text-emerald-700 font-semibold">
                        For Rescue Officers only
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {latestPacket.emergencyFormDetails.map((field, fIdx) => (
                        <div key={fIdx}>
                          <span className="text-[11px] text-slate-400 block">{field.label}</span>
                          <strong className="text-slate-900 font-medium">{field.value}</strong>
                        </div>
                      ))}
                    </div>
                    {latestPacket.exactAddress && (
                      <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <span className="text-slate-500">Pickup Address: </span>
                          <strong className="text-slate-900">{latestPacket.exactAddress}</strong>
                        </span>
                        <span className="font-mono text-slate-600">
                          {latestPacket.reporterName} · {latestPacket.contactMasked}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {hasConflict && incident.conflictingReports && (
                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg text-xs text-rose-950 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-rose-900">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Conflicting Reports</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700">
                      <div>
                        <strong className="text-slate-900 block">{incident.conflictingReports.sourceA}</strong>
                        <span>"{incident.conflictingReports.claimA}"</span>
                      </div>
                      <div>
                        <strong className="text-slate-900 block">{incident.conflictingReports.sourceB}</strong>
                        <span>"{incident.conflictingReports.claimB}"</span>
                      </div>
                    </div>
                    <p className="text-rose-900 font-medium pt-1 border-t border-rose-200/70">
                      {incident.conflictingReports.conservativeAction}
                    </p>
                  </div>
                )}

                {isStale && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Needs Re-Check ({incident.ageMinutes}m old)</span>
                    </div>
                    <p className="leading-relaxed">{incident.fallbackInstructions}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>From:</span>
                    {incident.provenanceTrail.map((pkt, pIdx) => (
                      <span key={pkt.id} className="inline-flex items-center gap-1">
                        {pIdx > 0 && <span className="text-slate-300" aria-hidden="true">·</span>}
                        <strong className="text-slate-800 font-medium">{formatChannelName(pkt.channel)}</strong>
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => onOpenProvenance(incident)}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
                  >
                    Details ({incident.provenanceTrail.length})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
