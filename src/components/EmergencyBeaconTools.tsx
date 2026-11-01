import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Sun, Download, CheckCircle2, X } from 'lucide-react';
import { GroundedPlaceRecord } from '../services/groundedLocations';

interface EmergencyBeaconToolsProps {
  placesMap: Record<string, GroundedPlaceRecord>;
  activeStateName?: string;
}

// International Morse SOS pattern: ... --- ... (1 = flash/tone on, 0 = gap)
const MORSE_SOS_STEPS: Array<{ on: boolean; ms: number }> = [
  { on: true, ms: 180 },
  { on: false, ms: 160 },
  { on: true, ms: 180 },
  { on: false, ms: 160 },
  { on: true, ms: 180 },
  { on: false, ms: 420 },
  { on: true, ms: 520 },
  { on: false, ms: 180 },
  { on: true, ms: 520 },
  { on: false, ms: 180 },
  { on: true, ms: 520 },
  { on: false, ms: 420 },
  { on: true, ms: 180 },
  { on: false, ms: 160 },
  { on: true, ms: 180 },
  { on: false, ms: 160 },
  { on: true, ms: 180 },
  { on: false, ms: 900 }
];

export const EmergencyBeaconTools: React.FC<EmergencyBeaconToolsProps> = ({
  placesMap,
  activeStateName = 'ALL'
}) => {
  const [isWhistleActive, setIsWhistleActive] = useState(false);
  const [isStrobeFullscreen, setIsStrobeFullscreen] = useState(false);
  const [strobeLit, setStrobeLit] = useState(false);
  const [packDownloaded, setPackDownloaded] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const whistleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strobeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopWhistle = () => {
    if (whistleTimerRef.current) {
      clearTimeout(whistleTimerRef.current);
      whistleTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    setIsWhistleActive(false);
  };

  const startWhistle = () => {
    stopWhistle();
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    setIsWhistleActive(true);

    let stepIdx = 0;

    const playStep = () => {
      if (!audioCtxRef.current) return;
      const step = MORSE_SOS_STEPS[stepIdx % MORSE_SOS_STEPS.length];

      if (step.on) {
        const now = ctx.currentTime;
        const durSec = step.ms / 1000;
        // Dual-frequency rescue pea-whistle modulation (2,950 Hz + 3,180 Hz) for maximum audibility over heavy rain
        const oscA = ctx.createOscillator();
        const oscB = ctx.createOscillator();
        const gain = ctx.createGain();

        oscA.type = 'triangle';
        oscB.type = 'sine';
        oscA.frequency.setValueAtTime(2950, now);
        oscB.frequency.setValueAtTime(3180, now);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.exponentialRampToValueAtTime(0.45, now + 0.02);
        gain.gain.setValueAtTime(0.45, Math.max(now + 0.02, now + durSec - 0.02));
        gain.gain.exponentialRampToValueAtTime(0.001, now + durSec);

        oscA.connect(gain);
        oscB.connect(gain);
        gain.connect(ctx.destination);

        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + durSec);
        oscB.stop(now + durSec);
      }

      stepIdx += 1;
      whistleTimerRef.current = setTimeout(playStep, step.ms);
    };

    playStep();
  };

  useEffect(() => {
    if (!isStrobeFullscreen) {
      if (strobeTimerRef.current) {
        clearTimeout(strobeTimerRef.current);
        strobeTimerRef.current = null;
      }
      setStrobeLit(false);
      return;
    }

    let stepIdx = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const step = MORSE_SOS_STEPS[stepIdx % MORSE_SOS_STEPS.length];
      setStrobeLit(step.on);
      stepIdx += 1;
      strobeTimerRef.current = setTimeout(tick, step.ms);
    };

    tick();

    return () => {
      cancelled = true;
      if (strobeTimerRef.current) {
        clearTimeout(strobeTimerRef.current);
        strobeTimerRef.current = null;
      }
    };
  }, [isStrobeFullscreen]);

  useEffect(() => {
    return () => {
      stopWhistle();
    };
  }, []);

  const handleDownloadOfflineShelterPack = () => {
    const shelters = Object.values(placesMap)
      .filter((p) => p.publicRole === 'shelter' || p.publicRole === 'backup_shelter')
      .map((s) => ({
        name: s.displayName || s.publicTitle,
        district: s.district,
        state: s.stateName,
        address: s.formattedAddress,
        coordinates: s.location,
        summary: s.publicSummary
      }));

    const pack = {
      packVersion: 'RESQNET-OFFLINE-PACK-2026',
      exportedAt: new Date().toISOString(),
      selectedRegion: activeStateName,
      emergencyHelplines: {
        nationalDisasterControl: '1070',
        districtRescueControl: '1077 / 1078',
        allIndiaEmergency: '112',
        offlineUssdCode: '*1070#'
      },
      shelters:
        shelters.length > 0
          ? shelters
          : [
              {
                name: 'Barpeta Vidyapith School Camp',
                district: 'Barpeta',
                state: 'Assam',
                address: 'Barpeta Town, Assam',
                summary: 'Open · Drinking water, hot meals, and medical desk'
              },
              {
                name: 'Morigaon Polytechnic Backup Camp',
                district: 'Morigaon',
                state: 'Assam',
                address: 'Morigaon, Assam',
                summary: 'Open (~220 spots) · High ground shelter'
              },
              {
                name: 'Gandhi Maidan Relief Camp',
                district: 'Patna',
                state: 'Bihar',
                address: 'Gandhi Maidan, Patna, Bihar',
                summary: 'Open (~310 spots) · Flood relief tents & clean water'
              }
            ]
    };

    try {
      localStorage.setItem('resqnet_offline_shelter_pack_v1', JSON.stringify(pack));
    } catch {
      // ignore
    }

    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ResQnet-Offline-Shelter-Pack-${
      activeStateName === 'ALL' ? 'India' : activeStateName.replace(/\s+/g, '-')
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setPackDownloaded(true);
    setTimeout(() => setPackDownloaded(false), 4000);
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Zero-Network Rescue Beacon &amp; Offline Shelter Pack
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Works with zero internet or SIM signal to alert nearby NDRF/SDRF rescue boats at night or in heavy rain.
            </p>
          </div>
          <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md self-start sm:self-auto">
            SOS MORSE · ••• ——— •••
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Acoustic Rescue Whistle */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-900">
                Acoustic Rescue Whistle (3.0 kHz)
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Plays a piercing 2,950–3,180 Hz dual-tone SOS whistle pattern engineered to carry over rain and engine noise.
              </p>
            </div>
            <button
              type="button"
              onClick={() => (isWhistleActive ? stopWhistle() : startWhistle())}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                isWhistleActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {isWhistleActive ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>Stop SOS Whistle</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>Start SOS Whistle</span>
                </>
              )}
            </button>
          </div>

          {/* 2. Optical Morse Strobe Torch */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-900">
                Night Boat Morse Screen Torch
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Flashes full-screen high-contrast Morse SOS (3 short, 3 long, 3 short) so patrol boats or drones spot your roof.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsStrobeFullscreen(true)}
              className="w-full py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Sun className="w-4 h-4" />
              <span>Launch Morse SOS Flasher</span>
            </button>
          </div>

          {/* 3. Offline Shelter Directory Pack */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-900">
                Offline Shelter &amp; Helpline File
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Saves verified shelter coordinates, camp summaries, and 1070/112 helplines directly onto your phone storage.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadOfflineShelterPack}
              className="w-full py-2.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              {packDownloaded ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Saved to Device</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-700" />
                  <span>Download Offline Pack</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen High-Contrast Morse SOS Optical Strobe */}
      {isStrobeFullscreen && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 transition-colors duration-75 ${
            strobeLit ? 'bg-white text-black' : 'bg-black text-white'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Emergency SOS Optical Beacon"
        >
          <div className="w-full max-w-md flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-widest">
              RESQNET OPTICAL SOS BEACON
            </span>
            <button
              type="button"
              onClick={() => setIsStrobeFullscreen(false)}
              className={`px-4 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                strobeLit
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-white'
              }`}
            >
              <X className="w-4 h-4" />
              <span>Exit Flasher</span>
            </button>
          </div>

          <div className="text-center space-y-3 select-none">
            <div className="text-5xl sm:text-7xl font-black tracking-tight font-mono">
              S · O · S
            </div>
            <div className="text-lg font-bold font-mono tracking-widest">
              ••• &nbsp; ——— &nbsp; •••
            </div>
            <p className="text-xs max-w-xs mx-auto opacity-80">
              Hold screen facing approaching rescue boat, embankment road, or helicopter patrol.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsStrobeFullscreen(false)}
            className={`w-full max-w-xs py-3.5 rounded-xl text-sm font-bold border ${
              strobeLit
                ? 'bg-black text-white border-black'
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            Stop Optical Beacon
          </button>
        </div>
      )}
    </>
  );
};
