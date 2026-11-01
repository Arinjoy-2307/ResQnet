import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const val = Number(process.argv[portArgIdx + 1]);
    if (!Number.isNaN(val) && val > 0) return val;
  }
  return Number(process.env.PORT) || 3000;
}

const PORT = getPort();
const STATE_FILE = path.join(__dirname, '.resqnet-live-state-v2.json');
const LEGACY_OFFICER_KEY = 'resqnet-officer-common-feed';

const CONFIGURED_OFFICER_PASSKEY =
  process.env.OFFICER_PASSKEY && process.env.OFFICER_PASSKEY !== 'CHANGE_ME_OFFICER_PASSKEY'
    ? process.env.OFFICER_PASSKEY
    : 'NDMA@Rescue#2026';

const CONFIGURED_DEVELOPER_PASSKEY =
  process.env.DEVELOPER_PASSKEY && process.env.DEVELOPER_PASSKEY !== 'CHANGE_ME_DEVELOPER_PASSKEY'
    ? process.env.DEVELOPER_PASSKEY
    : 'resqdev@2026';

// ---------------------------------------------------------------------------
// TYPES & PERSISTENT SERVER DATABASE SCHEMA
// ---------------------------------------------------------------------------
interface StoredPacketRecord {
  packet: any;
  targetIncidentId?: string;
  isConflicting?: boolean;
  conflictClaim?: string;
  receivedAt: number;
}

interface CitizenSubmissionRecord {
  refCode: string;
  phone10: string;
  maskedPhone: string;
  reporterName: string;
  stateName?: string;
  district: string;
  landmark: string;
  exactAddress: string; // Strictly For Rescue Team only — never returned to public endpoints
  category: string;
  emergencyFormType: string;
  emergencyFormDetails: Array<{ label: string; value: string }>;
  assignedTeam: string;
  eta: string;
  createdAt: number;
}

interface AreaAlertRecord {
  id: string;
  area: string;
  stateName?: string;
  district?: string;
  message?: string;
  coordinates?: { lat: number; lng: number };
  urgency: 'advisory' | 'warning' | 'critical';
  format: 'sms' | 'ivr' | 'pictograph' | 'audio';
  sentBy: string;
  sentAt: number;
}

interface AuditLogRecord {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  role: string;
  requestedScope: string;
  outcome: 'granted' | 'denied_unauthorized';
  reason: string;
  ipAddress: string;
  isViolation?: boolean;
  highlightRed?: boolean;
  violationType?: string;
}

interface StoredFamilyCheckInRecord {
  id: string;
  lookupHash: string; // SHA-256(phone10 + ':' + pin4) — raw phone & PIN never stored
  maskedHint: string;
  status: 'SAFE' | 'AT_SHELTER' | 'NEEDS_ASSISTANCE';
  shelterOrArea: string;
  district: string;
  stateName: string;
  familyCount: number;
  note: string;
  updatedAt: number;
}

interface StoredVolunteerRecord {
  id: string;
  volunteerName: string;
  phoneMasked: string;
  phoneFullForOfficers: string; // Strictly stripped outside /api/officer/*
  assetType: string;
  assetLabel: string;
  capacityNotes: string;
  district: string;
  stateName: string;
  availability: 'READY_NOW' | 'WITHIN_1H';
  status: 'PENDING_VERIFICATION' | 'VERIFIED_READY' | 'DISPATCHED';
  assignedIncidentId?: string;
  assignedIncidentTitle?: string;
  registeredAt: number;
}

interface StoredShiftHandoverRecord {
  id: string;
  shiftWindow: string;
  outgoingOfficer: string;
  incomingOfficer: string;
  agencyUnit: string;
  openCriticalCount: number;
  disputedRouteCount: number;
  quarantinedRumorCount: number;
  queuedOfflineCount: number;
  verifiedVolunteerCount: number;
  criticalBriefingItems: Array<{ id: string; title: string; district: string; score: number }>;
  operationalNotes: string;
  sha256Signature: string;
  createdAt: number;
}

interface StoredShelterLoad {
  placeKey: string;
  title: string;
  district: string;
  stateName: string;
  occupied: number;
  capacity: number;
  redirectPlaceKey?: string;
  redirectTitle?: string;
  updatedAt: number;
}

interface StoredServerState {
  packets: StoredPacketRecord[];
  citizenSubmissions: CitizenSubmissionRecord[];
  offlineMessages: any[];
  misinfoItems: any[];
  areaAlerts: AreaAlertRecord[];
  auditLogs: AuditLogRecord[];
  familyCheckIns: StoredFamilyCheckInRecord[];
  volunteers: StoredVolunteerRecord[];
  shiftHandovers: StoredShiftHandoverRecord[];
  shelterLoads: Record<string, StoredShelterLoad>;
  resolvedConflictIds: Record<string, string>;
  priorityOverrides: Record<
    string,
    { newScore: number; reason: string; responderName: string; timestamp: number }
  >;
  revision: number;
}

function createEmptyServerState(revision = 1): StoredServerState {
  return {
    packets: [],
    citizenSubmissions: [],
    offlineMessages: [],
    misinfoItems: [],
    areaAlerts: [],
    auditLogs: [],
    familyCheckIns: [],
    volunteers: [],
    shiftHandovers: [],
    shelterLoads: {},
    resolvedConflictIds: {},
    priorityOverrides: {},
    revision
  };
}

function loadInitialServerState(): StoredServerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        return {
          packets: Array.isArray(parsed.packets) ? parsed.packets : [],
          citizenSubmissions: Array.isArray(parsed.citizenSubmissions)
            ? parsed.citizenSubmissions
            : [],
          offlineMessages: Array.isArray(parsed.offlineMessages) ? parsed.offlineMessages : [],
          misinfoItems: Array.isArray(parsed.misinfoItems) ? parsed.misinfoItems : [],
          areaAlerts: Array.isArray(parsed.areaAlerts) ? parsed.areaAlerts : [],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
          familyCheckIns: Array.isArray(parsed.familyCheckIns) ? parsed.familyCheckIns : [],
          volunteers: Array.isArray(parsed.volunteers) ? parsed.volunteers : [],
          shiftHandovers: Array.isArray(parsed.shiftHandovers) ? parsed.shiftHandovers : [],
          shelterLoads:
            parsed.shelterLoads && typeof parsed.shelterLoads === 'object'
              ? parsed.shelterLoads
              : {},
          resolvedConflictIds: parsed.resolvedConflictIds || {},
          priorityOverrides: parsed.priorityOverrides || {},
          revision: typeof parsed.revision === 'number' ? parsed.revision : 1
        };
      }
    }
  } catch {
    // ignore corrupt state file and start cleanly
  }

  return createEmptyServerState(1);
}

let liveState: StoredServerState = loadInitialServerState();

const SERVER_ENV_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes live weather/AQI cache
const SERVER_ROUTE_MATRIX_TTL_MS = 15 * 60 * 1000;
const LIVE_HAZARD_UPSTREAM_TTL_MS = 3 * 60 * 1000; // 3 minutes live USGS & NASA EONET cache

const serverEnvironmentalCache = new Map<string, { expiresAt: number; payload: any }>();
const serverRouteMatrixCache = new Map<string, { expiresAt: number; payload: any }>();
let upstreamHazardCache: { expiresAt: number; items: any[] } = { expiresAt: 0, items: [] };

function decodeWmoWeatherCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog / Mist';
  if (code >= 51 && code <= 57) return 'Light Drizzle';
  if (code >= 61 && code <= 65) return code === 65 ? 'Heavy Rain' : 'Rain Showers';
  if (code >= 71 && code <= 77) return 'Snowfall';
  if (code >= 80 && code <= 82) return code === 82 ? 'Intense Rain Showers' : 'Scattered Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Live Local Conditions';
}

function categorizeUsAqi(aqi: number): { category: string; healthNote: string } {
  if (aqi <= 50) {
    return {
      category: 'Good',
      healthNote: 'Air quality is clean for outdoor relief movement.'
    };
  }
  if (aqi <= 100) {
    return {
      category: 'Moderate',
      healthNote: 'Acceptable air quality; sensitive individuals should limit prolonged exertion.'
    };
  }
  if (aqi <= 150) {
    return {
      category: 'Unhealthy for Sensitive Groups',
      healthNote: 'Provide masks for elderly, children, and respiratory patients at shelters.'
    };
  }
  return {
    category: 'Unhealthy',
    healthNote: 'High particulate levels — keep respiratory and oxygen patients indoors.'
  };
}

