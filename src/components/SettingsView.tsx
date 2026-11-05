import React, { useRef, useState } from 'react';
import { Download, Sun, Moon, Upload, Check, LogOut, X, Mail, Bug, MessageSquareText, FileSpreadsheet } from 'lucide-react';
import packageInfo from '../../package.json';
import { UserSettings, Trade } from '../types/trade';
import { AVATAR_PRESETS, ProfileAvatar } from './ProfileAvatar';

interface SettingsViewProps {
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  trades: Trade[];
  onImportTrades: (imported: Trade[]) => void;
  onSignOut: () => Promise<void>;
  accountEmail: string;
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

const escapeXml = (value: string) => value
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const makeStoredZip = (files: Array<[string, string]>) => {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const [path, contents] of files) {
    const name = encoder.encode(path);
    const data = encoder.encode(contents);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  const parts = [...localParts, ...centralParts, end];
  const zip = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { zip.set(part, offset); offset += part.length; }
  return zip;
};

const createTradesWorkbook = (trades: Trade[]) => {
  const columns: Array<[string, (trade: Trade) => unknown]> = [
    ['Trade ID', (t) => t.id], ['Record type', (t) => t.tradeStatus || 'EXECUTED'], ['Status', (t) => t.status],
    ['Entry type', (t) => t.entryOrderType], ['Missed reason', (t) => t.missedReason], ['Hypothetical outcome', (t) => t.hypotheticalOutcome],
    ['Symbol', (t) => t.symbol], ['Asset class', (t) => t.assetClass], ['Side', (t) => t.side], ['Session', (t) => t.session],
    ['Entry date', (t) => t.entryDate], ['Entry time', (t) => t.entryTime], ['Exit date', (t) => t.exitDate], ['Exit time', (t) => t.exitTime],
    ['Entry price', (t) => t.entryPrice], ['Exit price', (t) => t.exitPrice], ['Stop loss', (t) => t.stopLoss], ['Take profit', (t) => t.takeProfit],
    ['Quantity', (t) => t.quantity], ['Risk amount', (t) => t.riskAmount], ['Fees', (t) => t.fee], ['Net P&L', (t) => t.pnl], ['P&L %', (t) => t.pnlPercent],
    ['Planned R', (t) => t.plannedR], ['Planned R:R', (t) => t.plannedRR], ['Realized R', (t) => t.realizedR], ['Setup', (t) => t.setup],
    ['Timeframe', (t) => t.timeframe], ['Plan followed', (t) => t.rulesFollowed], ['Discipline score', (t) => t.disciplineScore], ['Emotion', (t) => t.emotion],
    ['Psychology tags', (t) => t.psychologyTags], ['Mistakes', (t) => t.mistakes], ['Execution quality', (t) => t.executionQuality], ['Trade grade', (t) => t.tradeGrade],
    ['MAE price', (t) => t.maxAdversePrice], ['MFE price', (t) => t.maxFavorablePrice], ['MAE R', (t) => t.maeR], ['MFE R', (t) => t.mfeR],
    ['Notes', (t) => t.notes], ['Tags / events', (t) => t.tags], ['Chart link', (t) => t.linkUrl], ['Screenshot attached', (t) => Boolean(t.imageUrl)],
  ];
  const columnName = (index: number) => {
    let name = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return name;
  };
  const cellXml = (reference: string, value: unknown, header = false) => {
    const style = header ? ' s="1"' : '';
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}"${style} t="n"><v>${value}</v></c>`;
    const text = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value);
    return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
  };
  const rows = [columns.map(([heading], index) => cellXml(`${columnName(index)}1`, heading, true)).join(''), ...trades.map((trade, rowIndex) => columns.map(([, getValue], colIndex) => cellXml(`${columnName(colIndex)}${rowIndex + 2}`, getValue(trade))).join(''))];
  const lastColumn = columnName(columns.length - 1);
  const lastRow = Math.max(1, trades.length + 1);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns.map((_, index) => `<col min="${index + 1}" max="${index + 1}" width="18" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((row, index) => `<row r="${index + 1}">${row}</row>`).join('')}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE30613"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files: Array<[string, string]> = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Trades" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', styles], ['xl/worksheets/sheet1.xml', sheet],
  ];
  return new Blob([makeStoredZip(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, setSettings, trades, onImportTrades, onSignOut, accountEmail }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const bugReportHref = `mailto:xecutddev03@gmail.com?subject=${encodeURIComponent('Xecutd bug report')}&body=${encodeURIComponent(`App version: ${packageInfo.version}\nPage: ${window.location.pathname}\n\nWhat happened?\n\nSteps to reproduce:\n\nExpected result:\n\nActual result:`)}`;
  const feedbackHref = `mailto:xecutddev03@gmail.com?subject=${encodeURIComponent('Feedback for Xecutd')}`;
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

  const handleExcelExport = () => {
    const url = URL.createObjectURL(createTradesWorkbook(trades));
    const link = document.createElement('a');
    link.href = url;
    link.download = `xecutd-trades-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`Exported ${trades.length} ${trades.length === 1 ? 'trade' : 'trades'} to Excel.`);
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:gap-6">
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
          <p className="mt-1 font-body-sm text-body-sm text-tertiary">{accountEmail || 'Signed-in account'} · Sign out of this journal on this device.</p>
        </div>
        <button type="button" onClick={() => { void onSignOut(); }} className="inline-flex min-h-11 items-center justify-center gap-2 border border-outline-variant bg-surface-container-low px-4 py-2 font-body-sm text-body-sm font-semibold text-on-surface transition hover:bg-surface-container">
          <LogOut size={16} aria-hidden="true" /> Sign out
        </button>
      </section>
      <section className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="support-heading">
        <div>
          <h2 id="support-heading" className="font-headline-md text-headline-md font-semibold text-on-surface">Support</h2>
          <p className="mt-1 font-body-sm text-body-sm text-tertiary">Questions or feedback? Send us an email and we’ll get back to you.</p>
          <a href="mailto:xecutddev03@gmail.com" className="mt-2 inline-flex items-center gap-2 font-body-sm text-body-sm font-semibold text-on-surface underline decoration-outline-variant underline-offset-4 hover:decoration-on-surface"><Mail size={14} aria-hidden="true" /> xecutddev03@gmail.com</a>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <a href={bugReportHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 font-body-sm text-body-sm font-semibold text-on-surface transition hover:bg-surface-container"><Bug size={16} aria-hidden="true" /> Report a bug</a>
          <a href={feedbackHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 font-body-sm text-body-sm font-semibold text-on-surface transition hover:bg-surface-container"><MessageSquareText size={16} aria-hidden="true" /> Send feedback</a>
        </div>
      </section>
      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:p-6" aria-labelledby="help-heading">
        <div className="mb-4">
          <h2 id="help-heading" className="font-headline-md text-headline-md font-semibold text-on-surface">Quick help</h2>
          <p className="mt-1 font-body-sm text-body-sm text-tertiary">A few quick answers for common journal issues.</p>
        </div>
        <div className="divide-y divide-outline-variant/70">
          <details className="group py-3 first:pt-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">I can’t sign in or use Google login<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">Check your email and password, or make sure Google sign-in is enabled for this Supabase project. If you recently changed devices or URLs, the app URL may need to be allowed in Supabase Auth settings.</p>
          </details>
          <details className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">My journal isn’t syncing<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">Confirm you’re online and signed into the same account on both devices. Check the sync status at the bottom of the app; if it reports an issue, refresh and try again before making more changes.</p>
          </details>
          <details className="group py-3 last:pb-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">How do I keep a backup of my trades?<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">Open Trade data below and choose Export trades to download a JSON backup. Store it somewhere private; importing a backup replaces the trades in the active journal.</p>
          </details>
          <details className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">What does R multiple mean?<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">R compares your result with your initial risk. If you risked $100, a +2R result means about $200 profit; −1R means about $100 loss.</p>
          </details>
          <details className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">What is a missed trade?<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">It records a setup you planned but didn’t execute. Its hypothetical result can inform the Flawless Execution Curve, but it never changes actual P&amp;L or account balance.</p>
          </details>
          <details className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">What does Discipline Gap show?<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">It compares actual results with a reference curve that counts on-plan executed trades and eligible missed setups. It is a review aid, not a prediction of what you would definitely have earned.</p>
          </details>
          <details className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">How is plan adherence calculated?<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">It is the percentage of executed trades in the selected period that you marked as following your plan. It reflects the trades you logged and tagged.</p>
          </details>
          <details className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">What are MFE and MAE?<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">MFE is the furthest price moved in your favor while the trade was open. MAE is the furthest it moved against you. Add those prices to review how the trade moved before exit.</p>
          </details>
          <details className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">What is Profit Factor?<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">It divides total gross profit by total gross loss for the selected trades. Above 1 means gross profits exceeded gross losses in that sample; it does not guarantee future results.</p>
          </details>
          <details className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">What’s the difference between strategies and tags?<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">A strategy is the named setup you want to track, such as “FVG retest.” Tags add details like timeframe, confirmation, or market condition. You can create your own strategies in Playbook.</p>
          </details>
          <details className="group py-3 last:pb-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body-sm text-body-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">How do session results work?<span className="material-symbols-outlined text-body-sm text-tertiary transition-transform group-open:rotate-180">expand_more</span></summary>
            <p className="mt-2 max-w-3xl font-body-sm text-body-sm leading-relaxed text-tertiary">Trades are grouped by the session selected when you log them. D, W, M, and ALL change the time period used for the session summaries.</p>
          </details>
        </div>
      </section>
      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:p-6" aria-labelledby="data-heading">
        <div className="mb-5">
          <h2 id="data-heading" className="font-headline-md text-headline-md font-semibold text-on-surface">Trade data</h2>
          <p className="mt-1 font-body-sm text-body-sm text-tertiary">Your journal syncs to your Supabase account. Download a JSON copy or restore trades from a previous Xecutd export.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-body-sm text-body-sm font-semibold text-on-primary transition hover:opacity-90"
          >
            <Download size={17} aria-hidden="true" /> Export trades ({trades.length})
          </button>
          <button
            type="button"
            onClick={handleExcelExport}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 font-body-sm text-body-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            <FileSpreadsheet size={17} aria-hidden="true" /> Export Excel (.xlsx)
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
