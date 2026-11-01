import { FieldPhotoForensicResult } from '../types/disaster';

const REPLAY_HASH_STORAGE_KEY = 'resqnet_photo_sha256_registry_v1';

function getKnownHashes(): Record<string, { fileName: string; seenAt: number }> {
  try {
    const raw = localStorage.getItem(REPLAY_HASH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function recordKnownHash(sha256Hex: string, fileName: string): void {
  try {
    const existing = getKnownHashes();
    existing[sha256Hex] = { fileName, seenAt: Date.now() };
    localStorage.setItem(REPLAY_HASH_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // ignore storage limits
  }
}

async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const bytes = new Uint8Array(buffer);
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = '';
  const max = Math.min(view.byteLength, offset + length);
  for (let i = offset; i < max; i += 1) {
    const code = view.getUint8(i);
    if (code === 0) break;
    if (code >= 32 && code <= 126) {
      out += String.fromCharCode(code);
    }
  }
  return out.trim();
}

interface ParsedExifSummary {
  hasJpegExifHeader: boolean;
  hasGpsIfd: boolean;
  exifCaptureTime?: string;
  cameraModel?: string;
}

function parseJpegExifBinary(buffer: ArrayBuffer): ParsedExifSummary {
  const view = new DataView(buffer);
  if (view.byteLength < 12) {
    return { hasJpegExifHeader: false, hasGpsIfd: false };
  }

  // Check JPEG SOI marker 0xFFD8
  if (view.getUint16(0, false) !== 0xffd8) {
    return { hasJpegExifHeader: false, hasGpsIfd: false };
  }

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      break;
    }
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) {
      // Start of Scan or End of Image
      break;
    }

    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2 || offset + 2 + segmentLength > view.byteLength) {
      break;
    }

    // APP1 marker (0xFFE1) carrying "Exif\0\0"
    if (marker === 0xe1 && segmentLength >= 10) {
      const header = readAscii(view, offset + 4, 4);
      if (header === 'Exif') {
        const tiffStart = offset + 10;
        if (tiffStart + 8 <= view.byteLength) {
          const byteOrder = view.getUint16(tiffStart, false);
          const littleEndian = byteOrder === 0x4949;
          const firstIfdRel = view.getUint32(tiffStart + 4, littleEndian);
          const ifd0Offset = tiffStart + firstIfdRel;

          let hasGpsIfd = false;
          let cameraModel: string | undefined;
          let exifSubIfdOffset = 0;
          let exifCaptureTime: string | undefined;

          if (ifd0Offset + 2 <= view.byteLength) {
            const entryCount = view.getUint16(ifd0Offset, littleEndian);
            for (let i = 0; i < entryCount; i += 1) {
              const entryOffset = ifd0Offset + 2 + i * 12;
              if (entryOffset + 12 > view.byteLength) break;
              const tag = view.getUint16(entryOffset, littleEndian);
              const count = view.getUint32(entryOffset + 4, littleEndian);
              const valOffsetRel = view.getUint32(entryOffset + 8, littleEndian);

              // 0x0110 = Model
              if (tag === 0x0110 && count > 0 && count < 64) {
                const strPos = count <= 4 ? entryOffset + 8 : tiffStart + valOffsetRel;
                if (strPos + count <= view.byteLength) {
                  cameraModel = readAscii(view, strPos, count);
                }
              }
              // 0x8769 = ExifOffset
              if (tag === 0x8769) {
                exifSubIfdOffset = tiffStart + valOffsetRel;
              }
              // 0x8825 = GPSInfo IFD Pointer
              if (tag === 0x8825) {
                hasGpsIfd = true;
              }
            }
          }

          if (exifSubIfdOffset > tiffStart && exifSubIfdOffset + 2 <= view.byteLength) {
            const subCount = view.getUint16(exifSubIfdOffset, littleEndian);
            for (let j = 0; j < subCount; j += 1) {
              const entryOffset = exifSubIfdOffset + 2 + j * 12;
              if (entryOffset + 12 > view.byteLength) break;
              const tag = view.getUint16(entryOffset, littleEndian);
              const count = view.getUint32(entryOffset + 4, littleEndian);
              const valOffsetRel = view.getUint32(entryOffset + 8, littleEndian);

              // 0x9003 = DateTimeOriginal, 0x9004 = DateTimeDigitized
              if ((tag === 0x9003 || tag === 0x9004) && count >= 10 && count <= 32) {
                const strPos = tiffStart + valOffsetRel;
                if (strPos + count <= view.byteLength) {
                  exifCaptureTime = readAscii(view, strPos, count);
                }
              }
            }
          }

          return {
            hasJpegExifHeader: true,
            hasGpsIfd,
            exifCaptureTime,
            cameraModel
          };
        }
      }
    }

    offset += 2 + segmentLength;
  }

  return { hasJpegExifHeader: false, hasGpsIfd: false };
}

