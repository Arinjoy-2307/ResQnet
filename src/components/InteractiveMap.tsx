import React, { useEffect, useMemo, useState } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  useMap
} from '@vis.gl/react-google-maps';
import {
  FusedIncident,
  CredibilityState,
  ShelterLoadRecord,
  LivePublicHazardItem
} from '../types/disaster';
import {
  Bell,
  Send,
  X,
  ExternalLink,
  RefreshCw,
  LocateFixed
} from 'lucide-react';
import { LanguageCode } from '../services/i18n';
import {
  INCIDENT_TO_PLACE_KEY,
  useGroundedAssamPlaces,
  GeoPoint
} from '../services/groundedLocations';
import { dispatchAreaAlertOnServer } from '../services/realtimeClient';
import { ElevationAndWeatherBar } from './ElevationAndWeatherBar';
import {
  ALL_INDIA_CENTER,
  ALL_INDIA_ZOOM,
  INDIAN_STATES_ONLY,
  INDIAN_UTS_ONLY,
  getDistrictsForState,
  getStateInfo,
  inferStateFromDistrict,
  formatLocationWithState
} from '../data/indianStates';

interface InteractiveMapProps {
  incidents: FusedIncident[];
  selectedIncident: FusedIncident | null;
  onSelectIncident: (inc: FusedIncident | null) => void;
  language: LanguageCode;
  onOpenProvenance: (inc: FusedIncident) => void;
  shelterLoads?: Record<string, ShelterLoadRecord>;
  liveHazards?: LivePublicHazardItem[];
  onUpdateShelterLoad?: (
    placeKey: string,
    occupied: number,
    capacity: number,
    title: string,
    district: string,
    stateName: string,
    redirectPlaceKey?: string,
    redirectTitle?: string
  ) => void;
}

