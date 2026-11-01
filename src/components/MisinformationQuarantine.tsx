import React, { useState, useEffect } from 'react';
import { FusedIncident, MisinformationItem } from '../types/disaster';
import { Send, Check, Plus, ShieldCheck } from 'lucide-react';
import { LanguageCode } from '../services/i18n';
import { reviewMisinfoOnServer } from '../services/realtimeClient';

interface MisinformationQuarantineProps {
  incidents: FusedIncident[];
  misinfoList: MisinformationItem[];
  setMisinfoList: React.Dispatch<React.SetStateAction<MisinformationItem[]>>;
  onDebunkAndBroadcast: (incidentId: string, debunkNotice: string, misinfoId?: string) => void;
  language: LanguageCode;
  authenticatedOfficerName?: string;
}

export const MisinformationQuarantine: React.FC<MisinformationQuarantineProps> = ({
  incidents: _incidents,
  misinfoList,
  setMisinfoList,
  onDebunkAndBroadcast,
  language: _language,
  authenticatedOfficerName = 'Duty Officer'
}) => {
  const [selectedId, setSelectedId] = useState<string>(misinfoList[0]?.id || '');
  const activeItem = misinfoList.find((m) => m.id === selectedId) || misinfoList[0] || null;

  const [newClaimText, setNewClaimText] = useState('');
  const [newOriginChannel, setNewOriginChannel] = useState('WhatsApp / Social Forward');
  const [showAddForm, setShowAddForm] = useState(false);

  const [debunkSms, setDebunkSms] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  useEffect(() => {
    if (misinfoList.length > 0 && !misinfoList.some((m) => m.id === selectedId)) {
      setSelectedId(misinfoList[0].id);
    }
  }, [misinfoList, selectedId]);

  useEffect(() => {
    if (activeItem) {
      setDebunkSms(
        activeItem.reviewerNotes ||
          `OFFICIAL FACT-CHECK: Claim "${activeItem.sourceText.slice(0, 90)}" has been reviewed by ${authenticatedOfficerName}. Follow verified NDMA / State Control advisories.`
      );
    }
  }, [activeItem?.id, authenticatedOfficerName]);

  const handleLogNewClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = newClaimText.trim();
    if (cleanText.length < 8) return;

    const itemId = `MIS-${Date.now().toString().slice(-6)}`;
    const localItem: MisinformationItem = {
      id: itemId,
      timestamp: Date.now(),
      sourceText: cleanText,
      originChannel: newOriginChannel,
      viralityVelocityScore: 50,
      authorVerificationStatus: 'OFFICIAL_KEY_MISSING',
      isQuarantined: true,
      humanReviewDecision: 'CONFIRMED_HOAX',
      reviewerName: authenticatedOfficerName,
      reviewerNotes: `Logged for fact-check review by ${authenticatedOfficerName}.`,
      exposedCitizenCount: 1,
      exposedCitizenList: []
    };

    const saved = await reviewMisinfoOnServer({
      id: itemId,
      sourceText: cleanText,
      originChannel: newOriginChannel,
      decision: 'PENDING',
      reviewerName: authenticatedOfficerName,
      reviewerNotes: localItem.reviewerNotes || 'Under verification'
    });

    const finalItem = saved || localItem;
    setMisinfoList((prev) => [finalItem, ...prev.filter((m) => m.id !== finalItem.id)]);
    setSelectedId(finalItem.id);
    setNewClaimText('');
    setShowAddForm(false);
  };

  const handleReviewDecision = async (decision: 'CONFIRMED_HOAX' | 'GENUINE_EMERGENCY') => {
    if (!activeItem) return;

    const defaultNote =
      decision === 'CONFIRMED_HOAX'
        ? `VERIFIED FALSE RUMOR: "${activeItem.sourceText.slice(0, 95)}" — Checked with district control and field sensors. Please do not forward.`
        : `CONFIRMED EMERGENCY ALERT: "${activeItem.sourceText.slice(0, 95)}" — Confirmed by field teams. Follow official evacuation guidance.`;

    setDebunkSms(defaultNote);

    const saved = await reviewMisinfoOnServer({
      id: activeItem.id,
      sourceText: activeItem.sourceText,
      originChannel: activeItem.originChannel,
      decision,
      reviewerName: authenticatedOfficerName,
      reviewerNotes: defaultNote
    });

    const updated: MisinformationItem = saved || {
      ...activeItem,
      humanReviewDecision: decision,
      reviewerName: authenticatedOfficerName,
      reviewerNotes: defaultNote
    };

    setMisinfoList((prev) => prev.map((m) => (m.id === activeItem.id ? updated : m)));
  };

  const handlePublishPublicFactCheck = async () => {
    if (!activeItem || !debunkSms.trim()) return;
    setIsBroadcasting(true);

    const decision: 'CONFIRMED_HOAX' | 'GENUINE_EMERGENCY' =
      activeItem.humanReviewDecision === 'GENUINE_EMERGENCY'
        ? 'GENUINE_EMERGENCY'
        : 'CONFIRMED_HOAX';

    const saved = await reviewMisinfoOnServer({
      id: activeItem.id,
      sourceText: activeItem.sourceText,
      originChannel: activeItem.originChannel,
      decision,
      reviewerName: authenticatedOfficerName,
      reviewerNotes: debunkSms.trim()
    });

    if (saved) {
      setMisinfoList((prev) => prev.map((m) => (m.id === activeItem.id ? saved : m)));
    }

    onDebunkAndBroadcast('', debunkSms.trim(), activeItem.id);
    setIsBroadcasting(false);
    setBroadcastSuccess(true);
    setTimeout(() => setBroadcastSuccess(false), 4000);
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Fact-Check &amp; Rumor Verification Desk
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Review citizen-submitted rumors or viral forwards, verify them with ground teams, and publish official fact-checks live to the Citizen Alerts feed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAddForm ? 'Close Form' : 'Log Claim to Fact-Check'}</span>
        </button>
      </div>

      {/* Officer Claim Entry Form */}
      {showAddForm && (
        <form
          onSubmit={handleLogNewClaim}
          className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs shadow-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-800 mb-1">
                Unverified Claim or Viral Message *
              </label>
              <input
                type="text"
                value={newClaimText}
                onChange={(e) => setNewClaimText(e.target.value)}
                placeholder="Paste forwarded WhatsApp/SMS text or rumor reported from the field..."
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Source Channel
              </label>
              <select
                value={newOriginChannel}
                onChange={(e) => setNewOriginChannel(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
              >
                <option value="WhatsApp / Social Forward">WhatsApp / Social Forward</option>
                <option value="Citizen Rumor Check Desk">Citizen Rumor Check Desk</option>
                <option value="Local SMS / Voice Note">Local SMS / Voice Note</option>
                <option value="Field Radio Query">Field Radio Query</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold"
            >
              Add to Fact-Check Queue
            </button>
          </div>
        </form>
      )}

      {misinfoList.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-2.5">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            No Flagged Rumors Waiting for Review
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            When citizens submit a forwarded message in the Live Alerts Rumor Check box—or when an officer logs a claim above—it appears here in real time for verification and public broadcast.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Left: Flagged Rumor List */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700 tabular-nums">
              Submitted Claims ({misinfoList.length})
            </div>
            <div className="divide-y divide-slate-100">
              {misinfoList.map((item) => {
                const isSelected = activeItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      isSelected ? 'bg-slate-100/90' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span className="truncate max-w-[140px]">{item.originChannel}</span>
                      <span
                        className={`font-semibold shrink-0 ${
                          item.humanReviewDecision === 'CONFIRMED_HOAX'
                            ? 'text-rose-700'
                            : item.humanReviewDecision === 'GENUINE_EMERGENCY'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {item.humanReviewDecision === 'CONFIRMED_HOAX'
                          ? 'False Rumor'
                          : item.humanReviewDecision === 'GENUINE_EMERGENCY'
                          ? 'Confirmed Alert'
                          : 'Needs Check'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                      {item.sourceText}
                    </p>
                    <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
                      {new Date(item.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Review & Public Bulletin Broadcast */}
          {activeItem && (
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="border-b border-slate-100 pb-4 space-y-1">
                <div className="text-xs text-slate-500">
                  Source: {activeItem.originChannel} · Logged{' '}
                  {new Date(activeItem.timestamp).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  "{activeItem.sourceText}"
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="font-semibold text-slate-800 mr-1">Verification Decision:</span>
                <button
                  type="button"
                  onClick={() => void handleReviewDecision('CONFIRMED_HOAX')}
                  className={`px-3.5 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                    activeItem.humanReviewDecision === 'CONFIRMED_HOAX'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Mark False Rumor
                </button>
                <button
                  type="button"
                  onClick={() => void handleReviewDecision('GENUINE_EMERGENCY')}
                  className={`px-3.5 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                    activeItem.humanReviewDecision === 'GENUINE_EMERGENCY'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Confirm Real Emergency
                </button>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-slate-900">
                    Official Public Fact-Check Bulletin
                  </label>
                  <span className="text-slate-500">
                    Publishes live to Citizen Alerts
                  </span>
                </div>

                <textarea
                  value={debunkSms}
                  onChange={(e) => setDebunkSms(e.target.value)}
                  rows={3}
                  placeholder="Write a clear verification note for citizens..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-900 leading-relaxed"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <span className="text-slate-500 text-[11px]">
                    Appears immediately in the Citizen Live Alerts feed across connected browsers.
                  </span>

                  <button
                    type="button"
                    onClick={() => void handlePublishPublicFactCheck()}
                    disabled={isBroadcasting || !debunkSms.trim()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isBroadcasting ? 'Publishing…' : 'Publish Fact-Check to Public Alerts'}
                    </span>
                  </button>
                </div>

                {broadcastSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Official fact-check published live to Citizen Alerts.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