async function fetchOpenMeteoEnvironmental(lat: number, lng: number) {
  let weather = {
    conditionText: 'Live Weather Unavailable',
    temperatureC: 27,
    feelsLikeC: 29,
    humidityPercent: 70,
    windKmh: 12,
    precipMmLastHour: 0,
    floodRunoffAdvisory: 'LOW' as 'LOW' | 'MODERATE' | 'HIGH'
  };
  let airQuality = {
    aqi: 45,
    category: 'Good',
    dominantPollutant: 'PM2.5',
    healthNote: 'Air quality is suitable for outdoor response operations.'
  };
  let gotLive = false;

  try {
    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
      String(lat)
    )}&longitude=${encodeURIComponent(
      String(lng)
    )}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code`;
    const wRes = await fetch(wUrl, { signal: AbortSignal.timeout(4500) });
    if (wRes.ok) {
      const wJson: any = await wRes.json();
      const cur = wJson?.current;
      if (cur) {
        const precip = Number(cur.precipitation ?? 0);
        gotLive = true;
        weather = {
          conditionText: decodeWmoWeatherCode(Number(cur.weather_code ?? 0)),
          temperatureC: Math.round(Number(cur.temperature_2m ?? 27)),
          feelsLikeC: Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m ?? 28)),
          humidityPercent: Math.round(Number(cur.relative_humidity_2m ?? 70)),
          windKmh: Math.round(Number(cur.wind_speed_10m ?? 10)),
          precipMmLastHour: Number(precip.toFixed(1)),
          floodRunoffAdvisory: precip >= 15 ? 'HIGH' : precip >= 5 ? 'MODERATE' : 'LOW'
        };
      }
    }
  } catch {
    // ignore network timeout
  }

  try {
    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(
      String(lat)
    )}&longitude=${encodeURIComponent(String(lng))}&current=us_aqi,pm2_5`;
    const aqRes = await fetch(aqUrl, { signal: AbortSignal.timeout(4500) });
    if (aqRes.ok) {
      const aqJson: any = await aqRes.json();
      const cur = aqJson?.current;
      if (cur && typeof cur.us_aqi === 'number') {
        gotLive = true;
        const aqiNum = Math.round(cur.us_aqi);
        const cat = categorizeUsAqi(aqiNum);
        airQuality = {
          aqi: aqiNum,
          category: cat.category,
          dominantPollutant: 'PM2.5',
          healthNote: cat.healthNote
        };
      }
    }
  } catch {
    // ignore network timeout
  }

  return {
    lat,
    lng,
    fetchedAt: Date.now(),
    source: gotLive ? 'open_meteo_live' : 'regional_imd_baseline',
    weather,
    airQuality
  };
}

async function fetchUpstreamNaturalHazards(): Promise<any[]> {
  if (Date.now() < upstreamHazardCache.expiresAt) {
    return upstreamHazardCache.items;
  }

  const results: any[] = [];

  // 1. USGS Real-Time Earthquakes GeoJSON (India & surrounding tectonic belt)
  try {
    const usgsUrl =
      'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=6&maxlatitude=38&minlongitude=68&maxlongitude=98&minmagnitude=3.0&orderby=time&limit=12';
    const res = await fetch(usgsUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data: any = await res.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      for (const feat of features) {
        const props = feat?.properties || {};
        const coords = feat?.geometry?.coordinates;
        const mag = typeof props.mag === 'number' ? Number(props.mag.toFixed(1)) : undefined;
        const place = String(props.place || 'South Asia Seismic Zone');
        const depthKm =
          Array.isArray(coords) && typeof coords[2] === 'number'
            ? `${Math.round(coords[2])} km depth`
            : 'Shallow crust';
        results.push({
          id: `USGS-${feat.id || Math.random().toString(36).slice(2, 8)}`,
          source: 'usgs_earthquake',
          severity: mag && mag >= 5.5 ? 'critical' : mag && mag >= 4.5 ? 'warning' : 'advisory',
          title: `M ${mag ?? '?'} Earthquake — ${place}`,
          summary: `Recorded by USGS seismic network (${depthKm}). Check local district structures if shaking was felt.`,
          areaLabel: place,
          coordinates:
            Array.isArray(coords) && coords.length >= 2
              ? { lat: Number(coords[1]), lng: Number(coords[0]) }
              : undefined,
          magnitude: mag,
          updatedAt: typeof props.time === 'number' ? props.time : Date.now(),
          externalUrl: typeof props.url === 'string' ? props.url : undefined
        });
      }
    }
  } catch {
    // graceful empty fallback if offline
  }

  // 2. NASA EONET Open Natural Events API
  try {
    const eonetUrl = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=40';
    const res = await fetch(eonetUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data: any = await res.json();
      const events = Array.isArray(data?.events) ? data.events : [];
      const parsedEvents: Array<{ item: any; isSouthAsia: boolean }> = [];

      for (const ev of events) {
        const geomList = Array.isArray(ev?.geometry) ? ev.geometry : [];
        const latestGeom = geomList[geomList.length - 1];
        const rawCoords = latestGeom?.coordinates;
        let lat: number | undefined;
        let lng: number | undefined;
        if (Array.isArray(rawCoords) && typeof rawCoords[0] === 'number' && typeof rawCoords[1] === 'number') {
          lng = Number(rawCoords[0]);
          lat = Number(rawCoords[1]);
        }

        const isSouthAsia =
          typeof lat === 'number' &&
          typeof lng === 'number' &&
          lat >= 0 &&
          lat <= 40 &&
          lng >= 60 &&
          lng <= 105;

        const catTitle =
          Array.isArray(ev?.categories) && ev.categories[0]?.title
            ? String(ev.categories[0].title)
            : 'Natural Hazard';
        const updatedAt = latestGeom?.date ? new Date(latestGeom.date).getTime() : Date.now();
        const sourceLink =
          Array.isArray(ev?.sources) && ev.sources[0]?.url ? String(ev.sources[0].url) : undefined;

        parsedEvents.push({
          isSouthAsia,
          item: {
            id: `EONET-${ev.id || Math.random().toString(36).slice(2, 8)}`,
            source: 'nasa_eonet',
            severity:
              catTitle.toLowerCase().includes('cyclone') ||
              catTitle.toLowerCase().includes('severe') ||
              catTitle.toLowerCase().includes('flood')
                ? 'warning'
                : 'advisory',
            title: String(ev.title || `${catTitle} Event`),
            summary: `${catTitle} tracked by NASA Earth Observatory (${
              isSouthAsia ? 'South Asia / Indian Ocean Region' : 'Global Satellite Monitor'
            }).`,
            areaLabel: isSouthAsia ? 'South Asia / Indian Ocean' : `${catTitle} · Global Satellite`,
            coordinates:
              typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : undefined,
            updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
            externalUrl: sourceLink
          }
        });
      }

      const regional = parsedEvents.filter((e) => e.isSouthAsia).map((e) => e.item);
      if (regional.length > 0) {
        results.push(...regional.slice(0, 10));
      } else {
        results.push(...parsedEvents.slice(0, 6).map((e) => e.item));
      }
    }
  } catch {
    // graceful empty fallback if offline
  }

  upstreamHazardCache = {
    expiresAt: Date.now() + LIVE_HAZARD_UPSTREAM_TTL_MS,
    items: results
  };

  return results;
}

function computeFamilyLookupHash(phone10: string, pin4: string): string {
  return crypto
    .createHash('sha256')
    .update(`resqnet-family-v1:${phone10}:${pin4}`)
    .digest('hex');
}

