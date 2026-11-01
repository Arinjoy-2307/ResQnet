import React, { useState } from 'react';
import { FusedIncident, ReportPacket } from '../types/disaster';
import { LanguageCode } from '../services/i18n';
import { CitizenPortal } from './CitizenPortal';
import { InteractiveMap } from './InteractiveMap';
import { TriageConsole } from './TriageConsole';
import { FusionFeed } from './FusionFeed';
import { SIMULATION_LABEL_STRING } from '../services/operationalCheckpoints';
import {
  SplitSquareVertical,
  Columns,
  Radio,
  Map,
  HeartHandshake,
  ShieldCheck,
  Smartphone,
  LayoutDashboard,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface CombinedControlSuiteProps {
  incidents: FusedIncident[];
  onIngestCitizenReport: (packet: ReportPacket) => void;
  onUpdateIncidentOverride: (
    incidentId: string,
    newScore: number,
    reason: string,
    responderName: string
  ) => void;
  language: LanguageCode;
  isLowNetwork: boolean;
  onOpenProvenance: (inc: FusedIncident) => void;
  onOpenOfficialLogin: () => void;
  selectedStateFilter: string;
  setSelectedStateFilter: (state: string) => void;
  isOfficerRealtimeConnected: boolean;
  liveConnectedOfficerTabs: number;
}

export const CombinedControlSuite: React.FC<CombinedControlSuiteProps> = ({
  incidents,
  onIngestCitizenReport,
  onUpdateIncidentOverride,
  language,
  isLowNetwork,
  onOpenProvenance,
  onOpenOfficialLogin,
  selectedStateFilter,
  setSelectedStateFilter,
  isOfficerRealtimeConnected,
  liveConnectedOfficerTabs
}) => {
  const [splitOrientation, setSplitOrientation] = useState<
    'side-by-side' | 'officer-focus' | 'citizen-focus' | 'stacked'
  >('side-by-side');
  const [officerSubTab, setOfficerSubTab] = useState<'triage' | 'map' | 'feed'>('triage');
  const [selectedIncident, setSelectedIncident] = useState<FusedIncident | null>(null);

  const showOfficerPane = splitOrientation !== 'citizen-focus';
  const showCitizenPane = splitOrientation !== 'officer-focus';

  return (
    <div className="space-y-4">
      {/* Simulation Watermark & Suite Control Bar */}
      <div className="p-3 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-extrabold text-[11px] tracking-wide animate-pulse">
            {SIMULATION_LABEL_STRING}
          </span>
          <span className="font-semibold text-slate-200">
            Dual-Interface Viewport
          </span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline">
            Tactical Emergency Responder (POV 2) + Public Citizen Interface (POV 1)
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[11px] font-medium px-1 hidden lg:inline">Layout:</span>
          
          <button
            type="button"
            onClick={() => setSplitOrientation('side-by-side')}
            className={`px-2.5 py-1 rounded font-semibold text-xs flex items-center gap-1.5 transition-colors ${
              splitOrientation === 'side-by-side'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Split 50/50 side-by-side"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split 50/50</span>
          </button>

          <button
            type="button"
            onClick={() => setSplitOrientation('officer-focus')}
            className={`px-2.5 py-1 rounded font-semibold text-xs flex items-center gap-1.5 transition-colors ${
              splitOrientation === 'officer-focus'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Focus Emergency Tactical Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Focus Responders</span>
          </button>

          <button
            type="button"
            onClick={() => setSplitOrientation('citizen-focus')}
            className={`px-2.5 py-1 rounded font-semibold text-xs flex items-center gap-1.5 transition-colors ${
              splitOrientation === 'citizen-focus'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Focus Public Citizen Interface"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Focus Citizens</span>
          </button>

          <button
            type="button"
            onClick={() => setSplitOrientation('stacked')}
            className={`px-2.5 py-1 rounded font-semibold text-xs flex items-center gap-1.5 transition-colors hidden sm:flex ${
              splitOrientation === 'stacked'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Stacked view"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>Stacked</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div
        className={`grid gap-5 ${
          splitOrientation === 'side-by-side'
            ? 'grid-cols-1 lg:grid-cols-2'
            : 'grid-cols-1'
        }`}
      >
        {/* PANE A: EMERGENCY DASHBOARD (Control Rooms & Tactical Responders) */}
        {showOfficerPane && (
          <section
            aria-label="Tactical Emergency Dashboard"
            className="border-2 border-indigo-200 rounded-2xl bg-white p-4 shadow-sm flex flex-col space-y-4 min-h-[680px] transition-all"
          >
            {/* Pane Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-900 rounded-lg">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>Emergency Tactical Dashboard</span>
                    <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-200">
                      OFFICER / NDRF
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Control Room Dispatch · XAI Triage Gate · Ephemeral GPS Leases
                  </p>
                </div>
              </div>

              {/* Officer sub-tabs & Focus Toggle */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setOfficerSubTab('triage')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                      officerSubTab === 'triage'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <HeartHandshake className="w-3 h-3 text-red-600" />
                    <span>Rescue Queue</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOfficerSubTab('map')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                      officerSubTab === 'map'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Map className="w-3 h-3 text-blue-600" />
                    <span>Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOfficerSubTab('feed')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                      officerSubTab === 'feed'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Radio className="w-3 h-3 text-emerald-600" />
                    <span>Live Feed</span>
                  </button>
                </div>

                {splitOrientation === 'officer-focus' ? (
                  <button
                    type="button"
                    onClick={() => setSplitOrientation('side-by-side')}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                    title="Restore Split 50/50 View"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSplitOrientation('officer-focus')}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                    title="Maximize Responder Dashboard"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Pane Content */}
            <div className="flex-1 overflow-y-auto">
              {officerSubTab === 'triage' && (
                <TriageConsole
                  incidents={incidents}
                  onUpdateIncidentOverride={onUpdateIncidentOverride}
                  language={language}
                  onOpenProvenance={onOpenProvenance}
                />
              )}

              {officerSubTab === 'map' && (
                <InteractiveMap
                  incidents={incidents}
                  selectedIncident={selectedIncident}
                  onSelectIncident={setSelectedIncident}
                  language={language}
                  onOpenProvenance={onOpenProvenance}
                />
              )}

              {officerSubTab === 'feed' && (
                <FusionFeed
                  incidents={incidents}
                  onOpenProvenance={onOpenProvenance}
                  onRefreshIncidentPing={() => {}}
                  language={language}
                  selectedStateFilter={selectedStateFilter}
                  setSelectedStateFilter={setSelectedStateFilter}
                  isRealtimeConnected={isOfficerRealtimeConnected}
                  connectedOfficerTabs={liveConnectedOfficerTabs}
                />
              )}
            </div>
          </section>
        )}

        {/* PANE B: CITIZEN FLOW INTERFACE (Public Citizen Mobile / Web SOS) */}
        {showCitizenPane && (
          <section
            aria-label="Public Citizen Flow"
            className="border-2 border-emerald-200 rounded-2xl bg-white p-4 shadow-sm flex flex-col space-y-4 min-h-[680px] transition-all"
          >
            {/* Pane Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-900 rounded-lg">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>Citizen Flow Interface</span>
                    <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                      PUBLIC / CITIZEN
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Write-only Emergency SOS · Safe Shelters Map · Offline Localization Checkpoint
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Zero-Leak Protected</span>
                </div>

                {splitOrientation === 'citizen-focus' ? (
                  <button
                    type="button"
                    onClick={() => setSplitOrientation('side-by-side')}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                    title="Restore Split 50/50 View"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSplitOrientation('citizen-focus')}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                    title="Maximize Citizen Flow"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Pane Content */}
            <div className="flex-1 overflow-y-auto">
              <CitizenPortal
                incidents={incidents}
                onIngestCitizenReport={onIngestCitizenReport}
                language={language}
                isOffline={isLowNetwork}
                onOpenOfficialLogin={onOpenOfficialLogin}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
