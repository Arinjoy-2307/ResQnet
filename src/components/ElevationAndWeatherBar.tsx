import React from 'react';
import { CloudRain, Wind, Mountain, Thermometer } from 'lucide-react';
import {
  GeoPoint,
  useElevationEscapeProfile,
  useEnvironmentalOverlay
} from '../services/groundedLocations';

interface ElevationAndWeatherBarProps {
  weatherTargetCoords: GeoPoint | null;
  weatherAreaLabel: string;
  escapeOriginCoords: GeoPoint | null;
  escapeOriginLabel: string;
  escapeDestinationCoords: GeoPoint | null;
  escapeDestinationLabel: string;
}

export const ElevationAndWeatherBar: React.FC<ElevationAndWeatherBarProps> = ({
  weatherTargetCoords,
  weatherAreaLabel,
  escapeOriginCoords,
  escapeOriginLabel,
  escapeDestinationCoords,
  escapeDestinationLabel
}) => {
  const { snapshot: envSnap } = useEnvironmentalOverlay(weatherTargetCoords, Boolean(weatherTargetCoords));

  const { profile: elevProfile } = useElevationEscapeProfile({
    origin: escapeOriginCoords,
    destination: escapeDestinationCoords,
    originLabel: escapeOriginLabel,
    destinationLabel: escapeDestinationLabel,
    enabled: Boolean(escapeOriginCoords && escapeDestinationCoords)
  });

  // Build responsive SVG polyline for terrain profile
  const renderElevationSvg = () => {
    if (!elevProfile || elevProfile.samples.length < 2) return null;
    const width = 520;
    const height = 86;
    const padX = 10;
    const padY = 12;

    const minE = elevProfile.minElevationM;
    const maxE = Math.max(minE + 2, elevProfile.maxElevationM);
    const span = maxE - minE;

    const pts = elevProfile.samples.map((s, idx) => {
      const x = padX + (idx / (elevProfile.samples.length - 1)) * (width - padX * 2);
      const y = height - padY - ((s.elevationMeters - minE) / span) * (height - padY * 2);
      return { x, y, el: s.elevationMeters };
    });

    const linePoints = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPoints = `${pts[0].x.toFixed(1)},${height - padY} ${linePoints} ${pts[
      pts.length - 1
    ].x.toFixed(1)},${height - padY}`;

    // Simulated floodwater danger line (lowest 25% of basin)
    const floodY = height - padY - 0.28 * (height - padY * 2);

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-20 overflow-visible"
        role="img"
        aria-label={`Terrain elevation escape profile from ${elevProfile.originLabel} to ${elevProfile.destinationLabel}`}
      >
        <polygon points={areaPoints} fill="rgba(16, 185, 129, 0.14)" />
        <line
          x1={padX}
          y1={floodY}
          x2={width - padX}
          y2={floodY}
          stroke="#dc2626"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <polyline
          fill="none"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={linePoints}
        />
        <circle cx={pts[0].x} cy={pts[0].y} r="3.5" fill="#dc2626" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" fill="#059669" />
      </svg>
    );
  };

  if (!envSnap && !elevProfile) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* 1. Live Weather, Rainfall Runoff & Air Quality Telemetry */}
      {envSnap && (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <CloudRain className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Weather, Rain Runoff &amp; Air Quality · {weatherAreaLabel}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                envSnap.weather.floodRunoffAdvisory === 'HIGH'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : envSnap.weather.floodRunoffAdvisory === 'MODERATE'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              RUNOFF: {envSnap.weather.floodRunoffAdvisory}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 tabular-nums">
            <div>
              <span className="text-[11px] text-slate-400 block">Condition</span>
              <strong className="text-slate-900 font-semibold line-clamp-1">
                {envSnap.weather.conditionText}
              </strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Thermometer className="w-3 h-3" /> Temp / Humidity
              </span>
              <strong className="font-mono text-slate-900">
                {envSnap.weather.temperatureC}°C · {envSnap.weather.humidityPercent}%
              </strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Wind className="w-3 h-3" /> Rain / Wind
              </span>
              <strong className="font-mono text-slate-900">
                {envSnap.weather.precipMmLastHour} mm/h · {envSnap.weather.windKmh} km/h
              </strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Air Quality (AQI)</span>
              <strong className="font-mono text-emerald-700">
                {envSnap.airQuality.aqi} ({envSnap.airQuality.dominantPollutant})
              </strong>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <span className="truncate">{envSnap.airQuality.healthNote}</span>
            <span className="text-[10px] text-slate-400 shrink-0">
              {envSnap.source === 'google_maps_platform'
                ? 'Google Maps Weather & AQI'
                : envSnap.source === 'open_meteo_live'
                ? 'Live Open-Meteo Telemetry'
                : 'Regional Weather Feed'}
            </span>
          </div>
        </div>
      )}

      {/* 2. High-Ground Terrain Elevation Escape Profile */}
      {elevProfile && (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 min-w-0">
              <Mountain className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">
                High-Ground Escape Terrain: {elevProfile.originLabel} → {elevProfile.destinationLabel}
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold text-emerald-700 shrink-0 tabular-nums">
              {elevProfile.netClimbM >= 0 ? `+${elevProfile.netClimbM}m` : `${elevProfile.netClimbM}m`} climb
            </span>
          </div>

          {renderElevationSvg()}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 tabular-nums pt-1 border-t border-slate-100">
            <span>
              Low Point: <strong className="font-mono text-slate-900">{elevProfile.minElevationM}m ASL</strong>
            </span>
            <span>
              Shelter Plinth: <strong className="font-mono text-emerald-700">{elevProfile.maxElevationM}m ASL</strong>
            </span>
            <span className="text-[10px] text-slate-400">
              {elevProfile.source === 'google_maps_elevation'
                ? 'Google Maps Elevation API'
                : 'Topographic Corridor Model'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
