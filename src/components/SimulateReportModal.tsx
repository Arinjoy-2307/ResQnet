import React, { useState } from 'react';
import {
  SourceChannel,
  DistrictName,
  IndianStateName,
  IncidentCategory,
  FusedIncident,
  ReportPacket,
  FieldPhotoForensicResult
} from '../types/disaster';
import { generateProvenanceHash } from '../services/fusionEngine';
import {
  INDIAN_STATES_ONLY,
  INDIAN_UTS_ONLY,
  getDistrictsForState,
  getStateInfo,
  formatLocationWithState
} from '../data/indianStates';
import { inspectFieldPhotoEvidence } from '../utils/exifTamperCheck';
import {
  X,
  Send,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Navigation
} from 'lucide-react';

interface SimulateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingIncidents: FusedIncident[];
  onIngestNewPacket: (
    packet: ReportPacket,
    targetIncidentId?: string,
    isConflicting?: boolean,
    conflictClaim?: string
  ) => void;
}

export const SimulateReportModal: React.FC<SimulateReportModalProps> = ({
  isOpen,
  onClose,
  existingIncidents,
  onIngestNewPacket
}) => {
  const [channel, setChannel] = useState<SourceChannel>('sdrf_radio');
  const [stateName, setStateName] = useState<IndianStateName>('Delhi');
  const [district, setDistrict] = useState<DistrictName>('New Delhi');
  const [customDistrict, setCustomDistrict] = useState<string>('');
  const [category, setCategory] = useState<IncidentCategory>('flood_surge');
  const [reporterName, setReporterName] = useState('');
  const [reporterRole, setReporterRole] = useState('Field Responder');
  const [landmark, setLandmark] = useState('');
  const [headline, setHeadline] = useState('');
  const [details, setDetails] = useState('');
  const [liveGpsCoords, setLiveGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [targetClusterOption, setTargetClusterOption] = useState<'new' | 'corroborate' | 'conflict'>('new');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(existingIncidents[0]?.id || '');
  const [conflictClaimText, setConflictClaimText] = useState('');
  const [photoForensics, setPhotoForensics] = useState<FieldPhotoForensicResult | null>(null);

  if (!isOpen) return null;

  const districtOptions = getDistrictsForState(stateName);
  const resolvedDistrict =
    district === '__custom__' ? customDistrict.trim() || stateName : district;

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Browser geolocation is not supported on this device.');
      return;
    }
    setGpsStatus('Reading device GPS…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5))
        };
        setLiveGpsCoords(coords);
        setGpsStatus(`Locked GPS: ${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`);
      },
      () => {
        setGpsStatus('Could not access GPS. Using selected district coordinates.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const packetId = `REP-${channel.toUpperCase().slice(0, 3)}-${Math.floor(
      Math.random() * 9000 + 1000
    )}`;
    const now = Date.now();
    const isOfficial =
      channel === 'pwd_official' ||
      channel === 'district_magistrate' ||
      channel === 'cwc_gauge' ||
      channel === 'imd_feed';
    const isAuthorized = channel === 'ndrf_agent' || channel === 'sdrf_radio';

    const stInfo = getStateInfo(stateName);
    const baseCenter = stInfo ? stInfo.viewCenter : { lat: 28.6139, lng: 77.209 };
    const finalCoords = liveGpsCoords || {
      lat: Number((baseCenter.lat + (Math.random() - 0.5) * 0.03).toFixed(4)),
      lng: Number((baseCenter.lng + (Math.random() - 0.5) * 0.03).toFixed(4))
    };

    const resolvedTargetId =
      targetClusterOption === 'new'
        ? undefined
        : selectedIncidentId || existingIncidents[0]?.id;

    const packet: ReportPacket = {
      id: packetId,
      incidentClusterId:
        targetClusterOption === 'new' || !resolvedTargetId
          ? `INC-${Math.floor(Math.random() * 900 + 100)}`
          : resolvedTargetId,
      timestamp: now,
      channel,
      reporterName: reporterName.trim() || 'Field Officer',
      reporterRole: reporterRole.trim() || 'Field Responder',
      isOfficial,
      isAuthorizedFieldAgent: isAuthorized,
      stateName,
      district: resolvedDistrict,
      landmark: landmark.trim(),
      coordinates: finalCoords,
      category,
      headline: headline.trim(),
      details: photoForensics
        ? `${details.trim()} [Photo Check: ${photoForensics.trustVerdict} · ${photoForensics.summaryNote}]`
        : details.trim(),
      rawPayload: JSON.stringify({
        packet_id: packetId,
        source: channel,
        reporter: reporterName.trim(),
        state: stateName,
        district: resolvedDistrict,
        landmark: landmark.trim(),
        coordinates: finalCoords,
        text: headline.trim(),
        photo_forensics: photoForensics || undefined,
        ingested_at: new Date(now).toISOString()
      }),
      provenanceHash: generateProvenanceHash(packetId, now, channel),
      contactMasked: '+91 ••••• •••••',
      exactAddress: `${landmark.trim()}, ${resolvedDistrict}, ${stateName}`
    };

    onIngestNewPacket(
      packet,
      resolvedTargetId,
      targetClusterOption === 'conflict',
      conflictClaimText.trim()
    );

    setHeadline('');
    setDetails('');
    setLandmark('');
    setConflictClaimText('');
    setPhotoForensics(null);
    setLiveGpsCoords(null);
    setGpsStatus(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">
              Log Field Report
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Record a live ground update or corroborate an open incident across any State or UT
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close form"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {existingIncidents.length > 0 && (
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5">
                Report Action
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'new', title: 'New Incident' },
                    { id: 'corroborate', title: 'Confirm Existing' },
                    { id: 'conflict', title: 'Contradict Existing' }
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setTargetClusterOption(opt.id);
                      if (!selectedIncidentId && existingIncidents[0]) {
                        setSelectedIncidentId(existingIncidents[0].id);
                      }
                    }}
                    className={`p-2.5 rounded-lg border text-center font-semibold transition-colors ${
                      targetClusterOption === opt.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {opt.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {targetClusterOption !== 'new' && existingIncidents.length > 0 && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Select Existing Incident
                </label>
                <select
                  value={selectedIncidentId || existingIncidents[0]?.id || ''}
                  onChange={(e) => setSelectedIncidentId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:border-slate-900"
                >
                  {existingIncidents.map((inc) => (
                    <option key={inc.id} value={inc.id}>
                      {inc.title} ({formatLocationWithState(inc.district, inc.stateName)})
                    </option>
                  ))}
                </select>
              </div>

              {targetClusterOption === 'conflict' && (
                <div>
                  <label className="block font-semibold text-rose-800 mb-1">
                    Ground Difference Observed *
                  </label>
                  <input
                    type="text"
                    value={conflictClaimText}
                    onChange={(e) => setConflictClaimText(e.target.value)}
                    placeholder="e.g., Approach road submerged; light vehicles cannot cross"
                    className="w-full p-2.5 border border-rose-300 rounded-lg bg-white outline-none focus:border-rose-600"
                    required
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                State / Union Territory
              </label>
              <select
                value={stateName}
                onChange={(e) => {
                  const nextState = e.target.value;
                  setStateName(nextState);
                  const nextDistricts = getDistrictsForState(nextState);
                  setDistrict(nextDistricts[0] || nextState);
                  setCustomDistrict('');
                }}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:border-slate-900"
              >
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

            <div>
              <label className="block font-semibold text-slate-800 mb-1">District / City</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:border-slate-900"
              >
                {districtOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="__custom__">Other District / Town…</option>
              </select>
              {district === '__custom__' && (
                <input
                  type="text"
                  value={customDistrict}
                  onChange={(e) => setCustomDistrict(e.target.value)}
                  placeholder={`Enter district or town in ${stateName}`}
                  className="mt-2 w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-slate-900"
                  required
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Reporting Source</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as SourceChannel)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:border-slate-900"
              >
                <option value="sdrf_radio">SDRF Field Team</option>
                <option value="ndrf_agent">NDRF Officer</option>
                <option value="pwd_official">PWD Roads Engineer</option>
                <option value="district_magistrate">District Control / SDMA</option>
                <option value="cwc_gauge">River Gauge Station</option>
                <option value="imd_feed">Weather Station</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">Emergency Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:border-slate-900"
              >
                <option value="flood_surge">Flood / Cyclone Evacuation</option>
                <option value="medical_oxygen">Medical / Oxygen Emergency</option>
                <option value="bridge_collapse">Bridge Structural Hazard</option>
                <option value="road_cut">Road / Landslide Blockage</option>
                <option value="shelter_capacity">Relief Shelter Update</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-800">Area / Landmark *</label>
              <button
                type="button"
                onClick={handleCaptureGps}
                className="text-[11px] font-semibold text-slate-700 hover:text-slate-950 inline-flex items-center gap-1"
              >
                <Navigation className="w-3 h-3 text-emerald-600" />
                <span>Attach My GPS</span>
              </button>
            </div>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g., Ward 4 Primary School / NH-27 Km 42"
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900"
              required
            />
            {gpsStatus && (
              <p className="text-[11px] text-emerald-700 font-mono mt-1 tabular-nums">
                {gpsStatus}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Reporter Name *</label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Officer or responder name"
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">Unit / Role</label>
              <input
                type="text"
                value={reporterRole}
                onChange={(e) => setReporterRole(e.target.value)}
                placeholder="e.g., SDRF Boat Lead"
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Short Headline *</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g., Approach road flooded near primary school"
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Field Notes *</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              placeholder="People affected, water depth, vehicle access, or medical requirements..."
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900"
              required
            />
          </div>

          {/* Field Photo EXIF & SHA-256 Check */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900 inline-flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-slate-700" />
                  <span>Optional Field Photo EXIF Verification</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Checks uploaded JPEG EXIF/GPS headers and SHA-256 hash locally in your browser.
                </p>
              </div>

              <label className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-semibold cursor-pointer transition-colors">
                <span>Attach Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    if (!file) return;
                    const res = await inspectFieldPhotoEvidence(file);
                    setPhotoForensics(res);
                  }}
                />
              </label>
            </div>

            {photoForensics && (
              <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-bold inline-flex items-center gap-1 ${
                      photoForensics.trustVerdict === 'AUTHENTIC_FIELD_CAPTURE'
                        ? 'text-emerald-700'
                        : photoForensics.trustVerdict === 'REPLAY_DUPLICATE_FLAGGED'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {photoForensics.trustVerdict === 'AUTHENTIC_FIELD_CAPTURE' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {photoForensics.trustVerdict === 'AUTHENTIC_FIELD_CAPTURE'
                        ? 'Geotagged Camera Photo Verified'
                        : photoForensics.trustVerdict === 'REPLAY_DUPLICATE_FLAGGED'
                        ? 'Duplicate Photo Hash Flagged'
                        : 'No Embedded EXIF Metadata'}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    SHA-256: {photoForensics.sha256Hex.slice(0, 12)}…
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">{photoForensics.summaryNote}</div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Save Field Report</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
