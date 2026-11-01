import React, { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  Download,
  Ship,
  QrCode,
  CheckCircle2,
  ShieldCheck,
  Phone
} from 'lucide-react';
import {
  FusedIncident,
  MisinformationItem,
  ShiftHandoverRecord,
  StoreForwardMessage,
  VolunteerResourceRecord
} from '../types/disaster';
import {
  createOfficerShiftHandover,
  fetchOfficerShiftHandovers,
  fetchOfficerVolunteers,
  updateOfficerVolunteerStatus,
  verifyOfficerQrPassOnServer
} from '../services/realtimeClient';
import { formatLocationWithState } from '../data/indianStates';

interface ShiftHandoverAndVolunteerConsoleProps {
  incidents: FusedIncident[];
  misinfoList: MisinformationItem[];
  storeForwardMessages: StoreForwardMessage[];
  authenticatedOfficerName: string;
  initialVolunteers?: VolunteerResourceRecord[];
  initialHandovers?: ShiftHandoverRecord[];
}

export const ShiftHandoverAndVolunteerConsole: React.FC<
  ShiftHandoverAndVolunteerConsoleProps
> = ({
  incidents,
  misinfoList,
  storeForwardMessages,
  authenticatedOfficerName,
  initialVolunteers = [],
  initialHandovers = []
}) => {
  const [volunteers, setVolunteers] = useState<VolunteerResourceRecord[]>(initialVolunteers);
  const [handovers, setHandovers] = useState<ShiftHandoverRecord[]>(initialHandovers);

  // Handover Form State (clean inputs, no pre-filled mock scenario strings)
  const [shiftWindow, setShiftWindow] = useState('08:00 – 16:00 IST Operational Watch');
  const [incomingOfficer, setIncomingOfficer] = useState('');
  const [agencyUnit, setAgencyUnit] = useState('Joint District Disaster Control Desk');
  const [operationalNotes, setOperationalNotes] = useState('');
  const [isSigningHandover, setIsSigningHandover] = useState(false);

  // Volunteer Dispatch Target
  const [selectedIncidentByVol, setSelectedIncidentByVol] = useState<Record<string, string>>({});

  // Offline QR Rescue Pass Verifier State
  const [qrInputJson, setQrInputJson] = useState('');
  const [qrVerifyResult, setQrVerifyResult] = useState<{
    valid: boolean;
    checksumMatched?: boolean;
    matchedInServerQueue?: boolean;
    assignedTeam?: string;
    eta?: string;
    parsedPass?: any;
    error?: string;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const [vols, hnds] = await Promise.all([
        fetchOfficerVolunteers(),
        fetchOfficerShiftHandovers()
      ]);
      if (vols) setVolunteers(vols);
      if (hnds) setHandovers(hnds);
    })();
  }, []);

  useEffect(() => {
    setVolunteers(initialVolunteers);
  }, [initialVolunteers]);

  useEffect(() => {
    setHandovers(initialHandovers);
  }, [initialHandovers]);

  const criticalIncidents = incidents
    .filter((i) => i.triagePriorityScore >= 75)
    .sort((a, b) => b.triagePriorityScore - a.triagePriorityScore);
  const disputedCount = incidents.filter((i) => i.state === 'disputed').length;
  const quarantinedRumors = misinfoList.filter((m) => m.isQuarantined).length;
  const queuedOfflineCount = storeForwardMessages.filter((m) => m.status === 'queued_locally').length;
  const verifiedVolCount = volunteers.filter((v) => v.status !== 'PENDING_VERIFICATION').length;

  const handleGenerateGoldenHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomingOfficer.trim() || !operationalNotes.trim()) return;
    setIsSigningHandover(true);
    const created = await createOfficerShiftHandover({
      shiftWindow,
      outgoingOfficer: authenticatedOfficerName,
      incomingOfficer: incomingOfficer.trim(),
      agencyUnit: agencyUnit.trim(),
      openCriticalCount: criticalIncidents.length,
      disputedRouteCount: disputedCount,
      quarantinedRumorCount: quarantinedRumors,
      queuedOfflineCount,
      verifiedVolunteerCount: verifiedVolCount,
      criticalBriefingItems: criticalIncidents.slice(0, 5).map((inc) => ({
        id: inc.id,
        title: inc.title,
        district: formatLocationWithState(inc.district, inc.stateName),
        score: inc.triagePriorityScore
      })),
      operationalNotes: operationalNotes.trim()
    });
    if (created) {
      setHandovers((prev) => [created, ...prev.filter((h) => h.id !== created.id)]);
      setOperationalNotes('');
    }
    setIsSigningHandover(false);
  };

  const handleExportHandoverReport = (record: ShiftHandoverRecord) => {
    const lines = [
      '====================================================================',
      'RESQNET SHIFT HANDOVER BRIEFING',
      '====================================================================',
      `Briefing ID       : ${record.id}`,
      `Created At        : ${new Date(record.createdAt).toISOString()}`,
      `Shift Window      : ${record.shiftWindow}`,
      `Agency / Desk     : ${record.agencyUnit}`,
      `Outgoing Officer  : ${record.outgoingOfficer}`,
      `Incoming Officer  : ${record.incomingOfficer}`,
      `SHA-256 Signature : ${record.sha256Signature}`,
      '--------------------------------------------------------------------',
      `Open Critical SOS : ${record.openCriticalCount}`,
      `Disputed Routes   : ${record.disputedRouteCount}`,
      `Flagged Rumors    : ${record.quarantinedRumorCount}`,
      `Pending Offline   : ${record.queuedOfflineCount}`,
      `Verified Assets   : ${record.verifiedVolunteerCount}`,
      '--------------------------------------------------------------------',
      'TOP PRIORITY INCIDENTS HANDED OVER:',
      ...(record.criticalBriefingItems.length > 0
        ? record.criticalBriefingItems.map(
            (item, idx) => `  ${idx + 1}. [${item.score}/100] ${item.title} (${item.district})`
          )
        : ['  None open at handover time.']),
      '--------------------------------------------------------------------',
      'OPERATIONAL WATCH INSTRUCTIONS:',
      record.operationalNotes,
      '===================================================================='
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${record.id}-Shift-Handover.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleVolunteerAction = async (
    vol: VolunteerResourceRecord,
    nextStatus: 'VERIFIED_READY' | 'DISPATCHED'
  ) => {
    const targetIncId = selectedIncidentByVol[vol.id] || incidents[0]?.id;
    const targetInc = incidents.find((i) => i.id === targetIncId);
    const updated = await updateOfficerVolunteerStatus({
      volunteerId: vol.id,
      status: nextStatus,
      assignedIncidentId: nextStatus === 'DISPATCHED' ? targetInc?.id : undefined,
      assignedIncidentTitle: nextStatus === 'DISPATCHED' ? targetInc?.title : undefined
    });
    if (updated) {
      setVolunteers(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Shift Handover Log */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Shift Handover &amp; Watch Briefing
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Creates a signed 8-hour shift handover across NDRF, SDRF, PWD, and District Control so open rescues and route advisories carry cleanly to the incoming officer.
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg self-start sm:self-auto tabular-nums">
            {handovers.length} Signed Handovers
          </span>
        </div>

        {/* Live Snapshot Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs tabular-nums">
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-slate-500 block text-[11px]">Critical Rescues</span>
            <strong className="text-lg font-mono text-red-600">{criticalIncidents.length}</strong>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-slate-500 block text-[11px]">Conflicting Reports</span>
            <strong className="text-lg font-mono text-amber-700">{disputedCount}</strong>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-slate-500 block text-[11px]">Flagged Rumors</span>
            <strong className="text-lg font-mono text-slate-900">{quarantinedRumors}</strong>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-slate-500 block text-[11px]">Offline Queue</span>
            <strong className="text-lg font-mono text-slate-900">{queuedOfflineCount}</strong>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-slate-500 block text-[11px]">Verified Volunteers</span>
            <strong className="text-lg font-mono text-emerald-700">{verifiedVolCount}</strong>
          </div>
        </div>

        <form onSubmit={handleGenerateGoldenHandover} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Shift Watch Window</label>
              <select
                value={shiftWindow}
                onChange={(e) => setShiftWindow(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
              >
                <option value="08:00 – 16:00 IST Operational Watch">08:00 – 16:00 IST Operational Watch</option>
                <option value="16:00 – 00:00 IST Evening Watch">16:00 – 00:00 IST Evening Watch</option>
                <option value="00:00 – 08:00 IST Night Watch">00:00 – 08:00 IST Night Watch</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">Incoming Officer Name *</label>
              <input
                type="text"
                value={incomingOfficer}
                onChange={(e) => setIncomingOfficer(e.target.value)}
                placeholder="e.g., Dy. Commandant R. Sharma"
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">Control Desk / Unit *</label>
              <input
                type="text"
                value={agencyUnit}
                onChange={(e) => setAgencyUnit(e.target.value)}
                placeholder="e.g., State Disaster Control Desk"
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Handover Instructions for Incoming Watch *
            </label>
            <textarea
              rows={2}
              value={operationalNotes}
              onChange={(e) => setOperationalNotes(e.target.value)}
              placeholder="Summarize pending rescues, active road closures, shelter capacity alerts, or supply priorities..."
              className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSigningHandover}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg inline-flex items-center gap-2 transition-colors"
            >
              <ClipboardCheck className="w-4 h-4 text-emerald-400" />
              <span>
                {isSigningHandover ? 'Saving Handover…' : 'Sign & Save Shift Handover'}
              </span>
            </button>
          </div>
        </form>

        <div className="border-t border-slate-200 pt-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Signed Shift Handover Records
          </h3>
          {handovers.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              No shift handovers signed yet during this session.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {handovers.map((h) => (
                <div key={h.id} className="py-3.5 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {h.id}
                      </span>
                      <strong className="text-slate-900">{h.shiftWindow}</strong>
                      <span className="text-slate-500">
                        · {h.outgoingOfficer} → {h.incomingOfficer}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExportHandoverReport(h)}
                      className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded-lg font-semibold text-slate-800 inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download (.txt)</span>
                    </button>
                  </div>
                  <p className="text-slate-700">{h.operationalNotes}</p>
                  <div className="font-mono text-[11px] text-slate-500 flex flex-wrap items-center gap-4 tabular-nums">
                    <span>
                      SHA-256: <strong className="text-emerald-800">{h.sha256Signature.slice(0, 20)}…</strong>
                    </span>
                    <span>Critical: {h.openCriticalCount}</span>
                    <span>Time: {new Date(h.createdAt).toLocaleTimeString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Community Volunteer Boat & Supply Verification Desk */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-slate-900" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Community Boat, Tractor &amp; Paramedic Volunteer Desk
              </h3>
              <p className="text-xs text-slate-600">
                Verify citizen-registered boats, generators, and medical volunteers in real time and assign them to active emergencies.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md tabular-nums">
            {volunteers.length} Registered Assets
          </span>
        </div>

        {volunteers.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No community volunteer boats or supply assets registered yet. Registrations submitted by citizens in the "Family Safe &amp; Volunteer" tab appear here live.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {volunteers.map((vol) => (
              <div key={vol.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{vol.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                        vol.status === 'DISPATCHED'
                          ? 'bg-sky-100 text-sky-900'
                          : vol.status === 'VERIFIED_READY'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {vol.status.replace('_', ' ')}
                    </span>
                    <span className="text-slate-500">
                      {formatLocationWithState(vol.district, vol.stateName)}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-slate-900">
                    {vol.assetLabel} — <span className="font-medium text-slate-700">{vol.volunteerName}</span>
                  </div>

                  {vol.capacityNotes && <p className="text-slate-600">{vol.capacityNotes}</p>}

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 pt-0.5 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1 text-slate-900 font-semibold">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      {vol.phoneFullForOfficers || vol.phoneMasked}
                    </span>
                    {vol.assignedIncidentTitle && (
                      <span className="font-sans text-sky-800 font-semibold">
                        Assigned → {vol.assignedIncidentTitle}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {vol.status === 'PENDING_VERIFICATION' && (
                    <button
                      type="button"
                      onClick={() => void handleVolunteerAction(vol, 'VERIFIED_READY')}
                      className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold inline-flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify Asset</span>
                    </button>
                  )}

                  {incidents.length > 0 && (
                    <>
                      <select
                        value={selectedIncidentByVol[vol.id] || incidents[0]?.id || ''}
                        onChange={(e) =>
                          setSelectedIncidentByVol((prev) => ({ ...prev, [vol.id]: e.target.value }))
                        }
                        className="p-2 border border-slate-300 rounded-lg bg-white text-slate-800 max-w-[210px]"
                      >
                        {incidents.slice(0, 8).map((inc) => (
                          <option key={inc.id} value={inc.id}>
                            {inc.title.slice(0, 34)} ({inc.district})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => void handleVolunteerAction(vol, 'DISPATCHED')}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold"
                      >
                        Assign
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Offline QR Rescue Pass Verifier */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <QrCode className="w-5 h-5 text-slate-900" />
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Offline QR Rescue Pass Verifier
            </h3>
            <p className="text-xs text-slate-600">
              Paste a citizen's scanned QR Rescue Pass payload (`RESQNET-QR-V1`) during boat boarding or shelter intake to verify reference ID and medical notes.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 text-xs">
          <input
            type="text"
            value={qrInputJson}
            onChange={(e) => setQrInputJson(e.target.value)}
            placeholder='Paste scanned QR payload JSON ({"version":"RESQNET-QR-V1","refId":"REF-NDMA-..."})'
            className="flex-1 p-2.5 border border-slate-300 rounded-lg font-mono bg-white outline-none focus:border-slate-900"
          />
          <button
            type="button"
            onClick={async () => {
              if (!qrInputJson.trim()) return;
              const result = await verifyOfficerQrPassOnServer(qrInputJson.trim());
              setQrVerifyResult(result);
            }}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shrink-0"
          >
            Verify Pass
          </button>
        </div>

        {qrVerifyResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              qrVerifyResult.valid
                ? 'border-emerald-200 bg-emerald-50/70 text-slate-900'
                : 'border-rose-200 bg-rose-50 text-rose-950'
            }`}
          >
            {qrVerifyResult.valid && qrVerifyResult.parsedPass ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-emerald-800 inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Verified Rescue Pass · {qrVerifyResult.parsedPass.refId}
                  </span>
                  <span className="font-mono text-[11px] text-slate-600">
                    Checksum: {qrVerifyResult.parsedPass.checksum}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Area &amp; Persons</span>
                    <strong>
                      {qrVerifyResult.parsedPass.landmark}, {qrVerifyResult.parsedPass.district} (
                      {qrVerifyResult.parsedPass.peopleCount} people)
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Emergency / Medical Note</span>
                    <strong>
                      {qrVerifyResult.parsedPass.category}
                      {qrVerifyResult.parsedPass.bloodOrMedNote
                        ? ` · ${qrVerifyResult.parsedPass.bloodOrMedNote}`
                        : ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Assigned Unit</span>
                    <strong>{qrVerifyResult.assignedTeam}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="font-semibold">{qrVerifyResult.error || 'Invalid QR pass payload.'}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
