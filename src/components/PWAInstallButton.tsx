import React, { useState } from 'react';
import { Download, Share, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ language?: 'en' | 'hi' }> = ({ language = 'en' }) => {
  const { isInstallable, isInstalled, isIOS, canPromptNatively, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [offlinePackSaved, setOfflinePackSaved] = useState(false);

  const handleSaveOfflinePack = () => {
    try {
      const offlineBundle = {
        savedAt: new Date().toISOString(),
        helplines: { national: '1070', rescue: '1078', emergency: '112', ussd: '*1070#' },
        featuredShelters: [
          { name: 'Barpeta Vidyapith School Camp', district: 'Barpeta, Assam', status: 'Open' },
          { name: 'Bhuragaon Higher Secondary Camp', district: 'Morigaon, Assam', status: 'Open' },
          { name: 'Morigaon Polytechnic Backup Camp', district: 'Morigaon, Assam', status: 'Backup Open' },
          { name: 'Gandhi Maidan Relief Camp', district: 'Patna, Bihar', status: 'Open' },
          { name: 'Puri Coastal Cyclone Shelter', district: 'Puri, Odisha', status: 'Open' },
          { name: 'Kalpetta SKMJ Relief Camp', district: 'Wayanad, Kerala', status: 'Open' }
        ]
      };
      localStorage.setItem('resqnet_offline_shelter_pack_v1', JSON.stringify(offlineBundle));
      setOfflinePackSaved(true);
      setTimeout(() => setOfflinePackSaved(false), 3500);
    } catch {
      // ignore storage errors
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        {isInstallable ? (
          <button
            type="button"
            onClick={() => {
              handleSaveOfflinePack();
              if (canPromptNatively) {
                void promptInstall();
              } else if (isIOS) {
                setShowIOSGuide(true);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1 text-xs font-bold text-slate-950 transition-colors whitespace-nowrap shrink-0"
            title="Install ResQnet app for offline access"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{language === 'hi' ? 'ऐप इंस्टॉल करें' : 'Install App'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSaveOfflinePack}
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200 transition-colors whitespace-nowrap shrink-0"
            title="Cache offline shelter directory on this device"
          >
            {offlinePackSaved ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">
                  {language === 'hi' ? 'ऑफ़लाइन पैक सहेजा गया' : 'Offline Pack Saved'}
                </span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 text-emerald-400" />
                <span>{language === 'hi' ? 'ऑफ़लाइन पैक' : 'Save Offline Pack'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-5 text-slate-900 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 id="ios-install-title" className="text-sm font-bold text-slate-900">
                Install ResQnet for Offline Use
              </h2>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Close install instructions"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-3 space-y-2.5 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900">1.</span>
                <span>Tap the</span>
                <Share className="h-4 w-4 text-sky-600 shrink-0" />
                <span>
                  <strong>Share</strong> button in Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono font-bold text-slate-900">2.</span>
                <span>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono font-bold text-slate-900">3.</span>
                <span>
                  Tap <strong>Add</strong> to keep emergency maps, SOS whistle, and shelter guides offline.
                </span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
};
