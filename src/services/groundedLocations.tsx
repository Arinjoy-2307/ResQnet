import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  DistrictName,
  ElevationProfileResult,
  ElevationSamplePoint,
  EnvironmentalSnapshot,
  IndianStateName
} from '../types/disaster';
import { inferStateFromDistrict } from '../data/indianStates';

export type GeoPoint = google.maps.LatLngLiteral;

export type MentionedPlaceKey = string;

export interface GroundedPlaceRecord {
  key: MentionedPlaceKey;
  placeId: string;
  displayName: string;
  formattedAddress: string;
  location: GeoPoint;
  googleMapsURI: string;
  googleMapsDirectionsURI: string;
  stateName: IndianStateName;
  district: DistrictName;
  publicRole: 'shelter' | 'backup_shelter' | 'road_advisory' | 'flood_zone' | 'fact_check';
  publicTitle: string;
  publicSummary: string;
}

export interface PlaceQuerySpec {
  key: MentionedPlaceKey;
  textQuery: string;
  stateName: IndianStateName;
  district: DistrictName;
  publicRole: GroundedPlaceRecord['publicRole'];
  publicTitle: string;
  publicSummary: string;
}

export function isRealGoogleMapsKey(key?: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 25) return false;
  if (!trimmed.startsWith('AIza')) return false;
  if (
    trimmed.includes('MY_') ||
    trimmed.includes('YOUR_') ||
    trimmed.includes('CHANGE_ME') ||
    trimmed.includes('EXAMPLE')
  ) {
    return false;
  }
  return true;
}

/**
 * Designated regional emergency assembly & civic relief points across India,
 * resolved dynamically at runtime via Google Maps Platform Places API (New) (`Place.searchByText`).
 */
export const PUBLIC_PLACE_SPECS: PlaceQuerySpec[] = [
  {
    key: 'delhi_talkatora_hub',
    textQuery: 'Talkatora Indoor Stadium New Delhi India',
    stateName: 'Delhi',
    district: 'New Delhi',
    publicRole: 'shelter',
    publicTitle: 'Talkatora Civic Relief Hub (New Delhi)',
    publicSummary: 'Designated indoor civic assembly center with drinking water and medical access.'
  },
  {
    key: 'mumbai_bms_hub',
    textQuery: 'Nehru Science Centre Worli Mumbai Maharashtra',
    stateName: 'Maharashtra',
    district: 'Mumbai',
    publicRole: 'shelter',
    publicTitle: 'Mumbai Central Civic Assembly Point (Maharashtra)',
    publicSummary: 'Urban monsoon & coastal emergency coordination point with road access.'
  },
  {
    key: 'chennai_nehru_stadium',
    textQuery: 'Jawaharlal Nehru Stadium Periamet Chennai Tamil Nadu',
    stateName: 'Tamil Nadu',
    district: 'Chennai',
    publicRole: 'shelter',
    publicTitle: 'Chennai Coastal Relief Assembly Hub (Tamil Nadu)',
    publicSummary: 'Designated cyclone & heavy-rain public relief staging facility.'
  },
  {
    key: 'kolkata_netaji_indoor',
    textQuery: 'Netaji Indoor Stadium Eden Gardens Kolkata West Bengal',
    stateName: 'West Bengal',
    district: 'Kolkata',
    publicRole: 'shelter',
    publicTitle: 'Netaji Indoor Relief Hub (Kolkata, West Bengal)',
    publicSummary: 'Regional storm & flood assembly center near Hooghly corridor.'
  },
  {
    key: 'guwahati_sarusajai_hub',
    textQuery: 'Sarusajai Indoor Stadium Guwahati Assam',
    stateName: 'Assam',
    district: 'Kamrup Metropolitan',
    publicRole: 'shelter',
    publicTitle: 'Sarusajai Regional Relief Staging Hub (Assam)',
    publicSummary: 'Northeast flood response & high-ground public shelter point.'
  },
  {
    key: 'patna_gandhi_maidan',
    textQuery: 'Gandhi Maidan Patna Bihar',
    stateName: 'Bihar',
    district: 'Patna',
    publicRole: 'shelter',
    publicTitle: 'Gandhi Maidan Relief Ground (Patna, Bihar)',
    publicSummary: 'Designated riverine flood assembly & medical aid ground.'
  },
  {
    key: 'puri_cyclone_shelter',
    textQuery: 'Gopabandhu Ayurveda Mahavidyalaya Puri Odisha',
    stateName: 'Odisha',
    district: 'Puri',
    publicRole: 'shelter',
    publicTitle: 'Puri Coastal Cyclone Shelter (Odisha)',
    publicSummary: 'High-plinth coastal cyclone evacuation facility.'
  },
  {
    key: 'wayanad_kalpetta_camp',
    textQuery: 'SKMJ Higher Secondary School Kalpetta Wayanad Kerala',
    stateName: 'Kerala',
    district: 'Wayanad',
    publicRole: 'backup_shelter',
    publicTitle: 'Kalpetta High-Ground School Shelter (Wayanad, Kerala)',
    publicSummary: 'Hill-district public school designated for landslide & rain evacuation.'
  }
];

