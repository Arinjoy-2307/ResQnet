/**
 * ResQnet Disaster Relief Coordination Portal
 * Segments:
 * 1. Citizen — Emergency help requests, safe shelter map, live natural hazard & official alerts, family check-in
 * 2. Officer — Live rescue map, field reports, priority dispatch queue, fact-check desk, offline SMS queue, protected contacts, shift handover
 */

import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider, APIProviderContext } from '@vis.gl/react-google-maps';
import { isRealGoogleMapsKey } from './services/groundedLocations';
import {
  FusedIncident,
  ReportPacket,
  StoreForwardMessage,
  MisinformationItem,
  ShelterLoadRecord,
  ShiftHandoverRecord,
  VolunteerResourceRecord,
  LivePublicHazardItem
} from './types/disaster';
import {
  calculateDecayedReliability,
  evaluateCredibilityState,
  computeTriagePriority,
  buildFusedIncident,
  generateProvenanceHash
} from './services/fusionEngine';
import { LanguageCode, translations } from './services/i18n';
import {
  ALL_INDIA_CENTER,
  formatLocationWithState,
  getStateInfo,
  inferStateFromDistrict
} from './data/indianStates';
import { Header } from './components/Header';
import { KPIStrip } from './components/KPIStrip';
import { InteractiveMap } from './components/InteractiveMap';
import { FusionFeed } from './components/FusionFeed';
import { TriageConsole } from './components/TriageConsole';
import { MisinformationQuarantine } from './components/MisinformationQuarantine';
import { StoreForwardConsole } from './components/StoreForwardConsole';
import { PrivacyScopeConsole } from './components/PrivacyScopeConsole';
import { MediaPriorityConsole } from './components/MediaPriorityConsole';
import { ProvenanceInspectorModal } from './components/ProvenanceInspectorModal';
import { SimulateReportModal } from './components/SimulateReportModal';
import { CitizenPortal } from './components/CitizenPortal';
import { OfficialAuthModal } from './components/OfficialAuthModal';
import { ShiftHandoverAndVolunteerConsole } from './components/ShiftHandoverAndVolunteerConsole';
import {
  connectOfficerRealtimeChannel,
  connectPublicRealtimeChannel,
  fetchLivePublicHazards,
  fetchPublicShelterLoads,
  LiveOfficerSyncState,
  LivePacketRecord,
  logoutOfficerOnServer,
  pushOfficerPacketToServer,
  pushConflictResolutionToServer,
  pushPriorityOverrideToServer,
  recordAuditLogOnServer,
  updateOfficerShelterLoad
} from './services/realtimeClient';

