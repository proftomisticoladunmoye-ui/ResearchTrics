/**
 * Abstract scholarly-network visualization for the hero (Spec §54).
 * Elegant nodes + edges — no stock lab photos, no cliché icons.
 * Decorative only: aria-hidden.
 */
export function NetworkHero({ className }: { className?: string }) {
  const nodes = [
    { x: 60, y: 80, r: 6, accent: true },
    { x: 160, y: 40, r: 4 },
    { x: 250, y: 120, r: 5, accent: true },
    { x: 120, y: 170, r: 4 },
    { x: 320, y: 70, r: 4 },
    { x: 360, y: 180, r: 6, accent: true },
    { x: 220, y: 220, r: 4 },
    { x: 40, y: 200, r: 3 },
    { x: 300, y: 250, r: 4 },
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 3],
    [1, 2],
    [1, 4],
    [2, 5],
    [2, 6],
    [3, 6],
    [3, 7],
    [4, 5],
    [6, 8],
    [5, 8],
  ];

  return (
    <svg
      viewBox="0 0 400 300"
      className={className}
      role="img"
      aria-label="Abstract visualization of a connected global research network"
    >
      <g stroke="#1456A0" strokeOpacity="0.35" strokeWidth="1.25">
        {edges.map(([a, b], i) => {
          const na = nodes[a];
          const nb = nodes[b];
          if (!na || !nb) return null;
          return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} />;
        })}
      </g>
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.accent ? '#C9A227' : '#0B3A82'} />
      ))}
    </svg>
  );
}