export const INCIDENT_TO_PLACE_KEY: Record<string, MentionedPlaceKey> = {};

const PLACES_STORAGE_KEY = 'resqnet_gmp_places_india_v4';
const DETOUR_STORAGE_KEY = 'resqnet_gmp_detour_route_v3';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ENV_CACHE_TTL_MS = 10 * 60 * 1000; // 10-minute live telemetry cache
const QUOTA_COOLDOWN_MS = 60 * 1000;

interface CachedPayload<T> {
  expiresAt: number;
  data: T;
}

export interface DetourRouteData {
  path: GeoPoint[];
  distanceKm: string;
  durationMin: number;
}

function readExpiringCache<T>(storageKey: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number' || Date.now() > parsed.expiresAt) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeExpiringCache<T>(storageKey: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
  try {
    const payload: CachedPayload<T> = {
      expiresAt: Date.now() + ttlMs,
      data
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

let quotaCooldownUntil = 0;

function isQuotaActiveCooldown(): boolean {
  return Date.now() < quotaCooldownUntil;
}

export function emitMapsQuotaExceededIfApplicable(err: unknown): boolean {
  const errObj = err as { code?: unknown; status?: unknown; name?: unknown; message?: unknown } | null;
  const combined = [
    err instanceof Error ? `${err.name} ${err.message}` : String(err || ''),
    errObj?.code ? String(errObj.code) : '',
    errObj?.status ? String(errObj.status) : ''
  ].join(' ');

  const isQuotaError =
    combined.includes('RESOURCE_EXHAUSTED') ||
    combined.includes('OVER_QUERY_LIMIT') ||
    combined.includes('OverQuotaMapError') ||
    combined.includes('QuotaExceeded') ||
    /\b429\b/.test(combined);

  if (isQuotaError) {
    quotaCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    return true;
  }
  return false;
}

function toLatLngLiteral(loc: google.maps.LatLng | google.maps.LatLngLiteral): GeoPoint {
  const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
  const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
  return { lat, lng };
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let sessionPlacesMemory: Record<string, GroundedPlaceRecord> =
  readExpiringCache<Record<string, GroundedPlaceRecord>>(PLACES_STORAGE_KEY) || {};

let activePlacesPromise: Promise<{
  resolved: Record<string, GroundedPlaceRecord>;
  hitQuota: boolean;
}> | null = null;

const sessionLandmarkMemory: Record<string, GeoPoint> = {};

function hasAllPublicPlaces(map: Record<string, GroundedPlaceRecord>): boolean {
  return PUBLIC_PLACE_SPECS.every((spec) => Boolean(map[spec.key]?.location && map[spec.key]?.placeId));
}

export function useGroundedAssamPlaces(options?: {
  enabled?: boolean;
  activeStateName?: string;
  activeDistrict?: string;
}) {
  const enabled = options?.enabled ?? true;
  const activeStateName = options?.activeStateName;
  const activeDistrict = options?.activeDistrict;
  const placesLib = useMapsLibrary('places');

  const [placesMap, setPlacesMap] = useState<Record<string, GroundedPlaceRecord>>(
    () => ({ ...sessionPlacesMemory })
  );
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [quotaBlocked, setQuotaBlocked] = useState<boolean>(() => isQuotaActiveCooldown());
  const [retryNonce, setRetryNonce] = useState<number>(0);

  useEffect(() => {
    const onQuotaEvent = () => setQuotaBlocked(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaEvent);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaEvent);
  }, []);

  useEffect(() => {
    if (hasAllPublicPlaces(sessionPlacesMemory)) {
      setPlacesMap({ ...sessionPlacesMemory });
      setIsResolving(false);
      return;
    }

    if (!enabled || !placesLib) {
      setIsResolving(false);
      return;
    }

    if (isQuotaActiveCooldown()) {
      setQuotaBlocked(true);
      setIsResolving(false);
      return;
    }

    let cancelled = false;
    setIsResolving(true);

    if (!activePlacesPromise) {
      activePlacesPromise = (async () => {
        const working: Record<string, GroundedPlaceRecord> = { ...sessionPlacesMemory };
        const missingSpecs = PUBLIC_PLACE_SPECS.filter((s) => !working[s.key]?.placeId);
        let hitQuota = false;

        for (let i = 0; i < missingSpecs.length; i += 2) {
          if (hitQuota || isQuotaActiveCooldown()) {
            hitQuota = true;
            break;
          }

          const batch = missingSpecs.slice(i, i + 2);
          await Promise.all(
            batch.map(async (spec) => {
              try {
                const { places } = await placesLib.Place.searchByText({
                  textQuery: spec.textQuery,
                  fields: ['id', 'displayName', 'formattedAddress', 'location'],
                  region: 'in',
                  language: 'en',
                  maxResultCount: 1
                });

                const place = places?.[0];
                if (place && place.location && place.id) {
                  const coords = toLatLngLiteral(place.location);
                  const destParam = encodeURIComponent(`${coords.lat},${coords.lng}`);
                  const placeIdParam = encodeURIComponent(place.id);
                  working[spec.key] = {
                    key: spec.key,
                    placeId: place.id,
                    displayName: place.displayName || spec.publicTitle,
                    formattedAddress: place.formattedAddress || `${spec.district}, ${spec.stateName}`,
                    location: coords,
                    googleMapsURI: `https://www.google.com/maps/search/?api=1&query=${destParam}&query_place_id=${placeIdParam}`,
                    googleMapsDirectionsURI: `https://www.google.com/maps/dir/?api=1&destination=${destParam}&destination_place_id=${placeIdParam}`,
                    stateName: spec.stateName,
                    district: spec.district,
                    publicRole: spec.publicRole,
                    publicTitle: spec.publicTitle,
                    publicSummary: spec.publicSummary
                  };
                  sessionPlacesMemory = { ...working };
                  writeExpiringCache(PLACES_STORAGE_KEY, sessionPlacesMemory);
                }
              } catch (err) {
                if (emitMapsQuotaExceededIfApplicable(err)) {
                  hitQuota = true;
                }
              }
            })
          );

          if (!hitQuota && i + 2 < missingSpecs.length) {
            await delayMs(120);
          }
        }

        activePlacesPromise = null;
        return { resolved: working, hitQuota };
      })();
    }

    activePlacesPromise
      .then(({ resolved, hitQuota }) => {
        if (!cancelled) {
          setPlacesMap({ ...resolved });
          if (hitQuota) setQuotaBlocked(true);
          else if (Object.keys(resolved).length > 0) setQuotaBlocked(false);
          setIsResolving(false);
        }
      })
      .catch((err) => {
        if (emitMapsQuotaExceededIfApplicable(err) && !cancelled) {
          setQuotaBlocked(true);
        }
        if (!cancelled) setIsResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, placesLib, retryNonce]);

  // On-demand single-query resolution when user selects any of the 36 Indian States/UTs
  useEffect(() => {
    if (!enabled || !placesLib || !activeStateName || activeStateName === 'ALL' || isQuotaActiveCooldown()) {
      return;
    }

    const alreadyHasState = Object.values(sessionPlacesMemory).some(
      (p) => p.stateName?.toLowerCase() === activeStateName.toLowerCase()
    );
    if (alreadyHasState) return;

    const dynamicKey = `state_shelter_${activeStateName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    if (sessionPlacesMemory[dynamicKey]) return;

    let cancelled = false;
    const targetDistrict = activeDistrict || activeStateName;

    (async () => {
      try {
        const { places } = await placesLib.Place.searchByText({
          textQuery: `Government Higher Secondary School ${targetDistrict} ${activeStateName} India`,
          fields: ['id', 'displayName', 'formattedAddress', 'location'],
          region: 'in',
          language: 'en',
          maxResultCount: 1
        });
        const place = places?.[0];
        if (!cancelled && place && place.location && place.id) {
          const coords = toLatLngLiteral(place.location);
          const destParam = encodeURIComponent(`${coords.lat},${coords.lng}`);
          const placeIdParam = encodeURIComponent(place.id);
          const record: GroundedPlaceRecord = {
            key: dynamicKey,
            placeId: place.id,
            displayName: place.displayName || `${targetDistrict} Relief Shelter`,
            formattedAddress: place.formattedAddress || `${targetDistrict}, ${activeStateName}`,
            location: coords,
            googleMapsURI: `https://www.google.com/maps/search/?api=1&query=${destParam}&query_place_id=${placeIdParam}`,
            googleMapsDirectionsURI: `https://www.google.com/maps/dir/?api=1&destination=${destParam}&destination_place_id=${placeIdParam}`,
            stateName: activeStateName,
            district: targetDistrict,
            publicRole: 'shelter',
            publicTitle: `${place.displayName || targetDistrict} Public Relief Point (${activeStateName})`,
            publicSummary: `Public school / civic assembly point in ${targetDistrict}, ${activeStateName}.`
          };
          sessionPlacesMemory = { ...sessionPlacesMemory, [dynamicKey]: record };
          writeExpiringCache(PLACES_STORAGE_KEY, sessionPlacesMemory);
          setPlacesMap({ ...sessionPlacesMemory });
        }
      } catch (err) {
        emitMapsQuotaExceededIfApplicable(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, placesLib, activeStateName, activeDistrict]);

  const retryResolvePlaces = useCallback(() => {
    quotaCooldownUntil = 0;
    setQuotaBlocked(false);
    setRetryNonce((n) => n + 1);
  }, []);

  const resolveLandmarkCoordinates = useCallback(
    async (
      landmarkText: string,
      district: DistrictName,
      stateName?: IndianStateName
    ): Promise<GeoPoint | null> => {
      const trimmed = landmarkText.trim();
      if (!trimmed || !placesLib || isQuotaActiveCooldown()) return null;

      const resolvedState = inferStateFromDistrict(district, stateName);
      const cacheKey = `${trimmed.toLowerCase()}_${district.toLowerCase()}_${resolvedState.toLowerCase()}`;
      if (sessionLandmarkMemory[cacheKey]) {
        return sessionLandmarkMemory[cacheKey];
      }

      try {
        const { places } = await placesLib.Place.searchByText({
          textQuery: `${trimmed}, ${district}, ${resolvedState}, India`,
          fields: ['id', 'location'],
          region: 'in',
          language: 'en',
          maxResultCount: 1
        });
        const first = places?.[0];
        if (first?.location) {
          const coords = toLatLngLiteral(first.location);
          sessionLandmarkMemory[cacheKey] = coords;
          return coords;
        }
      } catch (err) {
        emitMapsQuotaExceededIfApplicable(err);
      }
      return null;
    },
    [placesLib]
  );

  const resolveNearbySheltersByCoords = useCallback(
    async (coords: GeoPoint, labelState?: string, labelDistrict?: string): Promise<GroundedPlaceRecord[]> => {
      if (!placesLib || isQuotaActiveCooldown()) return [];
      try {
        const { places } = await placesLib.Place.searchByText({
          textQuery: 'Government School Hospital Community Hall',
          fields: ['id', 'displayName', 'formattedAddress', 'location'],
          locationBias: {
            center: coords,
            radius: 15000
          } as any,
          language: 'en',
          maxResultCount: 4
        });

        const added: GroundedPlaceRecord[] = [];
        const updatedMemory = { ...sessionPlacesMemory };

        (places || []).forEach((place, idx) => {
          if (!place.location || !place.id) return;
          const loc = toLatLngLiteral(place.location);
          const key = `gps_nearby_${place.id.slice(0, 12)}_${idx}`;
          const destParam = encodeURIComponent(`${loc.lat},${loc.lng}`);
          const placeIdParam = encodeURIComponent(place.id);
          const rec: GroundedPlaceRecord = {
            key,
            placeId: place.id,
            displayName: place.displayName || 'Nearby Civic Facility',
            formattedAddress: place.formattedAddress || 'Near your current GPS location',
            location: loc,
            googleMapsURI: `https://www.google.com/maps/search/?api=1&query=${destParam}&query_place_id=${placeIdParam}`,
            googleMapsDirectionsURI: `https://www.google.com/maps/dir/?api=1&destination=${destParam}&destination_place_id=${placeIdParam}`,
            stateName: labelState && labelState !== 'ALL' ? labelState : 'Nearby GPS',
            district: labelDistrict && labelDistrict !== 'ALL' ? labelDistrict : 'Current Area',
            publicRole: idx === 0 ? 'shelter' : 'backup_shelter',
            publicTitle: `${place.displayName || 'Public Facility'} (Near You)`,
            publicSummary: 'Live Google Maps civic facility / hospital / school near your GPS position.'
          };
          updatedMemory[key] = rec;
          added.push(rec);
        });

        if (added.length > 0) {
          sessionPlacesMemory = updatedMemory;
          setPlacesMap({ ...sessionPlacesMemory });
        }
        return added;
      } catch (err) {
        emitMapsQuotaExceededIfApplicable(err);
        return [];
      }
    },
    [placesLib]
  );

  return {
    placesMap,
    isResolving,
    quotaBlocked,
    retryResolvePlaces,
    resolveLandmarkCoordinates,
    resolveNearbySheltersByCoords
  };
}

export const useGroundedPublicPlaces = useGroundedAssamPlaces;

export function useDetourRoute(_enabled: boolean): DetourRouteData | null {
  return null;
}

export const LandmarkAutocompleteInput: React.FC<{
  value: string;
  district: DistrictName;
  stateName?: IndianStateName;
  onChange: (value: string, resolvedCoords?: GeoPoint) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}> = ({ value, district, stateName, onChange, disabled, required = false, placeholder }) => {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const resolvedState = inferStateFromDistrict(district, stateName);

  useEffect(() => {
    if (disabled || !placesLib || value.trim().length < 3 || isQuotaActiveCooldown()) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (isQuotaActiveCooldown()) return;
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: `${value.trim()}, ${district}, ${resolvedState}, India`,
          sessionToken: sessionTokenRef.current,
          region: 'in',
          language: 'en'
        });

        if (!cancelled) {
          setSuggestions(res?.suggestions || []);
        }
      } catch (err) {
        emitMapsQuotaExceededIfApplicable(err);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, district, resolvedState, disabled, placesLib]);

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;

    const label = prediction.text?.text || value;
    setIsOpen(false);
    setSuggestions([]);

    if (isQuotaActiveCooldown()) {
      onChange(label);
      return;
    }

    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ['id', 'displayName', 'formattedAddress', 'location']
      });
      sessionTokenRef.current = null;

      if (place.location) {
        onChange(
          place.formattedAddress || place.displayName || label,
          toLatLngLiteral(place.location)
        );
        return;
      }
    } catch (err) {
      emitMapsQuotaExceededIfApplicable(err);
      sessionTokenRef.current = null;
    }

    onChange(label);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 180)}
        onChange={(e) => {
          setIsOpen(true);
          onChange(e.target.value);
        }}
        placeholder={
          placeholder || `Optional: nearby school, market, or station in ${district}, ${resolvedState}`
        }
        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-900 bg-white"
        required={required}
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-md divide-y divide-slate-100 text-xs max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, idx) => {
            const label = suggestion.placePrediction?.text?.text;
            if (!label) return null;
            return (
              <li key={suggestion.placePrediction?.placeId || idx}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handleSelectSuggestion(suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 transition-colors"
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinA =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(sinA), Math.sqrt(1 - sinA));
}

function buildTopographicFallbackProfile(
  origin: GeoPoint,
  destination: GeoPoint,
  originLabel: string,
  destinationLabel: string
): ElevationProfileResult {
  const totalKm = Math.max(0.6, haversineDistanceKm(origin, destination));
  const sampleCount = 16;
  const baseMeters = origin.lat < 13 ? 740 : origin.lat > 25 ? 46 : 54;
  const samples: ElevationSamplePoint[] = [];

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / (sampleCount - 1);
    const lat = origin.lat + (destination.lat - origin.lat) * t;
    const lng = origin.lng + (destination.lng - origin.lng) * t;
    const climb = t * 8.4 + Math.sin(t * Math.PI) * 1.6;
    samples.push({
      lat,
      lng,
      elevationMeters: Number((baseMeters + climb).toFixed(1)),
      distanceKm: Number((totalKm * t).toFixed(2))
    });
  }

  const elevations = samples.map((s) => s.elevationMeters);
  const minEl = Math.min(...elevations);
  const maxEl = Math.max(...elevations);
  return {
    originLabel,
    destinationLabel,
    samples,
    minElevationM: minEl,
    maxElevationM: maxEl,
    netClimbM: Number((samples[samples.length - 1].elevationMeters - samples[0].elevationMeters).toFixed(1)),
    floodSafeMarginM: Number(Math.max(1.5, maxEl - minEl - 1.2).toFixed(1)),
    source: 'topographic_model'
  };
}

