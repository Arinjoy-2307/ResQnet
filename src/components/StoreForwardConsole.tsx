import React from 'react';
import { StoreForwardMessage } from '../types/disaster';
import { LanguageCode } from '../services/i18n';
import { RefreshCw, Inbox } from 'lucide-react';

interface StoreForwardConsoleProps {
  language: LanguageCode;
  messages: StoreForwardMessage[];
  onSyncMessage: (msgId: string) => void;
  onSyncAllMessages: () => void;
}

function formatReadableStatusLabel(status: StoreForwardMessage['lastKnownSafeStatus']): string {
  switch (status) {
    case 'OXYGEN_NEEDED':
      return 'Needs Medical Oxygen';
    case 'NEED_RESCUE':
      return 'Needs Rescue Pickup';
    case 'WATER_RISING':
      return 'Rising Water Emergency';
    case 'SAFE':
    default:
      return 'Safety Check-In';
  }
}

export const StoreForwardConsole: React.FC<StoreForwardConsoleProps> = ({
  language: _language,
  messages,
  onSyncMessage,
  onSyncAllMessages
}) => {
  const pendingCount = messages.filter((m) => m.status === 'queued_locally').length;

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Offline SMS &amp; Low-Signal Queue
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Help requests queued during network outages or sent via SMS / <code className="font-mono">*1070#</code> that auto-sync when connectivity returns.
          </p>
        </div>

        {pendingCount > 0 && (
          <button
            type="button"
            onClick={onSyncAllMessages}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto tabular-nums"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Add All to Live Map ({pendingCount})</span>
          </button>
        )}
      </div>

      {/* Queued Messages */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700 tabular-nums">
          <span>Received Offline Messages ({messages.length})</span>
          <span className="text-slate-500 font-normal">SMS &amp; Auto-Synced SOS</span>
        </div>

        {messages.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
              <Inbox className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              No Queued Offline Messages Right Now
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              If a citizen submits an SOS while offline and reconnects—or dispatches an SMS / *1070# beacon—it appears here automatically so officers can add it to the rescue map.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {messages.map((msg) => (
              <div key={msg.id} className="p-4 space-y-1.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-500">
                    <strong className="text-slate-900">
                      {formatReadableStatusLabel(msg.lastKnownSafeStatus)}
                    </strong>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{msg.phoneNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span>via {msg.channel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {new Date(msg.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <span
                    className={`font-semibold ${
                      msg.status === 'synced'
                        ? 'text-emerald-700'
                        : msg.status === 'conflict_resolved'
                        ? 'text-slate-500'
                        : 'text-amber-700'
                    }`}
                  >
                    {msg.status === 'synced'
                      ? 'Added to Map'
                      : msg.status === 'conflict_resolved'
                      ? 'Superseded'
                      : 'Waiting'}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-mono bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200/80">
                  {msg.payload}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                  <span className="text-slate-500">Location: {msg.locationText}</span>

                  {msg.status === 'queued_locally' && (
                    <button
                      type="button"
                      onClick={() => onSyncMessage(msg.id)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
                    >
                      Add to Map
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
