import { prisma, type PrismaClient, type Prisma } from '@researchtrics/db';
import {
  SEARCHABLE_TYPES,
  relevanceScore,
  normalizePaging,
  type SearchIndex,
  type SearchQuery,
  type SearchResult,
  type SearchHit,
  type SearchableType,
  type SearchFilters,
} from './types';
import { emptyFacets } from './in-memory';

/**
 * PostgreSQL-backed search (Spec §17, §47). Uses case-insensitive matching with
 * JS relevance scoring for MVP scale. The indexed upgrade path — stored
 * `tsvector` + GIN, or OpenSearch — implements this same interface without
 * changing callers. `pg_trgm` (enabled in init.sql) supports future fuzzy
 * ranking.
 */
export class PostgresSearchIndex implements SearchIndex {
  constructor(private readonly db: PrismaClient = prisma) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    const { page, pageSize, skip } = normalizePaging(query.page, query.pageSize);
    const filters = query.filters ?? {};
    const returnTypes =
      filters.types && filters.types.length > 0 ? filters.types : [...SEARCHABLE_TYPES];
    const windowSize = Math.min(skip + pageSize, 200);

    // Facet counts across ALL types (so type tabs show numbers).
    const facets = emptyFacets();
    await Promise.all(
      SEARCHABLE_TYPES.map(async (t) => {
        facets.types[t] = await this.countType(t, query.q, filters);
      }),
    );

    // Fetch a window of hits per returned type, then merge + rank.
    const perType = await Promise.all(
      returnTypes.map((t) => this.fetchType(t, query.q, filters, windowSize)),
    );
    const merged = perType.flat();
    merged.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