import {
  Map,
  Radio,
  HeartHandshake,
  ShieldAlert,
  Layers,
  Lock,
  Globe,
  ClipboardCheck,
  X
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const fallbackMapsContext = {
  mapInstances: {},
  addMapInstance: () => {},
  removeMapInstance: () => {},
  clearMapInstances: () => {},
  loadedLibraries: {},
  importLibrary: async () => null
};

const AppMapsProvider: React.FC<{
  apiKey: string;
  language: string;
  children: React.ReactNode;
}> = ({ apiKey, language, children }) => {
  const isKeyValid = isRealGoogleMapsKey(apiKey);

  if (isKeyValid) {
    return (
      <APIProvider
        apiKey={apiKey}
        language={language}
        region="IN"
        libraries={['marker', 'places', 'routes', 'elevation']}
      >
        {children}
      </APIProvider>
    );
  }

  return (
    <APIProviderContext.Provider value={fallbackMapsContext as any}>
      {children}
    </APIProviderContext.Provider>
  );
};

function mergePacketRecordIdempotently(
  prevIncidents: FusedIncident[],
  record: LivePacketRecord,
  nowMs: number
): FusedIncident[] {
  const { packet, targetIncidentId, isConflicting, conflictClaim } = record;
  if (!packet || !packet.id) return prevIncidents;

  const alreadyIngested = prevIncidents.some((inc) =>
    inc.provenanceTrail.some((p) => p.id === packet.id)
  );
  if (alreadyIngested) return prevIncidents;

  if (targetIncidentId) {
    return prevIncidents.map((inc) => {
      if (inc.id !== targetIncidentId) return inc;

      const updatedTrail = [packet, ...inc.provenanceTrail];
      const conflictData = isConflicting
        ? {
            sourceA: inc.provenanceTrail[0]?.reporterName || 'Earlier Team',
            claimA: inc.provenanceTrail[0]?.headline || 'Earlier status',
            channelA: inc.provenanceTrail[0]?.channel || 'pwd_official',
            timestampA: inc.provenanceTrail[0]?.timestamp || nowMs,
            sourceB: packet.reporterName,
            claimB: conflictClaim || packet.headline,
            channelB: packet.channel,
            timestampB: packet.timestamp,
            conflictDescription: 'Opposing reports received from field teams.',
            conservativeAction:
              'Safety First: Treat route as closed and use detour until field teams verify together.'
          }
        : inc.conflictingReports;

      const { state, baseReliability, corroborationCount } = evaluateCredibilityState(
        updatedTrail,
        conflictData
      );

      const { currentReliability, ageMinutes, freshnessStatus, fallbackInstructions } =
        calculateDecayedReliability(
          baseReliability,
          packet.timestamp,
          Math.max(nowMs, packet.timestamp),
          inc.decayHalfLifeMin
        );

      return {
        ...inc,
        state,
        baseReliability,
        currentReliability,
        lastUpdatedAt: packet.timestamp,
        ageMinutes,
        freshnessStatus,
        fallbackInstructions,
        provenanceTrail: updatedTrail,
        corroborationCount,
        conflictingReports: conflictData
      };
    });
  }

  const newInc = buildFusedIncident(
    packet.incidentClusterId || `INC-LIVE-${packet.id.slice(-4)}`,
    `CLUST-${packet.district.slice(0, 3).toUpperCase()}-${packet.id.slice(-2)}`,
    packet.headline,
    packet.category,
    packet.district,
    packet.landmark,
    packet.coordinates,
    [packet],
    null,
    packet.category === 'medical_oxygen' ? 'critical' : 'high',
    Math.max(nowMs, packet.timestamp),
    45,
    false,
    undefined,
    false,
    undefined,
    undefined,
    undefined,
    packet.stateName
  );

  return [newInc, ...prevIncidents];
}

export default function App() {
  const [portalMode, setPortalMode] = useState<'citizen' | 'official'>('citizen');
  const [authenticatedOfficer, setAuthenticatedOfficer] = useState<{
    name: string;
    role: string;
    badgeId: string;
  } | null>(() => {
    try {
      const stored = sessionStorage.getItem('resqnet_officer_session');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isOfficialAuthOpen, setIsOfficialAuthOpen] = useState<boolean>(false);

  // Real browser online/offline state
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real-time Officer Channel Telemetry (strictly active in Officer view)
  const [isOfficerRealtimeConnected, setIsOfficerRealtimeConnected] = useState<boolean>(false);
  const [liveConnectedOfficerTabs, setLiveConnectedOfficerTabs] = useState<number>(0);
  const [liveArrivalBanner, setLiveArrivalBanner] = useState<{
    headline: string;
    district: string;
  } | null>(null);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [language, setLanguage] = useState<LanguageCode>('en');
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<
    'map' | 'feed' | 'triage' | 'misinfo' | 'storeforward' | 'privacy' | 'media' | 'handover'
  >('map');

  // Clean real-time operational state (zero pre-seeded mock data)
  const [incidents, setIncidents] = useState<FusedIncident[]>([]);
  const [storeForwardMessages, setStoreForwardMessages] = useState<StoreForwardMessage[]>([]);
  const [misinfoList, setMisinfoList] = useState<MisinformationItem[]>([]);
  const [shelterLoads, setShelterLoads] = useState<Record<string, ShelterLoadRecord>>({});
  const [liveHazards, setLiveHazards] = useState<LivePublicHazardItem[]>([]);
  const [isLoadingHazards, setIsLoadingHazards] = useState<boolean>(false);
  const [officerVolunteers, setOfficerVolunteers] = useState<VolunteerResourceRecord[]>([]);
  const [officerHandovers, setOfficerHandovers] = useState<ShiftHandoverRecord[]>([]);

  const [selectedIncident, setSelectedIncident] = useState<FusedIncident | null>(null);
  const [inspectedIncidentForProvenance, setInspectedIncidentForProvenance] =
    useState<FusedIncident | null>(null);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState<boolean>(false);
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('all');

  const [globalSupervisorAlert, setGlobalSupervisorAlert] = useState<{
    id: string;
    timestamp: number;
    userId: string;
    userName: string;
    role: string;
    requestedScope: string;
    ipAddress: string;
  } | null>(null);

  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);
  const [isQuotaBannerDismissed, setIsQuotaBannerDismissed] = useState<boolean>(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  const refreshLiveHazardsAndShelters = useCallback(async () => {
    if (isOffline) return;
    setIsLoadingHazards(true);
    try {
      const [hazardsRes, loadsRes] = await Promise.all([
        fetchLivePublicHazards(),
        fetchPublicShelterLoads()
      ]);
      if (hazardsRes?.hazards) {
        setLiveHazards(hazardsRes.hazards);
      }
      if (loadsRes) {
        setShelterLoads(loadsRes);
      }
    } finally {
      setIsLoadingHazards(false);
    }
  }, [isOffline]);

  useEffect(() => {
    void refreshLiveHazardsAndShelters();
    if (isOffline) return;
    const poll = setInterval(() => {
      void refreshLiveHazardsAndShelters();
    }, 3 * 60 * 1000);
    return () => clearInterval(poll);
  }, [isOffline, refreshLiveHazardsAndShelters]);

  // Connect zero-PII public real-time channel for verified official warnings, fact-checks & shelter occupancy
  useEffect(() => {
    if (isOffline) return;
    const disconnectPublic = connectPublicRealtimeChannel({
      onHazardsRefresh: () => {
        void refreshLiveHazardsAndShelters();
      },
      onShelterLoadsUpdated: (loads) => {
        setShelterLoads(loads);
      }
    });
    return () => {
      disconnectPublic();
    };
  }, [isOffline, refreshLiveHazardsAndShelters]);

  // Connect real-time multi-device WebSocket channel strictly when Officer view is authenticated
  useEffect(() => {
    if (portalMode !== 'official' || !authenticatedOfficer || isOffline) {
      setIsOfficerRealtimeConnected(false);
      setLiveConnectedOfficerTabs(0);
      return;
    }

    const applyServerStateSnapshot = (
      state: LiveOfficerSyncState,
      connectedTabs: number
    ) => {
      setIsOfficerRealtimeConnected(true);
      setLiveConnectedOfficerTabs(connectedTabs);

      if (Array.isArray(state.packets) && state.packets.length > 0) {
        const chronological = [...state.packets].reverse();
        setIncidents((prev) => {
          let next = prev;
          for (const rec of chronological) {
            next = mergePacketRecordIdempotently(next, rec, Date.now());
          }
          return next;
        });
      }

      if (Array.isArray(state.offlineMessages)) {
        setStoreForwardMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const fresh = state.offlineMessages.filter((m) => !existingIds.has(m.id));
          return fresh.length > 0 ? [...fresh, ...prev] : prev;
        });
      }

      if (Array.isArray(state.misinfoItems)) {
        setMisinfoList(state.misinfoItems);
      }

      if (Array.isArray(state.volunteers)) {
        setOfficerVolunteers(state.volunteers);
      }

      if (Array.isArray(state.shiftHandovers)) {
        setOfficerHandovers(state.shiftHandovers);
      }

      if (state.shelterLoads) {
        setShelterLoads(state.shelterLoads);
      }
    };

    const disconnect = connectOfficerRealtimeChannel({
      onFullState: applyServerStateSnapshot,
      onPacketIngested: (record, connectedTabs) => {
        setIsOfficerRealtimeConnected(true);
        setLiveConnectedOfficerTabs(connectedTabs);
        setIncidents((prev) => mergePacketRecordIdempotently(prev, record, Date.now()));
        if (record.packet?.headline) {
          setLiveArrivalBanner({
            headline: record.packet.headline,
            district: formatLocationWithState(record.packet.district, record.packet.stateName)
          });
        }
      },
      onOfflineBeacon: (message) => {
        setStoreForwardMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [message, ...prev]
        );
      },
      onMisinfoFlagged: (item) => {
        setMisinfoList((prev) =>
          prev.some((m) => m.id === item.id) ? prev : [item, ...prev]
        );
      },
      onMisinfoReviewed: (item) => {
        setMisinfoList((prev) =>
          prev.some((m) => m.id === item.id)
            ? prev.map((m) => (m.id === item.id ? item : m))
            : [item, ...prev]
        );
      },
      onConflictResolved: (incidentId, resolutionNote) => {
        applyLocalConflictResolution(incidentId, resolutionNote);
      },
      onPriorityOverride: (incidentId, override) => {
        applyLocalPriorityOverride(
          incidentId,
          override.newScore,
          override.reason,
          override.responderName
        );
      },
      onSecurityBreachDetected: (log) => {
        setGlobalSupervisorAlert({
          id: log.id,
          timestamp: log.timestamp,
          userId: log.userId,
          userName: log.userName,
          role: log.role,
          requestedScope: log.requestedScope,
          ipAddress: log.ipAddress || '127.0.0.1'
        });
      },
      onVolunteersUpdated: (volunteers) => {
        setOfficerVolunteers(volunteers);
      },
      onHandoverCreated: (handover) => {
        setOfficerHandovers((prev) =>
          prev.some((h) => h.id === handover.id) ? prev : [handover, ...prev]
        );
      },
      onShelterLoadsUpdated: (loads) => {
        setShelterLoads(loads);
      },
      onConnectionChange: (connected, tabs) => {
        setIsOfficerRealtimeConnected(connected);
        setLiveConnectedOfficerTabs(tabs);
      }
    });

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalMode, authenticatedOfficer, isOffline]);

  // Real wall-clock freshness refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIncidents((prevIncidents) =>
      prevIncidents.map((inc) => {
        const latestTime = inc.provenanceTrail.reduce(
          (max, p) => (p.timestamp > max ? p.timestamp : max),
          inc.lastUpdatedAt
        );

        const { currentReliability, ageMinutes, freshnessStatus, fallbackInstructions } =
          calculateDecayedReliability(
            inc.baseReliability,
            latestTime,
            Math.max(nowMs, latestTime),
            inc.decayHalfLifeMin
          );

        const triagePriorityScore = inc.responderOverride
          ? inc.responderOverride.overriddenScore
          : computeTriagePriority(inc.severityLevel, inc.vulnerabilityScore, currentReliability);

        return {
          ...inc,
          currentReliability,
          ageMinutes,
          freshnessStatus,
          fallbackInstructions,
          triagePriorityScore
        };
      })
    );
  }, [nowMs]);

  const handleSelectPortalMode = (mode: 'citizen' | 'official') => {
    if (mode === 'official' && !authenticatedOfficer) {
      setIsOfficialAuthOpen(true);
      return;
    }
    setPortalMode(mode);
  };

  const handleRefreshIncidentPing = (incidentId: string) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === incidentId) {
          const freshTime = Date.now();
          const updatedPackets = inc.provenanceTrail.map((p, idx) =>
            idx === 0 ? { ...p, timestamp: freshTime } : p
          );

          const { currentReliability, ageMinutes, freshnessStatus, fallbackInstructions } =
            calculateDecayedReliability(
              inc.baseReliability,
              freshTime,
              freshTime,
              inc.decayHalfLifeMin
            );

          return {
            ...inc,
            lastUpdatedAt: freshTime,
            provenanceTrail: updatedPackets,
            currentReliability,
            ageMinutes,
            freshnessStatus,
            fallbackInstructions
          };
        }
        return inc;
      })
    );
  };

  const handleIngestNewPacket = (
    packet: ReportPacket,
    targetIncidentId?: string,
    isConflicting?: boolean,
    conflictClaim?: string
  ) => {
    const record: LivePacketRecord = {
      packet,
      targetIncidentId,
      isConflicting,
      conflictClaim,
      receivedAt: Date.now()
    };

    if (portalMode !== 'citizen') {
      setIncidents((prev) => mergePacketRecordIdempotently(prev, record, Date.now()));
      if (!isOffline) {
        void pushOfficerPacketToServer(packet, targetIncidentId, isConflicting, conflictClaim);
      }
    }
  };

  const applyLocalConflictResolution = (incidentId: string, resolutionNote: string) => {
    const nowTime = Date.now();
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id !== incidentId) return inc;
        if (inc.state === 'verified' && !inc.conflictingReports) return inc;

        const pktId = `REP-JOINT-${incidentId}`;
        const jointPacket: ReportPacket = {
          id: pktId,
          incidentClusterId: inc.id,
          timestamp: nowTime,
          channel: 'ndrf_agent',
          reporterName: 'Joint PWD + SDRF Team',
          reporterRole: 'Joint Inspection Lead',
          isOfficial: true,
          isAuthorizedFieldAgent: true,
          district: inc.district,
          landmark: inc.landmark,
          coordinates: inc.coordinates,
          category: inc.category,
          headline: resolutionNote,
          details: resolutionNote,
          rawPayload: JSON.stringify({ joint_recon: true, resolved_at: nowTime }),
          provenanceHash: generateProvenanceHash(pktId, nowTime, 'ndrf_agent'),
          contactMasked: '+91 ••••• •••••',
          exactAddress: inc.landmark
        };

        const updatedTrail = [
          jointPacket,
          ...inc.provenanceTrail.filter((p) => p.id !== pktId)
        ];
        const { state, baseReliability, corroborationCount } = evaluateCredibilityState(
          updatedTrail,
          null
        );
        const { currentReliability, ageMinutes, freshnessStatus, fallbackInstructions } =
          calculateDecayedReliability(
            baseReliability,
            nowTime,
            nowTime,
            inc.decayHalfLifeMin
          );

        return {
          ...inc,
          state,
          baseReliability,
          currentReliability,
          lastUpdatedAt: nowTime,
          ageMinutes,
          freshnessStatus,
          fallbackInstructions,
          provenanceTrail: updatedTrail,
          corroborationCount,
          conflictingReports: null
        };
      })
    );
  };

  const applyLocalPriorityOverride = (
    incidentId: string,
    newScore: number,
    reason: string,
    responderName: string
  ) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === incidentId) {
          return {
            ...inc,
            triagePriorityScore: newScore,
            responderOverride: {
              responderId: authenticatedOfficer?.badgeId || 'DUTY-OFFICER',
              responderName,
              role: authenticatedOfficer?.role || 'Rescue Lead',
              originalScore: inc.triagePriorityScore,
              overriddenScore: newScore,
              reason,
              timestamp: Date.now()
            }
          };
        }
        return inc;
      })
    );
  };

  const handleUpdateIncidentOverride = (
    incidentId: string,
    newScore: number,
    reason: string,
    responderName: string
  ) => {
    applyLocalPriorityOverride(incidentId, newScore, reason, responderName);
    if (!isOffline) {
      void pushPriorityOverrideToServer(incidentId, newScore, reason, responderName);
    }
  };

  const handleDebunkAndBroadcast = (
    incidentId: string,
    debunkNotice: string,
    misinfoId?: string
  ) => {
    if (incidentId) {
      setIncidents((prev) =>
        prev.map((inc) => {
          if (inc.id === incidentId) {
            return {
              ...inc,
              isDebunked: true,
              debunkNotice
            };
          }
          return inc;
        })
      );
    }

    if (misinfoId) {
      setMisinfoList((prev) =>
        prev.map((item) =>
          item.id === misinfoId
            ? {
                ...item,
                reviewerName: authenticatedOfficer?.name || 'Duty Officer',
                reviewerNotes: debunkNotice,
                debunkBroadcast: {
                  sentAt: Date.now(),
                  smsDelivered: item.exposedCitizenCount,
                  ivrCallsMade: Math.floor(item.exposedCitizenCount * 0.85),
                  pictographsRendered: item.exposedCitizenCount,
                  reachRatePercentage: 100
                }
              }
            : item
        )
      );
    }
  };

  const syncSingleStoreForwardToIncidents = (msg: StoreForwardMessage) => {
    const packetId = `REP-SYNC-${msg.id}`;
    const stateGuess = msg.stateName || inferStateFromDistrict(msg.locationText);
    const stateCenter = getStateInfo(stateGuess)?.viewCenter || ALL_INDIA_CENTER;

    const readableTitle =
      msg.lastKnownSafeStatus === 'OXYGEN_NEEDED'
        ? `Urgent Oxygen Needed — ${msg.locationText}`
        : msg.lastKnownSafeStatus === 'NEED_RESCUE'
        ? `Rescue Needed — ${msg.locationText}`
        : `Emergency SMS — ${msg.locationText}`;

    const packet: ReportPacket = {
      id: packetId,
      incidentClusterId: `INC-SF-${msg.id.slice(-3)}`,
      timestamp: msg.timestamp,
      channel: msg.channel === 'USSD' ? 'citizen_ussd' : 'citizen_sms',
      reporterName: `Resident (${msg.phoneNumber.slice(-4)})`,
      reporterRole: 'Resident',
      isOfficial: false,
      isAuthorizedFieldAgent: false,
      stateName: stateGuess,
      district: msg.locationText.split(',').pop()?.trim() || stateGuess,
      landmark: msg.locationText,
      coordinates: stateCenter,
      category: msg.lastKnownSafeStatus === 'OXYGEN_NEEDED' ? 'medical_oxygen' : 'flood_surge',
      headline: readableTitle,
      details: msg.payload || `Received via offline ${msg.channel} from ${msg.locationText}.`,
      rawPayload: JSON.stringify(msg),
      provenanceHash: generateProvenanceHash(packetId, msg.timestamp, msg.channel === 'USSD' ? 'citizen_ussd' : 'citizen_sms'),
      vulnerabilityFactors: {
        needsOxygen: msg.lastKnownSafeStatus === 'OXYGEN_NEEDED',
        isBedridden: msg.lastKnownSafeStatus === 'NEED_RESCUE',
        householdId: msg.householdId
      },
      contactMasked: msg.referenceNo
        ? `+91 ••••• •••${msg.phoneNumber.replace(/\D/g, '').slice(-2)} (Ref: ${msg.referenceNo})`
        : `+91 ••••• •••${msg.phoneNumber.replace(/\D/g, '').slice(-2)}`,
      exactAddress: msg.locationText
    };

    handleIngestNewPacket(packet);
  };

  const handleSyncStoreForwardMessage = (msgId: string) => {
    const target = storeForwardMessages.find((m) => m.id === msgId);
    if (!target || target.status !== 'queued_locally') return;
    syncSingleStoreForwardToIncidents(target);
    setStoreForwardMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, status: 'synced' } : m))
    );
  };

  const handleSyncAllStoreForward = () => {
    const pending = storeForwardMessages.filter((m) => m.status === 'queued_locally');
    for (const msg of pending) {
      syncSingleStoreForwardToIncidents(msg);
    }
    setStoreForwardMessages((prev) =>
      prev.map((m) => (m.status === 'queued_locally' ? { ...m, status: 'synced' } : m))
    );
  };

  const handleUpdateShelterLoad = async (
    placeKey: string,
    occupied: number,
    capacity: number,
    title: string,
    district: string,
    stateName: string,
    redirectPlaceKey?: string,
    redirectTitle?: string
  ) => {
    const nextRecord: ShelterLoadRecord = {
      placeKey,
      title,
      district,
      stateName,
      occupied: Math.max(0, Math.min(capacity, occupied)),
      capacity,
      redirectPlaceKey,
      redirectTitle,
      updatedAt: Date.now()
    };
    setShelterLoads((prev) => ({ ...prev, [placeKey]: nextRecord }));
    if (!isOffline) {
      const updated = await updateOfficerShelterLoad({
        placeKey,
        title,
        district,
        stateName,
        occupied: nextRecord.occupied,
        capacity,
        redirectPlaceKey,
        redirectTitle
      });
      if (updated) {
        setShelterLoads(updated);
      }
    }
  };

  // Strictly prevent private live citizen SOS packets from leaking to CitizenPortal
  const citizenIsolatedIncidents = incidents.filter(
    (inc) => !inc.provenanceTrail.some((p) => p.fromLiveDevice)
  );

  return (
    <AppMapsProvider apiKey={GOOGLE_MAPS_API_KEY} language={language}>
      <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col antialiased">
        {mapsQuotaExceeded && !isQuotaBannerDismissed && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm flex items-center justify-between gap-3">
            <span className="flex-1 text-center">
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
            <button
              type="button"
              onClick={() => setIsQuotaBannerDismissed(true)}
              className="p-1 rounded hover:bg-amber-200/60 text-amber-900 shrink-0 transition-colors"
              aria-label="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. ResQnet Header */}
        <Header
          isOffline={isOffline}
          language={language}
          setLanguage={setLanguage}
          portalMode={portalMode}
          onSelectPortalMode={handleSelectPortalMode}
          onLogoutOfficial={() => {
            void logoutOfficerOnServer();
            try {
              sessionStorage.removeItem('resqnet_officer_session');
            } catch {
              // ignore
            }
            setAuthenticatedOfficer(null);
            setPortalMode('citizen');
            setLiveArrivalBanner(null);
          }}
          authenticatedOfficer={authenticatedOfficer}
          onOpenIngestModal={() => setIsIngestModalOpen(true)}
          liveConnectedOfficerTabs={liveConnectedOfficerTabs}
          isOfficerRealtimeConnected={isOfficerRealtimeConnected}
        />

        {/* 2. CITIZEN PORTAL (Default View) */}
        {portalMode === 'citizen' && (
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 space-y-6">
            <CitizenPortal
              incidents={citizenIsolatedIncidents}
              onIngestCitizenReport={(packet) => handleIngestNewPacket(packet)}
              language={language}
              isOffline={isOffline}
              onOpenOfficialLogin={() => setIsOfficialAuthOpen(true)}
              shelterLoads={shelterLoads}
              liveHazards={liveHazards}
              isLoadingHazards={isLoadingHazards}
              onRefreshHazards={() => void refreshLiveHazardsAndShelters()}
            />
          </main>
        )}

        {/* 3. OFFICER SEGMENT (Passkey Protected) */}
        {portalMode === 'official' && !authenticatedOfficer && (
          <main className="flex-1 max-w-md w-full mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 text-amber-400 flex items-center justify-center mb-4 shadow-xl border border-neutral-800">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Officer Desk Restricted</h2>
            <p className="text-xs text-slate-600 mb-6 max-w-sm leading-relaxed">
              Reserved for authorized emergency response coordinators. Sign in with your officer passkey to access live rescue requests, dispatch priority queues, and shelter management.
            </p>
            <div className="flex items-center gap-3 w-full max-w-xs">
              <button
                type="button"
                onClick={() => setPortalMode('citizen')}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
              >
                Citizen View
              </button>
              <button
                type="button"
                onClick={() => setIsOfficialAuthOpen(true)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Sign In</span>
              </button>
            </div>
          </main>
        )}

        {portalMode === 'official' && authenticatedOfficer && (
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 space-y-5">
            {liveArrivalBanner && (
              <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950">
                <div>
                  <strong className="font-bold">New Live Request Received:</strong>{' '}
                  <span>
                    {liveArrivalBanner.headline} ({liveArrivalBanner.district})
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStateFilter('all');
                      setActiveTab('feed');
                      setLiveArrivalBanner(null);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
                  >
                    Open Live Reports
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveArrivalBanner(null)}
                    className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <KPIStrip
              incidents={incidents}
              language={language}
              onFilterState={(state) => {
                setSelectedStateFilter(state);
                setActiveTab('feed');
              }}
              selectedStateFilter={selectedStateFilter}
              securityBreachAlert={globalSupervisorAlert}
              onDismissSecurityBreach={() => setGlobalSupervisorAlert(null)}
            />

            {globalSupervisorAlert && (
              <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Unauthorized Access Blocked:</strong> Attempt to access restricted citizen contact records ({globalSupervisorAlert.role}).
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActiveTab('privacy')}
                    className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-900 rounded-lg font-semibold border border-rose-200 transition-colors whitespace-nowrap"
                  >
                    View Access Log
                  </button>
                  <button
                    onClick={() => setGlobalSupervisorAlert(null)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <nav className="flex border-b border-slate-200 overflow-x-auto text-sm" aria-label="Officer sections">
              <button
                onClick={() => setActiveTab('map')}
                className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  activeTab === 'map'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Map className="w-4 h-4" />
                <span>{t.navMap}</span>
              </button>

              <button
                onClick={() => setActiveTab('feed')}
                className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 tabular-nums ${
                  activeTab === 'feed'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span>{t.navFeed} ({incidents.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('triage')}
                className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  activeTab === 'triage'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <HeartHandshake className="w-4 h-4" />
                <span>{t.navTriage}</span>
              </button>

              <button
                onClick={() => setActiveTab('misinfo')}
                className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 tabular-nums ${
                  activeTab === 'misinfo'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{t.navMisinfo} ({misinfoList.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('storeforward')}
                className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 tabular-nums ${
                  activeTab === 'storeforward'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>
                  {t.navStoreForward} ({storeForwardMessages.filter((m) => m.status === 'queued_locally').length})
                </span>
              </button>

              <button
                onClick={() => setActiveTab('privacy')}
                className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  activeTab === 'privacy'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>{t.navPrivacy}</span>
              </button>

              <button
                onClick={() => setActiveTab('media')}
                className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  activeTab === 'media'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>{language === 'hi' ? 'प्रेस सारांश' : 'Press Summary'}</span>
              </button>

              <button
                onClick={() => setActiveTab('handover')}
                className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  activeTab === 'handover'
                    ? 'border-emerald-700 text-emerald-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>{t.navHandover}</span>
              </button>
            </nav>

            <div>
              {activeTab === 'map' && (
                <InteractiveMap
                  incidents={incidents}
                  selectedIncident={selectedIncident}
                  onSelectIncident={setSelectedIncident}
                  language={language}
                  onOpenProvenance={(inc) => setInspectedIncidentForProvenance(inc)}
                  shelterLoads={shelterLoads}
                  liveHazards={liveHazards}
                  onUpdateShelterLoad={handleUpdateShelterLoad}
                />
              )}

              {activeTab === 'feed' && (
                <FusionFeed
                  incidents={incidents}
                  onOpenProvenance={(inc) => setInspectedIncidentForProvenance(inc)}
                  onRefreshIncidentPing={handleRefreshIncidentPing}
                  language={language}
                  selectedStateFilter={selectedStateFilter}
                  setSelectedStateFilter={setSelectedStateFilter}
                  isRealtimeConnected={isOfficerRealtimeConnected}
                  connectedOfficerTabs={liveConnectedOfficerTabs}
                  onOpenIngestModal={() => setIsIngestModalOpen(true)}
                />
              )}

              {activeTab === 'triage' && (
                <TriageConsole
                  incidents={incidents}
                  onUpdateIncidentOverride={handleUpdateIncidentOverride}
                  language={language}
                  onOpenProvenance={(inc) => setInspectedIncidentForProvenance(inc)}
                  authenticatedOfficerName={authenticatedOfficer.name}
                />
              )}

              {activeTab === 'misinfo' && (
                <MisinformationQuarantine
                  incidents={incidents}
                  misinfoList={misinfoList}
                  setMisinfoList={setMisinfoList}
                  onDebunkAndBroadcast={handleDebunkAndBroadcast}
                  language={language}
                  authenticatedOfficerName={authenticatedOfficer.name}
                />
              )}

              {activeTab === 'storeforward' && (
                <StoreForwardConsole
                  language={language}
                  messages={storeForwardMessages}
                  onSyncMessage={handleSyncStoreForwardMessage}
                  onSyncAllMessages={handleSyncAllStoreForward}
                />
              )}

              {activeTab === 'media' && (
                <MediaPriorityConsole
                  incidents={incidents}
                  language={language}
                />
              )}

              {activeTab === 'privacy' && (
                <PrivacyScopeConsole
                  incidents={incidents}
                  language={language}
                />
              )}

              {activeTab === 'handover' && (
                <ShiftHandoverAndVolunteerConsole
                  incidents={incidents}
                  misinfoList={misinfoList}
                  storeForwardMessages={storeForwardMessages}
                  authenticatedOfficerName={authenticatedOfficer.name}
                  initialVolunteers={officerVolunteers}
                  initialHandovers={officerHandovers}
                />
              )}
            </div>
          </main>
        )}

        {/* Modals */}
        <OfficialAuthModal
          isOpen={isOfficialAuthOpen}
          onClose={() => {
            setIsOfficialAuthOpen(false);
            if (!authenticatedOfficer) {
              setPortalMode('citizen');
            }
          }}
          onSuccessfulLogin={(officerName, role, badgeId) => {
            const sess = { name: officerName, role, badgeId };
            try {
              sessionStorage.setItem('resqnet_officer_session', JSON.stringify(sess));
            } catch {
              // ignore
            }
            setAuthenticatedOfficer(sess);
            setPortalMode('official');
          }}
          onFailedAttempt={(attemptedId) => {
            void recordAuditLogOnServer({
              userId: attemptedId || 'UNKNOWN_BADGE',
              userName: 'Unauthorized Applicant',
              role: 'Unverified Visitor',
              requestedScope: 'Officer Sign-In Attempt',
              outcome: 'denied_unauthorized',
              reason: 'Failed passkey authentication'
            });
          }}
        />

        <ProvenanceInspectorModal
          incident={inspectedIncidentForProvenance}
          onClose={() => setInspectedIncidentForProvenance(null)}
        />

        <SimulateReportModal
          isOpen={isIngestModalOpen}
          onClose={() => setIsIngestModalOpen(false)}
          existingIncidents={incidents}
          onIngestNewPacket={handleIngestNewPacket}
        />

        {/* Unified ResQnet Footer */}
        <footer className="bg-black text-neutral-300 border-t border-neutral-900 py-5 px-4 text-xs mt-12">
          <div className="max-w-5xl mx-auto flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src="/assets/aistudio/ResQnet_Medical_Connectivity_Logo_c2ba50c4.png"
                    alt="ResQnet Logo"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain scale-110"
                  />
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {t.footerTitle}
                  </div>
                  <div className="text-neutral-400 text-[11px]">
                    {t.footerHelpline}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                <span>{t.footerMapsNotice}</span>
                <span aria-hidden="true">·</span>
                <a
                  href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-neutral-200 underline underline-offset-2"
                >
                  {t.footerTerms}
                </a>
                <span aria-hidden="true">·</span>
                <a
                  href="https://policies.google.com/privacy?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-neutral-200 underline underline-offset-2"
                >
                  {t.footerPrivacy}
                </a>
              </div>
            </div>

            <div className="border-t border-neutral-900 pt-2.5 text-[11px] text-neutral-400">
              {t.footerDisclaimer}
            </div>
          </div>
        </footer>
      </div>
    </AppMapsProvider>
  );
}
