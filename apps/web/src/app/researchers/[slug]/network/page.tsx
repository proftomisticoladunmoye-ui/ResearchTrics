import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getResearcherBySlug,
  buildResearcherEgoGraph,
  getNetworkSummary,
  getConnectionPath,
  type GraphNode,
  type GraphNodeType,
} from '@researchtrics/core';
import { Card, MetricCard, Avatar } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = await getResearcherBySlug(slug);
  return { title: r ? `${r.displayName} — Research network` : 'Research network' };
}

export const dynamic = 'force-dynamic';

const NODE_COLOR: Record<GraphNodeType, string> = {
  researcher: 'var(--rt-blue)',
  institution: 'var(--rt-gold-dark)',
  group: 'var(--rt-blue-royal)',
  project: 'var(--rt-success)',
  publication: 'var(--rt-muted)',
};

const NODE_HREF: Partial<Record<GraphNodeType, string>> = {
  researcher: '/researchers',
  institution: '/institutions',
  group: '/research-groups',
  project: '/projects',
};

/** Server-rendered radial ego graph — no client JS. */
function EgoGraphSvg({ center, others }: { center: GraphNode; others: GraphNode[] }) {
  const size = 460;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 170;
  const shown = others.slice(0, 24);

  const positioned = shown.map((n, i) => {
    const angle = (i / shown.length) * Math.PI * 2 - Math.PI / 2;
    return { node: n, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto h-auto w-full max-w-md"
      role="img"
      aria-label={`Research network of ${center.label}`}
    >
      {positioned.map((p) => (
        <line
          key={`e-${p.node.id}`}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke="var(--rt-border)"
          strokeWidth={1}
        />
      ))}
      {positioned.map((p) => (
        <g key={`n-${p.node.id}`}>
          <circle cx={p.x} cy={p.y} r={7} fill={NODE_COLOR[p.node.type]} />
          <text
            x={p.x}
            y={p.y - 11}
            textAnchor="middle"
            fontSize={9}
            fill="var(--rt-text)"
          >
            {p.node.label.length > 18 ? `${p.node.label.slice(0, 17)}…` : p.node.label}
          </text>
        </g>
      ))}
      <circle cx={cx} cy={cy} r={12} fill="var(--rt-blue-dark)" />
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--rt-text)">
        {center.label}
      </text>
    </svg>
  );
}

function ConnectionGroup({ title, nodes }: { title: string; nodes: GraphNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-rt-text">
        {title} <span className="text-rt-muted">({nodes.length})</span>
      </h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {nodes.map((n) => {
          const base = NODE_HREF[n.type];
          const inner = (
            <span className="rounded-full border border-rt-border px-3 py-1 text-xs text-rt-text hover:bg-rt-blue-light">
              {n.label}
            </span>
          );
          return (
            <li key={n.id}>
              {base && n.slug ? <Link href={`${base}/${n.slug}`}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function ResearcherNetworkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const researcher = await getResearcherBySlug(slug);
  if (!researcher) notFound();

  const [graph, summary] = await Promise.all([
    buildResearcherEgoGraph(researcher.id),
    getNetworkSummary(researcher.id),
  ]);

  const center = graph.nodes.find((n) => n.id === graph.center)!;
  const others = graph.nodes.filter((n) => n.id !== graph.center);
  const collaborators = others.filter((n) => n.type === 'researcher');
  const institutions = others.filter((n) => n.type === 'institution');
  const groups = others.filter((n) => n.type === 'group');
  const projects = others.filter((n) => n.type === 'project');

  // "How you're connected" — only when a *different* signed-in researcher views this.
  const viewer = await getCurrentUser();
  const showPath =
    viewer?.researcher != null && viewer.researcher.id !== researcher.id;
  const connection = showPath
    ? await getConnectionPath(viewer!.researcher!.id, researcher.id)
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={researcher.displayName} />
          <div>
            <h1 className="text-2xl font-semibold text-rt-text">{researcher.displayName}</h1>
            <p className="text-sm text-rt-muted">Research network</p>
          </div>
        </div>
        <Link href={`/researchers/${researcher.slug}`} className="text-sm text-rt-blue hover:underline">
          ← Back to profile
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Collaborators" value={summary.collaborators} />
        <MetricCard label="Institutions" value={summary.institutions} />
        <MetricCard label="Groups" value={summary.groups} />
        <MetricCard label="Projects" value={summary.projects} />
      </div>

      {showPath ? (
        <Card className="mt-6 p-6">
          <h2 className="text-base font-semibold text-rt-text">How you&rsquo;re connected</h2>
          {connection?.connected ? (
            connection.hops === 0 ? (
              <p className="mt-2 text-sm text-rt-muted">This is you.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {connection.steps.map((s, i) => (
                  <li key={`${s.from.id}-${s.to.id}-${i}`} className="text-sm text-rt-text">
                    <span className="font-medium">{s.from.label}</span> →{' '}
                    <span className="font-medium">{s.to.label}</span>
                    <span className="block text-xs text-rt-muted">{s.reason}</span>
                  </li>
                ))}
              </ol>
            )
          ) : (
            <p className="mt-2 text-sm text-rt-muted">
              No connection path found yet — you have no shared co-authors, institution, or group.
            </p>
          )}
        </Card>
      ) : null}

      {others.length === 0 ? (
        <Card className="mt-6 p-6">
          <p className="text-sm text-rt-muted">
            No public connections yet. Co-authored publications, affiliations, groups, and projects
            will appear here.
          </p>
        </Card>
      ) : (
        <>
          <Card className="mt-6 p-6">
            <EgoGraphSvg center={center} others={others} />
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-rt-muted">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: NODE_COLOR.researcher }} />Collaborator</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: NODE_COLOR.institution }} />Institution</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: NODE_COLOR.group }} />Group</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: NODE_COLOR.project }} />Project</span>
            </div>
            <p className="mt-3 text-center text-xs text-rt-muted">
              Every connection is derived from verified records — nothing is inferred or fabricated.
            </p>
          </Card>

          <div className="mt-6 space-y-5">
            <ConnectionGroup title="Collaborators" nodes={collaborators} />
            <ConnectionGroup title="Institutions" nodes={institutions} />
            <ConnectionGroup title="Research groups" nodes={groups} />
            <ConnectionGroup title="Projects" nodes={projects} />
          </div>
        </>
      )}
    </div>
  );
}