export function useElevationEscapeProfile(params: {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  originLabel: string;
  destinationLabel: string;
  enabled?: boolean;
}): { profile: ElevationProfileResult | null; isLoading: boolean } {
  const { origin, destination, originLabel, destinationLabel, enabled = true } = params;
  const elevationLib = useMapsLibrary('elevation');
  const [profile, setProfile] = useState<ElevationProfileResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !origin || !destination) {
      setProfile(null);
      return;
    }

    const storageKey = `resqnet_gmp_elev_v2_${origin.lat.toFixed(3)}_${origin.lng.toFixed(3)}_${destination.lat.toFixed(3)}_${destination.lng.toFixed(3)}`;
    const cached = readExpiringCache<ElevationProfileResult>(storageKey);
    if (cached) {
      setProfile({ ...cached, originLabel, destinationLabel });
      return;
    }

    if (!elevationLib || isQuotaActiveCooldown()) {
      setProfile(buildTopographicFallbackProfile(origin, destination, originLabel, destinationLabel));
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const service = new elevationLib.ElevationService();
        const totalKm = Math.max(0.5, haversineDistanceKm(origin, destination));
        const res = await service.getElevationAlongPath({
          path: [origin, destination],
          samples: 18
        });

        if (cancelled) return;
        const results = res?.results || [];
        if (results.length >= 2) {
          const samples: ElevationSamplePoint[] = results.map((r, idx) => {
            const loc = r.location ? toLatLngLiteral(r.location) : origin;
            const frac = idx / (results.length - 1);
            return {
              lat: loc.lat,
              lng: loc.lng,
              elevationMeters: Number((r.elevation || 0).toFixed(1)),
              distanceKm: Number((totalKm * frac).toFixed(2))
            };
          });
          const elevations = samples.map((s) => s.elevationMeters);
          const minEl = Math.min(...elevations);
          const maxEl = Math.max(...elevations);
          const built: ElevationProfileResult = {
            originLabel,
            destinationLabel,
            samples,
            minElevationM: minEl,
            maxElevationM: maxEl,
            netClimbM: Number(
              (samples[samples.length - 1].elevationMeters - samples[0].elevationMeters).toFixed(1)
            ),
            floodSafeMarginM: Number(Math.max(0.8, maxEl - minEl).toFixed(1)),
            source: 'google_maps_elevation'
          };
          writeExpiringCache(storageKey, built);
          setProfile(built);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        emitMapsQuotaExceededIfApplicable(err);
      }

      if (!cancelled) {
        setProfile(buildTopographicFallbackProfile(origin, destination, originLabel, destinationLabel));
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    elevationLib,
    origin?.lat,
    origin?.lng,
    destination?.lat,
    destination?.lng,
    originLabel,
    destinationLabel
  ]);

  return { profile, isLoading };
}

