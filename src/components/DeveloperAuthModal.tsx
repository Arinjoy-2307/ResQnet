import React, { useState } from 'react';
import {
  KeyRound,
  AlertCircle,
  X,
  Code2
} from 'lucide-react';
import { loginDeveloperOnServer } from '../services/realtimeClient';

interface DeveloperAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessfulLogin: (devName: string) => void;
}

export const DeveloperAuthModal: React.FC<DeveloperAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccessfulLogin
}) => {
  const [devName, setDevName] = useState('Presentation Evaluator');
  const [passkey, setPasskey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const validPasskey = 'resqdev@2026';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const res = await loginDeveloperOnServer({
      devName,
      passkey
    });

    setLoading(false);
    if (res.ok && res.developer) {
      onSuccessfulLogin(res.developer.name);
      setPasskey('');
      onClose();
    } else {
      setErrorMsg(
        res.error ||
          'Incorrect developer passkey. Developer access is separate from Officer sign-in.'
      );
    }
  };

  const fillDemoPasskey = () => {
    setDevName('Presentation Evaluator');
    setPasskey(validPasskey);
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <Code2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                Developer Console Access
              </h3>
              <p className="text-[11px] text-slate-400">
                Test Suite, Curveballs & Diagnostics
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close developer login dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleLogin} className="p-5 space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Protected sandbox for running live test cases and stress simulations. Separate from the Rescue Officer portal.
          </p>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Session Label
            </label>
            <input
              type="text"
              value={devName}
              onChange={(e) => setDevName(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Developer Passkey
            </label>
            <div className="relative">
              <input
                type="password"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Enter developer passkey"
                className="w-full p-2.5 pr-8 border border-slate-300 rounded-lg font-mono outline-none focus:border-slate-900"
                required
              />
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
            </div>
          </div>

          <div className="p-3 bg-emerald-50/80 rounded-lg border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-[11px] font-semibold text-emerald-900 block">Evaluator &amp; Presenter Mode</span>
              <span className="text-[11px] text-emerald-700">Presentation Evaluator · Passkey: <code className="font-mono font-bold">resqdev@2026</code></span>
            </div>
            <button
              type="button"
              onClick={() => {
                onSuccessfulLogin('Presentation Evaluator');
                onClose();
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>⚡ 1-Click Evaluator Access</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Unlocking…' : 'Unlock Developer Console'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