    const total = returnTypes.reduce((sum, t) => sum + facets.types[t], 0);
    const items = merged.slice(skip, skip + pageSize);
    return { items, total, page, pageSize, facets };
  }

  private async countType(type: SearchableType, q: string, f: SearchFilters): Promise<number> {
    switch (type) {
      case 'researcher':
        return this.db.researcher.count({ where: this.researcherWhere(q, f) });
      case 'publication':
        return this.db.publication.count({ where: this.publicationWhere(q, f) });
      case 'institution':
        return this.db.institution.count({ where: this.institutionWhere(q, f) });
      case 'journal':
        return this.db.journal.count({ where: this.journalWhere(q, f) });
      case 'project':
        return this.db.project.count({ where: this.projectWhere(q) });
      case 'dataset':
        return this.db.dataset.count({ where: this.datasetWhere(q) });
      case 'instrument':
        return this.db.instrument.count({ where: this.instrumentWhere(q) });
      case 'software':
        return this.db.software.count({ where: this.softwareWhere(q) });
    }
  }

  private async fetchType(
    type: SearchableType,
    q: string,
    f: SearchFilters,
    take: number,
  ): Promise<SearchHit[]> {
    switch (type) {
      case 'researcher': {
        const rows = await this.db.researcher.findMany({
          where: this.researcherWhere(q, f),
          take,
          select: { id: true, displayName: true, slug: true, academicRank: true, country: true, verificationLevel: true, photoUrl: true },
        });
        return rows.map((r) => ({
          type,
          id: r.id,
          title: r.displayName,
          ...(r.academicRank || r.country ? { subtitle: [r.academicRank, r.country].filter(Boolean).join(' · ') } : {}),
          url: `/researchers/${r.slug}`,
          imageUrl: r.photoUrl,
          score: relevanceScore(r.displayName, q) || 0.3,
          meta: { verificationLevel: r.verificationLevel },
        }));
      }
      case 'publication': {
        const rows = await this.db.publication.findMany({
          where: this.publicationWhere(q, f),
          take,
          select: { id: true, title: true, slug: true, publishedYear: true, openAccess: true, journal: { select: { name: true } } },
        });
        return rows.map((p) => ({
          type,
          id: p.id,
          title: p.title,
          ...(p.journal?.name || p.publishedYear ? { subtitle: [p.journal?.name, p.publishedYear].filter(Boolean).join(' · ') } : {}),
          url: `/publications/${p.slug}`,
          score: relevanceScore(p.title, q) || 0.3,
          meta: { openAccess: p.openAccess },
        }));
      }
      case 'institution': {
        const rows = await this.db.institution.findMany({
          where: this.institutionWhere(q, f),
          take,
          select: { id: true, name: true, slug: true, city: true, country: true },
        });
        return rows.map((i) => ({
          type,
          id: i.id,
          title: i.name,
          ...(i.city || i.country ? { subtitle: [i.city, i.country].filter(Boolean).join(', ') } : {}),
          url: `/institutions/${i.slug}`,
          score: relevanceScore(i.name, q) || 0.3,
        }));
      }
      case 'journal': {
        const rows = await this.db.journal.findMany({
          where: this.journalWhere(q, f),
          take,
          select: { id: true, name: true, slug: true, publisher: true },
        });
        return rows.map((j) => ({
          type,
          id: j.id,
          title: j.name,
          ...(j.publisher ? { subtitle: j.publisher } : {}),
          url: `/journals/${j.slug}`,
          score: relevanceScore(j.name, q) || 0.3,
        }));
      }
      case 'project': {
        const rows = await this.db.project.findMany({
          where: this.projectWhere(q),
          take,
          select: { id: true, title: true, slug: true, status: true },
        });
        return rows.map((p) => ({
          type,
          id: p.id,
          title: p.title,
          subtitle: `Project · ${p.status}`,
          url: `/projects/${p.slug}`,
          score: relevanceScore(p.title, q) || 0.3,
        }));
      }
      case 'dataset': {
        const rows = await this.db.dataset.findMany({
          where: this.datasetWhere(q),
          take,
          select: { id: true, title: true, slug: true, accessLevel: true },
        });
        return rows.map((d) => ({
          type,
          id: d.id,
          title: d.title,
          subtitle: `Dataset · ${d.accessLevel}`,
          url: `/datasets/${d.slug}`,
          score: relevanceScore(d.title, q) || 0.3,
        }));
      }
      case 'instrument': {
        const rows = await this.db.instrument.findMany({
          where: this.instrumentWhere(q),
          take,
          select: { id: true, title: true, slug: true, construct: true },
        });
        return rows.map((i) => ({
          type,
          id: i.id,
          title: i.title,
          ...(i.construct ? { subtitle: i.construct } : {}),
          url: `/instruments/${i.slug}`,
          score: relevanceScore(i.title, q) || 0.3,
        }));
      }
      case 'software': {
        const rows = await this.db.software.findMany({
          where: this.softwareWhere(q),
          take,
          select: { id: true, name: true, slug: true },
        });
        return rows.map((s) => ({
          type,
          id: s.id,
          title: s.name,
          url: `/software/${s.slug}`,
          score: relevanceScore(s.name, q) || 0.3,
        }));
      }
    }
  }

  private researcherWhere(q: string, f: SearchFilters): Prisma.ResearcherWhereInput {
    const where: Prisma.ResearcherWhereInput = { deletedAt: null, profileVisibility: 'public' };
    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { familyName: { contains: q, mode: 'insensitive' } },
        { biography: { contains: q, mode: 'insensitive' } },
        { interests: { some: { label: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    if (f.country) where.country = f.country;
    if (f.verifiedOnly) where.verificationLevel = { gte: 2 };
    return where;
  }

  private publicationWhere(q: string, f: SearchFilters): Prisma.PublicationWhereInput {
    const where: Prisma.PublicationWhereInput = { deletedAt: null, visibility: 'public' };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { abstract: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (f.openAccess) where.openAccess = true;
    if (f.yearFrom !== undefined || f.yearTo !== undefined) {
      where.publishedYear = {
        ...(f.yearFrom !== undefined ? { gte: f.yearFrom } : {}),
        ...(f.yearTo !== undefined ? { lte: f.yearTo } : {}),
      };
    }
    return where;
  }

  private institutionWhere(q: string, f: SearchFilters): Prisma.InstitutionWhereInput {
    const where: Prisma.InstitutionWhereInput = { deletedAt: null };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (f.country) where.country = f.country;
    return where;
  }

  private journalWhere(q: string, _f: SearchFilters): Prisma.JournalWhereInput {
    const where: Prisma.JournalWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { publisher: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private projectWhere(q: string): Prisma.ProjectWhereInput {
    const where: Prisma.ProjectWhereInput = { deletedAt: null, visibility: 'public' };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private datasetWhere(q: string): Prisma.DatasetWhereInput {
    const where: Prisma.DatasetWhereInput = { deletedAt: null, visibility: 'public' };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private instrumentWhere(q: string): Prisma.InstrumentWhereInput {
    const where: Prisma.InstrumentWhereInput = { deletedAt: null, visibility: 'public' };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { construct: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private softwareWhere(q: string): Prisma.SoftwareWhereInput {
    const where: Prisma.SoftwareWhereInput = { deletedAt: null, visibility: 'public' };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }
}
