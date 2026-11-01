import React, { useState, useEffect, useCallback } from 'react';
import {
  FusedIncident,
  DistrictName,
  IndianStateName,
  IncidentCategory,
  ReportPacket,
  ShelterLoadRecord,
  FieldPhotoForensicResult,
  LivePublicHazardItem
} from '../types/disaster';
import { generateProvenanceHash } from '../services/fusionEngine';
import {
  AlertTriangle,
  LifeBuoy,
  MapPin,
  CheckCircle2,
  Home,
  Search,
  Send,
  Volume2,
  WifiOff,
  ShieldCheck,
  Map as MapIcon,
  Lock,
  Navigation,
  Trash2,
  Radio,
  HeartHandshake,
  Camera,
  LocateFixed,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { LanguageCode, translations } from '../services/i18n';
import {
  useGroundedAssamPlaces,
  LandmarkAutocompleteInput,
  MentionedPlaceKey,
  GeoPoint
} from '../services/groundedLocations';
import {
  submitCitizenSosToServer,
  trackCitizenRequestOnServer,
  checkRumorOnServer
} from '../services/realtimeClient';
import { CitizenPublicMap } from './CitizenPublicMap';
import { OfflineRescuePassCard } from './OfflineRescuePassCard';
import { FamilySafeCheckIn } from './FamilySafeCheckIn';
import { EmergencyBeaconTools } from './EmergencyBeaconTools';
import { inspectFieldPhotoEvidence } from '../utils/exifTamperCheck';
import {
  INDIAN_STATES_ONLY,
  INDIAN_UTS_ONLY,
  ALL_INDIA_CENTER,
  getDistrictsForState,
  getStateInfo,
  formatLocationWithState
} from '../data/indianStates';

interface CitizenPortalProps {
  incidents: FusedIncident[];
  onIngestCitizenReport: (packet: ReportPacket) => void;
  language: LanguageCode;
  isOffline: boolean;
  onOpenOfficialLogin: () => void;
  shelterLoads?: Record<string, ShelterLoadRecord>;
  liveHazards?: LivePublicHazardItem[];
  isLoadingHazards?: boolean;
  onRefreshHazards?: () => void;
}

interface LocalDeviceReceipt {
  refId: string;
  phoneLast10: string;
  maskedPhone: string;
  stateName?: IndianStateName;
  district: DistrictName;
  publicLandmark: string;
  categoryLabel: string;
  submittedAt: number;
}

const OWN_RECEIPTS_STORAGE_KEY = 'resqnet_citizen_own_receipts_v3';
const PENDING_OFFLINE_SOS_KEY = 'resqnet_pending_offline_sos_v1';

function normalizePhoneLast10(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

function maskPhoneNumber(raw: string): string {
  const last10 = normalizePhoneLast10(raw);
  if (last10.length < 4) return '+91 ••••• ••••';
  return `+91 ••••• •••${last10.slice(-2)}`;
}

function sanitizeCitizenVisibleTitle(
  category: IncidentCategory,
  district: DistrictName,
  stateName?: IndianStateName
): string {
  const loc = formatLocationWithState(district, stateName);
  switch (category) {
    case 'medical_oxygen':
      return `Medical & Boat Rescue · ${loc}`;
    case 'flood_surge':
      return `Flood Rescue Request · ${loc}`;
    case 'shelter_capacity':
      return `Food & Water Request · ${loc}`;
    case 'bridge_collapse':
    case 'road_cut':
      return `Stranded / Blocked Route Request · ${loc}`;
    default:
      return `Emergency Help Request · ${loc}`;
  }
}

function formatRelativeTime(timestampMs: number): string {
  const diffMin = Math.max(0, Math.round((Date.now() - timestampMs) / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export const CitizenPortal: React.FC<CitizenPortalProps> = ({
  incidents,
  onIngestCitizenReport,
  language,
  isOffline,
  shelterLoads = {},
  liveHazards = [],
  isLoadingHazards = false,
  onRefreshHazards
}) => {
  const [citizenTab, setCitizenTab] = useState<
    'sos' | 'map' | 'alerts' | 'shelters' | 'track' | 'checkin' | 'survival'
  >('map');
  const [focusedMapPlace, setFocusedMapPlace] = useState<MentionedPlaceKey | null>(null);
  const [mapStateFilter, setMapStateFilter] = useState<string>('ALL');

  const {
    placesMap,
    isResolving,
    quotaBlocked,
    retryResolvePlaces,
    resolveLandmarkCoordinates,
    resolveNearbySheltersByCoords
  } = useGroundedAssamPlaces({
    enabled: citizenTab === 'map' || citizenTab === 'shelters' || citizenTab === 'survival',
    activeStateName: mapStateFilter,
    activeDistrict: mapStateFilter !== 'ALL' ? getDistrictsForState(mapStateFilter)[0] : undefined
  });

  // Citizen SOS Fields (All 28 States + 8 Union Territories of India)
  const [sosCategory, setSosCategory] = useState<IncidentCategory>('medical_oxygen');
  const [sosStateName, setSosStateName] = useState<IndianStateName>('Delhi');
  const [sosDistrict, setSosDistrict] = useState<DistrictName>('New Delhi');
  const [customSosDistrict, setCustomSosDistrict] = useState<string>('');
  const [sosLandmark, setSosLandmark] = useState('');
  const [sosLandmarkCoords, setSosLandmarkCoords] = useState<GeoPoint | undefined>(undefined);
  const [isLocatingSosGps, setIsLocatingSosGps] = useState(false);
  const [sosGpsStatus, setSosGpsStatus] = useState<string | null>(null);
  const [sosExactAddress, setSosExactAddress] = useState('');
  const [sosPhone, setSosPhone] = useState('');
  const [sosName, setSosName] = useState('');
  const [sosNotes, setSosNotes] = useState('');
  const [sosPhotoForensics, setSosPhotoForensics] = useState<FieldPhotoForensicResult | null>(null);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [isSubmittingSos, setIsSubmittingSos] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<LocalDeviceReceipt | null>(null);

  // Form A: Medical / Oxygen Dedicated Fields
  const [medCondition, setMedCondition] = useState('Oxygen cylinder / concentrator running out');
  const [medBackupLeft, setMedBackupLeft] = useState('Less than 1 hour left');
  const [medMobility, setMedMobility] = useState<'bedridden' | 'assisted' | 'walking'>('bedridden');
  const [medPatientCount, setMedPatientCount] = useState<number>(1);
  const [medInfantOrElderly, setMedInfantOrElderly] = useState<boolean>(true);

  // Form B: Trapped by Water Dedicated Fields
  const [floodWaterDepth, setFloodWaterDepth] = useState<number>(5);
  const [floodWaitingSpot, setFloodWaitingSpot] = useState<
    'Ground Floor' | '1st Floor' | 'Roof / Tin Shed' | 'High Road'
  >('Roof / Tin Shed');
  const [floodPeopleCount, setFloodPeopleCount] = useState<number>(4);
  const [floodHouseType, setFloodHouseType] = useState('Concrete / Pucca house (holding)');
  const [floodHasElderly, setFloodHasElderly] = useState<boolean>(false);
  const [floodHasInfants, setFloodHasInfants] = useState<boolean>(false);
  const [floodHasImmobile, setFloodHasImmobile] = useState<boolean>(false);

  // Form C: Food & Water Dedicated Fields
  const [supplyItems, setSupplyItems] = useState<string[]>([
    'Clean Drinking Water',
    'Cooked Meals / Dry Rations'
  ]);
  const [supplyFamilySize, setSupplyFamilySize] = useState<number>(5);
  const [supplyDaysOut, setSupplyDaysOut] = useState('1 full day (24+ hours)');
  const [supplyHasInfants, setSupplyHasInfants] = useState<boolean>(false);
  const [supplyHasElderly, setSupplyHasElderly] = useState<boolean>(false);

  // Form D: Road Cut Off Dedicated Fields
  const [roadDamageType, setRoadDamageType] = useState('Bridge submerged or damaged');
  const [roadRouteName, setRoadRouteName] = useState('');
  const [roadStrandedStatus, setRoadStrandedStatus] = useState(
    'Yes — Families or vehicles stranded here'
  );
  const [roadStrandedCount, setRoadStrandedCount] = useState<number>(6);

  // Dual-Verification SOS Tracker State (Privacy-Hardened)
  const [trackRefCode, setTrackRefCode] = useState('');
  const [trackPhoneVerify, setTrackPhoneVerify] = useState('');
  const [trackedResult, setTrackedResult] = useState<{
    verifiedRef: string;
    maskedPhone: string;
    stateName?: IndianStateName;
    district: DistrictName;
    category: IncidentCategory;
    assignedTeam: string;
    eta: string;
  } | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [ownReceipts, setOwnReceipts] = useState<LocalDeviceReceipt[]>([]);

  // Real Automatic Offline Queue (flushes automatically when network returns)
  const [pendingOfflinePackets, setPendingOfflinePackets] = useState<ReportPacket[]>(() => {
    try {
      const saved = localStorage.getItem(PENDING_OFFLINE_SOS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [isFlushingOffline, setIsFlushingOffline] = useState(false);
  const [offlineSyncNotice, setOfflineSyncNotice] = useState<string | null>(null);

  const flushPendingOfflineRequests = useCallback(async () => {
    if (isOffline || pendingOfflinePackets.length === 0) return;
    setIsFlushingOffline(true);
    const remaining: ReportPacket[] = [];
    let delivered = 0;

    for (const pkt of pendingOfflinePackets) {
      const ok = await submitCitizenSosToServer(pkt);
      if (ok) {
        delivered += 1;
      } else {
        remaining.push(pkt);
      }
    }

    setPendingOfflinePackets(remaining);
    try {
      if (remaining.length === 0) {
        localStorage.removeItem(PENDING_OFFLINE_SOS_KEY);
      } else {
        localStorage.setItem(PENDING_OFFLINE_SOS_KEY, JSON.stringify(remaining));
      }
    } catch {
      // ignore
    }

    setIsFlushingOffline(false);
    if (delivered > 0) {
      setOfflineSyncNotice(
        `${delivered} offline help request${delivered > 1 ? 's' : ''} delivered to Rescue Officers.`
      );
      setTimeout(() => setOfflineSyncNotice(null), 7000);
    }
  }, [isOffline, pendingOfflinePackets]);

  useEffect(() => {
    if (!isOffline && pendingOfflinePackets.length > 0) {
      void flushPendingOfflineRequests();
    }
  }, [isOffline, pendingOfflinePackets.length, flushPendingOfflineRequests]);

  // Offline Bilingual Survival Guidance State (English & Hindi)
  const [survivalLang, setSurvivalLang] = useState<LanguageCode>(language);

  useEffect(() => {
    setSurvivalLang(language);
  }, [language]);

  // Live Alerts Filter & Rumor Check State
  const [alertSourceFilter, setAlertSourceFilter] = useState<
    'all' | 'official' | 'usgs_earthquake' | 'nasa_eonet'
  >('all');
  const [speakingAlertId, setSpeakingAlertId] = useState<string | null>(null);
  const [rumorText, setRumorText] = useState('');
  const [rumorCheckResult, setRumorCheckResult] = useState<string | null>(null);
  const [isCheckingRumor, setIsCheckingRumor] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        'ndma_offline_survival_guide',
        JSON.stringify({
          cachedAt: Date.now(),
          protocol: 'NDMA_SOP_2026_STRUCTURAL_SURVIVAL',
          languages: ['en', 'hi']
        })
      );
      const savedReceipts = JSON.parse(localStorage.getItem(OWN_RECEIPTS_STORAGE_KEY) || '[]');
      if (Array.isArray(savedReceipts)) {
        setOwnReceipts(savedReceipts);
      }
    } catch {
      // safe fallback
    }
  }, []);

  const toggleSupplyItem = (item: string) => {
    setSupplyItems((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const openPlaceOnCitizenMap = (placeKey: MentionedPlaceKey, stateFilter?: string) => {
    if (stateFilter) setMapStateFilter(stateFilter);
    setFocusedMapPlace(placeKey);
    setCitizenTab('map');
  };

  const handleCaptureSosGps = () => {
    if (!navigator.geolocation) {
      setSosGpsStatus('GPS is not supported by this browser.');
      return;
    }
    setIsLocatingSosGps(true);
    setSosGpsStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = {
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5))
        };
        setSosLandmarkCoords(pt);
        setSosGpsStatus(`GPS captured (${pt.lat}° N, ${pt.lng}° E)`);
        setIsLocatingSosGps(false);
      },
      () => {
        setSosGpsStatus('Location permission declined. Please enter your address manually.');
        setIsLocatingSosGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleReadAlertAloud = (hazard: LivePublicHazardItem) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingAlertId === hazard.id) {
      window.speechSynthesis.cancel();
      setSpeakingAlertId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${hazard.title}. ${hazard.summary}`);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.onend = () => setSpeakingAlertId(null);
    utterance.onerror = () => setSpeakingAlertId(null);
    setSpeakingAlertId(hazard.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleSosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    const effectiveDistrict =
      sosDistrict === '__custom__' ? customSosDistrict.trim() : sosDistrict.trim();

    if (!effectiveDistrict) {
      setFormValidationError('Please select or enter your District / City.');
      return;
    }

    const trimmedAddress = sosExactAddress.trim();
    if (!trimmedAddress) {
      setFormValidationError('Address is required so the rescue team can locate you.');
      return;
    }

    const cleanPhone10 = normalizePhoneLast10(sosPhone);
    if (cleanPhone10.length !== 10) {
      setFormValidationError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (sosCategory === 'bridge_collapse' && !roadRouteName.trim()) {
      setFormValidationError('Please enter the road or bridge name that is cut off.');
      return;
    }

    setIsSubmittingSos(true);
    const now = Date.now();
    const assignedRef = `REF-NDMA-${Math.floor(Math.random() * 900000 + 100000)}`;

    let resolvedCoords = sosLandmarkCoords;
    if (!resolvedCoords && !isOffline && sosLandmark.trim()) {
      const lookedUp = await resolveLandmarkCoordinates(
        sosLandmark,
        effectiveDistrict,
        sosStateName
      );
      if (lookedUp) resolvedCoords = lookedUp;
    }

    const matchingStatePlace = Object.values(placesMap).find(
      (p) =>
        p.district.toLowerCase() === effectiveDistrict.toLowerCase() ||
        p.stateName.toLowerCase() === sosStateName.toLowerCase()
    )?.location;
    const stateViewCenter = getStateInfo(sosStateName)?.viewCenter;

    const finalCoords =
      resolvedCoords || matchingStatePlace || stateViewCenter || ALL_INDIA_CENTER;
    const publicAreaLabel =
      sosLandmark.trim() || `${effectiveDistrict}, ${sosStateName}`;

    let categoryLabel = 'Medical / Oxygen';
    let emergencyFormDetails: Array<{ label: string; value: string }> = [];
    let computedNeedsOxygen = false;
    let computedIsBedridden = false;
    let computedIsElderly = false;
    let computedHasInfants = false;
    let computedWaterFt = 3;
    let computedFloor: 'Ground Floor' | '1st Floor' | 'Roof / Tin Shed' = 'Ground Floor';
    let packetHeadline = '';
    let packetDetails = '';

    if (sosCategory === 'medical_oxygen') {
      categoryLabel = 'Medical / Oxygen';
      computedNeedsOxygen =
        medCondition.toLowerCase().includes('oxygen') ||
        !medBackupLeft.toLowerCase().includes('no machine');
      computedIsBedridden = medMobility === 'bedridden';
      computedIsElderly = medInfantOrElderly;
      computedHasInfants = medInfantOrElderly;
      computedWaterFt = 4;
      emergencyFormDetails = [
        { label: 'Medical Need', value: medCondition },
        { label: 'Backup Remaining', value: medBackupLeft },
        {
          label: 'Mobility',
          value:
            medMobility === 'bedridden'
              ? 'Bedridden (Stretcher Boat Needed)'
              : medMobility === 'assisted'
              ? 'Needs Support to Board'
              : 'Can Walk'
        },
        { label: 'Patients', value: `${medPatientCount}` }
      ];
      packetHeadline = `Medical Emergency (${medCondition}) — ${publicAreaLabel}`;
      packetDetails = `${medCondition}. Backup: ${medBackupLeft}. Patients: ${medPatientCount}.${
        sosNotes.trim() ? ` Note: ${sosNotes.trim()}` : ''
      }`;
    } else if (sosCategory === 'flood_surge') {
      categoryLabel = 'Trapped by Water';
      computedNeedsOxygen = false;
      computedIsBedridden = floodHasImmobile;
      computedIsElderly = floodHasElderly;
      computedHasInfants = floodHasInfants;
      computedWaterFt = floodWaterDepth;
      computedFloor = floodWaitingSpot === 'High Road' ? 'Ground Floor' : floodWaitingSpot;
      emergencyFormDetails = [
        { label: 'Water Depth', value: `~${floodWaterDepth} ft` },
        { label: 'Waiting Spot', value: floodWaitingSpot },
        { label: 'People Trapped', value: `${floodPeopleCount} people` },
        { label: 'Structure', value: floodHouseType }
      ];
      packetHeadline = `Boat Rescue (${floodPeopleCount} trapped on ${floodWaitingSpot}) — ${publicAreaLabel}`;
      packetDetails = `Water ~${floodWaterDepth} ft. ${floodPeopleCount} people waiting at ${floodWaitingSpot} (${floodHouseType}).${
        sosNotes.trim() ? ` Note: ${sosNotes.trim()}` : ''
      }`;
    } else if (sosCategory === 'shelter_capacity') {
      categoryLabel = 'Food & Water';
      computedNeedsOxygen = false;
      computedIsBedridden = false;
      computedIsElderly = supplyHasElderly;
      computedHasInfants = supplyHasInfants || supplyItems.includes('Baby Milk / Infant Formula');
      computedWaterFt = 2;
      const chosenSupplies = supplyItems.length > 0 ? supplyItems.join(', ') : 'Water & Rations';
      emergencyFormDetails = [
        { label: 'Supplies Needed', value: chosenSupplies },
        { label: 'Family Size', value: `${supplyFamilySize} people` },
        { label: 'Without Supplies', value: supplyDaysOut }
      ];
      packetHeadline = `Food & Water Needed (${supplyFamilySize} people) — ${publicAreaLabel}`;
      packetDetails = `Needs: ${chosenSupplies} for ${supplyFamilySize} people (${supplyDaysOut}).${
        sosNotes.trim() ? ` Note: ${sosNotes.trim()}` : ''
      }`;
    } else {
      categoryLabel = 'Road Cut Off';
      computedNeedsOxygen = false;
      computedIsBedridden = roadStrandedStatus.toLowerCase().includes('stranded');
      computedIsElderly = false;
      computedHasInfants = false;
      computedWaterFt = 4;
      emergencyFormDetails = [
        { label: 'Blocked Route', value: roadRouteName.trim() },
        { label: 'Damage Type', value: roadDamageType },
        { label: 'Stranded Status', value: roadStrandedStatus },
        { label: 'People Stranded', value: `${roadStrandedCount}` }
      ];
      packetHeadline = `Road Cut Off: ${roadRouteName.trim()} (${roadDamageType})`;
      packetDetails = `${roadDamageType} at ${roadRouteName.trim()}. ${roadStrandedStatus} (${roadStrandedCount} people).${
        sosNotes.trim() ? ` Note: ${sosNotes.trim()}` : ''
      }`;
    }

    const packet: ReportPacket = {
      id: assignedRef,
      incidentClusterId: `INC-USER-${Math.floor(Math.random() * 900 + 100)}`,
      timestamp: now,
      channel: 'citizen_web',
      reporterName: sosName.trim() || 'Resident',
      reporterRole: 'Citizen Emergency Request',
      isOfficial: false,
      isAuthorizedFieldAgent: false,
      stateName: sosStateName,
      district: effectiveDistrict,
      landmark: publicAreaLabel,
      coordinates: finalCoords,
      category: sosCategory,
      headline: packetHeadline,
      details: packetDetails,
      emergencyFormType: categoryLabel,
      emergencyFormDetails,
      fromLiveDevice: true,
      rawPayload: JSON.stringify({
        source: 'CITIZEN_PUBLIC_PORTAL',
        reference_no: assignedRef,
        phone: `+91 ${cleanPhone10}`,
        state: sosStateName,
        district: effectiveDistrict,
        landmark_optional: sosLandmark.trim() || null,
        gps_coords: resolvedCoords || null,
        emergency_type: categoryLabel,
        emergency_details: emergencyFormDetails,
        photo_forensics: sosPhotoForensics || undefined,
        timestamp: new Date(now).toISOString()
      }),
      provenanceHash: generateProvenanceHash(assignedRef, now, 'citizen_web'),
      vulnerabilityFactors: {
        needsOxygen: computedNeedsOxygen,
        isBedridden: computedIsBedridden,
        isElderlyAlone: computedIsElderly,
        infantsPresent: computedHasInfants,
        waterLevelFeet: computedWaterFt,
        trappedFloor: computedFloor
      },
      contactMasked: `${maskPhoneNumber(cleanPhone10)} (Ref: ${assignedRef})`,
      exactAddress: `${trimmedAddress}, ${effectiveDistrict}, ${sosStateName} (Ref: ${assignedRef})`
    };

    let deliveredLive = false;
    if (!isOffline) {
      deliveredLive = await submitCitizenSosToServer(packet);
    }

    if (!deliveredLive) {
      const nextPending = [packet, ...pendingOfflinePackets];
      setPendingOfflinePackets(nextPending);
      try {
        localStorage.setItem(PENDING_OFFLINE_SOS_KEY, JSON.stringify(nextPending));
      } catch {
        // ignore
      }
    }

    onIngestCitizenReport(packet);

    const receipt: LocalDeviceReceipt = {
      refId: assignedRef,
      phoneLast10: cleanPhone10,
      maskedPhone: maskPhoneNumber(cleanPhone10),
      stateName: sosStateName,
      district: effectiveDistrict,
      publicLandmark: publicAreaLabel,
      categoryLabel,
      submittedAt: now
    };

    setSubmittedReceipt(receipt);
    setIsSubmittingSos(false);

    try {
      const updated = [receipt, ...ownReceipts].slice(0, 5);
      setOwnReceipts(updated);
      localStorage.setItem(OWN_RECEIPTS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // safe fallback
    }
  };

  const verifyAndTrackRequest = async (refInput: string, phoneInput: string) => {
    setTrackError(null);
    setTrackedResult(null);

    const normalizedRef = refInput.trim().toUpperCase();
    const normalizedPhone = normalizePhoneLast10(phoneInput);

    if (!/^REF-NDMA-\d{6}$/.test(normalizedRef)) {
      setTrackError('Enter your full Reference Code (for example: REF-NDMA-123456).');
      return;
    }

    if (normalizedPhone.length !== 10) {
      setTrackError('Enter the 10-digit mobile number used for this request.');
      return;
    }

    if (!isOffline) {
      const serverCheck = await trackCitizenRequestOnServer(normalizedRef, normalizedPhone);
      if (serverCheck.matched && serverCheck.district && serverCheck.category) {
        setTrackedResult({
          verifiedRef: normalizedRef,
          maskedPhone: serverCheck.maskedPhone || maskPhoneNumber(normalizedPhone),
          stateName: serverCheck.stateName,
          district: serverCheck.district as DistrictName,
          category: serverCheck.category as IncidentCategory,
          assignedTeam: serverCheck.assignedTeam || 'SDRF Rescue Boat',
          eta: serverCheck.eta || '~20 mins'
        });
        return;
      }
    }

    for (const inc of incidents) {
      for (const packet of inc.provenanceTrail) {
        let packetRef = '';
        let packetPhone10 = '';

        if (packet.id.toUpperCase() === normalizedRef) {
          packetRef = packet.id.toUpperCase();
        }

        const refMatchInMasked = packet.contactMasked.match(/REF-NDMA-\d{6}/i);
        if (!packetRef && refMatchInMasked) {
          packetRef = refMatchInMasked[0].toUpperCase();
        }

        try {
          const parsed = JSON.parse(packet.rawPayload);
          if (!packetRef && typeof parsed?.reference_no === 'string') {
            packetRef = parsed.reference_no.toUpperCase();
          }
          if (typeof parsed?.phone === 'string') {
            packetPhone10 = normalizePhoneLast10(parsed.phone);
          }
        } catch {
          // non-JSON payload
        }

        if (packetRef === normalizedRef && packetPhone10 === normalizedPhone) {
          setTrackedResult({
            verifiedRef: normalizedRef,
            maskedPhone: maskPhoneNumber(normalizedPhone),
            stateName: packet.stateName || inc.stateName,
            district: inc.district,
            category: inc.category,
            assignedTeam: inc.category === 'medical_oxygen' ? 'NDRF Medical Boat' : 'SDRF Rescue Boat',
            eta: '~20 mins'
          });
          return;
        }
      }
    }

    setTrackError(
      'No matching request found. Check that both your Reference Code and 10-digit mobile number match.'
    );
  };

  const handleTrackFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void verifyAndTrackRequest(trackRefCode, trackPhoneVerify);
  };

  const handleClearDeviceReceipts = () => {
    setOwnReceipts([]);
    setTrackedResult(null);
    try {
      localStorage.removeItem(OWN_RECEIPTS_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const filteredLiveHazards = liveHazards.filter((h) => {
    if (alertSourceFilter === 'all') return true;
    if (alertSourceFilter === 'official') {
      return h.source === 'officer_broadcast' || h.source === 'verified_fact_check';
    }
    return h.source === alertSourceFilter;
  });

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* 1. Emergency Helpline Strip */}
      <div className="bg-slate-900 text-white rounded-xl px-5 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="text-sm sm:text-base font-bold flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
          <span className="text-amber-400 text-xs uppercase tracking-wider font-semibold mr-1">
            Free 24/7 Help:
          </span>
          <span>
            Control:{' '}
            <a href="tel:1070" className="text-white hover:text-amber-300 underline underline-offset-2">
              1070
            </a>
          </span>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
          <span>
            Rescue:{' '}
            <a href="tel:1078" className="text-white hover:text-amber-300 underline underline-offset-2">
              1078
            </a>
          </span>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
          <span>
            Emergency:{' '}
            <a href="tel:112" className="text-white hover:text-amber-300 underline underline-offset-2">
              112
            </a>
          </span>
        </div>

        <div className="text-xs text-slate-300 shrink-0 border-t md:border-t-0 md:border-l border-slate-800 pt-2 md:pt-0 md:pl-4">
          No internet? Dial or SMS <strong className="text-white font-mono">*1070#</strong>
        </div>
      </div>

      {/* 2. Real Offline Queue Banner (Shown when browser is offline or has queued requests) */}
      {(isOffline || pendingOfflinePackets.length > 0) && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <div className="space-y-0.5">
              <strong className="text-amber-950 font-bold">
                {isOffline
                  ? 'You are currently offline'
                  : `${pendingOfflinePackets.length} saved help request(s) ready to sync`}
              </strong>
              <p className="text-amber-800 text-[11px]">
                {isOffline
                  ? 'Any help request you submit will be saved safely on this device and sent automatically as soon as your connection returns.'
                  : 'Your connection is back. Sending queued help requests to Rescue Officers.'}
              </p>
            </div>
          </div>

          {!isOffline && pendingOfflinePackets.length > 0 && (
            <button
              type="button"
              onClick={() => void flushPendingOfflineRequests()}
              disabled={isFlushingOffline}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-lg text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Radio className={`w-3.5 h-3.5 text-amber-400 ${isFlushingOffline ? 'animate-pulse' : ''}`} />
              <span>{isFlushingOffline ? 'Sending…' : 'Sync Now'}</span>
            </button>
          )}
        </div>
      )}

      {offlineSyncNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-950 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{offlineSyncNotice}</span>
        </div>
      )}

      {/* 3. Primary Citizen Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto text-sm">
        <button
          onClick={() => setCitizenTab('sos')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            citizenTab === 'sos'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          <span>Get Help</span>
        </button>

        <button
          onClick={() => setCitizenTab('map')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            citizenTab === 'map'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapIcon className="w-4 h-4 text-slate-700" />
          <span>Safe Map</span>
        </button>

        <button
          onClick={() => setCitizenTab('alerts')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 tabular-nums ${
            citizenTab === 'alerts'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Live Alerts ({liveHazards.length})</span>
        </button>

        <button
          onClick={() => setCitizenTab('shelters')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            citizenTab === 'shelters'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Home className="w-4 h-4 text-emerald-600" />
          <span>Shelters</span>
        </button>

        <button
          onClick={() => setCitizenTab('track')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            citizenTab === 'track'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="w-4 h-4 text-sky-600" />
          <span>Track Request</span>
        </button>

        <button
          onClick={() => setCitizenTab('checkin')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            citizenTab === 'checkin'
              ? 'border-emerald-700 text-emerald-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <HeartHandshake className="w-4 h-4 text-emerald-600" />
          <span>Family Safe &amp; Volunteer</span>
        </button>

        <button
          onClick={() => setCitizenTab('survival')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            citizenTab === 'survival'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-slate-700" />
          <span>Safety Tips &amp; Beacon</span>
        </button>
      </div>

      {/* 4. Tab 1: Get Emergency Help */}
      {citizenTab === 'sos' && (
        <div className="space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-900">Request Emergency Help</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Choose the emergency below to send your location and needs directly to the Rescue Officer Control Desk. Your phone number and exact address are never shown publicly.
            </p>
          </div>

          {submittedReceipt ? (
            <div className="py-6 space-y-5 max-w-2xl mx-auto">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">
                    {isOffline ? 'Saved Offline — Will Auto-Send' : 'Request Sent to Rescue Team'}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {isOffline
                      ? `Stored on your phone (${submittedReceipt.categoryLabel}) and will transmit automatically when signal returns.`
                      : `Delivered in real time to the Rescue Officer Desk (${submittedReceipt.categoryLabel}).`}
                  </p>
                </div>

                <div className="py-4 px-5 bg-slate-50 border border-slate-200 rounded-xl text-sm space-y-1.5 max-w-lg mx-auto">
                  <span className="text-slate-500 text-xs block">Your Reference Code</span>
                  <strong className="text-lg font-mono text-slate-900 block">{submittedReceipt.refId}</strong>
                  <div className="text-xs text-slate-500">
                    Phone: <span className="font-mono text-slate-700">{submittedReceipt.maskedPhone}</span>
                  </div>
                  <p className="text-xs text-slate-500 pt-1">
                    Save this code or download your Offline QR Rescue Pass below for boat boarding.
                  </p>
                </div>
              </div>

              <OfflineRescuePassCard
                refId={submittedReceipt.refId}
                maskedPhone={submittedReceipt.maskedPhone}
                district={submittedReceipt.district}
                stateName={submittedReceipt.stateName}
                landmark={submittedReceipt.publicLandmark}
                categoryLabel={submittedReceipt.categoryLabel}
                peopleCount={
                  sosCategory === 'medical_oxygen'
                    ? medPatientCount
                    : sosCategory === 'flood_surge'
                    ? floodPeopleCount
                    : sosCategory === 'shelter_capacity'
                    ? supplyFamilySize
                    : roadStrandedCount
                }
                medicalTag={
                  sosCategory === 'medical_oxygen'
                    ? `${medCondition} (${medBackupLeft})`
                    : `${submittedReceipt.categoryLabel} Priority`
                }
                issuedAt={submittedReceipt.submittedAt}
              />

              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => {
                    setCitizenTab('track');
                    setTrackRefCode(submittedReceipt.refId);
                    setTrackPhoneVerify(submittedReceipt.phoneLast10);
                    void verifyAndTrackRequest(submittedReceipt.refId, submittedReceipt.phoneLast10);
                  }}
                  className="px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  Check Status
                </button>
                <button
                  onClick={() => {
                    setSubmittedReceipt(null);
                    setSosPhotoForensics(null);
                  }}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  New Request
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSosSubmit} className="space-y-6">
              {formValidationError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 font-medium">
                  {formValidationError}
                </div>
              )}

              {/* Step 1: Emergency Selector */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  1. What help do you need?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setSosCategory('medical_oxygen')}
                    className={`p-3.5 rounded-lg border text-left transition-colors ${
                      sosCategory === 'medical_oxygen'
                        ? 'border-red-600 bg-red-50/60 text-red-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-bold">Medical / Oxygen</div>
                    <div className="text-xs text-slate-500 mt-0.5">Oxygen, patient, or medicine</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSosCategory('flood_surge')}
                    className={`p-3.5 rounded-lg border text-left transition-colors ${
                      sosCategory === 'flood_surge'
                        ? 'border-red-600 bg-red-50/60 text-red-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-bold">Trapped by Water</div>
                    <div className="text-xs text-slate-500 mt-0.5">Need a rescue boat pickup</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSosCategory('shelter_capacity')}
                    className={`p-3.5 rounded-lg border text-left transition-colors ${
                      sosCategory === 'shelter_capacity'
                        ? 'border-red-600 bg-red-50/60 text-red-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-bold">Food &amp; Water</div>
                    <div className="text-xs text-slate-500 mt-0.5">Clean water, rations, baby milk</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSosCategory('bridge_collapse')}
                    className={`p-3.5 rounded-lg border text-left transition-colors ${
                      sosCategory === 'bridge_collapse'
                        ? 'border-red-600 bg-red-50/60 text-red-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-bold">Road Cut Off</div>
                    <div className="text-xs text-slate-500 mt-0.5">Bridge or road washed out</div>
                  </button>
                </div>
              </div>

              {/* Step 2: Emergency Details */}
              {sosCategory === 'medical_oxygen' && (
                <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      2. Medical / Oxygen Details
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Helps medical boats bring oxygen cylinders, stretchers, or urgent medicines.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        What medical help is needed?
                      </label>
                      <select
                        value={medCondition}
                        onChange={(e) => setMedCondition(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
                      >
                        <option value="Oxygen cylinder / concentrator running out">
                          Oxygen cylinder / concentrator running out
                        </option>
                        <option value="Critical illness / Dialysis / Heart patient">
                          Critical illness / Dialysis / Heart patient
                        </option>
                        <option value="Urgent medicine (Insulin / Inhaler / BP)">
                          Urgent medicine (Insulin / Inhaler / BP)
                        </option>
                        <option value="Pregnant woman needing urgent care">
                          Pregnant woman needing urgent care
                        </option>
                        <option value="Injury or high fever">Injury or high fever</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Oxygen or Battery Backup Left
                      </label>
                      <select
                        value={medBackupLeft}
                        onChange={(e) => setMedBackupLeft(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
                      >
                        <option value="Empty now — Urgent">Empty now — Urgent</option>
                        <option value="Less than 1 hour left">Less than 1 hour left</option>
                        <option value="1 to 3 hours left">1 to 3 hours left</option>
                        <option value="No machine needed (Medicines / Doctor)">
                          No machine needed (Medicines / Doctor)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Can the patient walk to a boat?
                      </label>
                      <select
                        value={medMobility}
                        onChange={(e) =>
                          setMedMobility(e.target.value as 'bedridden' | 'assisted' | 'walking')
                        }
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
                      >
                        <option value="bedridden">No — Bedridden (Stretcher needed)</option>
                        <option value="assisted">Needs support from 2 people</option>
                        <option value="walking">Yes — Can walk with help</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Number of Patients
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={medPatientCount}
                        onChange={(e) => setMedPatientCount(Math.max(1, Number(e.target.value)))}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 font-mono tabular-nums outline-none focus:border-slate-900"
                        required
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={medInfantOrElderly}
                      onChange={(e) => setMedInfantOrElderly(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded border-slate-300"
                    />
                    <span>Patient is an infant, pregnant mother, or elderly person</span>
                  </label>
                </div>
              )}

              {sosCategory === 'flood_surge' && (
                <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      2. Flood Boat Rescue Details
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Helps boat teams choose the right boat size and find where you are waiting.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Current Water Depth
                      </label>
                      <select
                        value={floodWaterDepth}
                        onChange={(e) => setFloodWaterDepth(Number(e.target.value))}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
                      >
                        <option value={2}>Ankle to Knee (1–2 ft)</option>
                        <option value={4}>Waist High (3–4 ft)</option>
                        <option value={5}>Chest High (5–6 ft)</option>
                        <option value={8}>Ground Floor Flooded (8+ ft)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Where are people waiting right now?
                      </label>
                      <select
                        value={floodWaitingSpot}
                        onChange={(e) =>
                          setFloodWaitingSpot(
                            e.target.value as
                              | 'Ground Floor'
                              | '1st Floor'
                              | 'Roof / Tin Shed'
                              | 'High Road'
                          )
                        }
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
                      >
                        <option value="Roof / Tin Shed">Rooftop / Tin Shed</option>
                        <option value="1st Floor">Upper Floor / Balcony</option>
                        <option value="Ground Floor">Ground Floor</option>
                        <option value="High Road">Raised Road / Embankment</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Total People Waiting for Boat
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={floodPeopleCount}
                        onChange={(e) => setFloodPeopleCount(Math.max(1, Number(e.target.value)))}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 font-mono tabular-nums outline-none focus:border-slate-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        House / Building Condition
                      </label>
                      <select
                        value={floodHouseType}
                        onChange={(e) => setFloodHouseType(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
                      >
                        <option value="Concrete / Pucca house (holding)">
                          Concrete / Pucca house (holding)
                        </option>
                        <option value="Kutcha / Bamboo house (weakening in current)">
                          Kutcha / Bamboo house (weakening in current)
                        </option>
                        <option value="Water rising into our floor now">
                          Water rising into our floor now
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={floodHasElderly}
                        onChange={(e) => setFloodHasElderly(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded border-slate-300"
                      />
                      <span>Elderly person waiting</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={floodHasInfants}
                        onChange={(e) => setFloodHasInfants(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded border-slate-300"
                      />
                      <span>Babies / young children</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={floodHasImmobile}
                        onChange={(e) => setFloodHasImmobile(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded border-slate-300"
                      />
                      <span>Someone cannot walk</span>
                    </label>
                  </div>
                </div>
              )}

              {sosCategory === 'shelter_capacity' && (
                <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      2. Food, Drinking Water &amp; Relief Supplies
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select the items your family needs delivered.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-2">
                      Which supplies are needed?
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {[
                        'Clean Drinking Water',
                        'Cooked Meals / Dry Rations',
                        'Baby Milk / Infant Formula',
                        'ORS & Basic Fever Medicine',
                        'Dry Blankets / Tarpaulin',
                        'Sanitary / Hygiene Kit'
                      ].map((item) => (
                        <label
                          key={item}
                          className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={supplyItems.includes(item)}
                            onChange={() => toggleSupplyItem(item)}
                            className="w-4 h-4 text-red-600 rounded border-slate-300"
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Number of People Needing Rations
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={supplyFamilySize}
                        onChange={(e) => setSupplyFamilySize(Math.max(1, Number(e.target.value)))}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 font-mono tabular-nums outline-none focus:border-slate-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        How long without clean water or food?
                      </label>
                      <select
                        value={supplyDaysOut}
                        onChange={(e) => setSupplyDaysOut(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
                      >
                        <option value="Ran out today">Ran out today</option>
                        <option value="1 full day (24+ hours)">1 full day (24+ hours)</option>
                        <option value="2 or more days — Urgent">2 or more days — Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-5 pt-1">
                    <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={supplyHasInfants}
                        onChange={(e) => setSupplyHasInfants(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded border-slate-300"
                      />
                      <span>Infants or nursing mother in group</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={supplyHasElderly}
                        onChange={(e) => setSupplyHasElderly(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded border-slate-300"
                      />
                      <span>Elderly person in group</span>
                    </label>
                  </div>
                </div>
              )}

              {sosCategory === 'bridge_collapse' && (
                <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      2. Road or Bridge Cut-Off Details
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Alerts rescue convoys and road engineers about washed-out routes and stranded travelers.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Road or Bridge Name *
                      </label>
                      <input
                        type="text"
                        value={roadRouteName}
                        onChange={(e) => setRoadRouteName(e.target.value)}
                        placeholder="e.g., NH-44 highway culvert or district bridge"
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:border-slate-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        What happened to the road or bridge?
                      </label>
                      <select
                        value={roadDamageType}
                        onChange={(e) => setRoadDamageType(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
                      >
                        <option value="Bridge submerged or damaged">Bridge submerged or damaged</option>
                        <option value="Road / culvert washed out">Road / culvert washed out</option>
                        <option value="Embankment broken across road">Embankment broken across road</option>
                        <option value="Trees or power poles blocking road">
                          Trees or power poles blocking road
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Are people or vehicles stranded there?
                      </label>
                      <select
                        value={roadStrandedStatus}
                        onChange={(e) => setRoadStrandedStatus(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
                      >
                        <option value="Yes — Families or vehicles stranded here">
                          Yes — Families or vehicles stranded here
                        </option>
                        <option value="Yes — Village completely cut off">
                          Yes — Village completely cut off
                        </option>
                        <option value="No one trapped — Reporting blocked road">
                          No one trapped — Reporting blocked road
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Estimated People Stranded
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={roadStrandedCount}
                        onChange={(e) => setRoadStrandedCount(Math.max(0, Number(e.target.value)))}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 font-mono tabular-nums outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Location + Real Browser GPS */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-sm font-bold text-slate-900">
                    3. Where should the rescue team come?
                  </label>
                  <button
                    type="button"
                    onClick={handleCaptureSosGps}
                    disabled={isLocatingSosGps}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-sky-600" />
                    <span>{isLocatingSosGps ? 'Locating GPS…' : 'Use My GPS Location'}</span>
                  </button>
                </div>

                {sosGpsStatus && (
                  <div className="text-xs text-emerald-800 font-medium font-mono">
                    {sosGpsStatus}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      State / Union Territory *
                    </label>
                    <select
                      value={sosStateName}
                      onChange={(e) => {
                        const nextState = e.target.value as IndianStateName;
                        setSosStateName(nextState);
                        const nextDistricts = getDistrictsForState(nextState);
                        setSosDistrict(nextDistricts[0] || '');
                        setCustomSosDistrict('');
                        setSosLandmarkCoords(undefined);
                      }}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
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
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      District / City *
                    </label>
                    <select
                      value={sosDistrict}
                      onChange={(e) => {
                        setSosDistrict(e.target.value as DistrictName);
                        setSosLandmarkCoords(undefined);
                      }}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-slate-900"
                    >
                      {getDistrictsForState(sosStateName).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                      <option value="__custom__">Other District / Town…</option>
                    </select>
                    {sosDistrict === '__custom__' && (
                      <input
                        type="text"
                        value={customSosDistrict}
                        onChange={(e) => setCustomSosDistrict(e.target.value)}
                        placeholder={`Enter district or town in ${sosStateName}`}
                        className="mt-2 w-full p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:border-slate-900"
                        required
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      Nearest Landmark <span className="font-normal text-slate-500">(Optional)</span>
                    </label>
                    <LandmarkAutocompleteInput
                      value={sosLandmark}
                      district={sosDistrict === '__custom__' ? customSosDistrict || sosStateName : sosDistrict}
                      stateName={sosStateName}
                      disabled={isOffline}
                      required={false}
                      placeholder="Optional — school, temple, station, or market"
                      onChange={(val, coords) => {
                        setSosLandmark(val);
                        if (coords) setSosLandmarkCoords(coords);
                      }}
                    />
                  </div>
                </div>

                {/* Required Full Address — For Rescue Team only */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-semibold text-slate-800">
                      Exact Pickup Address *
                    </label>
                    <span className="text-[11px] text-emerald-700 font-semibold inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      For Rescue Officers only
                    </span>
                  </div>
                  <input
                    type="text"
                    value={sosExactAddress}
                    onChange={(e) => setSosExactAddress(e.target.value)}
                    placeholder="House number, lane, ward, street, or exact pickup spot"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-900 bg-white"
                    required
                  />
                </div>
              </div>

              {/* Step 4: Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={sosName}
                    onChange={(e) => setSosName(e.target.value)}
                    placeholder="Full name"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-900 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={sosPhone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setSosPhone(digits);
                    }}
                    pattern="[0-9]{10}"
                    title="Enter your 10-digit mobile number"
                    placeholder="10-digit mobile number"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-900 font-mono bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Extra Note <span className="font-normal text-slate-500">(Optional)</span>
                </label>
                <textarea
                  value={sosNotes}
                  onChange={(e) => setSosNotes(e.target.value)}
                  placeholder="Any extra landmark clue, roof color, or special instruction for the boat crew"
                  rows={2}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-900 bg-white"
                />
              </div>

              {/* Optional Ground Photo Evidence */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-slate-700" />
                      <span>Ground Photo Evidence (Optional)</span>
                    </span>
                    <p className="text-slate-500 mt-0.5">
                      Checks camera EXIF metadata locally on your device without exposing raw GPS publicly.
                    </p>
                  </div>
                  <label className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-semibold cursor-pointer transition-colors">
                    <span>Choose Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (ev) => {
                        const file = ev.target.files?.[0];
                        if (!file) return;
                        const result = await inspectFieldPhotoEvidence(file);
                        setSosPhotoForensics(result);
                      }}
                    />
                  </label>
                </div>

                {sosPhotoForensics && (
                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong
                        className={
                          sosPhotoForensics.trustVerdict === 'AUTHENTIC_FIELD_CAPTURE'
                            ? 'text-emerald-700'
                            : sosPhotoForensics.trustVerdict === 'REPLAY_DUPLICATE_FLAGGED'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                        }
                      >
                        {sosPhotoForensics.trustVerdict === 'AUTHENTIC_FIELD_CAPTURE'
                          ? 'Authentic Camera EXIF Verified'
                          : sosPhotoForensics.trustVerdict === 'REPLAY_DUPLICATE_FLAGGED'
                          ? 'Duplicate Image Hash Detected'
                          : 'Stripped Metadata (Accepted as Note)'}
                      </strong>
                      <span className="font-mono text-[11px] text-slate-500">
                        SHA-256: {sosPhotoForensics.sha256Hex.slice(0, 14)}…
                      </span>
                    </div>
                    <p className="text-slate-600">{sosPhotoForensics.summaryNote}</p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingSos}
                  className="w-full sm:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmittingSos
                      ? 'Sending to Rescue Team…'
                      : isOffline
                      ? 'Save Help Request Offline'
                      : 'Send Help Request'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 5. Tab 2: Safe Map */}
      {citizenTab === 'map' && (
        <CitizenPublicMap
          placesMap={placesMap}
          isResolving={isResolving}
          quotaBlocked={quotaBlocked}
          onRetryPlaces={retryResolvePlaces}
          focusedPlaceKey={focusedMapPlace}
          onSelectPlaceKey={setFocusedMapPlace}
          selectedStateFilter={mapStateFilter}
          onSelectStateFilter={setMapStateFilter}
          shelterLoads={shelterLoads}
          liveHazards={liveHazards}
          onDiscoverNearbyShelters={resolveNearbySheltersByCoords}
        />
      )}

      {/* 6. Tab 3: Live Alerts & Fact-Check Desk */}
      {citizenTab === 'alerts' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Live Disaster Bulletins &amp; Natural Hazard Feed
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Real-time NDMA / Rescue Officer warnings, verified fact-checks, USGS seismic events, and NASA EONET satellite hazard alerts.
              </p>
            </div>

            {onRefreshHazards && (
              <button
                type="button"
                onClick={onRefreshHazards}
                disabled={isLoadingHazards}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHazards ? 'animate-spin' : ''}`} />
                <span>{isLoadingHazards ? 'Refreshing…' : 'Refresh Live Feed'}</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto text-xs w-fit max-w-full">
            {(
              [
                { id: 'all', label: 'All Live Alerts' },
                { id: 'official', label: 'Officer Warnings & Fact-Checks' },
                { id: 'usgs_earthquake', label: 'Earthquakes (USGS)' },
                { id: 'nasa_eonet', label: 'Satellite Events (NASA EONET)' }
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAlertSourceFilter(f.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                  alertSourceFilter === f.id
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Live Hazards List */}
          {filteredLiveHazards.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-200 bg-white text-center space-y-1.5">
              <div className="text-sm font-semibold text-slate-900">
                {isLoadingHazards
                  ? 'Fetching live seismic, satellite, and official alerts…'
                  : 'No active warnings in this category right now'}
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Official warnings broadcast by Rescue Officers and live USGS / NASA EONET natural hazard events appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredLiveHazards.map((hazard) => {
                const isFactCheck = hazard.source === 'verified_fact_check';
                const isCritical = hazard.severity === 'critical';
                const sourceLabel =
                  hazard.source === 'officer_broadcast'
                    ? 'Official Rescue Warning'
                    : hazard.source === 'verified_fact_check'
                    ? 'Verified Fact-Check'
                    : hazard.source === 'usgs_earthquake'
                    ? 'USGS Seismic Sensor'
                    : 'NASA EONET Satellite';

                return (
                  <div
                    key={hazard.id}
                    className={`p-4 rounded-xl border space-y-2.5 ${
                      isFactCheck
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : isCritical
                        ? 'border-red-200 bg-red-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-600">
                        <strong
                          className={
                            isFactCheck
                              ? 'text-emerald-800'
                              : isCritical
                              ? 'text-red-700'
                              : 'text-amber-800'
                          }
                        >
                          {sourceLabel}
                        </strong>
                        <span aria-hidden="true">·</span>
                        <span>{hazard.areaLabel}</span>
                      </div>
                      <span className="text-slate-500 tabular-nums">
                        {formatRelativeTime(hazard.updatedAt)}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {hazard.title}
                      </h3>
                      <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                        {hazard.summary}
                      </p>
                    </div>

                    <div className="pt-1 flex flex-wrap items-center gap-2.5 text-xs">
                      <button
                        type="button"
                        onClick={() => handleReadAlertAloud(hazard)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {speakingAlertId === hazard.id ? 'Stop Audio' : 'Read Aloud'}
                        </span>
                      </button>

                      {hazard.coordinates && (
                        <button
                          type="button"
                          onClick={() => setCitizenTab('map')}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 text-red-600" />
                          <span>View on Safe Map</span>
                        </button>
                      )}

                      {hazard.externalUrl && (
                        <a
                          href={hazard.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 hover:text-slate-900 underline underline-offset-2 inline-flex items-center gap-1 ml-auto"
                        >
                          <span>Source Bulletin</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Check a Forwarded Message */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Check a Forwarded Message or Rumor
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Paste any forwarded warning message to check against verified bulletins or send it to Duty Officers for fact-checking.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={rumorText}
                onChange={(e) => setRumorText(e.target.value)}
                placeholder="Paste forwarded message or claim here..."
                className="flex-1 p-2.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-slate-900"
              />
              <button
                type="button"
                disabled={isCheckingRumor || !rumorText.trim()}
                onClick={async () => {
                  const msg = rumorText.trim();
                  if (!msg) return;
                  setIsCheckingRumor(true);
                  const verdictMsg = await checkRumorOnServer(msg);
                  setRumorCheckResult(verdictMsg);
                  setIsCheckingRumor(false);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0"
              >
                {isCheckingRumor ? 'Checking…' : 'Check Message'}
              </button>
            </div>

            {rumorCheckResult && (
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-800 flex items-center justify-between gap-2">
                <span>{rumorCheckResult}</span>
                <button
                  onClick={() => setRumorCheckResult(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs shrink-0"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Tab 4: Shelters (All 28 States & 8 Union Territories) */}
      {citizenTab === 'shelters' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Open Relief Shelters Across India</h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Grounded Google Maps relief centers, hospitals, and safe assembly hubs across Indian States &amp; Union Territories.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                State / UT:
              </label>
              <select
                value={mapStateFilter}
                onChange={(e) => setMapStateFilter(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-xs font-medium bg-white text-slate-800 outline-none focus:border-slate-900"
              >
                <option value="ALL">All India (Major Hubs)</option>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(placesMap)
              .filter(
                (p) =>
                  (p.publicRole === 'shelter' || p.publicRole === 'backup_shelter') &&
                  (mapStateFilter === 'ALL' ||
                    p.stateName.toLowerCase() === mapStateFilter.toLowerCase())
              )
              .map((shelter) => {
                const load = shelterLoads[shelter.key];
                const pct = load
                  ? Math.min(100, Math.round((load.occupied / Math.max(1, load.capacity)) * 100))
                  : null;
                const showFull = pct !== null && pct >= 85;
                return (
                  <div
                    key={shelter.key}
                    className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`font-semibold ${
                              showFull ? 'text-amber-700 font-bold' : 'text-emerald-700'
                            }`}
                          >
                            {showFull
                              ? 'Near Capacity — Redirect Active'
                              : shelter.publicRole === 'backup_shelter'
                              ? 'Open (Backup)'
                              : 'Open'}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">
                            {formatLocationWithState(shelter.district, shelter.stateName)}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1">
                          {shelter.displayName || shelter.publicTitle}
                        </h3>
                        <div className="text-xs text-slate-500 flex items-start gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{shelter.formattedAddress}</span>
                        </div>
                      </div>

                      {load && pct !== null && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs tabular-nums">
                            <span className="text-slate-600 font-medium">Reported Occupancy</span>
                            <strong
                              className={`font-mono ${
                                showFull ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              {load.occupied} / {load.capacity} ({pct}%)
                            </strong>
                          </div>
                          <progress
                            value={pct}
                            max={100}
                            className={`w-full h-1.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full ${
                              showFull
                                ? '[&::-webkit-progress-value]:bg-amber-500 [&::-moz-progress-bar]:bg-amber-500'
                                : '[&::-webkit-progress-value]:bg-emerald-600 [&::-moz-progress-bar]:bg-emerald-600'
                            }`}
                          />
                        </div>
                      )}

                      {showFull ? (
                        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-2">
                          <p>
                            Camp is ≥85% occupied. Overflow redirect active to{' '}
                            <strong>{load?.redirectTitle || 'Nearest Backup Relief Camp'}</strong>.
                          </p>
                          {load?.redirectPlaceKey && (
                            <button
                              type="button"
                              onClick={() =>
                                openPlaceOnCitizenMap(load.redirectPlaceKey!, shelter.stateName)
                              }
                              className="w-full py-1.5 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors"
                            >
                              Open Backup Shelter on Map
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 border-y border-slate-100 py-2.5 leading-relaxed">
                          {shelter.publicSummary}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500 tabular-nums">Helpline: 1070 / 112</span>
                      <button
                        type="button"
                        onClick={() => openPlaceOnCitizenMap(shelter.key, shelter.stateName)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>View on Map</span>
                      </button>
                    </div>
                  </div>
                );
              })}

            {Object.values(placesMap).filter(
              (p) =>
                (p.publicRole === 'shelter' || p.publicRole === 'backup_shelter') &&
                (mapStateFilter === 'ALL' ||
                  p.stateName.toLowerCase() === mapStateFilter.toLowerCase())
            ).length === 0 && (
              <div className="md:col-span-3 p-6 rounded-xl border border-slate-200 bg-white text-center space-y-2">
                <div className="text-sm font-semibold text-slate-900">
                  {isResolving
                    ? `Locating designated relief shelter in ${mapStateFilter}…`
                    : `Call State Emergency Control (1070 / 1077 / 112) for nearest camp in ${mapStateFilter}`}
                </div>
                <p className="text-xs text-slate-600">
                  Government Higher Secondary Schools and community halls act as designated SDMA relief shelters across {mapStateFilter}.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Tab 5: Track Request */}
      {citizenTab === 'track' && (
        <div className="space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-900">Track Your Request</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Enter your Reference Code and 10-digit mobile number to check your rescue status privately.
            </p>
          </div>

          {ownReceipts.length > 0 && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Saved on This Device ({ownReceipts.length})
                </span>
                <button
                  type="button"
                  onClick={handleClearDeviceReceipts}
                  className="text-xs text-slate-500 hover:text-red-600 inline-flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {ownReceipts.map((r) => (
                  <div
                    key={r.refId}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900">{r.refId}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-700">{r.categoryLabel}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-500">
                        {formatLocationWithState(r.district, r.stateName)} ({r.maskedPhone})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTrackRefCode(r.refId);
                        setTrackPhoneVerify(r.phoneLast10);
                        void verifyAndTrackRequest(r.refId, r.phoneLast10);
                      }}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors"
                    >
                      Check Status
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dual-Verification Form */}
          <form onSubmit={handleTrackFormSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reference Code
              </label>
              <input
                type="text"
                value={trackRefCode}
                onChange={(e) => setTrackRefCode(e.target.value)}
                placeholder="REF-NDMA-XXXXXX"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-900 font-mono uppercase bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                10-Digit Mobile Number
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={trackPhoneVerify}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setTrackPhoneVerify(digits);
                }}
                pattern="[0-9]{10}"
                title="Enter your 10-digit mobile number"
                placeholder="10-digit mobile number"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-900 font-mono bg-white"
                required
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                Check Status
              </button>
            </div>
          </form>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Both fields are required so nobody else can look up your family’s request.</span>
          </div>

          {trackError && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700">
              {trackError}
            </div>
          )}

          {trackedResult && (
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Received by Rescue Team
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {sanitizeCitizenVisibleTitle(
                      trackedResult.category,
                      trackedResult.district,
                      trackedResult.stateName
                    )}
                  </h3>
                </div>

                <div className="text-right text-xs font-mono text-slate-600">
                  <div>{trackedResult.verifiedRef}</div>
                  <div className="text-[11px] text-slate-400">{trackedResult.maskedPhone}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Area</span>
                  <strong className="text-slate-900 text-sm mt-0.5 block">
                    {formatLocationWithState(trackedResult.district, trackedResult.stateName)}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">Assigned Team</span>
                  <strong className="text-slate-900 text-sm mt-0.5 block">
                    {trackedResult.assignedTeam}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">Estimated Arrival</span>
                  <strong className="text-slate-900 text-sm mt-0.5 block tabular-nums">
                    {trackedResult.eta}
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700">
                Stay on an upper floor or high ground and wave a bright cloth or torch when you hear the rescue team.
              </div>

              <OfflineRescuePassCard
                refId={trackedResult.verifiedRef}
                maskedPhone={trackedResult.maskedPhone}
                district={trackedResult.district}
                stateName={trackedResult.stateName}
                landmark={`${trackedResult.district} Pickup Sector`}
                categoryLabel={sanitizeCitizenVisibleTitle(
                  trackedResult.category,
                  trackedResult.district,
                  trackedResult.stateName
                )}
                peopleCount={2}
                medicalTag={
                  trackedResult.category === 'medical_oxygen'
                    ? 'Medical / Oxygen Boat Priority'
                    : 'Verified Rescue Boarding Pass'
                }
                issuedAt={Date.now()}
              />
            </div>
          )}
        </div>
      )}

      {/* 8B. Tab: Zero-PII "I Am Safe" Family Check-In & Volunteer Boat Registry */}
      {citizenTab === 'checkin' && <FamilySafeCheckIn />}

      {/* 9. Tab 6: Safety Tips & Emergency Acoustic/Strobe Beacon (Works Offline) */}
      {citizenTab === 'survival' && (
        <div className="space-y-6">
          <EmergencyBeaconTools placesMap={placesMap} activeStateName={mapStateFilter} />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Flood &amp; Disaster Safety Tips (Works Offline)
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Saved on your phone in English &amp; Hindi so you can read them without internet.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setSurvivalLang('en')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  survivalLang === 'en'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setSurvivalLang('hi')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  survivalLang === 'hi'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold shrink-0">
                  1
                </span>
                {translations[survivalLang].guideWaterTitle}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-7">
                {translations[survivalLang].guideWaterBody}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold shrink-0">
                  2
                </span>
                {translations[survivalLang].guideElecTitle}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-7">
                {translations[survivalLang].guideElecBody}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold shrink-0">
                  3
                </span>
                {translations[survivalLang].guideRoofTitle}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-7">
                {translations[survivalLang].guideRoofBody}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold shrink-0">
                  4
                </span>
                {translations[survivalLang].guideSignalTitle}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-7">
                {translations[survivalLang].guideSignalBody}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold shrink-0">
                  5
                </span>
                {translations[survivalLang].guideMedTitle}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-7">
                {translations[survivalLang].guideMedBody}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold shrink-0">
                  6
                </span>
                {translations[survivalLang].guideCommsTitle}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-7">
                {translations[survivalLang].guideCommsBody}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