function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

export async function inspectFieldPhotoEvidence(file: File): Promise<FieldPhotoForensicResult> {
  const buffer = await file.arrayBuffer();
  const sha256Hex = await computeSha256Hex(buffer);
  const known = getKnownHashes();
  const isDuplicateReplay = Boolean(known[sha256Hex]);

  const exif = parseJpegExifBinary(buffer);
  const dims = await readImageDimensions(file);

  const lowerName = file.name.toLowerCase();
  const looksMessagingRenamed =
    lowerName.includes('whatsapp') ||
    lowerName.startsWith('wa0') ||
    lowerName.includes('forwarded') ||
    lowerName.includes('telegram');

  const isLikelyMessagingStripped = !exif.hasJpegExifHeader || looksMessagingRenamed;

  recordKnownHash(sha256Hex, file.name);

  if (isDuplicateReplay) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'image/jpeg',
      width: dims.width,
      height: dims.height,
      sha256Hex,
      hasJpegExifHeader: exif.hasJpegExifHeader,
      hasGpsIfd: exif.hasGpsIfd,
      exifCaptureTime: exif.exifCaptureTime,
      cameraModel: exif.cameraModel,
      isDuplicateReplay: true,
      isLikelyMessagingStripped,
      trustVerdict: 'REPLAY_DUPLICATE_FLAGGED',
      credibilityDelta: -18,
      summaryNote:
        'Duplicate SHA-256 image hash already submitted earlier. Held from automatic credibility boost to prevent recycled flood photo hoaxes.'
    };
  }

  if (exif.hasJpegExifHeader && (exif.hasGpsIfd || exif.exifCaptureTime)) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'image/jpeg',
      width: dims.width,
      height: dims.height,
      sha256Hex,
      hasJpegExifHeader: true,
      hasGpsIfd: exif.hasGpsIfd,
      exifCaptureTime: exif.exifCaptureTime,
      cameraModel: exif.cameraModel,
      isDuplicateReplay: false,
      isLikelyMessagingStripped: false,
      trustVerdict: 'AUTHENTIC_FIELD_CAPTURE',
      credibilityDelta: 14,
      summaryNote: `Camera EXIF verified${exif.hasGpsIfd ? ' with embedded GPS geotag IFD' : ''}${
        exif.cameraModel ? ` (${exif.cameraModel})` : ''
      }. Eligible for field corroboration boost.`
    };
  }

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: file.type || 'application/octet-stream',
    width: dims.width,
    height: dims.height,
    sha256Hex,
    hasJpegExifHeader: exif.hasJpegExifHeader,
    hasGpsIfd: exif.hasGpsIfd,
    exifCaptureTime: exif.exifCaptureTime,
    cameraModel: exif.cameraModel,
    isDuplicateReplay: false,
    isLikelyMessagingStripped: true,
    trustVerdict: 'METADATA_STRIPPED_CAUTION',
    credibilityDelta: 0,
    summaryNote:
      'No camera EXIF/GPS header detected (common in forwarded social media images). Accepted as supporting attachment without auto-corroboration boost.'
  };
}

/**
 * Generates a real binary JPEG ArrayBuffer with or without an authentic APP1 Exif + GPS IFD segment
 * so responders can test the binary parser directly in-browser alongside uploading camera files.
 */
