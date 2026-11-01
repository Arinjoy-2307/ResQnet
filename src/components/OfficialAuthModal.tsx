import React, { useState } from 'react';
import {
  KeyRound,
  AlertCircle,
  X
} from 'lucide-react';
import { loginOfficerOnServer } from '../services/realtimeClient';

interface OfficialAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessfulLogin: (officerName: string, role: string, badgeId: string) => void;
  onFailedAttempt: (attemptedId: string) => void;
}

export const OfficialAuthModal: React.FC<OfficialAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccessfulLogin,
  onFailedAttempt
}) => {
  const [badgeId, setBadgeId] = useState('');
  const [password, setPassword] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [role, setRole] = useState('NDRF Rescue Lead');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const res = await loginOfficerOnServer({
      officerName: officerName.trim() || 'Duty Officer',
      role,
      badgeId: badgeId.trim(),
      password: password.trim()
    });

    setLoading(false);
    if (res.ok && res.officer) {
      setPassword('');
      onSuccessfulLogin(res.officer.name, res.officer.role, res.officer.badgeId);
      onClose();
    } else {
      setErrorMsg(
        res.error || 'Incorrect passkey. Access is restricted to authorized rescue officers.'
      );
      onFailedAttempt(badgeId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/ResQnet_Medical_Connectivity_Logo_c2ba50c4.png"
                alt="ResQnet Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain scale-110"
              />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                Officer Sign In
              </h3>
              <p className="text-[11px] text-slate-400">
                Rescue &amp; District Control Desk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close login dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleLogin} className="p-5 space-y-4 text-xs">
          <p className="text-slate-600">
            For rescue coordinators and field teams only. Citizens do not need to sign in to request emergency help.
          </p>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Officer Name *
            </label>
            <input
              type="text"
              value={officerName}
              onChange={(e) => setOfficerName(e.target.value)}
              placeholder="e.g., S. Verma"
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Response Unit
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:border-slate-900"
            >
              <option value="NDRF Rescue Lead">NDRF Rescue Lead</option>
              <option value="SDRF Boat Team">SDRF Boat Team</option>
              <option value="District Control Desk">District Control Desk</option>
              <option value="PWD Roads Engineer">PWD Roads Engineer</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Badge ID *
              </label>
              <input
                type="text"
                value={badgeId}
                onChange={(e) => setBadgeId(e.target.value)}
                placeholder="e.g., NDRF-402"
                className="w-full p-2.5 border border-slate-300 rounded-lg font-mono outline-none focus:border-slate-900"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Officer Passkey *
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter passkey"
                  className="w-full p-2.5 pr-8 border border-slate-300 rounded-lg font-mono outline-none focus:border-slate-900"
                  required
                />
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Configured via <code className="font-mono">OFFICER_PASSKEY</code> (default environment key:{' '}
            <code className="font-mono text-slate-700">NDMA@Rescue#2026</code>).
          </p>

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
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
