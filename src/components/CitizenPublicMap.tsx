import React, { useEffect, useMemo, useState } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  useMap
} from '@vis.gl/react-google-maps';
import {
  ShieldCheck,
  ExternalLink,
  Navigation,
  Home,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  LocateFixed,
  X
} from 'lucide-react';
import {
  GroundedPlaceRecord,
  MentionedPlaceKey,
  PUBLIC_PLACE_SPECS,
  PlaceQuerySpec,
  GeoPoint
} from '../services/groundedLocations';
import {
  ALL_INDIA_CENTER,
  ALL_INDIA_ZOOM,
  INDIAN_STATES_ONLY,
  INDIAN_UTS_ONLY,
  getStateInfo,
  formatLocationWithState,
  getDistrictsForState
} from '../data/indianStates';
import { LivePublicHazardItem, ShelterLoadRecord } from '../types/disaster';
import { ElevationAndWeatherBar } from './ElevationAndWeatherBar';

interface CitizenPublicMapProps {
  placesMap: Record<string, GroundedPlaceRecord>;
  isResolving: boolean;
  quotaBlocked?: boolean;
  onRetryPlaces?: () => void;
  focusedPlaceKey: MentionedPlaceKey | null;
  onSelectPlaceKey: (key: MentionedPlaceKey | null) => void;
  selectedStateFilter?: string;
  onSelectStateFilter?: (stateName: string) => void;
  shelterLoads?: Record<string, ShelterLoadRecord>;
  liveHazards?: LivePublicHazardItem[];
  onDiscoverNearbyShelters?: (
    coords: GeoPoint,
    stateName?: string,
    district?: string
  ) => Promise<GroundedPlaceRecord[]>;
}