export function buildSampleTestPhotoFile(mode: 'geotagged_camera' | 'stripped_forward'): File {
  if (mode === 'stripped_forward') {
    // Minimal SOI + APP0 JFIF + EOI without APP1 Exif
    const stripped = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
    ]);
    return new File([stripped], 'WhatsApp_Image_Forwarded_Flood.jpg', { type: 'image/jpeg' });
  }

  // Construct valid big-endian APP1 Exif header with Model (0x0110), ExifOffset (0x8769), and GPSInfo (0x8825)
  const modelStr = 'SDRF-RuggedCam\0\0'; // 16 bytes
  const dateStr = '2026:07:14 14:22:09\0'; // 20 bytes
  // TIFF layout (big-endian "MM"):
  // 0..7: 4D 4D 00 2A 00 00 00 08
  // 8..9: IFD0 count = 3
  // 10..21: Tag 0x0110 (Model), ASCII (2), count 15, offset 50
  // 22..33: Tag 0x8769 (ExifOffset), LONG (4), count 1, offset 66
  // 34..45: Tag 0x8825 (GPSInfo), LONG (4), count 1, offset 84
  // 46..49: next IFD = 0
  // 50..65: modelStr (16 bytes)
  // 66..67: Exif SubIFD count = 1
  // 68..79: Tag 0x9003 (DateTimeOriginal), ASCII (2), count 20, offset 86
  // 80..83: next IFD = 0
  // 84..85: GPS IFD count = 0
  // 86..105: dateStr (20 bytes)
  const tiff = new Uint8Array(106);
  const dv = new DataView(tiff.buffer);
  dv.setUint16(0, 0x4d4d, false);
  dv.setUint16(2, 0x002a, false);
  dv.setUint32(4, 8, false);
  dv.setUint16(8, 3, false);

  // Entry 1: Model
  dv.setUint16(10, 0x0110, false);
  dv.setUint16(12, 2, false);
  dv.setUint32(14, 15, false);
  dv.setUint32(18, 50, false);

  // Entry 2: ExifOffset
  dv.setUint16(22, 0x8769, false);
  dv.setUint16(24, 4, false);
  dv.setUint32(26, 1, false);
  dv.setUint32(30, 66, false);

  // Entry 3: GPSInfo
  dv.setUint16(34, 0x8825, false);
  dv.setUint16(36, 4, false);
  dv.setUint32(38, 1, false);
  dv.setUint32(42, 84, false);

  dv.setUint32(46, 0, false);

  for (let i = 0; i < modelStr.length; i += 1) {
    tiff[50 + i] = modelStr.charCodeAt(i);
  }

  // Exif SubIFD at 66
  dv.setUint16(66, 1, false);
  dv.setUint16(68, 0x9003, false);
  dv.setUint16(70, 2, false);
  dv.setUint32(72, 20, false);
  dv.setUint32(76, 86, false);
  dv.setUint32(80, 0, false);

  // GPS IFD at 84
  dv.setUint16(84, 0, false);

  for (let i = 0; i < dateStr.length; i += 1) {
    tiff[86 + i] = dateStr.charCodeAt(i);
  }

  // Add unique 4-byte nonce at end so fresh captures aren't duplicate unless re-tested intentionally
  const nonce = new Uint8Array(4);
  const ndv = new DataView(nonce.buffer);
  ndv.setUint32(0, Math.floor(Math.random() * 0xffffffff), false);

  const app1PayloadLen = 2 + 6 + tiff.length;
  const jpeg = new Uint8Array(2 + 2 + app1PayloadLen + nonce.length + 2);
  let p = 0;
  jpeg[p++] = 0xff;
  jpeg[p++] = 0xd8;
  jpeg[p++] = 0xff;
  jpeg[p++] = 0xe1;
  jpeg[p++] = (app1PayloadLen >> 8) & 0xff;
  jpeg[p++] = app1PayloadLen & 0xff;
  // "Exif\0\0"
  jpeg[p++] = 0x45;
  jpeg[p++] = 0x78;
  jpeg[p++] = 0x69;
  jpeg[p++] = 0x66;
  jpeg[p++] = 0x00;
  jpeg[p++] = 0x00;
  jpeg.set(tiff, p);
  p += tiff.length;
  jpeg.set(nonce, p);
  p += nonce.length;
  jpeg[p++] = 0xff;
  jpeg[p++] = 0xd9;

  return new File([jpeg], `SDRF_Field_Capture_${Date.now().toString().slice(-4)}.jpg`, {
    type: 'image/jpeg'
  });
}
