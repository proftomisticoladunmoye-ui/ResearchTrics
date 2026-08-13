import { prisma, type PrismaClient } from '@researchtrics/db';
import { notFound } from './errors';

/**
 * Research graph (Phase 14, Spec §21, §29).
 *
 * The graph is a **live projection of verified records**, not a separate store:
 * every node is a real entity and every edge is derived from an existing
 * relationship (co-authorship, affiliation, group or project membership). This
 * keeps the graph grounded — no fabricated connections — and every edge and
 * connection path carries a human-readable explanation (Spec §29).
 */

export type GraphNodeType = 'researcher' | 'publication' | 'project' | 'institution' | 'group';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  slug?: string | undefined;
}

export type GraphEdgeType =
  | 'co_authored'
  | 'affiliated'
  | 'group_member'
  | 'project_member';

export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
  /** Human-readable reason this edge exists (Spec §29). */
  label: string;
}

export interface Graph {
  center: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------- Pure shortest-path (BFS) — tested without a database ----------

export interface Adjacency {
  /** For each researcher id, the reachable neighbours and the edge that links them. */
  get(id: string): Array<{ to: string; edge: GraphEdge }> | undefined;
}

export interface PathStep {
  from: string;
  to: string;
  edge: GraphEdge;
}

/**
 * Breadth-first shortest path between two researchers over a researcher-to-
 * researcher adjacency. Returns the ordered steps (each with its explaining
 * edge) or null if unreachable within `maxHops`. Pure and deterministic.
 */
export function shortestPath(
  adjacency: Map<string, Array<{ to: string; edge: GraphEdge }>>,
  from: string,
  to: string,
  maxHops = 4,
): PathStep[] | null {
  if (from === to) return [];
  const visited = new Set<string>([from]);
  const queue: Array<{ id: string; path: PathStep[] }> = [{ id: from, path: [] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (path.length >= maxHops) continue;
    for (const { to: next, edge } of adjacency.get(id) ?? []) {
      if (visited.has(next)) continue;
      const step: PathStep = { from: id, to: next, edge };
      const nextPath = [...path, step];
      if (next === to) return nextPath;
      visited.add(next);
      queue.push({ id: next, path: nextPath });
    }
  }
  return null;
}

// ---------- Ego graph (grounded projection) ----------

interface CoAuthorRow {
  otherId: string;
  otherName: string;
  otherSlug: string;
  pubId: string;
  pubTitle: string;
  pubSlug: string;
}

async function coAuthorEdges(
  researcherId: string,
  client: PrismaClient,
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const authorships = await client.publicationAuthor.findMany({
    where: { researcherId, publication: { deletedAt: null, visibility: 'public' } },
    select: {
      publication: {
        select: {
          id: true,
          title: true,
          slug: true,
          authors: {
            where: { researcherId: { not: null } },
            select: { researcherId: true, researcher: { select: { displayName: true, slug: true } } },
          },
        },
      },
    },
  });

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenNode = new Set<string>();
  const rows: CoAuthorRow[] = [];

  for (const a of authorships) {
    const pub = a.publication;
    for (const co of pub.authors) {
      if (!co.researcherId || co.researcherId === researcherId || !co.researcher) continue;
      rows.push({
        otherId: co.researcherId,
        otherName: co.researcher.displayName,
        otherSlug: co.researcher.slug,
        pubId: pub.id,
        pubTitle: pub.title,
        pubSlug: pub.slug,
      });
    }
  }

  for (const r of rows) {
    if (!seenNode.has(r.otherId)) {
      seenNode.add(r.otherId);
      nodes.push({ id: r.otherId, type: 'researcher', label: r.otherName, slug: r.otherSlug });
    }
    edges.push({
      source: researcherId,
      target: r.otherId,
      type: 'co_authored',
      label: `Co-authored "${r.pubTitle}"`,
    });
  }
  return { nodes, edges };
}

/**
 * Build the ego graph around a researcher: their co-authors, affiliated
 * institutions, research groups, and projects — every edge explained.
 */
export async function buildResearcherEgoGraph(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<Graph> {
  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    select: {
      id: true,
      displayName: true,
      slug: true,
      affiliations: {
        select: { institution: { select: { id: true, name: true, slug: true } } },
      },
      groupMemberships: {
        select: { group: { select: { id: true, name: true, slug: true } } },
      },
      projectsLed: {
        where: { deletedAt: null, visibility: 'public' },
        select: { id: true, title: true, slug: true },
      },
      projectMemberships: {
        where: { project: { deletedAt: null, visibility: 'public' } },
        select: { project: { select: { id: true, title: true, slug: true } } },
      },
    },
  });
  if (!researcher) throw notFound('Researcher not found');

  const nodes: GraphNode[] = [
    { id: researcher.id, type: 'researcher', label: researcher.displayName, slug: researcher.slug },
  ];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>([researcher.id]);
  const addNode = (n: GraphNode) => {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      nodes.push(n);
    }
  };

