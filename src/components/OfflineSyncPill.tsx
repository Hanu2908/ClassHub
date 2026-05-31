import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react';

export default function OfflineSyncPill() {
  const syncStatus = useAppStore((s) => s.syncStatus);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (syncStatus === 'online') {
      setVisible(false);
    } else {
      setVisible(true);
    }
  }, [syncStatus]);

  if (!visible) return null;

  let bgClass = '';
  let borderClass = '';
  let textClass = '';
  let glowClass = '';
  let label = '';
  let Icon = WifiOff;
  let animateClass = '';

  switch (syncStatus) {
    case 'offline':
      bgClass = 'bg-amber-950/75 backdrop-blur-md';
      borderClass = 'border-amber-500/30';
      textClass = 'text-amber-200';
      glowClass = 'shadow-[0_0_15px_rgba(245,158,11,0.15)]';
      label = 'Offline Mode';
      Icon = WifiOff;
      break;
    case 'syncing':
      bgClass = 'bg-blue-950/75 backdrop-blur-md';
      borderClass = 'border-blue-500/30';
      textClass = 'text-blue-200';
      glowClass = 'shadow-[0_0_15px_rgba(59,130,246,0.15)]';
      label = 'Syncing Updates...';
      Icon = RefreshCw;
      animateClass = 'animate-spin';
      break;
    case 'synced':
      bgClass = 'bg-emerald-950/75 backdrop-blur-md';
      borderClass = 'border-emerald-500/30';
      textClass = 'text-emerald-200';
      glowClass = 'shadow-[0_0_15px_rgba(16,185,129,0.15)]';
      label = 'Synced';
      Icon = CheckCircle;
      break;
    default:
      return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none animate-slide-down">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full border ${borderClass} ${bgClass} ${textClass} shadow-lg ${glowClass} transition-all duration-300`}
      >
        <Icon className={`w-3.5 h-3.5 ${animateClass}`} />
        <span className="text-xs font-semibold tracking-wide select-none">
          {label}
        </span>
      </div>
    </div>
  );
}
