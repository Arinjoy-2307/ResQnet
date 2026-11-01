import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Copy, CheckCircle2, QrCode } from 'lucide-react';
import { QrRescuePassPayload } from '../types/disaster';

interface OfflineRescuePassCardProps {
  refId: string;
  maskedPhone: string;
  district: string;
  stateName?: string;
  landmark: string;
  categoryLabel: string;
  peopleCount?: number;
  medicalTag?: string;
  issuedAt: number;
}

function deterministicChecksum(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(6, '0') + (h1 >>> 0).toString(16).padStart(6, '0')
  )
    .slice(0, 12)
    .toUpperCase();
}

export const OfflineRescuePassCard: React.FC<OfflineRescuePassCardProps> = ({
  refId,
  maskedPhone,
  district,
  stateName = 'Assam',
  landmark,
  categoryLabel,
  peopleCount = 1,
  medicalTag = 'Standard Rescue Intake',
  issuedAt
}) => {
  const [bloodOrMedNote, setBloodOrMedNote] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  const passPayload: QrRescuePassPayload = useMemo(() => {
    const checksum = deterministicChecksum(
      `RESQNET-QR-V1|${refId}|${maskedPhone}|${district}|${issuedAt}`
    );
    return {
      version: 'RESQNET-QR-V1',
      refId,
      maskedPhone,
      district,
      stateName,
      landmark,
      category: categoryLabel,
      peopleCount,
      medicalTag,
      bloodOrMedNote: bloodOrMedNote.trim() || undefined,
      issuedAt,
      checksum
    };
  }, [
    refId,
    maskedPhone,
    district,
    stateName,
    landmark,
    categoryLabel,
    peopleCount,
    medicalTag,
    bloodOrMedNote,
    issuedAt
  ]);

  const serializedJson = useMemo(() => JSON.stringify(passPayload), [passPayload]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(serializedJson, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, [serializedJson]);

  const handleDownloadPassImage = () => {
    if (!qrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White high-contrast card background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Top header bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, 68);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('RESQNET OFFLINE RESCUE PASS & MEDICAL TAG', 24, 42);

    // Left details column
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(passPayload.refId, 24, 114);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Emergency: ${passPayload.category}`, 24, 152);
    ctx.font = '15px sans-serif';
    ctx.fillText(`Area: ${passPayload.landmark} (${passPayload.district}, ${passPayload.stateName})`, 24, 182);
    ctx.fillText(`Phone: ${passPayload.maskedPhone}   |   Persons: ${passPayload.peopleCount}`, 24, 212);
    ctx.fillText(`Triage Note: ${passPayload.medicalTag}`, 24, 242);
    if (passPayload.bloodOrMedNote) {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Medical / Blood Tag: ${passPayload.bloodOrMedNote}`, 24, 272);
    }

    ctx.fillStyle = '#475569';
    ctx.font = '13px monospace';
    ctx.fillText(`Checksum: ${passPayload.checksum} · Helpline: 1070 / 112`, 24, 345);
    ctx.font = '12px sans-serif';
    ctx.fillText('Show this pass on your lockscreen to NDRF/SDRF boat crews or shelter intake desks.', 24, 376);

    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(476, 92, 216, 216);
      ctx.drawImage(qrImg, 480, 96, 208, 208);

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `ResQnet-Rescue-Pass-${passPayload.refId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    qrImg.src = qrDataUrl;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 text-left space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-slate-900" />
          <h4 className="text-sm font-bold text-slate-900">
            Offline QR Rescue Pass &amp; Medical Intake Tag
          </h4>
        </div>
        <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
          WORKS WITHOUT INTERNET
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <div className="p-2 bg-white border border-slate-200 rounded-xl shrink-0">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Offline QR Rescue Pass for ${refId}`}
              referrerPolicy="no-referrer"
              className="w-36 h-36 object-contain"
            />
          ) : (
            <div className="w-36 h-36 flex items-center justify-center text-xs text-slate-400">
              Generating QR…
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2.5 text-xs w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="text-slate-400 block text-[11px]">Reference ID</span>
              <strong className="font-mono text-slate-900 text-sm">{refId}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Verification Checksum</span>
              <strong className="font-mono text-slate-800">{passPayload.checksum}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">District &amp; State</span>
              <strong className="text-slate-900">
                {district}, {stateName}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Emergency Category</span>
              <strong className="text-slate-900">{categoryLabel}</strong>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Optional Blood Group / Critical Allergy Tag (Encoded into QR):
            </label>
            <input
              type="text"
              value={bloodOrMedNote}
              onChange={(e) => setBloodOrMedNote(e.target.value.slice(0, 60))}
              placeholder="e.g., O+ Blood · Insulin Dependent · Infant on board"
              className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:border-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadPassImage}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Lockscreen Pass (PNG)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText?.(serializedJson);
                setCopiedPayload(true);
                setTimeout(() => setCopiedPayload(false), 2500);
              }}
              className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              {copiedPayload ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">QR Code Data Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy QR Payload</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