  // Co-authors
  const co = await coAuthorEdges(researcher.id, client);
  for (const n of co.nodes) addNode(n);
  edges.push(...co.edges);

  // Institutions
  for (const a of researcher.affiliations) {
    if (!a.institution) continue;
    addNode({ id: a.institution.id, type: 'institution', label: a.institution.name, slug: a.institution.slug });
    edges.push({
      source: researcher.id,
      target: a.institution.id,
      type: 'affiliated',
      label: `Affiliated with ${a.institution.name}`,
    });
  }

  // Groups
  for (const m of researcher.groupMemberships) {
    addNode({ id: m.group.id, type: 'group', label: m.group.name, slug: m.group.slug });
    edges.push({
      source: researcher.id,
      target: m.group.id,
      type: 'group_member',
      label: `Member of ${m.group.name}`,
    });
  }

  // Projects (led or member)
  const projects = [
    ...researcher.projectsLed,
    ...researcher.projectMemberships.map((p) => p.project),
  ];
  for (const p of projects) {
    if (seen.has(p.id)) continue;
    addNode({ id: p.id, type: 'project', label: p.title, slug: p.slug });
    edges.push({
      source: researcher.id,
      target: p.id,
      type: 'project_member',
      label: `Works on "${p.title}"`,
    });
  }

  return { center: researcher.id, nodes, edges };
}

// ---------- Network summary ----------

export interface NetworkSummary {
  collaborators: number;
  institutions: number;
  groups: number;
  projects: number;
  /** Total structural connections (graph degree of the researcher). */
  degree: number;
}

