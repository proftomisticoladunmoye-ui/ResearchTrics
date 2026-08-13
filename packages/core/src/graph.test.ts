import { describe, it, expect } from 'vitest';
import { shortestPath, type GraphEdge } from './graph';

/** Build a small symmetric adjacency for tests, each edge carrying a reason. */
function adj(
  links: Array<[string, string, string]>,
): Map<string, Array<{ to: string; edge: GraphEdge }>> {
  const m = new Map<string, Array<{ to: string; edge: GraphEdge }>>();
  const add = (a: string, b: string, label: string) => {
    if (!m.has(a)) m.set(a, []);
    m.get(a)!.push({ to: b, edge: { source: a, target: b, type: 'co_authored', label } });
  };
  for (const [a, b, label] of links) {
    add(a, b, label);
    add(b, a, label);
  }
  return m;
}

describe('shortestPath (explainable connection, Spec §29)', () => {
  const graph = adj([
    ['A', 'B', 'A & B co-authored X'],
    ['B', 'C', 'B & C co-authored Y'],
    ['C', 'D', 'C & D at same institution'],
    ['A', 'E', 'A & E co-authored Z'],
  ]);

  it('returns an empty path for identical endpoints', () => {
    expect(shortestPath(graph, 'A', 'A')).toEqual([]);
  });

  it('finds a direct 1-hop connection with its reason', () => {
    const path = shortestPath(graph, 'A', 'B');
    expect(path).not.toBeNull();
    expect(path!).toHaveLength(1);
    expect(path![0]!.edge.label).toBe('A & B co-authored X');
  });

  it('finds the shortest multi-hop path', () => {
    const path = shortestPath(graph, 'A', 'C');
    expect(path!.map((s) => s.to)).toEqual(['B', 'C']); // A→B→C, not via E
  });

  it('returns null when unreachable within maxHops', () => {
    // A→B→C→D is 3 hops; cap at 2 makes D unreachable.
    expect(shortestPath(graph, 'A', 'D', 2)).toBeNull();
  });

  it('returns null when there is no path at all', () => {
    const disjoint = adj([['A', 'B', 'x'], ['C', 'D', 'y']]);
    expect(shortestPath(disjoint, 'A', 'D')).toBeNull();
  });

  it('every step carries an explaining reason', () => {
    const path = shortestPath(graph, 'A', 'D')!;
    expect(path.length).toBeGreaterThan(0);
    expect(path.every((s) => s.edge.label.length > 0)).toBe(true);
  });
});