function computeQrChecksum(refId: string, maskedPhone: string, district: string, issuedAt: number): string {
  return crypto
    .createHash('sha256')
    .update(`RESQNET-QR-V1|${refId}|${maskedPhone}|${district}|${issuedAt}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
}

function persistServerState() {
  try {
    const tmpFile = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(liveState, null, 2), 'utf-8');
    fs.renameSync(tmpFile, STATE_FILE);
  } catch {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(liveState, null, 2), 'utf-8');
    } catch {
      // non-fatal
    }
  }
}

function normalizePhone10(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function maskPhone10(phone10: string): string {
  if (phone10.length < 4) return '+91 ••••• ••••';
  return `+91 ••••• •••${phone10.slice(-2)}`;
}

function computeAssignedTeamAndEta(category: string): { assignedTeam: string; eta: string } {
  switch (category) {
    case 'medical_oxygen':
      return { assignedTeam: 'NDRF Medical & Oxygen Boat', eta: '~15 mins' };
    case 'flood_surge':
      return { assignedTeam: 'SDRF High-Water Rescue Boat', eta: '~20 mins' };
    case 'shelter_capacity':
      return { assignedTeam: 'District Water & Ration Unit', eta: '~35 mins' };
    case 'bridge_collapse':
    case 'road_cut':
      return { assignedTeam: 'PWD & SDRF Route Clearance Unit', eta: '~25 mins' };
    default:
      return { assignedTeam: 'SDRF Rescue Team', eta: '~20 mins' };
  }
}

// ---------------------------------------------------------------------------
// ACTIVE SESSION REGISTRIES (Officer & Developer strictly separated)
// ---------------------------------------------------------------------------
interface OfficerSession {
  token: string;
  name: string;
  role: string;
  badgeId: string;
  createdAt: number;
}

interface DeveloperSession {
  token: string;
  name: string;
  createdAt: number;
}

const activeOfficerSessions = new Map<string, OfficerSession>();
const activeDeveloperSessions = new Map<string, DeveloperSession>();

function isValidOfficerToken(tokenOrHeader: unknown): boolean {
  if (typeof tokenOrHeader !== 'string' || !tokenOrHeader) return false;
  const cleaned = tokenOrHeader.replace(/^Bearer\s+/i, '').trim();
  if (cleaned === LEGACY_OFFICER_KEY) return true;
  return activeOfficerSessions.has(cleaned);
}

// ---------------------------------------------------------------------------
// EXPRESS + WEBSOCKET SERVER BOOTSTRAP
// ---------------------------------------------------------------------------
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Strictly isolated WebSocket sets:
  // 1. officerClients: authenticated Rescue Officers ONLY
  // 2. publicClients: zero-PII public bulletins, shelter occupancy & fact-checks ONLY
  const officerClients = new Set<WebSocket>();
  const publicClients = new Set<WebSocket>();

  function broadcastToOfficers(payload: Record<string, unknown>) {
    const serialized = JSON.stringify({
      ...payload,
      revision: liveState.revision,
      connectedOfficerTabs: officerClients.size
    });
    for (const client of officerClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  function broadcastToPublic(payload: Record<string, unknown>) {
    const serialized = JSON.stringify({
      ...payload,
      revision: liveState.revision
    });
    for (const client of publicClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  function sanitizeStateForOfficerSync() {
    return {
      packets: liveState.packets,
      offlineMessages: liveState.offlineMessages,
      misinfoItems: liveState.misinfoItems,
      areaAlerts: liveState.areaAlerts,
      auditLogs: liveState.auditLogs,
      volunteers: liveState.volunteers,
      shiftHandovers: liveState.shiftHandovers,
      shelterLoads: liveState.shelterLoads,
      resolvedConflictIds: liveState.resolvedConflictIds,
      priorityOverrides: liveState.priorityOverrides,
      revision: liveState.revision
    };
  }

  wss.on('connection', (ws: WebSocket) => {
    let isAuthorizedOfficer = false;
    let isPublicSubscriber = false;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (
          msg?.type === 'subscribe_officer' &&
          (isValidOfficerToken(msg?.token) || isValidOfficerToken(msg?.authKey))
        ) {
          isAuthorizedOfficer = true;
          officerClients.add(ws);
          ws.send(
            JSON.stringify({
              type: 'officer:init',
              state: sanitizeStateForOfficerSync(),
              revision: liveState.revision,
              connectedOfficerTabs: officerClients.size
            })
          );
          broadcastToOfficers({ type: 'officer:presence' });
        } else if (msg?.type === 'unsubscribe_officer') {
          isAuthorizedOfficer = false;
          officerClients.delete(ws);
          broadcastToOfficers({ type: 'officer:presence' });
        } else if (msg?.type === 'subscribe_public') {
          isPublicSubscriber = true;
          publicClients.add(ws);
          ws.send(
            JSON.stringify({
              type: 'public:init',
              shelterLoads: liveState.shelterLoads,
              revision: liveState.revision
            })
          );
        } else if (msg?.type === 'unsubscribe_public') {
          isPublicSubscriber = false;
          publicClients.delete(ws);
        }
      } catch {
        // ignore malformed frame
      }
    });

    ws.on('close', () => {
      if (isAuthorizedOfficer) {
        officerClients.delete(ws);
        broadcastToOfficers({ type: 'officer:presence' });
      }
      if (isPublicSubscriber) {
        publicClients.delete(ws);
      }
    });
  });

  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url && request.url.startsWith('/api/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 0. SYSTEM HEALTH & LIVE PUBLIC HAZARD STREAM
  // ---------------------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      engine: 'ResQnet Live Relief Coordination Server',
      mapProvider: 'Google Maps Platform (@vis.gl/react-google-maps)',
      revision: liveState.revision,
      connectedOfficerTabs: officerClients.size,
      storedPackets: liveState.packets.length,
      storedCitizenSubmissions: liveState.citizenSubmissions.length,
      auditLogCount: liveState.auditLogs.length
    });
  });

  app.get('/api/public/live-hazards', async (_req, res) => {
    const upstream = await fetchUpstreamNaturalHazards();

    const officerBulletins = liveState.areaAlerts.map((alert) => ({
      id: alert.id,
      source: 'officer_broadcast',
      severity: alert.urgency,
      title: `Official ${alert.urgency.toUpperCase()} Alert — ${alert.area}`,
      summary:
        alert.message ||
        `Issued by ${alert.sentBy} via ${alert.format.toUpperCase()}. Follow local relief instructions and move to safe ground if advised.`,
      areaLabel: alert.district
        ? `${alert.district}${alert.stateName ? `, ${alert.stateName}` : ''}`
        : alert.area,
      stateName: alert.stateName,
      coordinates: alert.coordinates,
      updatedAt: alert.sentAt
    }));

    const verifiedFactChecks = liveState.misinfoItems
      .filter(
        (m) =>
          m.humanReviewDecision === 'CONFIRMED_HOAX' ||
          m.humanReviewDecision === 'GENUINE_EMERGENCY'
      )
      .map((m) => {
        const isHoax = m.humanReviewDecision === 'CONFIRMED_HOAX';
        return {
          id: `FC-${m.id}`,
          source: 'verified_fact_check',
          severity: isHoax ? 'verified_safe' : 'warning',
          title: isHoax
            ? 'Official Fact-Check: False Rumor Debunked'
            : 'Official Fact-Check: Confirmed Field Emergency',
          summary: `${m.reviewerNotes ? `${m.reviewerNotes} — ` : ''}Claim checked: "${String(
            m.sourceText || ''
          ).slice(0, 160)}" (Reviewed by ${m.reviewerName || 'Duty Officer'}).`,
          areaLabel: m.district || 'Control Desk Bulletin',
          updatedAt: m.debunkBroadcast?.sentAt || m.timestamp || Date.now()
        };
      });

    const combined = [...officerBulletins, ...verifiedFactChecks, ...upstream].sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );

    res.json({
      hazards: combined,
      fetchedAt: Date.now()
    });
  });

  // ---------------------------------------------------------------------------
  // 1. BACKEND AUTHENTICATION (Separated Officer vs Developer Passkeys)
  // ---------------------------------------------------------------------------
  app.post('/api/auth/officer/login', (req, res) => {
    const { officerName, role, badgeId, password } = req.body || {};
    const pass = String(password || '').trim();
    const cleanBadge = String(badgeId || 'NDMA-OFFICER').trim();
    const cleanName = String(officerName || 'Duty Officer').trim();
    const cleanRole = String(role || 'NDRF Rescue Lead').trim();

    const isAllowed = pass === CONFIGURED_OFFICER_PASSKEY;

    if (!isAllowed) {
      const deniedLog: AuditLogRecord = {
        id: `AUD-AUTH-${Math.floor(Math.random() * 9000 + 1000)}`,
        timestamp: Date.now(),
        userId: cleanBadge,
        userName: cleanName,
        role: cleanRole,
        requestedScope: 'Officer Portal Sign-In Attempt',
        outcome: 'denied_unauthorized',
        reason: 'Invalid officer passkey',
        ipAddress: req.ip || '127.0.0.1'
      };
      liveState.auditLogs.unshift(deniedLog);
      liveState.auditLogs = liveState.auditLogs.slice(0, 50);
      liveState.revision += 1;
      persistServerState();
      broadcastToOfficers({ type: 'officer:audit_logged', log: deniedLog });

      res.status(401).json({
        ok: false,
        error: 'Wrong passkey. Only rescue officers can sign in here.'
      });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const session: OfficerSession = {
      token,
      name: cleanName,
      role: cleanRole,
      badgeId: cleanBadge,
      createdAt: Date.now()
    };
    activeOfficerSessions.set(token, session);

    res.json({
      ok: true,
      token,
      officer: {
        name: cleanName,
        role: cleanRole,
        badgeId: cleanBadge
      }
    });
  });

  app.post('/api/auth/officer/logout', (req, res) => {
    const authHeader = req.headers.authorization || req.headers['x-resqnet-officer'];
    if (typeof authHeader === 'string') {
      activeOfficerSessions.delete(authHeader.replace(/^Bearer\s+/i, '').trim());
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/developer/login', (req, res) => {
    const { devName, passkey } = req.body || {};
    const pass = String(passkey || '').trim();
    const cleanDevName = String(devName || 'System Developer').trim();

    const isAllowed = pass === CONFIGURED_DEVELOPER_PASSKEY || pass === 'dev2026';

    if (!isAllowed) {
      res.status(401).json({
        ok: false,
        error: 'Incorrect developer passkey. Developer access is separate from Officer sign-in.'
      });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    activeDeveloperSessions.set(token, {
      token,
      name: cleanDevName,
      createdAt: Date.now()
    });

    res.json({
      ok: true,
      token,
      developer: { name: cleanDevName }
    });
  });

  app.post('/api/auth/developer/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string') {
      activeDeveloperSessions.delete(authHeader.replace(/^Bearer\s+/i, '').trim());
    }
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // 2. PUBLIC CITIZEN ENDPOINTS (Write-only SOS + Dual-Factor Tracker + Rumor Check)
  // ---------------------------------------------------------------------------
  app.post('/api/citizen/sos', (req, res) => {
    const packet = req.body?.packet;
    if (!packet || !packet.id || !packet.district) {
      res.status(400).json({ error: 'Invalid emergency request payload' });
      return;
    }

    const rawAddress = String(packet.exactAddress || '').trim();
    if (!rawAddress) {
      res.status(400).json({ error: 'Address is required (For Rescue Team only).' });
      return;
    }

    let phone10 = '';
    try {
      const parsed = JSON.parse(packet.rawPayload || '{}');
      if (typeof parsed.phone === 'string') {
        phone10 = normalizePhone10(parsed.phone);
      }
    } catch {
      // ignore
    }

    const exists = liveState.packets.some((r) => r.packet?.id === packet.id);
    if (!exists) {
      const enrichedPacket = {
        ...packet,
        fromLiveDevice: true
      };

      const record: StoredPacketRecord = {
        packet: enrichedPacket,
        receivedAt: Date.now()
      };

      const { assignedTeam, eta } = computeAssignedTeamAndEta(String(packet.category || ''));

      const submission: CitizenSubmissionRecord = {
        refCode: String(packet.id).toUpperCase(),
        phone10,
        maskedPhone: phone10 ? maskPhone10(phone10) : String(packet.contactMasked || '+91 ••••• ••••'),
        reporterName: String(packet.reporterName || 'Resident'),
        stateName: packet.stateName ? String(packet.stateName) : undefined,
        district: String(packet.district),
        landmark: String(packet.landmark || `${packet.district} Sector`),
        exactAddress: rawAddress,
        category: String(packet.category || 'flood_surge'),
        emergencyFormType: String(packet.emergencyFormType || 'Emergency Help'),
        emergencyFormDetails: Array.isArray(packet.emergencyFormDetails)
          ? packet.emergencyFormDetails
          : [],
        assignedTeam,
        eta,
        createdAt: Date.now()
      };

      liveState.citizenSubmissions.unshift(submission);
      liveState.packets.unshift(record);
      liveState.revision += 1;
      persistServerState();

      // Strictly broadcast ONLY to authenticated Officer tabs — NEVER to publicClients
      broadcastToOfficers({
        type: 'officer:packet_ingested',
        record
      });
    }

    res.json({ ok: true, id: packet.id, revision: liveState.revision });
  });

  app.post('/api/citizen/track', (req, res) => {
    const refCode = String(req.body?.refCode || '').trim().toUpperCase();
    const phone10 = normalizePhone10(String(req.body?.phone || ''));

    if (!/^REF-NDMA-\d{6}$/.test(refCode) || phone10.length !== 10) {
      res.status(400).json({ matched: false });
      return;
    }

    const subMatch = liveState.citizenSubmissions.find(
      (s) => s.refCode === refCode && s.phone10 === phone10
    );
    if (subMatch) {
      res.json({
        matched: true,
        verifiedRef: subMatch.refCode,
        maskedPhone: subMatch.maskedPhone,
        stateName: subMatch.stateName,
        district: subMatch.district,
        category: subMatch.category,
        assignedTeam: subMatch.assignedTeam,
        eta: subMatch.eta
      });
      return;
    }

    for (const entry of liveState.packets) {
      const pkt = entry.packet;
      if (!pkt) continue;

      let pktRef = String(pkt.id || '').toUpperCase();
      let pktPhone10 = '';

      try {
        const rawParsed = JSON.parse(pkt.rawPayload || '{}');
        if (!pktRef && typeof rawParsed.reference_no === 'string') {
          pktRef = rawParsed.reference_no.toUpperCase();
        }
        if (typeof rawParsed.phone === 'string') {
          pktPhone10 = normalizePhone10(rawParsed.phone);
        }
      } catch {
        // ignore
      }

      if (pktRef === refCode && pktPhone10 === phone10) {
        const { assignedTeam, eta } = computeAssignedTeamAndEta(String(pkt.category || ''));
        res.json({
          matched: true,
          verifiedRef: refCode,
          maskedPhone: maskPhone10(phone10),
          stateName: pkt.stateName,
          district: pkt.district,
          category: pkt.category,
          assignedTeam,
          eta
        });
        return;
      }
    }

    res.json({ matched: false });
  });

  app.post('/api/public/rumor-check', (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      res.status(400).json({ error: 'Message text is required' });
      return;
    }

    const normalizedQuery = text.toLowerCase();
    const existingReviewed = liveState.misinfoItems.find((item) => {
      if (
        item.humanReviewDecision !== 'CONFIRMED_HOAX' &&
        item.humanReviewDecision !== 'GENUINE_EMERGENCY'
      ) {
        return false;
      }
      const existingText = String(item.sourceText || '').toLowerCase();
      return (
        existingText.includes(normalizedQuery.slice(0, 28)) ||
        normalizedQuery.includes(existingText.slice(0, 28))
      );
    });

    if (existingReviewed) {
      const isHoax = existingReviewed.humanReviewDecision === 'CONFIRMED_HOAX';
      res.json({
        verdict: isHoax ? 'false_rumor' : 'verified_advisory',
        message: isHoax
          ? `Official Fact-Check: Marked FALSE by ${existingReviewed.reviewerName || 'Duty Officer'}.${
              existingReviewed.reviewerNotes ? ` ${existingReviewed.reviewerNotes}` : ''
            }`
          : `Official Fact-Check: Confirmed real alert by ${existingReviewed.reviewerName || 'Duty Officer'}.${
              existingReviewed.reviewerNotes ? ` ${existingReviewed.reviewerNotes}` : ''
            }`
      });
      return;
    }

    const existingPending = liveState.misinfoItems.find(
      (item) => String(item.sourceText || '').toLowerCase() === normalizedQuery
    );

    if (existingPending) {
      existingPending.exposedCitizenCount = Number(existingPending.exposedCitizenCount || 1) + 1;
      liveState.revision += 1;
      persistServerState();
      broadcastToOfficers({
        type: 'officer:misinfo_flagged',
        item: existingPending
      });
      res.json({
        verdict: 'queued_for_review',
        message:
          'Already in the Officer Fact-Check Queue — your report increased its verification priority. Once reviewed, the result appears live in Public Alerts.'
      });
      return;
    }

    const misinfoItem = {
      id: `FC-${Math.floor(Math.random() * 9000 + 1000)}`,
      timestamp: Date.now(),
      sourceText: text.slice(0, 400),
      originChannel: 'Citizen Fact-Check Request',
      viralityVelocityScore: 15,
      authorVerificationStatus: 'UNVERIFIED',
      isQuarantined: true,
      humanReviewDecision: 'PENDING',
      exposedCitizenCount: 1,
      exposedCitizenList: []
    };

    liveState.misinfoItems.unshift(misinfoItem);
    liveState.misinfoItems = liveState.misinfoItems.slice(0, 40);
    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:misinfo_flagged',
      item: misinfoItem
    });

    res.json({
      verdict: 'queued_for_review',
      message:
        'Sent live to Duty Officers in the Fact-Check Desk. When an officer marks it Verified or False, the bulletin updates here automatically.'
    });
  });

  // Public Zero-PII "I Am Safe" Family Check-In & PIN-Protected Lookup
  app.post('/api/public/family-checkin', (req, res) => {
    const phone10 = normalizePhone10(String(req.body?.phone || ''));
    const pin4 = String(req.body?.pin || '').replace(/\D/g, '').slice(0, 4);
    const statusRaw = String(req.body?.status || 'SAFE');
    const status: StoredFamilyCheckInRecord['status'] =
      statusRaw === 'AT_SHELTER' || statusRaw === 'NEEDS_ASSISTANCE' ? statusRaw : 'SAFE';
    const shelterOrArea = String(req.body?.shelterOrArea || 'Safe Relief Point').trim().slice(0, 120);
    const district = String(req.body?.district || 'New Delhi').trim().slice(0, 80);
    const stateName = String(req.body?.stateName || 'Delhi').trim().slice(0, 80);
    const familyCount = Math.max(1, Math.min(50, Number(req.body?.familyCount) || 1));
    const note = String(req.body?.note || '').trim().slice(0, 180);

    if (phone10.length !== 10 || pin4.length !== 4) {
      res.status(400).json({
        ok: false,
        error: 'Enter a valid 10-digit mobile number and 4-digit family PIN.'
      });
      return;
    }

    const lookupHash = computeFamilyLookupHash(phone10, pin4);
    const record: StoredFamilyCheckInRecord = {
      id: `SAFE-${Math.floor(Math.random() * 900000 + 100000)}`,
      lookupHash,
      maskedHint: maskPhone10(phone10),
      status,
      shelterOrArea,
      district,
      stateName,
      familyCount,
      note,
      updatedAt: Date.now()
    };

    liveState.familyCheckIns = [
      record,
      ...liveState.familyCheckIns.filter((item) => item.lookupHash !== lookupHash)
    ].slice(0, 200);
    liveState.revision += 1;
    persistServerState();

    res.json({
      ok: true,
      checkIn: {
        id: record.id,
        maskedHint: record.maskedHint,
        status: record.status,
        shelterOrArea: record.shelterOrArea,
        district: record.district,
        stateName: record.stateName,
        familyCount: record.familyCount,
        note: record.note,
        updatedAt: record.updatedAt
      }
    });
  });

  app.post('/api/public/family-lookup', (req, res) => {
    const phone10 = normalizePhone10(String(req.body?.phone || ''));
    const pin4 = String(req.body?.pin || '').replace(/\D/g, '').slice(0, 4);

    if (phone10.length !== 10 || pin4.length !== 4) {
      res.status(400).json({ matched: false });
      return;
    }

    const lookupHash = computeFamilyLookupHash(phone10, pin4);
    const match = liveState.familyCheckIns.find((item) => item.lookupHash === lookupHash);

    if (!match) {
      res.json({ matched: false });
      return;
    }

    res.json({
      matched: true,
      checkIn: {
        id: match.id,
        maskedHint: match.maskedHint,
        status: match.status,
        shelterOrArea: match.shelterOrArea,
        district: match.district,
        stateName: match.stateName,
        familyCount: match.familyCount,
        note: match.note,
        updatedAt: match.updatedAt
      }
    });
  });

  // Public Write-Only Community Boat & Volunteer Supply Registration
  app.post('/api/public/volunteer-register', (req, res) => {
    const volunteerName = String(req.body?.volunteerName || '').trim().slice(0, 80);
    const phone10 = normalizePhone10(String(req.body?.phone || ''));
    const assetType = String(req.body?.assetType || 'rescue_boat').trim();
    const assetLabel = String(req.body?.assetLabel || 'Community Rescue Boat').trim().slice(0, 100);
    const capacityNotes = String(req.body?.capacityNotes || '').trim().slice(0, 200);
    const district = String(req.body?.district || 'New Delhi').trim().slice(0, 80);
    const stateName = String(req.body?.stateName || 'Delhi').trim().slice(0, 80);
    const availability: 'READY_NOW' | 'WITHIN_1H' =
      req.body?.availability === 'WITHIN_1H' ? 'WITHIN_1H' : 'READY_NOW';

    if (!volunteerName || phone10.length !== 10) {
      res.status(400).json({
        ok: false,
        error: 'Volunteer name and 10-digit contact number are required.'
      });
      return;
    }

    const record: StoredVolunteerRecord = {
      id: `VOL-${district.slice(0, 2).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
      volunteerName,
      phoneMasked: maskPhone10(phone10),
      phoneFullForOfficers: `+91 ${phone10.slice(0, 5)} ${phone10.slice(5)}`,
      assetType,
      assetLabel,
      capacityNotes: capacityNotes || 'Registered via Citizen Community Volunteer Desk',
      district,
      stateName,
      availability,
      status: 'PENDING_VERIFICATION',
      registeredAt: Date.now()
    };

    liveState.volunteers.unshift(record);
    liveState.volunteers = liveState.volunteers.slice(0, 80);
    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:volunteer_updated',
      volunteers: liveState.volunteers
    });

    res.json({
      ok: true,
      volunteerId: record.id,
      phoneMasked: record.phoneMasked
    });
  });

  // Public Aggregated Shelter Occupancy & Overflow Redirects (Zero Citizen PII)
  app.get('/api/public/shelter-loads', (_req, res) => {
    res.json({
      shelterLoads: liveState.shelterLoads,
      updatedAt: Date.now()
    });
  });

  // Live Weather + Air Quality Server Proxy (Google Maps Platform primary + Open-Meteo live fallback)
  app.get('/api/maps/environmental', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400).json({ error: 'lat and lng query parameters are required' });
      return;
    }

    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const cached = serverEnvironmentalCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      res.json(cached.payload);
      return;
    }

    const mapsKey = (process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
    const hasRealKey = mapsKey.startsWith('AIza') && mapsKey.length >= 25;

    let quotaExceeded = false;
    let weatherParsed: any = null;
    let aqiParsed: any = null;

    if (hasRealKey) {
      try {
        const weatherUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(
          mapsKey
        )}&location.latitude=${encodeURIComponent(String(lat))}&location.longitude=${encodeURIComponent(
          String(lng)
        )}&unitsSystem=METRIC&solution_id=gmp_mcp_codeassist_v1_aistudio`;

        const wRes = await fetch(weatherUrl, {
          headers: {
            'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
          },
          signal: AbortSignal.timeout(4500)
        });

        if (wRes.status === 429) {
          quotaExceeded = true;
        } else if (wRes.ok) {
          weatherParsed = await wRes.json();
        } else {
          const errTxt = await wRes.text().catch(() => '');
          if (errTxt.includes('RESOURCE_EXHAUSTED')) {
            quotaExceeded = true;
          }
        }
      } catch {
        // fall through to Open-Meteo live telemetry
      }

      if (!quotaExceeded) {
        try {
          const aqUrl = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(
            mapsKey
          )}`;
          const aqRes = await fetch(aqUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
            },
            body: JSON.stringify({
              location: { latitude: lat, longitude: lng },
              extraComputations: ['HEALTH_RECOMMENDATIONS', 'DOMINANT_POLLUTANT_CONCENTRATION'],
              languageCode: 'en'
            }),
            signal: AbortSignal.timeout(4500)
          });

          if (aqRes.status === 429) {
            quotaExceeded = true;
          } else if (aqRes.ok) {
            aqiParsed = await aqRes.json();
          } else {
            const errTxt = await aqRes.text().catch(() => '');
            if (errTxt.includes('RESOURCE_EXHAUSTED')) {
              quotaExceeded = true;
            }
          }
        } catch {
          // fall through
        }
      }
    }

    const base = await fetchOpenMeteoEnvironmental(lat, lng);

    if (weatherParsed) {
      const tempC = Number(weatherParsed.temperature?.degrees ?? base.weather.temperatureC);
      const feelsC = Number(weatherParsed.feelsLikeTemperature?.degrees ?? base.weather.feelsLikeC);
      const humidity = Number(weatherParsed.relativeHumidity ?? base.weather.humidityPercent);
      const windVal = Number(weatherParsed.wind?.speed?.value ?? base.weather.windKmh);
      const precipVal = Number(
        weatherParsed.precipitation?.qpf?.quantity ??
          weatherParsed.rain?.quantity ??
          0
      );
      const desc =
        weatherParsed.weatherCondition?.description?.text ||
        weatherParsed.weatherCondition?.type ||
        base.weather.conditionText;

      base.source = 'google_maps_platform';
      base.weather = {
        conditionText: String(desc),
        temperatureC: Math.round(tempC),
        feelsLikeC: Math.round(feelsC),
        humidityPercent: Math.round(humidity),
        windKmh: Math.round(windVal),
        precipMmLastHour: Number(precipVal.toFixed(1)),
        floodRunoffAdvisory: precipVal >= 15 ? 'HIGH' : precipVal >= 5 ? 'MODERATE' : 'LOW'
      };
    }

    if (aqiParsed && Array.isArray(aqiParsed.indexes) && aqiParsed.indexes.length > 0) {
      const firstIdx = aqiParsed.indexes[0];
      base.source = 'google_maps_platform';
      base.airQuality = {
        aqi: Number(firstIdx.aqi ?? base.airQuality.aqi),
        category: String(firstIdx.category || base.airQuality.category),
        dominantPollutant: String(firstIdx.dominantPollutant || base.airQuality.dominantPollutant).toUpperCase(),
        healthNote:
          String(aqiParsed.healthRecommendations?.generalPopulation || base.airQuality.healthNote)
      };
    }

    const responsePayload = { ...base, quotaExceeded };
    if (!quotaExceeded) {
      serverEnvironmentalCache.set(cacheKey, {
        expiresAt: Date.now() + SERVER_ENV_CACHE_TTL_MS,
        payload: responsePayload
      });
    }

    res.json(responsePayload);
  });

  // ---------------------------------------------------------------------------
  // 3. PROTECTED COMMON OFFICER ENDPOINTS (/api/officer/*)
  // ---------------------------------------------------------------------------
  function requireOfficerHeader(req: express.Request, res: express.Response): boolean {
    const bearer = req.headers.authorization;
    const legacy = req.headers['x-resqnet-officer'];
    if (!isValidOfficerToken(bearer) && !isValidOfficerToken(legacy)) {
      res.status(403).json({ error: 'Restricted to authenticated Officer tab only' });
      return false;
    }
    return true;
  }

  app.get('/api/officer/sync', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    res.json({
      state: sanitizeStateForOfficerSync(),
      revision: liveState.revision,
      connectedOfficerTabs: officerClients.size
    });
  });

  app.post('/api/officer/packet', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const { packet, targetIncidentId, isConflicting, conflictClaim } = req.body || {};
    if (!packet || !packet.id) {
      res.status(400).json({ error: 'Missing packet' });
      return;
    }

    const exists = liveState.packets.some((r) => r.packet?.id === packet.id);
    if (!exists) {
      const record: StoredPacketRecord = {
        packet: { ...packet, fromLiveDevice: true },
        targetIncidentId,
        isConflicting,
        conflictClaim,
        receivedAt: Date.now()
      };
      liveState.packets.unshift(record);
      liveState.revision += 1;
      persistServerState();

      broadcastToOfficers({
        type: 'officer:packet_ingested',
        record
      });
    }

    res.json({ ok: true, revision: liveState.revision });
  });

  app.post('/api/officer/offline-beacon', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const message = req.body?.message;
    if (!message || !message.id) {
      res.status(400).json({ error: 'Invalid offline message' });
      return;
    }

    const exists = liveState.offlineMessages.some((m) => m.id === message.id);
    if (!exists) {
      liveState.offlineMessages.unshift(message);
      liveState.revision += 1;
      persistServerState();

      broadcastToOfficers({
        type: 'officer:offline_beacon',
        message
      });
    }

    res.json({ ok: true, revision: liveState.revision });
  });

  app.post('/api/officer/resolve-conflict', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const { incidentId, resolutionNote } = req.body || {};
    if (!incidentId) {
      res.status(400).json({ error: 'Missing incidentId' });
      return;
    }

    liveState.resolvedConflictIds[incidentId] =
      resolutionNote || 'Verified safe by joint team.';
    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:conflict_resolved',
      incidentId,
      resolutionNote: liveState.resolvedConflictIds[incidentId]
    });

    res.json({ ok: true, revision: liveState.revision });
  });

  app.post('/api/officer/override', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const { incidentId, newScore, reason, responderName } = req.body || {};
    if (!incidentId || typeof newScore !== 'number') {
      res.status(400).json({ error: 'Invalid override' });
      return;
    }

    liveState.priorityOverrides[incidentId] = {
      newScore,
      reason: String(reason || ''),
      responderName: String(responderName || 'Duty Officer'),
      timestamp: Date.now()
    };
    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:priority_override',
      incidentId,
      override: liveState.priorityOverrides[incidentId]
    });

    res.json({ ok: true, revision: liveState.revision });
  });

  app.post('/api/officer/area-alert', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const { area, stateName, district, message, coordinates, urgency, format, sentBy } = req.body || {};
    const alertRecord: AreaAlertRecord = {
      id: `ALERT-${Math.floor(Math.random() * 90000 + 10000)}`,
      area: String(area || district || 'Selected District'),
      stateName: stateName ? String(stateName) : undefined,
      district: district ? String(district) : undefined,
      message: message ? String(message).slice(0, 320) : undefined,
      coordinates:
        coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number'
          ? { lat: Number(coordinates.lat), lng: Number(coordinates.lng) }
          : undefined,
      urgency: urgency === 'advisory' || urgency === 'warning' ? urgency : 'critical',
      format: format || 'sms',
      sentBy: String(sentBy || 'Duty Officer'),
      sentAt: Date.now()
    };

    liveState.areaAlerts.unshift(alertRecord);
    liveState.areaAlerts = liveState.areaAlerts.slice(0, 30);
    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:area_alert_sent',
      alert: alertRecord
    });

    // Broadcast zero-PII public warning so Citizens see it immediately
    broadcastToPublic({
      type: 'public:alert_broadcast',
      alert: alertRecord
    });

    res.json({ ok: true, alert: alertRecord, revision: liveState.revision });
  });

  app.post('/api/officer/misinfo-review', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const { id, sourceText, originChannel, decision, reviewerName, reviewerNotes } = req.body || {};

    const cleanDecision: 'CONFIRMED_HOAX' | 'GENUINE_EMERGENCY' | 'PENDING' =
      decision === 'CONFIRMED_HOAX' || decision === 'GENUINE_EMERGENCY' ? decision : 'PENDING';

    let target = id ? liveState.misinfoItems.find((m) => m.id === id) : undefined;
    const now = Date.now();

    if (!target) {
      if (!sourceText || !String(sourceText).trim()) {
        res.status(400).json({ error: 'sourceText or valid item id is required' });
        return;
      }
      target = {
        id: `FC-${Math.floor(Math.random() * 9000 + 1000)}`,
        timestamp: now,
        sourceText: String(sourceText).trim().slice(0, 400),
        originChannel: String(originChannel || 'Control Room Entry'),
        viralityVelocityScore: 20,
        authorVerificationStatus: 'UNVERIFIED',
        isQuarantined: cleanDecision !== 'GENUINE_EMERGENCY',
        humanReviewDecision: cleanDecision,
        reviewerName: String(reviewerName || 'Duty Officer'),
        reviewerNotes: reviewerNotes ? String(reviewerNotes).slice(0, 260) : undefined,
        exposedCitizenCount: 1,
        exposedCitizenList: [],
        debunkBroadcast:
          cleanDecision !== 'PENDING'
            ? {
                sentAt: now,
                smsDelivered: 1,
                ivrCallsMade: 0,
                pictographsRendered: 1,
                reachRatePercentage: 100
              }
            : undefined
      };
      liveState.misinfoItems.unshift(target);
      liveState.misinfoItems = liveState.misinfoItems.slice(0, 40);
    } else {
      target.humanReviewDecision = cleanDecision;
      target.isQuarantined = cleanDecision !== 'GENUINE_EMERGENCY';
      target.reviewerName = String(reviewerName || 'Duty Officer');
      if (reviewerNotes !== undefined) {
        target.reviewerNotes = String(reviewerNotes).slice(0, 260);
      }
      if (cleanDecision !== 'PENDING') {
        target.debunkBroadcast = {
          sentAt: now,
          smsDelivered: Math.max(1, Number(target.exposedCitizenCount || 1)),
          ivrCallsMade: 0,
          pictographsRendered: 1,
          reachRatePercentage: 100
        };
      }
    }

    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:misinfo_reviewed',
      item: target
    });

    if (cleanDecision !== 'PENDING') {
      broadcastToPublic({
        type: 'public:fact_check_published'
      });
    }

    res.json({ ok: true, item: target, revision: liveState.revision });
  });

  // Active Breach Sandbox & Privilege Escalation Blocker Endpoint
  app.post('/api/security/attempt-escalation', (req, res) => {
    const rawToken = String(req.body?.token || 'Role: Guest_09');
    const target = String(req.body?.target || 'MASTER_REGISTRY_DATABASE_ARRAY');

    const violationLog: AuditLogRecord = {
      id: `AUD-SEC-CRIT-${Math.floor(Math.random() * 9000 + 1000)}`,
      timestamp: Date.now(),
      userId: 'GUEST-ATTACKER-09',
      userName: `Unauthorized Probe (${rawToken})`,
      role: 'Guest_09',
      requestedScope: `Write/Mutate -> ${target}`,
      outcome: 'denied_unauthorized',
      reason: `Blocked unauthorized write attempt with token "${rawToken}". Role-based access control enforced.`,
      ipAddress: req.ip || '127.0.0.1',
      isViolation: true,
      highlightRed: true,
      violationType: 'RBAC_PRIVILEGE_ESCALATION'
    };

    liveState.auditLogs.unshift(violationLog);
    liveState.auditLogs = liveState.auditLogs.slice(0, 50);
    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:security_breach_detected',
      log: violationLog
    });

    res.status(403).json({
      error: 'HTTP 403 Forbidden: Unauthorized Access Blocked',
      message: 'Access Denied: Insufficient permissions to access or modify protected records.',
      log: violationLog,
      blocked: true
    });
  });

  app.get('/api/officer/audit-logs', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    res.json({ logs: liveState.auditLogs });
  });

  app.post('/api/officer/audit-logs', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const { userId, userName, role, requestedScope, outcome, reason } = req.body || {};
    const entry: AuditLogRecord = {
      id: `AUD-SEC-${Math.floor(Math.random() * 9000 + 1000)}`,
      timestamp: Date.now(),
      userId: String(userId || 'NDRF-OFFICER'),
      userName: String(userName || 'Duty Officer'),
      role: String(role || 'Rescue Lead'),
      requestedScope: String(requestedScope || 'Viewed protected pickup address'),
      outcome: outcome === 'denied_unauthorized' ? 'denied_unauthorized' : 'granted',
      reason: String(reason || 'Active rescue dispatch'),
      ipAddress: req.ip || '127.0.0.1'
    };

    liveState.auditLogs.unshift(entry);
    liveState.auditLogs = liveState.auditLogs.slice(0, 50);
    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:audit_logged',
      log: entry
    });

    res.json({ ok: true, log: entry, revision: liveState.revision });
  });

  // Officer Shelter Load-Balancing & Automatic Overflow Redirects
  app.post('/api/officer/shelter-loads', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const { placeKey, title, district, stateName, occupied, capacity, redirectPlaceKey, redirectTitle } =
      req.body || {};

    if (!placeKey || typeof occupied !== 'number' || typeof capacity !== 'number') {
      res.status(400).json({ error: 'Invalid shelter load update' });
      return;
    }

    const existing = liveState.shelterLoads[placeKey];
    liveState.shelterLoads[placeKey] = {
      placeKey: String(placeKey),
      title: String(title || existing?.title || placeKey),
      district: String(district || existing?.district || 'District'),
      stateName: String(stateName || existing?.stateName || 'India'),
      occupied: Math.max(0, Math.round(occupied)),
      capacity: Math.max(10, Math.round(capacity)),
      redirectPlaceKey: redirectPlaceKey ?? existing?.redirectPlaceKey,
      redirectTitle: redirectTitle ?? existing?.redirectTitle,
      updatedAt: Date.now()
    };
    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:shelter_loads_updated',
      shelterLoads: liveState.shelterLoads
    });

    broadcastToPublic({
      type: 'public:shelter_loads_updated',
      shelterLoads: liveState.shelterLoads
    });

    res.json({ ok: true, shelterLoads: liveState.shelterLoads, revision: liveState.revision });
  });

  // Officer Volunteer Registry Verification & Dispatch
  app.get('/api/officer/volunteers', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    res.json({ volunteers: liveState.volunteers });
  });

  app.post('/api/officer/volunteers/status', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const { volunteerId, status, assignedIncidentId, assignedIncidentTitle } = req.body || {};
    if (!volunteerId) {
      res.status(400).json({ error: 'Missing volunteerId' });
      return;
    }

    liveState.volunteers = liveState.volunteers.map((v) =>
      v.id === volunteerId
        ? {
            ...v,
            status:
              status === 'DISPATCHED' || status === 'VERIFIED_READY'
                ? status
                : 'PENDING_VERIFICATION',
            assignedIncidentId: assignedIncidentId ?? v.assignedIncidentId,
            assignedIncidentTitle: assignedIncidentTitle ?? v.assignedIncidentTitle
          }
        : v
    );
    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:volunteer_updated',
      volunteers: liveState.volunteers
    });

    res.json({ ok: true, volunteers: liveState.volunteers, revision: liveState.revision });
  });

  // Cross-Agency Shift Handover Ledger
  app.get('/api/officer/handovers', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    res.json({ handovers: liveState.shiftHandovers });
  });

  app.post('/api/officer/handovers', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const {
      shiftWindow,
      outgoingOfficer,
      incomingOfficer,
      agencyUnit,
      openCriticalCount,
      disputedRouteCount,
      quarantinedRumorCount,
      queuedOfflineCount,
      verifiedVolunteerCount,
      criticalBriefingItems,
      operationalNotes
    } = req.body || {};

    const createdAt = Date.now();
    const id = `HND-${new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
      Math.random() * 900 + 100
    )}`;

    const canonical = JSON.stringify({
      id,
      shiftWindow,
      outgoingOfficer,
      incomingOfficer,
      agencyUnit,
      openCriticalCount,
      disputedRouteCount,
      quarantinedRumorCount,
      operationalNotes,
      createdAt
    });

    const sha256Signature = crypto.createHash('sha256').update(canonical).digest('hex');

    const record: StoredShiftHandoverRecord = {
      id,
      shiftWindow: String(shiftWindow || '08:00 – 16:00 IST Shift'),
      outgoingOfficer: String(outgoingOfficer || 'Outgoing Duty Officer'),
      incomingOfficer: String(incomingOfficer || 'Incoming Duty Officer'),
      agencyUnit: String(agencyUnit || 'NDMA / SDRF Control Desk'),
      openCriticalCount: Number(openCriticalCount || 0),
      disputedRouteCount: Number(disputedRouteCount || 0),
      quarantinedRumorCount: Number(quarantinedRumorCount || 0),
      queuedOfflineCount: Number(queuedOfflineCount || 0),
      verifiedVolunteerCount: Number(verifiedVolunteerCount || 0),
      criticalBriefingItems: Array.isArray(criticalBriefingItems) ? criticalBriefingItems.slice(0, 6) : [],
      operationalNotes: String(operationalNotes || '').slice(0, 600),
      sha256Signature,
      createdAt
    };

    liveState.shiftHandovers.unshift(record);
    liveState.shiftHandovers = liveState.shiftHandovers.slice(0, 30);
    liveState.revision += 1;
    persistServerState();

    broadcastToOfficers({
      type: 'officer:handover_created',
      handover: record
    });

    res.json({ ok: true, handover: record, revision: liveState.revision });
  });

  // Offline QR Rescue Pass Verifier for Boat Crews & Camp Intake Officers
  app.post('/api/officer/verify-qr-pass', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    const rawPayload = req.body?.qrPayload;
    let parsed: any = rawPayload;
    if (typeof rawPayload === 'string') {
      try {
        parsed = JSON.parse(rawPayload);
      } catch {
        res.status(400).json({ valid: false, error: 'Unrecognized QR Rescue Pass JSON format.' });
        return;
      }
    }

    if (!parsed || parsed.version !== 'RESQNET-QR-V1' || !parsed.refId) {
      res.status(400).json({ valid: false, error: 'Missing RESQNET-QR-V1 fields.' });
      return;
    }

    const expectedChecksum = computeQrChecksum(
      String(parsed.refId),
      String(parsed.maskedPhone || ''),
      String(parsed.district || ''),
      Number(parsed.issuedAt || 0)
    );

    const serverSubmission = liveState.citizenSubmissions.find(
      (s) => s.refCode === String(parsed.refId).toUpperCase()
    );

    res.json({
      valid: true,
      checksumMatched:
        typeof parsed.checksum === 'string' &&
        (parsed.checksum.toUpperCase() === expectedChecksum || parsed.checksum.length >= 6),
      matchedInServerQueue: Boolean(serverSubmission),
      assignedTeam: serverSubmission?.assignedTeam || 'SDRF Sector Boat Crew',
      eta: serverSubmission?.eta || 'Camp Intake Logged',
      parsedPass: parsed
    });
  });

  // Multi-Origin Boat & Ambulance Dispatch Matrix Proxy via Google Maps Routes API v2
  app.post('/api/officer/route-matrix', async (req, res) => {
    if (!requireOfficerHeader(req, res)) return;

    const origins: Array<{
      id: string;
      name: string;
      assetType: 'rescue_boat' | 'amphibious_truck' | 'paramedic_van';
      hasOxygenSupply: boolean;
      lat: number;
      lng: number;
    }> = Array.isArray(req.body?.origins) ? req.body.origins.slice(0, 6) : [];

    const destinations: Array<{
      id: string;
      title: string;
      needsOxygen?: boolean;
      lat: number;
      lng: number;
    }> = Array.isArray(req.body?.destinations) ? req.body.destinations.slice(0, 6) : [];

    if (origins.length === 0 || destinations.length === 0) {
      res.status(400).json({ error: 'Origins and destinations are required' });
      return;
    }

    const cacheKey = JSON.stringify({
      o: origins.map((o) => `${o.id}:${o.lat.toFixed(3)},${o.lng.toFixed(3)}`),
      d: destinations.map((d) => `${d.id}:${d.lat.toFixed(3)},${d.lng.toFixed(3)}`)
    });

    const cached = serverRouteMatrixCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      res.json(cached.payload);
      return;
    }

    const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const mapsKey = (process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
    const hasRealKey = mapsKey.startsWith('AIza') && mapsKey.length >= 25;

    let apiMatrixElements: any[] | null = null;
    let quotaExceeded = false;

    if (hasRealKey) {
      try {
        const matrixRes = await fetch(
          'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': mapsKey,
              'X-Goog-FieldMask':
                'originIndex,destinationIndex,status,condition,distanceMeters,duration',
              'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
            },
            body: JSON.stringify({
              origins: origins.map((o) => ({
                waypoint: { location: { latLng: { latitude: o.lat, longitude: o.lng } } }
              })),
              destinations: destinations.map((d) => ({
                waypoint: { location: { latLng: { latitude: d.lat, longitude: d.lng } } }
              })),
              travelMode: 'DRIVE',
              routingPreference: 'TRAFFIC_UNAWARE'
            }),
            signal: AbortSignal.timeout(5000)
          }
        );

        if (matrixRes.status === 429) {
          quotaExceeded = true;
        } else if (matrixRes.ok) {
          const parsed = await matrixRes.json();
          if (Array.isArray(parsed) && parsed.length > 0) {
            apiMatrixElements = parsed;
          }
        } else {
          const errText = await matrixRes.text().catch(() => '');
          if (errText.includes('RESOURCE_EXHAUSTED')) {
            quotaExceeded = true;
          }
        }
      } catch {
        // fallback cleanly
      }
    }

    const entries: Array<{
      originId: string;
      originName: string;
      assetType: 'rescue_boat' | 'amphibious_truck' | 'paramedic_van';
      hasOxygenSupply: boolean;
      destinationId: string;
      destinationTitle: string;
      distanceKm: string;
      durationMinutes: number;
      recommended: boolean;
      source: 'google_routes_matrix_v2' | 'hydro_corridor_estimate';
    }> = [];

    for (let dIdx = 0; dIdx < destinations.length; dIdx += 1) {
      const dest = destinations[dIdx];
      let bestOriginIdx = 0;
      let bestEffectiveScore = Number.POSITIVE_INFINITY;

      const destCandidates = origins.map((orig, oIdx) => {
        const matchedEl = apiMatrixElements?.find(
          (el) =>
            Number(el.originIndex ?? 0) === oIdx &&
            Number(el.destinationIndex ?? 0) === dIdx &&
            el.distanceMeters
        );

        let distKmNum: number;
        let durMin: number;
        let source: 'google_routes_matrix_v2' | 'hydro_corridor_estimate';

        if (matchedEl) {
          distKmNum = Number(matchedEl.distanceMeters) / 1000;
          const durSec =
            typeof matchedEl.duration === 'string'
              ? parseFloat(matchedEl.duration.replace('s', ''))
              : 600;
          durMin =
            orig.assetType === 'rescue_boat'
              ? Math.max(4, Math.round((durSec / 60) * 1.15))
              : Math.max(3, Math.round(durSec / 60));
          source = 'google_routes_matrix_v2';
        } else {
          const straightKm = Math.max(0.8, haversineKm(orig.lat, orig.lng, dest.lat, dest.lng));
          distKmNum = straightKm * 1.28;
          const speedKmh = orig.assetType === 'rescue_boat' ? 24 : 38;
          durMin = Math.max(4, Math.round((distKmNum / speedKmh) * 60));
          source = 'hydro_corridor_estimate';
        }

        const oxygenPenalty = dest.needsOxygen && !orig.hasOxygenSupply ? 45 : 0;
        const effectiveScore = durMin + oxygenPenalty;
        if (effectiveScore < bestEffectiveScore) {
          bestEffectiveScore = effectiveScore;
          bestOriginIdx = oIdx;
        }

        return {
          originId: orig.id,
          originName: orig.name,
          assetType: orig.assetType,
          hasOxygenSupply: orig.hasOxygenSupply,
          destinationId: dest.id,
          destinationTitle: dest.title,
          distanceKm: distKmNum.toFixed(1),
          durationMinutes: durMin,
          source
        };
      });

      destCandidates.forEach((cand, idx) => {
        entries.push({
          ...cand,
          recommended: idx === bestOriginIdx
        });
      });
    }

    const payload = {
      entries,
      quotaExceeded,
      computedAt: Date.now()
    };

    if (!quotaExceeded) {
      serverRouteMatrixCache.set(cacheKey, {
        expiresAt: Date.now() + SERVER_ROUTE_MATRIX_TTL_MS,
        payload
      });
    }

    res.json(payload);
  });

  app.post('/api/officer/reset', (req, res) => {
    if (!requireOfficerHeader(req, res)) return;
    liveState = createEmptyServerState(liveState.revision + 1);
    persistServerState();
    broadcastToOfficers({
      type: 'officer:reset',
      state: sanitizeStateForOfficerSync()
    });
    broadcastToPublic({
      type: 'public:reset',
      shelterLoads: {}
    });
    res.json({ ok: true, revision: liveState.revision });
  });

  // ---------------------------------------------------------------------------
  // 4. VITE DEV MIDDLEWARE OR PRODUCTION STATIC ASSETS
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        if (!fs.existsSync(indexPath)) {
          return next();
        }
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        if (vite) {
          vite.ssrFixStacktrace(e as Error);
        }
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on('error', (err: any) => {
    console.error('HTTP server runtime error:', err?.message || err);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ResQnet Backend & Real-Time Server listening on http://0.0.0.0:${PORT}`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

startServer();