export async function getNetworkSummary(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<NetworkSummary> {
  const graph = await buildResearcherEgoGraph(researcherId, client);
  const distinctCollaborators = new Set(
    graph.edges.filter((e) => e.type === 'co_authored').map((e) => e.target),
  ).size;
  const institutions = graph.nodes.filter((n) => n.type === 'institution').length;
  const groups = graph.nodes.filter((n) => n.type === 'group').length;
  const projects = graph.nodes.filter((n) => n.type === 'project').length;
  return {
    collaborators: distinctCollaborators,
    institutions,
    groups,
    projects,
    degree: distinctCollaborators + institutions + groups + projects,
  };
}

// ---------- Connection path ("how are you connected") ----------

export interface ConnectionResult {
  connected: boolean;
  hops: number;
  steps: Array<{
    from: { id: string; label: string; slug?: string | undefined };
    to: { id: string; label: string; slug?: string | undefined };
    reason: string;
  }>;
}

/**
 * Explain how two researchers are connected via structural ties only —
 * co-authorship, shared institution, or shared research group. Similarity
 * (e.g. shared interests) is deliberately excluded: a connection must be a real
 * link, not a resemblance. Returns the shortest such path, each hop explained.
 */
export async function getConnectionPath(
  fromResearcherId: string,
  toResearcherId: string,
  client: PrismaClient = prisma,
  maxHops = 4,
): Promise<ConnectionResult> {
  if (fromResearcherId === toResearcherId) {
    return { connected: true, hops: 0, steps: [] };
  }

  const { adjacency, labels } = await buildResearcherAdjacency(client);
  const path = shortestPath(adjacency, fromResearcherId, toResearcherId, maxHops);

  if (!path) return { connected: false, hops: 0, steps: [] };

  const nameOf = (id: string) => labels.get(id) ?? { label: 'Unknown', slug: undefined };
  return {
    connected: true,
    hops: path.length,
    steps: path.map((s) => ({
      from: { id: s.from, ...nameOf(s.from) },
      to: { id: s.to, ...nameOf(s.to) },
      reason: s.edge.label,
    })),
  };
}

/**
 * Project all structural researcher-to-researcher ties into an adjacency map.
 * Co-authorship, shared institution, and shared group each contribute an edge
 * with a reason. Kept bounded for the platform's current scale.
 */
async function buildResearcherAdjacency(
  client: PrismaClient,
): Promise<{
  adjacency: Map<string, Array<{ to: string; edge: GraphEdge }>>;
  labels: Map<string, { label: string; slug?: string | undefined }>;
}> {
  const adjacency = new Map<string, Array<{ to: string; edge: GraphEdge }>>();
  const labels = new Map<string, { label: string; slug?: string | undefined }>();

  const link = (a: string, b: string, edge: GraphEdge) => {
    if (a === b) return;
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push({ to: b, edge });
  };

  // Co-authorship: authors sharing a publication are linked.
  const pubs = await client.publication.findMany({
    where: { deletedAt: null, visibility: 'public' },
    select: {
      title: true,
      authors: {
        where: { researcherId: { not: null } },
        select: { researcherId: true, researcher: { select: { displayName: true, slug: true } } },
      },
    },
  });
  for (const pub of pubs) {
    const authors = pub.authors.filter((a) => a.researcherId && a.researcher);
    for (const a of authors) labels.set(a.researcherId!, { label: a.researcher!.displayName, slug: a.researcher!.slug });
    for (let i = 0; i < authors.length; i++) {
      for (let j = i + 1; j < authors.length; j++) {
        const x = authors[i]!.researcherId!;
        const y = authors[j]!.researcherId!;
        const edge = (s: string, t: string): GraphEdge => ({
          source: s,
          target: t,
          type: 'co_authored',
          label: `Co-authored "${pub.title}"`,
        });
        link(x, y, edge(x, y));
        link(y, x, edge(y, x));
      }
    }
  }

  // Shared institution.
  await linkSharedGroup(
    client.affiliation.findMany({
      where: { researcher: { deletedAt: null } },
      select: {
        institutionId: true,
        researcherId: true,
        researcher: { select: { displayName: true, slug: true } },
        institution: { select: { name: true } },
      },
    }),
    (row) => row.institutionId,
    (row) => ({ id: row.researcherId, name: row.researcher.displayName, slug: row.researcher.slug }),
    (row) => `Both affiliated with ${row.institution?.name ?? 'the same institution'}`,
    'affiliated',
    link,
    labels,
  );

  // Shared research group.
  await linkSharedGroup(
    client.researchGroupMember.findMany({
      select: {
        groupId: true,
        researcherId: true,
        researcher: { select: { displayName: true, slug: true } },
        group: { select: { name: true } },
      },
    }),
    (row) => row.groupId,
    (row) => ({ id: row.researcherId, name: row.researcher.displayName, slug: row.researcher.slug }),
    (row) => `Both members of ${row.group?.name ?? 'the same group'}`,
    'group_member',
    link,
    labels,
  );

  return { adjacency, labels };
}

/** Link every pair of researchers that share the same grouping key. */
async function linkSharedGroup<T>(
  rowsPromise: Promise<T[]>,
  keyOf: (row: T) => string,
  actorOf: (row: T) => { id: string; name: string; slug: string },
  reasonOf: (row: T) => string,
  type: GraphEdgeType,
  link: (a: string, b: string, edge: GraphEdge) => void,
  labels: Map<string, { label: string; slug?: string | undefined }>,
): Promise<void> {
  const rows = await rowsPromise;
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const actor = actorOf(row);
    labels.set(actor.id, { label: actor.name, slug: actor.slug });
    const key = keyOf(row);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  }
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const x = actorOf(bucket[i]!).id;
        const y = actorOf(bucket[j]!).id;
        const reason = reasonOf(bucket[i]!);
        link(x, y, { source: x, target: y, type, label: reason });
        link(y, x, { source: y, target: x, type, label: reason });
      }
    }
  }
}