const OfficerMapOverlaysController: React.FC<{
  focusedPoint: GeoPoint | null;
  fitPoints: GeoPoint[];
  fitTriggerKey: string;
  fallbackViewport: { center: GeoPoint; zoom: number } | null;
}> = ({
  focusedPoint,
  fitPoints,
  fitTriggerKey,
  fallbackViewport
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !focusedPoint) return;
    map.panTo(focusedPoint);
    if ((map.getZoom() || 8) < 12) {
      map.setZoom(13);
    }
  }, [map, focusedPoint?.lat, focusedPoint?.lng]);

  useEffect(() => {
    if (!map || focusedPoint) return;
    if (fitPoints.length === 1) {
      map.panTo(fitPoints[0]);
      map.setZoom(11);
      return;
    }
    if (fitPoints.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      fitPoints.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, 48);
      return;
    }
    if (fallbackViewport) {
      map.panTo(fallbackViewport.center);
      map.setZoom(fallbackViewport.zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitTriggerKey, fitPoints.length]);

  return null;
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  language: _language,
  onOpenProvenance,
  shelterLoads = {},
  liveHazards = [],
  onUpdateShelterLoad
}) => {
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('ALL');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('ALL');
  const [selectedShelter, setSelectedShelter] = useState<any>(null);
  const [selectedHazard, setSelectedHazard] = useState<LivePublicHazardItem | null>(null);
  const [officerGpsCoords, setOfficerGpsCoords] = useState<GeoPoint | null>(null);
  const [isLocatingOfficer, setIsLocatingOfficer] = useState(false);

  const availableDistricts = useMemo(() => {
    if (selectedStateFilter === 'ALL') {
      const dynamicDistricts = Array.from(new Set(incidents.map((i) => i.district)));
      return ['ALL', ...dynamicDistricts];
    }
    return ['ALL', ...getDistrictsForState(selectedStateFilter)];
  }, [selectedStateFilter, incidents]);

  const primaryDistrictForSelectedState =
    selectedStateFilter === 'ALL' ? undefined : getDistrictsForState(selectedStateFilter)[0];

  const {
    placesMap,
    isResolving,
    quotaBlocked,
    retryResolvePlaces,
    resolveNearbySheltersByCoords
  } = useGroundedAssamPlaces({
    enabled: true,
    activeStateName: selectedStateFilter,
    activeDistrict: primaryDistrictForSelectedState
  });

  const [showShelters, setShowShelters] = useState(true);
  const [showHazards, setShowHazards] = useState(true);
  const [alertTargetingOpen, setAlertTargetingOpen] = useState(false);
  const [alertStateName, setAlertStateName] = useState<string>('Delhi');
  const [alertDistrictName, setAlertDistrictName] = useState<string>('New Delhi');
  const [alertSeverity, setAlertSeverity] = useState<'advisory' | 'warning' | 'critical'>('warning');
  const [alertFormat, setAlertFormat] = useState<'sms' | 'ivr' | 'pictograph' | 'audio'>('sms');
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [alertBroadcastSent, setAlertBroadcastSent] = useState(false);

  const getGroundedIncidentCoords = (inc: FusedIncident): GeoPoint | null => {
    const mappedKey = INCIDENT_TO_PLACE_KEY[inc.id];
    if (mappedKey && placesMap[mappedKey]?.location) {
      return placesMap[mappedKey].location;
    }
    return inc.coordinates || null;
  };

  const visibleIncidentsWithCoords = useMemo(() => {
    return incidents
      .filter((inc) => {
        if (selectedStateFilter !== 'ALL') {
          const incState = inferStateFromDistrict(inc.district, inc.stateName);
          if (incState.toLowerCase() !== selectedStateFilter.toLowerCase()) return false;
        }
        if (selectedDistrictFilter !== 'ALL') {
          if (inc.district.toLowerCase() !== selectedDistrictFilter.toLowerCase()) return false;
        }
        return true;
      })
      .map((inc) => ({ incident: inc, coords: getGroundedIncidentCoords(inc) }))
      .filter((entry): entry is { incident: FusedIncident; coords: GeoPoint } => Boolean(entry.coords));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, selectedStateFilter, selectedDistrictFilter, placesMap]);

  const visibleShelters = useMemo(() => {
    if (!showShelters) return [];
    return Object.values(placesMap).filter(
      (s) =>
        Boolean(s?.location) &&
        (s.publicRole === 'shelter' || s.publicRole === 'backup_shelter') &&
        (selectedStateFilter === 'ALL' ||
          (s.stateName || '').toLowerCase() === selectedStateFilter.toLowerCase())
    );
  }, [showShelters, placesMap, selectedStateFilter]);

  const visibleHazards = useMemo(() => {
    if (!showHazards) return [];
    return liveHazards.filter(
      (h) =>
        Boolean(h.coordinates) &&
        (selectedStateFilter === 'ALL' ||
          !h.stateName ||
          h.stateName.toLowerCase() === selectedStateFilter.toLowerCase())
    );
  }, [showHazards, liveHazards, selectedStateFilter]);

  const fallbackViewport = useMemo(() => {
    if (selectedStateFilter === 'ALL') {
      return { center: ALL_INDIA_CENTER, zoom: ALL_INDIA_ZOOM };
    }
    const stInfo = getStateInfo(selectedStateFilter);
    if (stInfo) {
      return { center: stInfo.viewCenter, zoom: stInfo.viewZoom };
    }
    return { center: ALL_INDIA_CENTER, zoom: ALL_INDIA_ZOOM };
  }, [selectedStateFilter]);

  const selectedIncidentCoords = selectedIncident
    ? getGroundedIncidentCoords(selectedIncident)
    : null;

  const selectedIncidentPlace =
    selectedIncident && INCIDENT_TO_PLACE_KEY[selectedIncident.id]
      ? placesMap[INCIDENT_TO_PLACE_KEY[selectedIncident.id]]
      : null;

  const getMarkerBadge = (state: CredibilityState) => {
    switch (state) {
      case 'verified':
        return { bgClass: 'bg-emerald-600', symbol: '✓', label: 'Verified' };
      case 'corroborated':
        return { bgClass: 'bg-amber-600', symbol: '2+', label: '2+ Reports' };
      case 'unconfirmed':
        return { bgClass: 'bg-sky-600', symbol: '?', label: 'Needs Check' };
      case 'disputed':
        return { bgClass: 'bg-red-600', symbol: '!', label: 'Conflicting' };
    }
  };

  const handleUseOfficerGps = () => {
    if (!navigator.geolocation) return;
    setIsLocatingOfficer(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const pt = {
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5))
        };
        setOfficerGpsCoords(pt);
        setSelectedShelter(null);
        setSelectedHazard(null);
        onSelectIncident(null);
        await resolveNearbySheltersByCoords(
          pt,
          selectedStateFilter === 'ALL' ? 'India' : selectedStateFilter,
          'Nearby Sector'
        );
        setIsLocatingOfficer(false);
      },
      () => {
        setIsLocatingOfficer(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleBroadcastAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCoords = getStateInfo(alertStateName)?.viewCenter || ALL_INDIA_CENTER;
    const defaultMsg =
      alertSeverity === 'critical'
        ? `Immediate evacuation advised in ${alertDistrictName}, ${alertStateName}. Move to higher ground or designated relief shelters.`
        : `Official weather and safety advisory active for ${alertDistrictName}, ${alertStateName}. Stay alert and monitor updates.`;

    setAlertBroadcastSent(true);
    await dispatchAreaAlertOnServer({
      area: `${alertDistrictName}, ${alertStateName}`,
      stateName: alertStateName,
      district: alertDistrictName,
      message: alertMessage.trim() || defaultMsg,
      coordinates: targetCoords,
      urgency: alertSeverity,
      format: alertFormat
    });
    setAlertMessage('');
    setTimeout(() => {
      setAlertBroadcastSent(false);
    }, 3500);
  };

  const availableAlertDistricts = getDistrictsForState(alertStateName);

  const focusedPoint =
    selectedIncidentCoords ||
    (selectedShelter?.location ?? null) ||
    (selectedHazard?.coordinates ?? null) ||
    officerGpsCoords;

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Live Rescue Operations Map
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Real-time view of incoming citizen help requests, grounded relief shelters, live natural hazards, and local weather across India.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {isResolving && (
            <span className="text-xs text-slate-500">Resolving Google Maps places…</span>
          )}
          {quotaBlocked && !isResolving && (
            <button
              type="button"
              onClick={retryResolvePlaces}
              className="px-3 py-2 rounded-lg text-xs font-semibold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Places</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleUseOfficerGps}
            disabled={isLocatingOfficer}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <LocateFixed className="w-3.5 h-3.5 text-sky-600" />
            <span>{isLocatingOfficer ? 'Locating…' : 'Use My Location'}</span>
          </button>
          <button
            type="button"
            onClick={() => setAlertTargetingOpen(!alertTargetingOpen)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
              alertTargetingOpen
                ? 'bg-slate-200 text-slate-900'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{alertTargetingOpen ? 'Close Warning Form' : 'Broadcast Area Warning'}</span>
          </button>
        </div>
      </div>

      {/* Live Area Warning Broadcast Form */}
      {alertTargetingOpen && (
        <form
          onSubmit={handleBroadcastAlert}
          className="p-5 rounded-xl border border-slate-200 bg-white space-y-4 text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Broadcast Live Area Warning
              </h3>
              <p className="text-slate-600 mt-0.5">
                Publishes immediately to the Citizen Safe Map and Live Alerts feed via WebSocket.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAlertTargetingOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              aria-label="Close alert panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5">
                State / Union Territory
              </label>
              <select
                value={alertStateName}
                onChange={(e) => {
                  const nextSt = e.target.value;
                  setAlertStateName(nextSt);
                  const firstDist = getDistrictsForState(nextSt)[0] || nextSt;
                  setAlertDistrictName(firstDist);
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
              <label className="block font-semibold text-slate-800 mb-1.5">
                District / City
              </label>
              <select
                value={alertDistrictName}
                onChange={(e) => setAlertDistrictName(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:border-slate-900"
              >
                {availableAlertDistricts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1.5">
                Urgency Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'advisory', label: 'Advisory' },
                  { id: 'warning', label: 'Warning' },
                  { id: 'critical', label: 'Evacuate' }
                ] as const).map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setAlertSeverity(lvl.id)}
                    className={`py-2 px-2 rounded-lg border font-semibold transition-colors whitespace-nowrap truncate ${
                      alertSeverity === lvl.id
                        ? lvl.id === 'critical'
                          ? 'border-red-600 bg-red-600 text-white'
                          : 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">
              Warning Message for Citizens
            </label>
            <textarea
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              rows={2}
              placeholder={`Enter clear safety instructions for residents in ${alertDistrictName}, ${alertStateName}…`}
              className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">
              Delivery Channel
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {([
                { id: 'sms', title: 'Text SMS + Live Feed', desc: 'Works on low signal' },
                { id: 'pictograph', title: 'Visual Map Banner', desc: 'High-contrast warning' },
                { id: 'ivr', title: 'Voice Call', desc: 'Spoken in English & Hindi' },
                { id: 'audio', title: 'Local Siren', desc: 'District control alert' }
              ] as const).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setAlertFormat(fmt.id)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    alertFormat === fmt.id
                      ? 'border-red-600 bg-red-50/50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-slate-900">{fmt.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{fmt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-slate-600">
              Target Area:{' '}
              <strong className="text-slate-900">
                {alertDistrictName}, {alertStateName}
              </strong>
            </div>

            <button
              type="submit"
              disabled={alertBroadcastSent}
              className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                alertBroadcastSent
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {alertBroadcastSent
                  ? `Published to ${alertDistrictName}, ${alertStateName}`
                  : 'Publish Live Warning'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Live Environmental Telemetry & High-Ground Escape Elevation Profile */}
      {(() => {
        const focusCoords =
          focusedPoint ||
          visibleIncidentsWithCoords[0]?.coords ||
          fallbackViewport.center;
        const focusLabel = selectedIncident
          ? `${selectedIncident.landmark} (${selectedIncident.district})`
          : selectedShelter
          ? `${selectedShelter.displayName} (${selectedShelter.district})`
          : selectedHazard
          ? selectedHazard.areaLabel
          : officerGpsCoords
          ? `Your GPS Location (${officerGpsCoords.lat}° N, ${officerGpsCoords.lng}° E)`
          : selectedStateFilter === 'ALL'
          ? 'All-India Environmental Watch'
          : `${selectedStateFilter} Sector Watch`;

        const nearestShelter = visibleShelters[0] || Object.values(placesMap)[0] || null;
        const destCoords =
          selectedShelter?.location ||
          nearestShelter?.location || {
            lat: Number((focusCoords.lat + 0.022).toFixed(4)),
            lng: Number((focusCoords.lng + 0.018).toFixed(4))
          };
        const destLabel =
          selectedShelter?.displayName ||
          nearestShelter?.displayName ||
          'Designated High-Ground Relief Shelter';

        return (
          <ElevationAndWeatherBar
            weatherTargetCoords={focusCoords}
            weatherAreaLabel={focusLabel}
            escapeOriginCoords={focusCoords}
            escapeOriginLabel={
              selectedIncident ? selectedIncident.landmark : 'Active Sector Origin'
            }
            escapeDestinationCoords={destCoords}
            escapeDestinationLabel={destLabel}
          />
        );
      })()}

      {/* Map Filter Bar & Viewport */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="officer-map-state-select" className="font-semibold text-slate-700 whitespace-nowrap">
                State / UT:
              </label>
              <select
                id="officer-map-state-select"
                value={selectedStateFilter}
                onChange={(e) => {
                  setSelectedStateFilter(e.target.value);
                  setSelectedDistrictFilter('ALL');
                  onSelectIncident(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium outline-none focus:border-slate-900"
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

            {availableDistricts.length > 1 && (
              <div className="flex items-center gap-2">
                <label htmlFor="officer-map-district-select" className="font-semibold text-slate-700 whitespace-nowrap">
                  District:
                </label>
                <select
                  id="officer-map-district-select"
                  value={selectedDistrictFilter}
                  onChange={(e) => setSelectedDistrictFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium outline-none focus:border-slate-900"
                >
                  {availableDistricts.map((dist) => (
                    <option key={dist} value={dist}>
                      {dist === 'ALL' ? 'All Districts' : dist}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-slate-700">
            <label className="flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={showHazards}
                onChange={(e) => setShowHazards(e.target.checked)}
                className="rounded border-slate-300 text-slate-900"
              />
              <span>Live Hazards ({visibleHazards.length})</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={showShelters}
                onChange={(e) => setShowShelters(e.target.checked)}
                className="rounded border-slate-300 text-slate-900"
              />
              <span>Shelters ({visibleShelters.length})</span>
            </label>
          </div>
        </div>

        {/* Map Viewport: GoogleMap */}
        <div className="relative w-full h-[500px] min-h-[480px] bg-slate-100">
          <GoogleMap
            defaultCenter={ALL_INDIA_CENTER}
            defaultZoom={ALL_INDIA_ZOOM}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_git_agentskills_v1']}
            className="w-full h-full min-h-[480px]"
          >
            <OfficerMapOverlaysController
              focusedPoint={focusedPoint}
              fitPoints={visibleIncidentsWithCoords.map((v) => v.coords)}
              fitTriggerKey={selectedStateFilter}
              fallbackViewport={fallbackViewport}
            />

            {/* Officer GPS Marker */}
            {officerGpsCoords && (
              <AdvancedMarker position={officerGpsCoords} zIndex={50} title="Your GPS Position">
                <div className="px-2.5 py-1 rounded-lg bg-sky-700 text-white border-2 border-white shadow-md text-[11px] font-bold whitespace-nowrap">
                  Your Location
                </div>
              </AdvancedMarker>
            )}

            {/* Live Public Hazard Markers (USGS / NASA / Broadcasts) */}
            {visibleHazards.map((hazard) => {
              if (!hazard.coordinates) return null;
              const isSelected = selectedHazard?.id === hazard.id;
              return (
                <AdvancedMarker
                  key={`haz-${hazard.id}`}
                  position={hazard.coordinates}
                  title={hazard.title}
                  zIndex={isSelected ? 42 : 18}
                  onClick={() => {
                    setSelectedHazard(hazard);
                    setSelectedShelter(null);
                    onSelectIncident(null);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHazard(hazard);
                      setSelectedShelter(null);
                      onSelectIncident(null);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-white border shadow-md text-[11px] font-semibold whitespace-nowrap transition-transform cursor-pointer ${
                      hazard.severity === 'critical' ? 'bg-red-700' : 'bg-amber-600'
                    } ${
                      isSelected ? 'ring-2 ring-amber-300 scale-105 border-white' : 'border-white hover:scale-105'
                    }`}
                  >
                    <span>!</span>
                    <span className="max-w-[140px] truncate">{hazard.title}</span>
                  </button>
                </AdvancedMarker>
              );
            })}

            {/* Relief Shelter Advanced Markers */}
            {visibleShelters.map((shelter, idx) => {
              const isSelected = selectedShelter?.key === shelter.key;
              const sLoad = shelterLoads[shelter.key];
              const pct = sLoad ? Math.round((sLoad.occupied / Math.max(1, sLoad.capacity)) * 100) : null;
              const isNearFull = pct !== null && pct >= 85;
              return (
                <AdvancedMarker
                  key={`shelter-${shelter.key}`}
                  position={shelter.location}
                  title={shelter.publicTitle}
                  zIndex={isSelected ? 45 : 25}
                  onClick={() => {
                    setSelectedShelter(shelter);
                    setSelectedHazard(null);
                    onSelectIncident(null);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShelter(shelter);
                      setSelectedHazard(null);
                      onSelectIncident(null);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white border shadow-md text-[11px] font-semibold whitespace-nowrap transition-transform cursor-pointer ${
                      isNearFull ? 'bg-amber-700' : 'bg-emerald-900'
                    } ${
                      isSelected
                        ? 'ring-2 ring-emerald-400 scale-105 border-white'
                        : 'border-white hover:scale-105'
                    }`}
                  >
                    <span className="font-bold">S{idx + 1}</span>
                    <span>{shelter.displayName}</span>
                    {pct !== null && (
                      <span className="font-mono text-[10px] opacity-90 tabular-nums">{pct}%</span>
                    )}
                  </button>
                </AdvancedMarker>
              );
            })}

            {/* Active Rescue Incident Advanced Markers */}
            {visibleIncidentsWithCoords.map(({ incident, coords }) => {
              const badge = getMarkerBadge(incident.state);
              const isSelected = selectedIncident?.id === incident.id;
              return (
                <AdvancedMarker
                  key={incident.id}
                  position={coords}
                  title={incident.title}
                  zIndex={isSelected ? 48 : 30}
                  onClick={() => {
                    setSelectedShelter(null);
                    setSelectedHazard(null);
                    onSelectIncident(incident);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShelter(null);
                      setSelectedHazard(null);
                      onSelectIncident(incident);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-slate-900 shadow-md text-[11px] font-semibold whitespace-nowrap transition-transform ${
                      isSelected
                        ? 'ring-2 ring-slate-900 scale-105 border border-slate-900'
                        : 'border border-slate-300 hover:scale-105'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full ${badge.bgClass} text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0`}
                    >
                      {badge.symbol}
                    </span>
                    <span className="max-w-[160px] truncate">{incident.title}</span>
                  </button>
                </AdvancedMarker>
              );
            })}
          </GoogleMap>

          {/* Selected Live Hazard Detail Overlay */}
          {selectedHazard && (
            <div className="absolute top-3 right-3 max-w-xs w-[calc(100%-1.5rem)] bg-white text-slate-900 rounded-xl border border-amber-200 shadow-lg p-4 text-xs z-20 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] text-amber-800 font-semibold">
                    {selectedHazard.source === 'usgs_earthquake'
                      ? 'USGS Live Seismic Feed'
                      : selectedHazard.source === 'nasa_eonet'
                      ? 'NASA EONET Satellite Feed'
                      : 'Active Area Warning'}{' '}
                    · {selectedHazard.areaLabel}
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">
                    {selectedHazard.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHazard(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                  aria-label="Close hazard details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">{selectedHazard.summary}</p>
              {selectedHazard.externalUrl && (
                <a
                  href={selectedHazard.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-slate-800 hover:text-slate-950 inline-flex items-center gap-1 underline underline-offset-2"
                >
                  <span>Open Official Sensor Bulletin</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Selected Incident Detail Overlay */}
          {selectedIncident && (
            <div className="absolute top-3 right-3 max-w-xs w-[calc(100%-1.5rem)] bg-white text-slate-900 rounded-xl border border-slate-200 shadow-lg p-4 text-xs z-20 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] text-slate-500">
                    <strong
                      className={
                        selectedIncident.state === 'verified'
                          ? 'text-emerald-700'
                          : selectedIncident.state === 'corroborated'
                          ? 'text-amber-700'
                          : selectedIncident.state === 'disputed'
                          ? 'text-rose-700'
                          : 'text-sky-700'
                      }
                    >
                      {getMarkerBadge(selectedIncident.state).label}
                    </strong>
                    {' · '}
                    <span>{formatLocationWithState(selectedIncident.district, selectedIncident.stateName)}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">
                    {selectedIncident.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectIncident(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                  aria-label="Close incident details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-slate-600 text-[11px]">
                {selectedIncidentPlace
                  ? selectedIncidentPlace.formattedAddress
                  : selectedIncident.landmark}
              </div>

              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between tabular-nums">
                <span>Updated {selectedIncident.ageMinutes}m ago</span>
                <strong className="text-slate-900">{selectedIncident.currentReliability}% confidence</strong>
              </div>

              {selectedIncident.state === 'disputed' && selectedIncident.conflictingReports && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-900">
                  {selectedIncident.conflictingReports.conservativeAction}
                </div>
              )}

              {selectedIncident.freshnessStatus === 'stale' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                  {selectedIncident.fallbackInstructions}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                {(selectedIncidentPlace?.googleMapsURI || selectedIncidentCoords) && (
                  <a
                    href={
                      selectedIncidentPlace?.googleMapsURI ||
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${selectedIncidentCoords!.lat},${selectedIncidentCoords!.lng}`
                      )}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    <span>Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onOpenProvenance(selectedIncident)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors ml-auto"
                >
                  Details ({selectedIncident.provenanceTrail.length})
                </button>
              </div>
            </div>
          )}

          {/* Selected Shelter Detail Overlay */}
          {selectedShelter && (
            <div className="absolute top-3 right-3 max-w-xs w-[calc(100%-1.5rem)] bg-white text-slate-900 rounded-xl border border-emerald-200 shadow-lg p-4 text-xs z-20 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                    <span>
                      Designated Relief Shelter ·{' '}
                      {formatLocationWithState(selectedShelter.district, selectedShelter.stateName)}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">
                    {selectedShelter.displayName || selectedShelter.publicTitle}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedShelter(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                  aria-label="Close shelter details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-slate-600 text-[11px]">
                {selectedShelter.formattedAddress}
              </div>

              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[11px] text-emerald-950 leading-relaxed">
                {selectedShelter.publicSummary}
              </div>

              {/* Officer Live Shelter Load Controls */}
              {(() => {
                const existingLoad = shelterLoads[selectedShelter.key] || {
                  placeKey: selectedShelter.key,
                  title: selectedShelter.displayName || selectedShelter.publicTitle,
                  district: selectedShelter.district,
                  stateName: selectedShelter.stateName || 'India',
                  occupied: 0,
                  capacity: 400,
                  updatedAt: Date.now()
                };
                const pct = Math.min(
                  100,
                  Math.round((existingLoad.occupied / Math.max(1, existingLoad.capacity)) * 100)
                );
                const nearFull = pct >= 85;

                return (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] tabular-nums">
                      <span className="font-semibold text-slate-700">Reported Occupancy</span>
                      <strong className={`font-mono ${nearFull ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {existingLoad.occupied} / {existingLoad.capacity} ({pct}%)
                      </strong>
                    </div>
                    <progress
                      value={pct}
                      max={100}
                      className={`w-full h-1.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:rounded-full ${
                        nearFull
                          ? '[&::-webkit-progress-value]:bg-amber-500 [&::-moz-progress-bar]:bg-amber-500'
                          : '[&::-webkit-progress-value]:bg-emerald-600 [&::-moz-progress-bar]:bg-emerald-600'
                      }`}
                    />
                    {nearFull && (
                      <div className="text-[10px] text-amber-800 font-medium">
                        Overflow redirect active on Citizen Map.
                      </div>
                    )}
                    {onUpdateShelterLoad && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateShelterLoad(
                              existingLoad.placeKey,
                              existingLoad.occupied - 15,
                              existingLoad.capacity,
                              existingLoad.title,
                              existingLoad.district,
                              existingLoad.stateName,
                              existingLoad.redirectPlaceKey,
                              existingLoad.redirectTitle
                            )
                          }
                          className="flex-1 py-1 px-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-[11px] transition-colors"
                        >
                          -15 Discharged
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateShelterLoad(
                              existingLoad.placeKey,
                              existingLoad.occupied + 15,
                              existingLoad.capacity,
                              existingLoad.title,
                              existingLoad.district,
                              existingLoad.stateName,
                              existingLoad.redirectPlaceKey,
                              existingLoad.redirectTitle || 'Nearest Backup Relief Camp'
                            )
                          }
                          className="flex-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] transition-colors"
                        >
                          +15 Intake
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 tabular-nums">Helpline: 1070 / 112</span>
                {selectedShelter.googleMapsURI && (
                  <a
                    href={selectedShelter.googleMapsURI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    <span>Directions</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Clean Unboxed Legend Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold inline-flex items-center justify-center">✓</span>
              Verified
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[9px] font-bold inline-flex items-center justify-center">2+</span>
              2+ Reports
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-sky-600 text-white text-[10px] font-bold inline-flex items-center justify-center">?</span>
              Needs Check
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold inline-flex items-center justify-center">!</span>
              Live Hazard / Conflict
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Powered by Google Maps Platform · Click any pin for details
          </span>
        </div>
      </div>
    </div>
  );
};
