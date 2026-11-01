import React, { useState, useEffect } from 'react';
import { FusedIncident, SecurityAuditLog } from '../types/disaster';
import { Lock, Unlock, ShieldCheck } from 'lucide-react';
import { LanguageCode } from '../services/i18n';
import {
  fetchAuditLogsFromServer,
  recordAuditLogOnServer
} from '../services/realtimeClient';

interface PrivacyScopeConsoleProps {
  incidents: FusedIncident[];
  language: LanguageCode;
}

export const PrivacyScopeConsole: React.FC<PrivacyScopeConsoleProps> = ({
  incidents,
  language: _language
}) => {
  const [viewMode, setViewMode] = useState<'public' | 'authorized'>('public');
  const [responderBadge, setResponderBadge] = useState('');
  const [sessionExpirySeconds, setSessionExpirySeconds] = useState(900);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchAuditLogsFromServer().then((serverLogs) => {
      if (!cancelled && serverLogs) {
        setAuditLogs(serverLogs);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isSessionActive && sessionExpirySeconds > 0) {
      timer = setInterval(() => {
        setSessionExpirySeconds((prev) => {
          if (prev <= 1) {
            setIsSessionActive(false);
            setViewMode('public');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSessionActive, sessionExpirySeconds]);

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const badge = responderBadge.trim();
    if (!badge) return;

    setIsSessionActive(true);
    setViewMode('authorized');
    setSessionExpirySeconds(900);

    const serverEntry = await recordAuditLogOnServer({
      userId: badge,
      userName: `Officer (${badge})`,
      role: 'Rescue Coordinator',
      requestedScope: 'Unlocked protected contact details (15m)',
      outcome: 'granted',
      reason: 'Active rescue dispatch'
    });

    const entry: SecurityAuditLog = serverEntry || {
      id: `AUD-SEC-${Math.floor(Math.random() * 9000 + 1000)}`,
      timestamp: Date.now(),
      userId: badge,
      userName: `Officer (${badge})`,
      role: 'Rescue Coordinator',
      requestedScope: 'Unlocked protected contact details (15m)',
      outcome: 'granted',
      reason: 'Active rescue dispatch',
      ipAddress: ''
    };

    setAuditLogs((prev) => [entry, ...prev.filter((l) => l.id !== entry.id)]);
  };

  const handleRevoke = () => {
    setIsSessionActive(false);
    setViewMode('public');
    setSessionExpirySeconds(0);
  };

  const activeRequests = incidents.filter((i) => !i.isQuarantined);

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">
          Protected Contacts &amp; Access Log
        </h2>
        <p className="text-sm text-slate-600 mt-0.5">
          Citizen phone numbers and exact house addresses remain masked by default. Authorized rescue coordinators can unlock them for 15 minutes during pickup, with every access logged.
        </p>
      </div>

      {/* Active View Control */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <strong className="text-base font-bold text-slate-900 block">
            {viewMode === 'public' ? 'Contacts Masked' : 'Contacts Unlocked for Dispatch'}
          </strong>
          <p className="text-xs text-slate-600 tabular-nums">
            {viewMode === 'public'
              ? 'Phone numbers and exact house numbers are hidden until unlocked.'
              : `Auto-locks in ${Math.floor(sessionExpirySeconds / 60)}m ${sessionExpirySeconds % 60}s.`}
          </p>
        </div>

        <div className="shrink-0">
          {viewMode === 'authorized' ? (
            <button
              type="button"
              onClick={handleRevoke}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Mask Contacts Now</span>
            </button>
          ) : (
            <form onSubmit={handleGrantAccess} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={responderBadge}
                onChange={(e) => setResponderBadge(e.target.value)}
                placeholder="Enter Officer Badge ID"
                className="p-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-slate-900 w-48"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Unlock for 15 Mins</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Citizen Contact Records */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700 tabular-nums">
          <span>Active Rescue Requests ({activeRequests.length})</span>
          <span className={viewMode === 'public' ? 'text-slate-500 font-normal' : 'text-emerald-700'}>
            {viewMode === 'public' ? 'Masked' : 'Unlocked for Rescue Team'}
          </span>
        </div>

        {activeRequests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No active citizen rescue requests have been submitted yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeRequests.map((inc) => (
              <div key={inc.id} className="p-4 space-y-2 text-xs hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-slate-900 text-sm">{inc.title}</strong>
                  {inc.provenanceTrail.some((p) => p.fromLiveDevice) && (
                    <span className="text-[11px] font-semibold text-emerald-700">
                      Live Citizen Request
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Phone</span>
                    <span className="font-mono font-medium text-slate-800 tabular-nums">
                      {viewMode === 'authorized'
                        ? inc.provenanceTrail[0]?.contactMasked.replace(/\(Ref:.*\)/, '').trim()
                        : '+91 ••••• ••••• (Masked)'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Exact Pickup Address</span>
                    <span className="font-medium text-slate-800">
                      {viewMode === 'authorized'
                        ? inc.provenanceTrail[0]?.exactAddress || `${inc.landmark}, ${inc.district}`
                        : `${inc.landmark ? `${inc.landmark}, ` : ''}${inc.district} (House number hidden)`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real-Time Access History */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700 tabular-nums">
          <span>Session Access Audit Log ({auditLogs.length})</span>
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No contact unlock or unauthorized sign-in events recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs p-2 space-y-1.5">
            {auditLogs.map((log) => {
              const isViolation =
                log.outcome !== 'granted' ||
                log.isViolation ||
                log.highlightRed;

              return (
                <div
                  key={log.id}
                  className={`p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                    isViolation
                      ? 'bg-rose-50/70 border border-rose-200 text-rose-950'
                      : 'bg-white hover:bg-slate-50/60 border border-slate-100'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className={isViolation ? 'text-rose-950 font-bold' : 'text-slate-900'}>
                        {log.userName}
                      </strong>
                      <span className="text-slate-400" aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          log.outcome === 'granted' ? 'text-emerald-700' : 'text-rose-700 font-bold'
                        }`}
                      >
                        {log.outcome === 'granted' ? 'Allowed' : 'Blocked'}
                      </span>
                    </div>
                    <p className={isViolation ? 'text-rose-900 leading-relaxed' : 'text-slate-600'}>
                      <strong>Action:</strong> {log.requestedScope} — {log.reason}
                    </p>
                  </div>

                  <div className="font-mono text-[11px] text-slate-500 shrink-0 self-start sm:self-auto tabular-nums">
                    {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}{' '}
                    · {log.id}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
