import React from 'react';
import { FusedIncident } from '../types/disaster';
import { LanguageCode } from '../services/i18n';

interface KPIStripProps {
  incidents: FusedIncident[];
  language: LanguageCode;
  onFilterState: (state: string) => void;
  selectedStateFilter: string;
  securityBreachAlert?: {
    id: string;
    userId: string;
    role: string;
    requestedScope: string;
    reason?: string;
  } | null;
  onDismissSecurityBreach?: () => void;
}

export const KPIStrip: React.FC<KPIStripProps> = ({
  incidents,
  language,
  onFilterState,
  selectedStateFilter,
  securityBreachAlert,
  onDismissSecurityBreach
}) => {
  const verifiedCount = incidents.filter(i => i.state === 'verified').length;
  const corroboratedCount = incidents.filter(i => i.state === 'corroborated').length;
  const unconfirmedCount = incidents.filter(i => i.state === 'unconfirmed').length;
  const disputedCount = incidents.filter(i => i.state === 'disputed').length;

  const staleCount = incidents.filter(i => i.freshnessStatus === 'stale').length;
  const urgentCount = incidents.filter(i => i.vulnerabilityScore >= 60).length;

  const filterButtons = [
    { id: 'all', label: language === 'hi' ? 'सभी' : 'All', count: incidents.length },
    { id: 'verified', label: language === 'hi' ? 'सत्यापित' : 'Verified', count: verifiedCount },
    { id: 'corroborated', label: language === 'hi' ? '2+ रिपोर्ट' : '2+ Reports', count: corroboratedCount },
    { id: 'unconfirmed', label: language === 'hi' ? 'जांच बाकी' : 'Needs Check', count: unconfirmedCount },
    { id: 'disputed', label: language === 'hi' ? 'आपत्तिजनक' : 'Conflicting', count: disputedCount }
  ];

  return (
    <div
      className={`rounded-xl transition-all duration-300 overflow-hidden ${
        securityBreachAlert
          ? 'bg-slate-900 text-white border-2 border-amber-400 ring-4 ring-amber-400/50 shadow-[0_0_35px_rgba(251,191,36,0.55)]'
          : 'bg-slate-900 text-white border border-slate-800'
      }`}
    >
      {/* Emergency Amber Glow Security Breach Warning Banner */}
      {securityBreachAlert && (
        <div className="bg-amber-400 text-slate-950 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              {language === 'hi'
                ? `सुरक्षा चेतावनी: अनधिकृत टोकन ("भूमिका: ${securityBreachAlert.role || 'Guest_09'}") ने रजिस्ट्री डेटाबेस में अनाधिकृत परिवर्तन का प्रयास किया। HTTP 403 लागू।`
                : `EMERGENCY RBAC BREACH BLOCKED: Low-privilege token ("Role: ${securityBreachAlert.role || 'Guest_09'}") attempted unauthorized write to Master Registry Database Array. HTTP 403 Forbidden enforced.`}
            </span>
          </div>
          {onDismissSecurityBreach && (
            <button
              type="button"
              onClick={onDismissSecurityBreach}
              className="px-2.5 py-0.5 rounded bg-slate-950 text-amber-300 text-[11px] font-semibold hover:bg-slate-900"
            >
              {language === 'hi' ? 'स्वीकार करें' : 'Acknowledge Alert'}
            </button>
          )}
        </div>
      )}

      <div className="px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {filterButtons.map((btn) => {
            const isActive = selectedStateFilter === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => onFilterState(isActive && btn.id !== 'all' ? 'all' : btn.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  isActive
                    ? 'bg-white text-slate-900 font-semibold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {btn.label} ({btn.count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-5 text-xs text-slate-300 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-5 tabular-nums">
          <div>
            <span className="text-slate-400 block text-[11px]">
              {language === 'hi' ? 'तत्काल बचाव' : 'Urgent Rescues'}
            </span>
            <strong className="text-sm font-bold text-white">
              {urgentCount} {language === 'hi' ? 'परिवार' : 'families'}
            </strong>
          </div>
          <span className="text-slate-700" aria-hidden="true">·</span>
          <div>
            <span className="text-slate-400 block text-[11px]">
              {language === 'hi' ? 'पुरानी रिपोर्टें' : 'Old Reports'}
            </span>
            <strong className={`text-sm font-bold ${staleCount > 0 ? 'text-amber-400' : 'text-white'}`}>
              {staleCount} {language === 'hi' ? 'जांच बाकी' : 'to re-check'}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
