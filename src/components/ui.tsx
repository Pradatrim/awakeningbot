/* Small shared UI pieces. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function TopBar({ title, onBack }: { title?: string; onBack?: () => void }) {
  const nav = useNavigate();
  return (
    <div className="topbar">
      <button className="back" aria-label="Go back" onClick={onBack ?? (() => nav(-1))}>
        ‹
      </button>
      {title && <h3 style={{ flex: 1 }}>{title}</h3>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="screen center-col fade-in" style={{ justifyContent: 'center' }}>
      <div className="pop" style={{ fontSize: 48 }}>🌅</div>
      <h2>{label}</h2>
    </div>
  );
}

export function Dots({ count, active }: { count: number; active: number }) {
  return (
    <div className="dots" aria-label={`Step ${active + 1} of ${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`dot${i === active ? ' on' : ''}`} />
      ))}
    </div>
  );
}

export function Choice({
  emoji,
  label,
  selected,
  onClick,
}: {
  emoji?: string;
  label: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`choice${selected ? ' selected' : ''}`} onClick={onClick} aria-pressed={selected}>
      {emoji && <span className="emoji">{emoji}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 26, color: selected ? 'var(--sun-deep)' : 'var(--line)' }}>
        {selected ? '●' : '○'}
      </span>
    </button>
  );
}
