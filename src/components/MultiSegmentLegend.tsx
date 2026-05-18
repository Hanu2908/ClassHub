interface Segment {
    label: string;
    color?: string;
}

export default function MultiSegmentLegend({ segments }: { segments: Segment[] }) {
    return (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {segments.map((s, i) => (
                <div key={s.label + i} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color ?? 'var(--accent-primary)', flexShrink: 0 }} />
                    <span style={{ font: '400 12px var(--font-body)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 96 }}>{s.label}</span>
                </div>
            ))}
        </div>
    );
}
