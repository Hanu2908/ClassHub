import React from 'react';

interface StatusCardProps {
    title: string;
    value?: React.ReactNode;
    icon?: React.ReactNode;
    onClick?: () => void;
    compact?: boolean;
}

export default function StatusCard({ title, value, icon, onClick, compact }: StatusCardProps) {
    return (
        <div
            className="status-card card"
            role={onClick ? 'button' : undefined}
            onClick={onClick}
            style={{ padding: compact ? '8px 10px' : 14, display: 'flex', alignItems: 'center', gap: 12, cursor: onClick ? 'pointer' : 'default' }}
        >
            {icon ? <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div> : null}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-mono-sm" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{title}</div>
                <div className="t-card-title" style={{
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    whiteSpace: typeof value === 'string' ? 'nowrap' : undefined,
                    overflow: typeof value === 'string' ? 'hidden' : undefined,
                    textOverflow: typeof value === 'string' ? 'ellipsis' : undefined
                }}>{value}</div>
            </div>
        </div>
    );
}
