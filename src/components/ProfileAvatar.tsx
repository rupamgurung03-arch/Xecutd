import React from 'react';
import { Activity, BarChart3, CandlestickChart, Crosshair, Radio } from 'lucide-react';

export const AVATAR_PRESETS = [
  { id: 'signal', label: 'Signal', color: '#e30613', Icon: Activity },
  { id: 'market', label: 'Market', color: '#202124', Icon: CandlestickChart },
  { id: 'focus', label: 'Focus', color: '#315c9b', Icon: Crosshair },
  { id: 'volume', label: 'Volume', color: '#a45a12', Icon: BarChart3 },
  { id: 'pulse', label: 'Pulse', color: '#6b4c8a', Icon: Radio },
] as const;

interface ProfileAvatarProps {
  name: string;
  preset?: string;
  image?: string;
  size?: 'sm' | 'lg';
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ name, preset = 'signal', image, size = 'sm' }) => {
  const selected = AVATAR_PRESETS.find((item) => item.id === preset) ?? AVATAR_PRESETS[0];
  const Icon = selected.Icon;
  const sizeClass = size === 'lg' ? 'h-24 w-24' : 'h-8 w-8';
  return (
    <span className={`inline-flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden border border-outline-variant bg-surface-container-low text-on-surface`} aria-label={`${name || 'Trader'} profile picture`}>
      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : (
        <span className="flex h-full w-full items-center justify-center text-white" style={{ backgroundColor: selected.color }}>
          <Icon size={size === 'lg' ? 34 : 17} strokeWidth={1.8} aria-hidden="true" />
        </span>
      )}
    </span>
  );
};
