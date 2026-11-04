import React, { useState, useEffect } from 'react';
import { UserSettings, Trade } from '../types/trade';
import { ProfileAvatar } from './ProfileAvatar';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNewTrade: () => void;
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  trades?: Trade[];
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  onOpenNewTrade,
  settings,
  setSettings,
  trades = [],
}) => {
  // This clock uses the chosen journal display zone. Session clocks elsewhere remain tied to their exchange zones.
  const [journalTime, setJournalTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeZone = settings.journalTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      setJournalTime(new Intl.DateTimeFormat(undefined, { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(now));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [settings.journalTimeZone]);

  // Compute today's P&L (or most recent session)
  const todayPnL = React.useMemo(() => {
    if (!trades || trades.length === 0) return { amount: 0, pct: 0 };
    // Get latest trade date
    const dates = trades.map((t) => t.entryDate).filter(Boolean).sort();
    const latestDate = dates[dates.length - 1];
    const latestTrades = trades.filter((t) => t.entryDate === latestDate && t.tradeStatus !== 'MISSED');
    const sum = latestTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const pct = ((sum / 50000) * 100).toFixed(1);
    return {
      amount: sum,
      pct: parseFloat(pct),
    };
  }, [trades]);

  const navItems = [
    { id: 'dashboard', label: 'DASHBOARD' },
    { id: 'trades', label: 'TRADES LEDGER' },
    { id: 'calendar', label: 'CALENDAR' },
    { id: 'playbook', label: 'PLAYBOOK' },
    { id: 'analysis', label: 'ANALYSIS' },
    { id: 'coach', label: 'BUDDY' },
  ];

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    setSettings((prev) => ({ ...prev, theme: nextTheme }));
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-white/90 dark:bg-surface/90 backdrop-blur-xl shadow-xs border-b border-outline-variant/80">
      <div className="h-14 sm:h-16 w-full px-3 sm:px-gutter-desktop flex items-center justify-between gap-2 sm:gap-space-md">
        
        {/* Brand & Market Telemetry */}
        <div className="flex min-w-0 items-center gap-space-sm shrink">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="flex min-w-0 items-center gap-2 sm:gap-3 text-left focus:outline-none group cursor-pointer"
          >
            <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 overflow-hidden rounded-full border border-outline-variant bg-black shadow-inner group-hover:border-primary-container transition-colors">
              <img src="/icons/xecutd-logo.svg" alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xs sm:text-body-md font-bold tracking-wider text-on-surface uppercase whitespace-nowrap">
                XECUTD
              </span>
              <div className="flex items-center gap-space-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
                <span className="max-w-[11rem] truncate font-caption-mono text-caption-mono text-tertiary uppercase">{settings.traderName.trim() ? `${settings.traderName.trim()}'s Journal` : 'Your Journal'}</span>
                <span className="hidden sm:inline text-outline-variant text-caption-mono">•</span>
                <span className="hidden md:inline font-caption-mono text-caption-mono text-on-surface-variant font-medium">
                  {journalTime || '--:--:--'}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Center Pill Nav Bar */}
        <nav className="hidden lg:flex shrink-0 items-center bg-surface-container-low p-space-xs rounded-full gap-space-xs border border-outline-variant/60">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'settings') {
                    setCurrentTab('settings');
                  } else {
                    setCurrentTab(item.id);
                  }
                }}
                className={`px-2 py-1.5 shrink-0 whitespace-nowrap rounded-full border border-transparent transition-colors tracking-wide text-xs uppercase font-caption-mono font-semibold cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-surface-container-high text-on-surface shadow-xs border-outline-variant/60'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-1.5 sm:gap-space-md shrink-0">
          {/* Daily P&L readout */}
          <div className="hidden md:flex items-center gap-space-sm bg-surface-container-low px-space-md py-1.5 rounded-full border border-outline-variant/80">
            <span className="font-caption-mono text-caption-mono text-tertiary uppercase">DAILY P&amp;L</span>
            <span
              className={`font-table-data text-table-data font-bold ${
                todayPnL.amount >= 0 ? 'text-success' : 'text-secondary'
              }`}
            >
              {todayPnL.amount >= 0 ? '+' : ''}${Math.abs(todayPnL.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="font-caption-mono text-caption-mono text-tertiary font-semibold">
              ({todayPnL.pct >= 0 ? '+' : ''}{todayPnL.pct}%)
            </span>
          </div>

          {/* Log Trade CTA button */}
          <button
            onClick={onOpenNewTrade}
            title="Log a trade"
            aria-label="Log a trade"
            className="flex items-center justify-center gap-space-xs bg-primary text-on-primary hover:bg-neutral-800 transition-transform active:scale-95 px-2 sm:px-space-md py-1.5 rounded-full shadow-sm cursor-pointer"
          >
            <span className="hidden sm:block w-2 h-2 rounded-full bg-secondary-container shrink-0"></span>
            <span className="material-symbols-outlined sm:hidden text-lg leading-none">add</span>
            <span className="hidden sm:inline font-headline-md text-body-sm font-semibold tracking-wider uppercase text-on-primary whitespace-nowrap">
              LOG TRADE
            </span>
          </button>

          {/* Theme switcher button */}
          <button
            onClick={toggleTheme}
            title={settings.theme === 'dark' ? 'Switch to Studio White (Light Theme)' : 'Switch to Matte Obsidian (Dark Theme)'}
            className="w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center transition-colors text-on-surface-variant hover:text-on-surface cursor-pointer border border-outline-variant/60"
          >
            <span className="material-symbols-outlined text-body-md">
              {settings.theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Profile avatar */}
          <button
            onClick={() => setCurrentTab('settings')}
            title={settings.traderName || 'Profile settings'}
            aria-label={`Open profile settings${settings.traderName ? ` for ${settings.traderName}` : ''}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-outline-variant bg-surface-container-low p-0.5 hover:border-primary-container transition-colors cursor-pointer"
          >
            <ProfileAvatar name={settings.traderName} preset={settings.avatarPreset} image={settings.profileImage} />
          </button>
        </div>

      </div>

      {/* Mobile Nav strip */}
      <nav aria-label="Journal sections" className="mobile-nav-scroll flex w-full max-w-full min-w-0 lg:hidden overflow-x-auto overscroll-x-contain px-2 sm:px-4 py-1.5 sm:py-2 border-t border-surface-container-high/40 gap-0.5 sm:gap-1 bg-surface-container-low">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`px-2 sm:px-3 py-1 rounded-full font-caption-mono text-[9px] sm:text-caption-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-surface-container-high text-on-surface font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