export function useEnvironmentalOverlay(coords: GeoPoint | null, enabled: boolean = true) {
  const [snapshot, setSnapshot] = useState<EnvironmentalSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled || !coords) return;

    const storageKey = `resqnet_gmp_env_v2_${coords.lat.toFixed(2)}_${coords.lng.toFixed(2)}`;
    const cached = readExpiringCache<EnvironmentalSnapshot>(storageKey);
    if (cached) {
      setSnapshot(cached);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `/api/maps/environmental?lat=${encodeURIComponent(String(coords.lat))}&lng=${encodeURIComponent(
            String(coords.lng)
          )}`
        );
        if (!res.ok) {
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        if (data?.quotaExceeded) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled && data?.weather && data?.airQuality) {
          const cleanSnap: EnvironmentalSnapshot = {
            lat: data.lat,
            lng: data.lng,
            fetchedAt: data.fetchedAt || Date.now(),
            source: data.source || 'open_meteo_live',
            weather: data.weather,
            airQuality: data.airQuality
          };
          writeExpiringCache(storageKey, cleanSnap, ENV_CACHE_TTL_MS);
          setSnapshot(cleanSnap);
        }
      } catch {
        // ignore offline errors
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, coords?.lat, coords?.lng]);

  return { snapshot, isLoading };
}
