import React, { useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Search,
  HeartHandshake,
  ShieldCheck,
  Ship,
  Send
} from 'lucide-react';
import {
  INDIAN_STATES_ONLY,
  INDIAN_UTS_ONLY,
  getDistrictsForState,
  formatLocationWithState
} from '../data/indianStates';
import {
  lookupFamilySafeCheckIn,
  registerCommunityVolunteer,
  submitFamilySafeCheckIn
} from '../services/realtimeClient';
import { FamilyCheckInStatus, VolunteerAssetType } from '../types/disaster';

export const FamilySafeCheckIn: React.FC = () => {
  // 1. Zero-PII "I Am Safe" Check-In Form State
  const [checkPhone, setCheckPhone] = useState('');
  const [checkPin, setCheckPin] = useState('');
  const [checkStatus, setCheckStatus] = useState<'SAFE' | 'AT_SHELTER' | 'NEEDS_ASSISTANCE'>('SAFE');
  const [checkState, setCheckState] = useState('Delhi');
  const [checkDistrict, setCheckDistrict] = useState('New Delhi');
  const [checkArea, setCheckArea] = useState('');
  const [checkFamilyCount, setCheckFamilyCount] = useState(1);
  const [checkNote, setCheckNote] = useState('');
  const [savedCheckIn, setSavedCheckIn] = useState<FamilyCheckInStatus | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  // 2. Relatives' PIN Lookup Form State
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupPin, setLookupPin] = useState('');
  const [lookupResult, setLookupResult] = useState<FamilyCheckInStatus | null>(null);
  const [lookupNotFound, setLookupNotFound] = useState(false);

  // 3. Community Boat & Supply Volunteer Registration State
  const [volName, setVolName] = useState('');
  const [volPhone, setVolPhone] = useState('');
  const [volAssetType, setVolAssetType] = useState<VolunteerAssetType>('rescue_boat');
  const [volAssetLabel, setVolAssetLabel] = useState('Motorized Rescue Boat');
  const [volState, setVolState] = useState('Delhi');
  const [volDistrict, setVolDistrict] = useState('New Delhi');
  const [volAvailability, setVolAvailability] = useState<'READY_NOW' | 'WITHIN_1H'>('READY_NOW');
  const [volNotes, setVolNotes] = useState('');
  const [volReceipt, setVolReceipt] = useState<{ id: string; masked: string } | null>(null);
  const [volError, setVolError] = useState<string | null>(null);

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckError(null);
    const res = await submitFamilySafeCheckIn({
      phone: checkPhone,
      pin: checkPin,
      status: checkStatus,
      shelterOrArea: checkArea.trim(),
      district: checkDistrict,
      stateName: checkState,
      familyCount: checkFamilyCount,
      note: checkNote.trim()
    });
    if (!res.ok || !res.checkIn) {
      setCheckError(res.error || 'Enter a 10-digit mobile number and 4-digit family PIN.');
      return;
    }
    setSavedCheckIn(res.checkIn);
  };

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupNotFound(false);
    setLookupResult(null);
    const res = await lookupFamilySafeCheckIn(lookupPhone, lookupPin);
    if (res.matched && res.checkIn) {
      setLookupResult(res.checkIn);
    } else {
      setLookupNotFound(true);
    }
  };

  const handleVolunteerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVolError(null);
    const res = await registerCommunityVolunteer({
      volunteerName: volName.trim(),
      phone: volPhone,
      assetType: volAssetType,
      assetLabel: volAssetLabel.trim(),
      capacityNotes: volNotes.trim(),
      district: volDistrict,
      stateName: volState,
      availability: volAvailability
    });
    if (!res.ok || !res.volunteerId) {
      setVolError(res.error || 'Please provide your name and 10-digit contact number.');
      return;
    }
    setVolReceipt({ id: res.volunteerId, masked: res.phoneMasked || '+91 ••••• ••••' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">
          Family "I Am Safe" Check-In &amp; Volunteer Registry
        </h2>
        <p className="text-sm text-slate-600 mt-0.5">
          Share your safety status privately with relatives using a 4-digit PIN, or register a boat, generator, vehicle, or medical skill with the Rescue Control Desk.
        </p>
      </div>

      {/* Zero-PII Family Safe Check-In + Lookup Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Post "I Am Safe" Status */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                1. Post Family "I Am Safe" Check-In
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Protected by a SHA-256 hash of your phone + 4-digit PIN. Never listed in a public directory.
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          </div>

          <form onSubmit={handleCheckInSubmit} className="space-y-3.5 text-xs">
            {checkError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-medium">
                {checkError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  10-Digit Mobile Number *
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={checkPhone}
                  onChange={(e) => setCheckPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile"
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono bg-white outline-none focus:border-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  4-Digit Family PIN *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={checkPin}
                  onChange={(e) => setCheckPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4-digit PIN"
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono bg-white outline-none focus:border-slate-900"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'SAFE', label: 'Safe at Home' },
                  { id: 'AT_SHELTER', label: 'At Relief Camp' },
                  { id: 'NEEDS_ASSISTANCE', label: 'Need Non-SOS Aid' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCheckStatus(opt.id)}
                  className={`py-2 px-2 rounded-lg border font-semibold text-center transition-colors ${
                    checkStatus === opt.id
                      ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">State / UT</label>
                <select
                  value={checkState}
                  onChange={(e) => {
                    const st = e.target.value;
                    setCheckState(st);
                    setCheckDistrict(getDistrictsForState(st)[0] || st);
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                >
                  <optgroup label="States (28)">
                    {INDIAN_STATES_ONLY.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Union Territories (8)">
                    {INDIAN_UTS_ONLY.map((u) => (
                      <option key={u.code} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">District</label>
                <select
                  value={checkDistrict}
                  onChange={(e) => setCheckDistrict(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                >
                  {getDistrictsForState(checkState).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-800 mb-1">
                  Current Relief Camp or Safe Area *
                </label>
                <input
                  type="text"
                  value={checkArea}
                  onChange={(e) => setCheckArea(e.target.value)}
                  placeholder="e.g., Community Hall Relief Camp / Sector 4"
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">People Safe</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={checkFamilyCount}
                  onChange={(e) => setCheckFamilyCount(Math.max(1, Number(e.target.value)))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono tabular-nums bg-white outline-none focus:border-slate-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Short Note for Relatives (Optional)
              </label>
              <input
                type="text"
                value={checkNote}
                onChange={(e) => setCheckNote(e.target.value)}
                placeholder="e.g., Reached safe shelter together; keeping phone on battery saver."
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Family Check-In</span>
            </button>
          </form>

          {savedCheckIn && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>Check-In Saved ({savedCheckIn.id})</span>
                <span className="font-mono">{savedCheckIn.maskedHint}</span>
              </div>
              <p className="text-[11px] text-emerald-900">
                Relatives with your 10-digit mobile number and 4-digit PIN can now confirm you are safe at{' '}
                <strong>{savedCheckIn.shelterOrArea}</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Lookup Relative Status */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  2. Check a Relative’s Safety Status
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Requires both the exact 10-digit mobile number and the 4-digit family PIN.
                </p>
              </div>
              <Lock className="w-5 h-5 text-slate-500 shrink-0" />
            </div>

            <form onSubmit={handleLookupSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Relative’s 10-Digit Mobile *
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono bg-white outline-none focus:border-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    4-Digit Family PIN *
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={lookupPin}
                    onChange={(e) => setLookupPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4-digit PIN"
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono bg-white outline-none focus:border-slate-900"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>Check Safety Status</span>
              </button>
            </form>

            {lookupNotFound && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                No check-in matched that mobile + PIN combination yet. Verify both numbers or call helpline 1070.
              </div>
            )}

            {lookupResult && (
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800">
                    {lookupResult.status === 'AT_SHELTER'
                      ? 'SAFE AT RELIEF CAMP'
                      : lookupResult.status === 'SAFE'
                      ? 'CONFIRMED SAFE'
                      : 'SAFE · REQUESTED ASSISTANCE'}
                  </span>
                  <span className="font-mono text-slate-600">{lookupResult.maskedHint}</span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {lookupResult.shelterOrArea} ·{' '}
                  {formatLocationWithState(lookupResult.district, lookupResult.stateName)}
                </div>
                <div className="text-slate-700 tabular-nums">
                  People Together: <strong>{lookupResult.familyCount}</strong> · Updated{' '}
                  {new Date(lookupResult.updatedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                {lookupResult.note && (
                  <p className="p-2.5 bg-white rounded-lg border border-emerald-200 text-slate-800">
                    "{lookupResult.note}"
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <span>
              Privacy Protection: ResQnet never stores raw phone numbers on the family board and never exposes public name lists.
            </span>
          </div>
        </div>
      </div>

      {/* Community Boat, Tractor & Paramedic Volunteer Registry */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Ship className="w-5 h-5 text-slate-900 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                3. Community Boat, Generator &amp; Volunteer Supply Registry
              </h3>
              <p className="text-xs text-slate-600">
                Register local boats, high-clearance vehicles, generators, drinking water, or paramedic skills. Contact numbers are visible strictly to authenticated Rescue Officers.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1 shrink-0">
            <HeartHandshake className="w-3.5 h-3.5" />
            Live Sync to Officer Desk
          </span>
        </div>

        {volReceipt ? (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-sm">
                Volunteer Resource Registered ({volReceipt.id})
              </div>
              <p className="text-emerald-900">
                Sent live to the Officer Control Desk ({volReceipt.masked}). Duty officers can verify and contact you if needed in {volDistrict}, {volState}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setVolReceipt(null);
                setVolNotes('');
              }}
              className="px-3.5 py-2 bg-white border border-emerald-300 rounded-lg font-semibold text-emerald-950 hover:bg-emerald-100 shrink-0"
            >
              Register Another Asset
            </button>
          </div>
        ) : (
          <form onSubmit={handleVolunteerSubmit} className="space-y-4 text-xs">
            {volError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-medium">
                {volError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Volunteer / Group Name *
                </label>
                <input
                  type="text"
                  value={volName}
                  onChange={(e) => setVolName(e.target.value)}
                  placeholder="Name or local group"
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  10-Digit Mobile (Officers Only) *
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={volPhone}
                  onChange={(e) => setVolPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile"
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono bg-white outline-none focus:border-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">Resource Type</label>
                <select
                  value={volAssetType}
                  onChange={(e) => {
                    const val = e.target.value as VolunteerAssetType;
                    setVolAssetType(val);
                    const defaults: Record<VolunteerAssetType, string> = {
                      rescue_boat: 'Motorized Rescue Boat',
                      tractor_suv: 'High-Clearance Tractor / 4x4',
                      medical_paramedic: 'Doctor / Nurse / Paramedic Volunteer',
                      generator_power: 'Generator / Power Backup Unit',
                      water_rations: 'Drinking Water & Cooked Meals'
                    };
                    setVolAssetLabel(defaults[val]);
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                >
                  <option value="rescue_boat">Country / Motor Boat</option>
                  <option value="tractor_suv">High-Clearance Tractor / 4x4</option>
                  <option value="medical_paramedic">Paramedic / Nurse / Doctor</option>
                  <option value="generator_power">Generator / Inverter Charging</option>
                  <option value="water_rations">Drinking Water / Cooked Meals</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">Readiness</label>
                <select
                  value={volAvailability}
                  onChange={(e) => setVolAvailability(e.target.value as 'READY_NOW' | 'WITHIN_1H')}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                >
                  <option value="READY_NOW">Ready Immediately</option>
                  <option value="WITHIN_1H">Available Within 1 Hour</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">State / UT</label>
                <select
                  value={volState}
                  onChange={(e) => {
                    const st = e.target.value;
                    setVolState(st);
                    setVolDistrict(getDistrictsForState(st)[0] || st);
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                >
                  <optgroup label="States (28)">
                    {INDIAN_STATES_ONLY.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Union Territories (8)">
                    {INDIAN_UTS_ONLY.map((u) => (
                      <option key={u.code} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">District</label>
                <select
                  value={volDistrict}
                  onChange={(e) => setVolDistrict(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                >
                  {getDistrictsForState(volState).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Equipment / Capacity Summary *
                </label>
                <input
                  type="text"
                  value={volAssetLabel}
                  onChange={(e) => setVolAssetLabel(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={volNotes}
                onChange={(e) => setVolNotes(e.target.value)}
                placeholder="Staging point, seating/fuel capacity, or medical kit details"
                className="flex-1 p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-slate-900"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg inline-flex items-center justify-center gap-2 transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit to Rescue Desk</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