const CitizenMapOverlaysController: React.FC<{
  focusedPoint: GeoPoint | null;
  fitPoints: GeoPoint[];
  fitTriggerKey: string;
  fallbackViewport: { center: GeoPoint; zoom: number } | null;
}> = ({ focusedPoint, fitPoints, fitTriggerKey, fallbackViewport }) => {
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

export const CitizenPublicMap: React.FC<CitizenPublicMapProps> = ({
  placesMap,
  isResolving,
  quotaBlocked = false,
  onRetryPlaces,
  focusedPlaceKey,
  onSelectPlaceKey,
  selectedStateFilter,
  onSelectStateFilter,
  shelterLoads = {},
  liveHazards = [],
  onDiscoverNearbyShelters
}) => {
  const [internalStateFilter, setInternalStateFilter] = useState<string>('ALL');
  const activeState = selectedStateFilter ?? internalStateFilter;
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('ALL');

  const [showShelters, setShowShelters] = useState(true);
  const [showLiveHazards, setShowLiveHazards] = useState(true);

  const [userGpsCoords, setUserGpsCoords] = useState<GeoPoint | null>(null);
  const [gpsStatusText, setGpsStatusText] = useState<string>('');
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const [selectedHazard, setSelectedHazard] = useState<LivePublicHazardItem | null>(null);

  const availableDistricts = useMemo(() => {
    if (activeState === 'ALL') {
      return [
        'ALL',
        'New Delhi',
        'Mumbai',
        'Chennai',
        'Kolkata',
        'Kamrup Metropolitan',
        'Patna',
        'Puri',
        'Wayanad'
      ];
    }
    return ['ALL', ...getDistrictsForState(activeState)];
  }, [activeState]);

  const handleStateChange = (nextState: string) => {
    setInternalStateFilter(nextState);
    setSelectedDistrictFilter('ALL');
    setSelectedHazard(null);
    if (onSelectStateFilter) {
      onSelectStateFilter(nextState);
    }
    onSelectPlaceKey(null);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsStatusText('Browser geolocation is not supported on this device.');
      return;
    }
    setIsLocatingGps(true);
    setGpsStatusText('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: GeoPoint = {
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5))
        };
        setUserGpsCoords(coords);
        setSelectedHazard(null);
        onSelectPlaceKey(null);
        setIsLocatingGps(false);

        if (onDiscoverNearbyShelters) {
          const found = await onDiscoverNearbyShelters(coords, activeState, selectedDistrictFilter);
          setGpsStatusText(
            found.length > 0
              ? `Centered on your GPS — found ${found.length} nearby public facilities.`
              : 'Centered on your live GPS coordinates.'
          );
        } else {
          setGpsStatusText('Centered on your live GPS coordinates.');
        }
      },
      () => {
        setIsLocatingGps(false);
        setGpsStatusText('Location permission declined. Select your State or District below.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const activePlace = focusedPlaceKey ? placesMap[focusedPlaceKey] || null : null;

  const matchesRoleAndState = (
    role: PlaceQuerySpec['publicRole'],
    stateName: string
  ): boolean => {
    if ((role === 'shelter' || role === 'backup_shelter') && !showShelters) return false;
    if (stateName === 'Nearby GPS') return showShelters;
    if (activeState !== 'ALL' && stateName.toLowerCase() !== activeState.toLowerCase()) return false;
    return true;
  };

  const visiblePlaces = useMemo(() => {
    return Object.values(placesMap).filter(
      (p): p is GroundedPlaceRecord =>
        Boolean(p?.location) &&
        matchesRoleAndState(p.publicRole, p.stateName || 'India') &&
        (p.stateName === 'Nearby GPS' ||
          selectedDistrictFilter === 'ALL' ||
          p.district.toLowerCase() === selectedDistrictFilter.toLowerCase())
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesMap, activeState, selectedDistrictFilter, showShelters]);

  const mappableHazards = useMemo(() => {
    if (!showLiveHazards) return [];
    return liveHazards.filter((h) => {
      if (!h.coordinates) return false;
      if (activeState !== 'ALL' && h.stateName && h.stateName.toLowerCase() !== activeState.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [liveHazards, showLiveHazards, activeState]);

  const filteredSpecs = useMemo(() => {
    const baseSpecs = PUBLIC_PLACE_SPECS.filter(
      (spec) =>
        matchesRoleAndState(spec.publicRole, spec.stateName) &&
        (selectedDistrictFilter === 'ALL' ||
          spec.district.toLowerCase() === selectedDistrictFilter.toLowerCase())
    );
    const dynamicResolved = Object.values(placesMap)
      .filter(
        (p) =>
          (p.key.startsWith('state_shelter_') || p.key.startsWith('gps_nearby_')) &&
          matchesRoleAndState(p.publicRole, p.stateName) &&
          (p.stateName === 'Nearby GPS' ||
            selectedDistrictFilter === 'ALL' ||
            p.district.toLowerCase() === selectedDistrictFilter.toLowerCase())
      )
      .map(
        (p): PlaceQuerySpec => ({
          key: p.key,
          textQuery: `${p.displayName} ${p.district} ${p.stateName}`,
          stateName: p.stateName,
          district: p.district,
          publicRole: p.publicRole,
          publicTitle: p.publicTitle,
          publicSummary: p.publicSummary
        })
      );
    const merged = [...dynamicResolved, ...baseSpecs];
    if (merged.length === 0 && activeState !== 'ALL' && showShelters) {
      const stInfo = getStateInfo(activeState);
      const primaryDistrict =
        selectedDistrictFilter !== 'ALL'
          ? selectedDistrictFilter
          : stInfo?.districts[0] || activeState;
      return [
        {
          key: `state_shelter_${activeState.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
          textQuery: `Government Higher Secondary School ${primaryDistrict} ${activeState} India`,
          stateName: activeState,
          district: primaryDistrict,
          publicRole: 'shelter' as const,
          publicTitle: `${primaryDistrict} Public Relief Shelter (${activeState})`,
          publicSummary: `Public school / assembly shelter in ${primaryDistrict}, ${activeState}.`
        }
      ];
    }
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesMap, activeState, selectedDistrictFilter, showShelters]);

  const fallbackViewport = useMemo(() => {
    if (activeState === 'ALL') {
      return { center: ALL_INDIA_CENTER, zoom: ALL_INDIA_ZOOM };
    }
    const stInfo = getStateInfo(activeState);
    if (stInfo) {
      return { center: stInfo.viewCenter, zoom: stInfo.viewZoom };
    }
    return { center: ALL_INDIA_CENTER, zoom: ALL_INDIA_ZOOM };
  }, [activeState]);

  const getBadgeConfig = (role: PlaceQuerySpec['publicRole'], key: MentionedPlaceKey) => {
    const load = shelterLoads[key];
    const loadPct = load ? Math.round((load.occupied / Math.max(1, load.capacity)) * 100) : null;
    if (role === 'shelter') {
      const isFull = loadPct !== null && loadPct >= 85;
      return {
        bgClass: isFull ? 'bg-amber-600' : 'bg-emerald-600',
        code: 'S',
        tag: isFull ? 'Near Capacity' : 'Public Shelter',
        tagColor: isFull ? 'text-amber-700' : 'text-emerald-700'
      };
    }
    if (role === 'backup_shelter') {
      return {
        bgClass: 'bg-emerald-700',
        code: 'B',
        tag: 'Backup Shelter',
        tagColor: 'text-emerald-700'
      };
    }
    return {
      bgClass: 'bg-amber-600',
      code: '!',
      tag: 'Advisory',
      tagColor: 'text-amber-700'
    };
  };

  const focusedMapPoint: GeoPoint | null =
    selectedHazard?.coordinates || activePlace?.location || userGpsCoords || null;

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Safe Shelters &amp; Live Hazard Map
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Find nearby public shelters, live weather &amp; air quality, and real-time hazard advisories across all 28 States &amp; 8 Union Territories. Private homes and SOS requests are never displayed publicly.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocatingGps}
            className="px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>{isLocatingGps ? 'Locating GPS…' : 'Use My Location'}</span>
          </button>

          {isResolving && (
            <span className="text-xs text-slate-500 font-medium">
              Loading map places…
            </span>
          )}
          {quotaBlocked && !isResolving && onRetryPlaces && (
            <button
              type="button"
              onClick={onRetryPlaces}
              className="px-3 py-2 rounded-lg text-xs font-semibold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Places</span>
            </button>
          )}
        </div>
      </div>

      {gpsStatusText && (
        <div className="px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 flex items-center justify-between gap-2">
          <span>{gpsStatusText}</span>
          {userGpsCoords && (
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {userGpsCoords.lat.toFixed(4)}, {userGpsCoords.lng.toFixed(4)}
            </span>
          )}
        </div>
      )}

      {/* Live Weather, Rain, Air Quality & High-Ground Terrain Profile */}
      {(() => {
        const primaryShelter =
          visiblePlaces.find((p) => p.publicRole === 'shelter' || p.publicRole === 'backup_shelter') ||
          null;

        const weatherCoords =
          userGpsCoords || activePlace?.location || primaryShelter?.location || fallbackViewport.center;
        const weatherLabel = userGpsCoords
          ? 'Your Current GPS Area'
          : activePlace
          ? `${activePlace.displayName} (${activePlace.district})`
          : activeState === 'ALL'
          ? 'Central India Overview'
          : `${activeState} Region`;

        const escOriginCoords =
          userGpsCoords ||
          (activePlace
            ? {
                lat: Number((activePlace.location.lat - 0.015).toFixed(4)),
                lng: Number((activePlace.location.lng - 0.015).toFixed(4))
              }
            : {
                lat: Number((weatherCoords.lat - 0.015).toFixed(4)),
                lng: Number((weatherCoords.lng - 0.015).toFixed(4))
              });
        const escOriginLabel = userGpsCoords
          ? 'Your GPS Position'
          : activePlace
          ? `Nearby Sector (${activePlace.district})`
          : 'Surrounding Sector';

        const escDestCoords = activePlace?.location || primaryShelter?.location || weatherCoords;
        const escDestLabel =
          activePlace?.displayName || primaryShelter?.displayName || 'Nearest Public Relief Point';

        return (
          <ElevationAndWeatherBar
            weatherTargetCoords={weatherCoords}
            weatherAreaLabel={weatherLabel}
            escapeOriginCoords={escOriginCoords}
            escapeOriginLabel={escOriginLabel}
            escapeDestinationCoords={escDestCoords}
            escapeDestinationLabel={escDestLabel}
          />
        );
      })()}

      {/* Map Container */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="citizen-map-state-select" className="font-semibold text-slate-700 whitespace-nowrap">
                State / UT:
              </label>
              <select
                id="citizen-map-state-select"
                value={activeState}
                onChange={(e) => handleStateChange(e.target.value)}
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

            <div className="flex items-center gap-2">
              <label htmlFor="citizen-map-district-select" className="font-semibold text-slate-700 whitespace-nowrap">
                District:
              </label>
              <select
                id="citizen-map-district-select"
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
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-700">
            <label className="flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={showShelters}
                onChange={(e) => setShowShelters(e.target.checked)}
                className="rounded border-slate-300 text-slate-900"
              />
              <span>Shelters</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={showLiveHazards}
                onChange={(e) => setShowLiveHazards(e.target.checked)}
                className="rounded border-slate-300 text-slate-900"
              />
              <span>Live Hazards ({mappableHazards.length})</span>
            </label>
          </div>
        </div>

        {/* Google Map */}
        <div className="relative w-full h-[500px] min-h-[480px] bg-slate-100">
          <GoogleMap
            defaultCenter={ALL_INDIA_CENTER}
            defaultZoom={ALL_INDIA_ZOOM}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_git_agentskills_v1']}
            className="w-full h-full"
          >
            <CitizenMapOverlaysController
              focusedPoint={focusedMapPoint}
              fitPoints={visiblePlaces.map((p) => p.location)}
              fitTriggerKey={activeState}
              fallbackViewport={fallbackViewport}
            />

            {userGpsCoords && (
              <AdvancedMarker position={userGpsCoords} title="Your GPS Location" zIndex={60}>
                <div className="px-2.5 py-1 rounded-lg bg-sky-700 text-white text-[11px] font-bold shadow-md border border-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span>You</span>
                </div>
              </AdvancedMarker>
            )}

            {visiblePlaces.map((place) => {
              const badge = getBadgeConfig(place.publicRole, place.key);
              const isSelected = activePlace?.key === place.key;
              return (
                <AdvancedMarker
                  key={place.key}
                  position={place.location}
                  title={place.publicTitle}
                  zIndex={isSelected ? 40 : 20}
                  onClick={() => {
                    setSelectedHazard(null);
                    onSelectPlaceKey(place.key);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHazard(null);
                      onSelectPlaceKey(place.key);
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
                      {badge.code}
                    </span>
                    <span className="max-w-[160px] truncate">{place.displayName}</span>
                  </button>
                </AdvancedMarker>
              );
            })}

            {mappableHazards.map((hazard) => {
              if (!hazard.coordinates) return null;
              const isSelected = selectedHazard?.id === hazard.id;
              const bg =
                hazard.severity === 'critical'
                  ? 'bg-red-600'
                  : hazard.severity === 'warning'
                  ? 'bg-amber-600'
                  : 'bg-slate-800';
              return (
                <AdvancedMarker
                  key={hazard.id}
                  position={hazard.coordinates}
                  title={hazard.title}
                  zIndex={isSelected ? 50 : 25}
                  onClick={() => {
                    onSelectPlaceKey(null);
                    setSelectedHazard(hazard);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPlaceKey(null);
                      setSelectedHazard(hazard);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${bg} text-white shadow-md text-[11px] font-semibold whitespace-nowrap transition-transform ${
                      isSelected ? 'ring-2 ring-white scale-105' : 'hover:scale-105'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span className="max-w-[150px] truncate">{hazard.title}</span>
                  </button>
                </AdvancedMarker>
              );
            })}
          </GoogleMap>

          {/* Selected Live Hazard Detail Card */}
          {selectedHazard && (
            <div className="absolute top-3 right-3 max-w-xs w-[calc(100%-1.5rem)] bg-white text-slate-900 rounded-xl border border-slate-200 shadow-lg p-4 text-xs z-20 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-red-700 uppercase">
                    {selectedHazard.source === 'usgs_earthquake'
                      ? 'USGS Live Seismic Network'
                      : selectedHazard.source === 'nasa_eonet'
                      ? 'NASA EONET Satellite'
                      : 'Official Area Warning'}
                  </span>
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
              <p className="text-slate-700 leading-relaxed">{selectedHazard.summary}</p>
              <div className="text-[11px] text-slate-500 tabular-nums">
                Updated: {new Date(selectedHazard.updatedAt).toLocaleString('en-IN')}
              </div>
              {selectedHazard.externalUrl && (
                <a
                  href={selectedHazard.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-900 underline"
                >
                  <span>View Official Event Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Selected Public Place Detail Card */}
          {activePlace && !selectedHazard && (
            <div className="absolute top-3 right-3 max-w-xs w-[calc(100%-1.5rem)] bg-white text-slate-900 rounded-xl border border-slate-200 shadow-lg p-4 text-xs z-20 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`text-[11px] font-semibold ${
                      getBadgeConfig(activePlace.publicRole, activePlace.key).tagColor
                    }`}
                  >
                    {getBadgeConfig(activePlace.publicRole, activePlace.key).tag} ·{' '}
                    {formatLocationWithState(activePlace.district, activePlace.stateName)}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">
                    {activePlace.publicTitle}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectPlaceKey(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                  aria-label="Close place details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-[11px] text-slate-500">
                {activePlace.formattedAddress}
              </div>

              <p className="text-slate-700 leading-relaxed">{activePlace.publicSummary}</p>

              {(() => {
                const load = shelterLoads[activePlace.key];
                if (!load) return null;
                const pct = Math.min(100, Math.round((load.occupied / Math.max(1, load.capacity)) * 100));
                const nearFull = pct >= 85;
                return (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-slate-600 font-sans font-medium">Live Reported Occupancy</span>
                      <strong className={nearFull ? 'text-amber-700' : 'text-emerald-700'}>
                        {load.occupied}/{load.capacity} ({pct}%)
                      </strong>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <progress
                        value={pct}
                        max={100}
                        className="w-full h-full accent-emerald-600"
                      />
                    </div>
                    {nearFull && load.redirectPlaceKey && (
                      <button
                        type="button"
                        onClick={() => onSelectPlaceKey(load.redirectPlaceKey!)}
                        className="w-full mt-1 py-1.5 px-2.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-colors text-center"
                      >
                        Redirect to {load.redirectTitle || 'Backup Shelter'}
                      </button>
                    )}
                  </div>
                );
              })()}

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <a
                  href={activePlace.googleMapsDirectionsURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Directions</span>
                </a>
                <a
                  href={activePlace.googleMapsURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Clean Unboxed Legend Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold inline-flex items-center justify-center">S</span>
              Public Shelter
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center justify-center">B</span>
              Backup Facility
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold inline-flex items-center justify-center">!</span>
              Live Hazard / Warning
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Private homes hidden · Google Maps
          </span>
        </div>
      </div>

      {/* Quick Jump & Direct Google Maps Place Directory */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {filteredSpecs.map((spec) => {
          const resolvedItem = placesMap[spec.key];
          const isFocused = focusedPlaceKey === spec.key && Boolean(resolvedItem);
          const badge = getBadgeConfig(spec.publicRole, spec.key);
          const directSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            spec.textQuery
          )}`;

          if (resolvedItem) {
            return (
              <button
                key={spec.key}
                type="button"
                onClick={() => {
                  setSelectedHazard(null);
                  onSelectPlaceKey(spec.key);
                }}
                className={`p-3 rounded-xl border text-left transition-colors text-xs space-y-1 ${
                  isFocused
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className={`font-semibold ${badge.tagColor}`}>
                    {badge.tag} · {spec.stateName}
                  </span>
                  {spec.publicRole === 'shelter' || spec.publicRole === 'backup_shelter' ? (
                    <Home className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : spec.publicRole === 'fact_check' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  )}
                </div>
                <div className="font-bold text-slate-900 line-clamp-1">{resolvedItem.displayName}</div>
                <div className="text-[11px] text-slate-500 line-clamp-1">{resolvedItem.formattedAddress}</div>
              </button>
            );
          }

          return (
            <div
              key={spec.key}
              className="p-3 rounded-xl border border-slate-200 bg-white text-left text-xs flex flex-col justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className={`font-semibold ${badge.tagColor}`}>
                    {badge.tag} · {formatLocationWithState(spec.district, spec.stateName)}
                  </span>
                  <Home className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                </div>
                <div className="font-bold text-slate-900 line-clamp-1">{spec.publicTitle}</div>
                <div className="text-[11px] text-slate-600 line-clamp-2">{spec.publicSummary}</div>
              </div>
              <a
                href={directSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-slate-900 hover:text-slate-700 inline-flex items-center gap-1 underline underline-offset-2 pt-1 border-t border-slate-100"
              >
                <span>Open in Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};
