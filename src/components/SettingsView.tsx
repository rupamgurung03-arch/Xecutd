import React, { useRef, useState } from 'react';
import { Download, Sun, Moon, Upload, Check, LogOut, X } from 'lucide-react';
import { UserSettings, Trade } from '../types/trade';
import { AVATAR_PRESETS, ProfileAvatar } from './ProfileAvatar';

interface SettingsViewProps {
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  trades: Trade[];
  onImportTrades: (imported: Trade[]) => void;
  onSignOut: () => Promise<void>;
}

const isTradeArray = (value: unknown): value is Trade[] =>
  Array.isArray(value) && value.every((item) =>
    item && typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.symbol === 'string' &&
    typeof item.entryDate === 'string' &&
    typeof item.entryPrice === 'number' &&
    typeof item.pnl === 'number'
  );

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, setSettings, trades, onImportTrades, onSignOut }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const journalTimeZone = settings.journalTimeZone || deviceTimeZone;
  const timeZones = [
    ['UTC', 'UTC'],
    ['America/New_York', 'New York'],
    ['America/Chicago', 'Chicago'],
    ['America/Denver', 'Denver'],
    ['America/Los_Angeles', 'Los Angeles'],
    ['Europe/London', 'London'],
    ['Europe/Paris', 'Paris'],
    ['Asia/Dubai', 'Dubai'],
    ['Asia/Kolkata', 'Mumbai / Kolkata'],
    ['Asia/Singapore', 'Singapore'],
    ['Asia/Tokyo', 'Tokyo'],
    ['Australia/Sydney', 'Sydney'],
  ].filter(([zone]) => zone !== deviceTimeZone) as [string, string][];
  const handleExport = () => {
    const contents = JSON.stringify(trades, null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `xecutd-trades-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${trades.length} ${trades.length === 1 ? 'trade' : 'trades'}.`);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not process that image.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const profileImage = canvas.toDataURL('image/jpeg', 0.82);
      setSettings((current) => ({ ...current, profileImage }));
      setMessage('Profile picture updated and syncing to your journal.');
    } catch (uploadError) {
      setMessage(uploadError instanceof Error ? uploadError.message : 'Could not load that image.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isTradeArray(parsed)) {
        setMessage('That file is not a valid Xecutd trade export.');
        return;
      }
      if (!window.confirm(`Import ${parsed.length} trades? This replaces the trades currently saved in this journal.`)) return;
      onImportTrades(parsed);
      setMessage(`Imported ${parsed.length} ${parsed.length === 1 ? 'trade' : 'trades'}.`);
    } catch {
      setMessage('Could not read that JSON file. Your journal was not changed.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="font-caption-mono text-caption-mono uppercase tracking-[.16em] text-tertiary">Settings</p>
        <h1 className="font-headline-lg text-headline-lg font-semibold tracking-tight text-on-surface">Your preferences</h1>
        <p className="max-w-2xl font-body-md text-body-md text-tertiary">A few simple controls for how Xecutd looks and how you keep a copy of your trades.</p>
      </header>

      <section className="border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:p-6" aria-labelledby="profile-heading">
        <div className="mb-5">
          <h2 id="profile-heading" className="font-headline-md text-headline-md font-semibold text-on-surface">Profile</h2>
          <p className="mt-1 font-body-sm text-body-sm text-tertiary">Your name and picture sync with your journal account across browsers.</p>
        </div>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ProfileAvatar name={settings.traderName} preset={settings.avatarPreset} image={settings.profileImage} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <label htmlFor="profile-name" className="block font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">
              Profile name
              <input id="profile-name" type="text" maxLength={48} value={settings.traderName} onChange={(event) => setSettings((current) => ({ ...current, traderName: event.target.value }))} className="mt-2 min-h-11 w-full border border-outline-variant bg-surface-container-low px-3 font-body-sm text-on-surface outline-none focus:border-on-surface sm:max-w-md" placeholder="Your name" />
            </label>
            <div>
              <p className="mb-2 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">Default pictures</p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PRESETS.map(({ id, label }) => (
                  <button key={id} type="button" aria-label={`${label} avatar`} aria-pressed={!settings.profileImage && settings.avatarPreset === id} onClick={() => { setSettings((current) => ({ ...current, avatarPreset: id, profileImage: undefined })); setMessage(`${label} profile picture selected.`); }} className={`border p-1 transition-colors ${!settings.profileImage && (settings.avatarPreset ?? 'signal') === id ? 'border-primary' : 'border-outline-variant hover:border-on-surface'}`}>
                    <ProfileAvatar name={settings.traderName} preset={id} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={(event) => { void handleAvatarUpload(event); }} className="hidden" />
              <button type="button" onClick={() => avatarInputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 border border-outline-variant bg-surface-container-low px-3 py-2 font-caption-mono text-caption-mono uppercase tracking-wider text-on-surface hover:bg-surface-container"><Upload size={15} aria-hidden="true" /> Upload picture</button>
              {settings.profileImage && <button type="button" onClick={() => { setSettings((current) => ({ ...current, profileImage: undefined })); setMessage('Using your selected default picture.'); }} className="inline-flex min-h-10 items-center gap-2 border border-outline-variant px-3 py-2 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary hover:text-on-surface"><X size={14} aria-hidden="true" /> Remove upload</button>}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:p-6" aria-labelledby="appearance-heading">
        <div className="mb-5">
          <h2 id="appearance-heading" className="font-headline-md text-headline-md font-semibold text-on-surface">Appearance</h2>
          <p className="mt-1 font-body-sm text-body-sm text-tertiary">Choose the theme you prefer. Your choice syncs with your journal account.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={settings.theme === 'light'}
            onClick={() => setSettings((current) => ({ ...current, theme: 'light' }))}
            className={`flex min-h-16 items-center gap-3 rounded-xl border p-4 text-left transition-colors ${settings.theme === 'light' ? 'border-[#e30613] bg-[#e30613] text-white shadow-[0_4px_16px_rgba(227,6,19,.18)]' : 'border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container'}`}
          >
            <Sun size={19} aria-hidden="true" />
            <span className="font-body-md text-body-md font-semibold">Chalk Ceramic</span>
            {settings.theme === 'light' && <Check size={17} className="ml-auto text-white" aria-label="Selected" />}
          </button>
          <button
            type="button"
            aria-pressed={settings.theme === 'dark'}
            onClick={() => setSettings((current) => ({ ...current, theme: 'dark' }))}
            className={`flex min-h-16 items-center gap-3 rounded-xl border p-4 text-left transition-colors ${settings.theme === 'dark' ? 'border-[#e30613] bg-[#e30613] text-white shadow-[0_4px_16px_rgba(227,6,19,.18)]' : 'border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container'}`}
          >
            <Moon size={19} aria-hidden="true" />
            <span className="font-body-md text-body-md font-semibold">Matte Obsidian</span>
            {settings.theme === 'dark' && <Check size={17} className="ml-auto text-white" aria-label="Selected" />}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:p-6" aria-labelledby="time-zone-heading">
        <div className="mb-5">
          <h2 id="time-zone-heading" className="font-headline-md text-headline-md font-semibold text-on-surface">Journal time</h2>
          <p className="mt-1 font-body-sm text-body-sm text-tertiary">Choose the time zone shown in the journal header. Market session clocks keep their exchange time zones.</p>
        </div>
        <label htmlFor="journal-time-zone" className="mb-2 block font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">Journal time zone</label>
        <select id="journal-time-zone" value={journalTimeZone} onChange={(event) => setSettings((current) => ({ ...current, journalTimeZone: event.target.value }))} className="min-h-11 w-full max-w-md border border-outline-variant bg-surface-container-low px-3 py-2 font-body-sm text-on-surface outline-none focus:border-on-surface">
          <option value={deviceTimeZone}>Device local ({deviceTimeZone})</option>
          {timeZones.map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}
        </select>
      </section>
      <section className="flex flex-col gap-4 border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="account-heading">
        <div>
          <h2 id="account-heading" className="font-headline-md text-headline-md font-semibold text-on-surface">Account</h2>
          <p className="mt-1 font-body-sm text-body-sm text-tertiary">Sign out of this journal on this device.</p>
        </div>
        <button type="button" onClick={() => { void onSignOut(); }} className="inline-flex min-h-11 items-center justify-center gap-2 border border-outline-variant bg-surface-container-low px-4 py-2 font-body-sm text-body-sm font-semibold text-on-surface transition hover:bg-surface-container">
          <LogOut size={16} aria-hidden="true" /> Sign out
        </button>
      </section>
      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:p-6" aria-labelledby="data-heading">
        <div className="mb-5">
          <h2 id="data-heading" className="font-headline-md text-headline-md font-semibold text-on-surface">Trade data</h2>
          <p className="mt-1 font-body-sm text-body-sm text-tertiary">Your journal syncs to your Supabase account. Download a JSON copy or restore trades from a previous Xecutd export.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-body-sm text-body-sm font-semibold text-on-primary transition hover:opacity-90"
          >
            <Download size={17} aria-hidden="true" /> Export trades ({trades.length})
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 font-body-sm text-body-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            <Upload size={17} aria-hidden="true" /> Import trades
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
        </div>
        <p className="mt-3 min-h-5 font-body-sm text-body-sm text-tertiary" role="status" aria-live="polite">{message || 'Import replaces the trades in this journal after confirmation.'}</p>
      </section>
    </div>
  );
};
