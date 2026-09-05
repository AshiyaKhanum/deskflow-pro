interface BarListItem {
  label: string;
  value: number;
  color?: string;
}

/**
 * A simple, accessible horizontal bar chart built from plain markup (no charting
 * library) - each bar is a labeled progress-style row so screen readers get the
 * exact number, not just a shape.
 */
export function BarList({ items, maxOverride }: { items: BarListItem[]; maxOverride?: number }) {
  const max = maxOverride ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item) => (
        <li key={item.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: 4 }}>
            <span>{item.label}</span>
            <span style={{ fontWeight: 600 }}>{item.value}</span>
          </div>
          <div
            className="bar-track"
            role="img"
            aria-label={`${item.label}: ${item.value}`}
          >
            <div
              className="bar-fill"
              style={{ width: `${Math.min(100, (item.value / max) * 100)}%`, background: item.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
