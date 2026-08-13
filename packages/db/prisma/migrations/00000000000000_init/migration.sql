-- ResearchTrics initial migration (generated from schema)
-- Extensions + sequences that the app relies on (Spec §7, §9, §20, §57; Federation §16)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SEQUENCE IF NOT EXISTS researcher_rtx_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS publication_rtp_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS project_rtj_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS dataset_rtd_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS instrument_rti_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS software_rts_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS opportunity_rto_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS work_rtw_seq START WITH 1 INCREMENT BY 1;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'pending');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('researcher', 'student_researcher', 'research_assistant', 'research_group_admin', 'institution_admin', 'department_admin', 'journal_editor', 'publisher_admin', 'reviewer', 'research_administrator', 'funder', 'employer', 'platform_admin', 'super_admin');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('global', 'institution', 'department', 'research_group', 'journal');

-- CreateEnum
CREATE TYPE "ResearcherType" AS ENUM ('academic', 'independent', 'student', 'research_assistant', 'practitioner', 'other');

-- CreateEnum
CREATE TYPE "CareerStage" AS ENUM ('undergraduate', 'graduate', 'doctoral', 'early_career', 'mid_career', 'senior', 'professor', 'research_administrator', 'independent');

-- CreateEnum
CREATE TYPE "VisibilityLevel" AS ENUM ('public', 'researchers', 'institution', 'private');

-- CreateEnum
CREATE TYPE "IdentifierScheme" AS ENUM ('orcid', 'scopus', 'wos', 'openalex', 'scholar_url', 'ror');

-- CreateEnum
CREATE TYPE "ExternalSource" AS ENUM ('crossref', 'orcid', 'openalex', 'ojs', 'datacite', 'pubmed', 'ror', 'user');

-- CreateEnum
CREATE TYPE "AffiliationRole" AS ENUM ('faculty', 'postdoc', 'phd_student', 'masters_student', 'research_staff', 'visiting', 'emeritus', 'other');

-- CreateEnum
CREATE TYPE "OutputType" AS ENUM ('journal_article', 'conference_paper', 'conference_proceeding', 'preprint', 'postprint', 'working_paper', 'technical_report', 'research_report', 'thesis', 'dissertation', 'book', 'book_chapter', 'dataset', 'instrument', 'software', 'poster', 'presentation', 'policy_brief', 'research_brief', 'systematic_review', 'meta_analysis', 'registered_report', 'other');

-- CreateEnum
CREATE TYPE "PublicationVersion" AS ENUM ('preprint', 'accepted_manuscript', 'version_of_record', 'correction', 'retraction');

-- CreateEnum
CREATE TYPE "PublicationIdScheme" AS ENUM ('doi', 'pmid', 'pmcid', 'arxiv', 'isbn', 'openalex', 'handle');

-- CreateEnum
CREATE TYPE "CitationSource" AS ENUM ('crossref', 'openalex', 'scholar', 'scopus', 'wos');

-- CreateEnum
CREATE TYPE "FileAccessLevel" AS ENUM ('public', 'restricted', 'request', 'embargoed', 'private');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "SyncKind" AS ENUM ('manual', 'scheduled', 'webhook');

-- CreateEnum
CREATE TYPE "OjsStrategy" AS ENUM ('oai_pmh', 'native_rest');

-- CreateEnum
CREATE TYPE "CollaborationRequestStatus" AS ENUM ('pending', 'accepted', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('proposed', 'active', 'completed', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "DatasetAccessLevel" AS ENUM ('open', 'restricted', 'request', 'embargoed', 'private');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('page_view', 'publication_view', 'profile_view', 'project_view', 'dataset_view', 'instrument_view', 'software_view', 'journal_view', 'institution_view', 'download', 'citation_export', 'search_appearance', 'follow', 'external_referral');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('grant', 'fellowship', 'call_for_papers', 'conference', 'position', 'award', 'training', 'collaboration', 'other');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('draft', 'open', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('discovered', 'match_review', 'unclaimed', 'claim_pending', 'claimed', 'verified', 'disputed', 'merged', 'suppressed');

-- CreateEnum
CREATE TYPE "ClaimChannel" AS ENUM ('public', 'institutional', 'referral', 'ambassador', 'email_optin', 'researcher_initiated');

-- CreateEnum
CREATE TYPE "ClaimInvitationStatus" AS ENUM ('pending', 'sent', 'viewed', 'claimed', 'declined', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "PublicationClaimStatus" AS ENUM ('claimed', 'disputed', 'review');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "rotated_from" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "scope_type" "ScopeType" NOT NULL DEFAULT 'global',
    "scope_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "researchers" (
    "id" TEXT NOT NULL,
    "researchtrics_id" TEXT NOT NULL,
    "user_id" TEXT,
    "given_names" TEXT,
    "family_name" TEXT,
    "preferred_name" TEXT,
    "display_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "biography" TEXT,
    "country" TEXT,
    "city" TEXT,
    "academic_rank" TEXT,
    "website" TEXT,
    "photo_url" TEXT,
    "researcher_type" "ResearcherType" NOT NULL DEFAULT 'academic',
    "career_stage" "CareerStage",
    "verification_level" INTEGER NOT NULL DEFAULT 0,
    "profile_visibility" "VisibilityLevel" NOT NULL DEFAULT 'public',
    "profile_status" "ProfileStatus" NOT NULL DEFAULT 'claimed',
    "identity_confidence" INTEGER,
    "discovery_source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "researchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "researcher_identifiers" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "scheme" "IdentifierScheme" NOT NULL,
    "value" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "researcher_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "researcher_name_variants" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "script" TEXT,
    "source" TEXT,

    CONSTRAINT "researcher_name_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ror_id" TEXT,
    "country" TEXT,
    "city" TEXT,
    "type" TEXT,
    "is_tenant" BOOLEAN NOT NULL DEFAULT false,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_department_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliations" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "department_id" TEXT,
    "role" "AffiliationRole" NOT NULL DEFAULT 'faculty',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_interests" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_records" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "evidence_ref" TEXT,
    "verified_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcid_connections" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "orcid" TEXT NOT NULL,
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT,
    "scope" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "orcid_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "issn_print" TEXT,
    "issn_electronic" TEXT,
    "publisher" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "output_type" "OutputType" NOT NULL DEFAULT 'journal_article',
    "version_type" "PublicationVersion" NOT NULL DEFAULT 'version_of_record',
    "journal_id" TEXT,
    "volume" TEXT,
    "issue" TEXT,
    "first_page" TEXT,
    "last_page" TEXT,
    "published_on" TIMESTAMP(3),
    "published_year" INTEGER,
    "publisher" TEXT,
    "article_type" TEXT,
    "license_code" TEXT,
    "open_access" BOOLEAN NOT NULL DEFAULT false,
    "pdf_url" TEXT,
    "primary_file_id" TEXT,
    "visibility" "VisibilityLevel" NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_identifiers" (
    "id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "scheme" "PublicationIdScheme" NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_authors" (
    "id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "researcher_id" TEXT,
    "author_order" INTEGER NOT NULL,
    "raw_name" TEXT NOT NULL,
    "given_name" TEXT,
    "family_name" TEXT,
    "affiliation_text" TEXT,
    "orcid" TEXT,
    "is_corresponding" BOOLEAN NOT NULL DEFAULT false,
    "match_confidence" DOUBLE PRECISION,

    CONSTRAINT "publication_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_citation_counts" (
    "id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "source" "CitationSource" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "as_of" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_citation_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "access_level" "FileAccessLevel" NOT NULL DEFAULT 'public',
    "license_code" TEXT,
    "pdf_has_text" BOOLEAN,
    "uploader_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ror_id" TEXT,
    "country" TEXT,
    "funder_doi" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grants" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "funder_id" TEXT,
    "amount" DECIMAL(14,2),
    "currency" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL DEFAULT 'grant',
    "status" "OpportunityStatus" NOT NULL DEFAULT 'open',
    "summary" TEXT,
    "description" TEXT,
    "organization" TEXT,
    "country" TEXT,
    "url" TEXT,
    "amount_min" DECIMAL(14,2),
    "amount_max" DECIMAL(14,2),
    "currency" TEXT,
    "opens_at" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "eligibility" TEXT,
    "disciplines" TEXT[],
    "source" TEXT,
    "source_url" TEXT,
    "funder_id" TEXT,
    "institution_id" TEXT,
    "posted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_saves" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_saves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "researcher_sources" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT,
    "source_url" TEXT,
    "field" TEXT,
    "confidence" INTEGER,
    "retrieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),
    "payload" JSONB,

    CONSTRAINT "researcher_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_invitations" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "channel" "ClaimChannel" NOT NULL DEFAULT 'public',
    "status" "ClaimInvitationStatus" NOT NULL DEFAULT 'pending',
    "referrer_user_id" TEXT,
    "email" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "researcher_publication_claims" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "status" "PublicationClaimStatus" NOT NULL DEFAULT 'review',
    "reason" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "researcher_publication_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_suppressions" (
    "id" TEXT NOT NULL,
    "orcid" TEXT,
    "name_key" TEXT NOT NULL,
    "reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_runs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "query" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "discovered" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "matched" INTEGER NOT NULL DEFAULT 0,
    "started_by_id" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objectives" TEXT,
    "research_questions" TEXT,
    "methodology" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "pi_researcher_id" TEXT,
    "institution_id" TEXT,
    "funder_id" TEXT,
    "grant_id" TEXT,
    "visibility" "VisibilityLevel" NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_publications" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,

    CONSTRAINT "project_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datasets" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "creator_researcher_id" TEXT,
    "institution_id" TEXT,
    "sample" TEXT,
    "geography" TEXT,
    "methodology" TEXT,
    "variables_text" TEXT,
    "file_formats" TEXT,
    "access_level" "DatasetAccessLevel" NOT NULL DEFAULT 'open',
    "license_code" TEXT,
    "doi" TEXT,
    "ethics_info" TEXT,
    "version" TEXT,
    "released_on" TIMESTAMP(3),
    "citation_text" TEXT,
    "related_project_id" TEXT,
    "visibility" "VisibilityLevel" NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "construct" TEXT,
    "population" TEXT,
    "language" TEXT,
    "country" TEXT,
    "item_count" INTEGER,
    "response_scale" TEXT,
    "scoring_method" TEXT,
    "reliability" TEXT,
    "validity_evidence" TEXT,
    "factor_structure" TEXT,
    "norms" TEXT,
    "translation_of" TEXT,
    "copyright" TEXT,
    "license_code" TEXT,
    "doi" TEXT,
    "author_researcher_id" TEXT,
    "related_project_id" TEXT,
    "related_dataset_id" TEXT,
    "visibility" "VisibilityLevel" NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "author_researcher_id" TEXT,
    "repository_url" TEXT,
    "doi" TEXT,
    "license_code" TEXT,
    "documentation_url" TEXT,
    "citation_text" TEXT,
    "related_project_id" TEXT,
    "visibility" "VisibilityLevel" NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "software_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ojs_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "site_id" TEXT,
    "version_detected" TEXT,
    "strategy" "OjsStrategy",
    "oai_url" TEXT,
    "rest_api_available" BOOLEAN NOT NULL DEFAULT false,
    "api_token_enc" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_probed_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ojs_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ojs_journals" (
    "id" TEXT NOT NULL,
    "ojs_source_id" TEXT NOT NULL,
    "ojs_journal_id" TEXT NOT NULL,
    "ojs_journal_path" TEXT,
    "internal_journal_id" TEXT,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ojs_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ojs_articles" (
    "id" TEXT NOT NULL,
    "ojs_source_id" TEXT NOT NULL,
    "ojs_article_id" TEXT NOT NULL,
    "ojs_journal_id" TEXT,
    "internal_publication_id" TEXT,
    "doi" TEXT,
    "last_record_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ojs_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ojs_authors" (
    "id" TEXT NOT NULL,
    "ojs_source_id" TEXT NOT NULL,
    "ojs_author_key" TEXT NOT NULL,
    "internal_researcher_id" TEXT,
    "raw_name" TEXT NOT NULL,
    "orcid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ojs_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "integration" TEXT NOT NULL,
    "kind" "SyncKind" NOT NULL DEFAULT 'manual',
    "status" "SyncStatus" NOT NULL DEFAULT 'pending',
    "ojs_source_id" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "processed" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "sync_job_id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "entity_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_records" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "source" "ExternalSource" NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "raw_payload" JSONB,
    "normalized_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unified_work_records" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL DEFAULT 'publication',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "abstract" TEXT,
    "published_year" INTEGER,
    "journal_title" TEXT,
    "publisher" TEXT,
    "license_code" TEXT,
    "doi" TEXT,
    "pmid" TEXT,
    "pmcid" TEXT,
    "openalex_id" TEXT,
    "datacite_id" TEXT,
    "crossref_id" TEXT,
    "ojs_id" TEXT,
    "publication_id" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unified_work_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_field_provenance" (
    "id" TEXT NOT NULL,
    "unified_work_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "value" TEXT,
    "authoritative" BOOLEAN NOT NULL DEFAULT false,
    "conflict_status" TEXT NOT NULL DEFAULT 'none',
    "retrieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_field_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citation_edges" (
    "id" TEXT NOT NULL,
    "citing_doi" TEXT NOT NULL,
    "cited_doi" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "retrieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citation_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rvm_scores" (
    "id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "overall" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "missing_data" JSONB,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rvm_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_groups" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "interests" TEXT,
    "institution_id" TEXT,
    "lead_researcher_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "research_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "role" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_requests" (
    "id" TEXT NOT NULL,
    "from_researcher_id" TEXT NOT NULL,
    "to_researcher_id" TEXT NOT NULL,
    "message" TEXT,
    "status" "CollaborationRequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "collaboration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "event_type" "AnalyticsEventType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "visitor_hash" TEXT,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "referrer_host" TEXT,
    "country" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_snapshots" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_scope_type_scope_id_key" ON "user_roles"("user_id", "role", "scope_type", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "researchers_researchtrics_id_key" ON "researchers"("researchtrics_id");

-- CreateIndex
CREATE UNIQUE INDEX "researchers_user_id_key" ON "researchers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "researchers_slug_key" ON "researchers"("slug");

-- CreateIndex
CREATE INDEX "researchers_family_name_idx" ON "researchers"("family_name");

-- CreateIndex
CREATE INDEX "researchers_profile_status_idx" ON "researchers"("profile_status");

-- CreateIndex
CREATE INDEX "researchers_verification_level_idx" ON "researchers"("verification_level");

-- CreateIndex
CREATE INDEX "researcher_identifiers_researcher_id_idx" ON "researcher_identifiers"("researcher_id");

-- CreateIndex
CREATE UNIQUE INDEX "researcher_identifiers_scheme_value_key" ON "researcher_identifiers"("scheme", "value");

-- CreateIndex
CREATE INDEX "researcher_name_variants_researcher_id_idx" ON "researcher_name_variants"("researcher_id");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_slug_key" ON "institutions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_ror_id_key" ON "institutions"("ror_id");

-- CreateIndex
CREATE INDEX "institutions_country_idx" ON "institutions"("country");

-- CreateIndex
CREATE INDEX "departments_institution_id_idx" ON "departments"("institution_id");

-- CreateIndex
CREATE INDEX "affiliations_researcher_id_idx" ON "affiliations"("researcher_id");

-- CreateIndex
CREATE INDEX "affiliations_institution_id_idx" ON "affiliations"("institution_id");

-- CreateIndex
CREATE INDEX "research_interests_researcher_id_idx" ON "research_interests"("researcher_id");

-- CreateIndex
CREATE UNIQUE INDEX "research_interests_researcher_id_label_key" ON "research_interests"("researcher_id", "label");

-- CreateIndex
CREATE INDEX "verification_records_researcher_id_idx" ON "verification_records"("researcher_id");

-- CreateIndex
CREATE UNIQUE INDEX "orcid_connections_researcher_id_key" ON "orcid_connections"("researcher_id");

-- CreateIndex
CREATE UNIQUE INDEX "orcid_connections_orcid_key" ON "orcid_connections"("orcid");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_idx" ON "verification_tokens"("user_id");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_at_idx" ON "verification_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "journals_slug_key" ON "journals"("slug");

-- CreateIndex
CREATE INDEX "journals_name_idx" ON "journals"("name");

-- CreateIndex
CREATE UNIQUE INDEX "publications_public_id_key" ON "publications"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "publications_slug_key" ON "publications"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "publications_primary_file_id_key" ON "publications"("primary_file_id");

-- CreateIndex
CREATE INDEX "publications_published_year_idx" ON "publications"("published_year");

-- CreateIndex
CREATE INDEX "publications_journal_id_idx" ON "publications"("journal_id");

-- CreateIndex
CREATE INDEX "publication_identifiers_publication_id_idx" ON "publication_identifiers"("publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_identifiers_scheme_value_key" ON "publication_identifiers"("scheme", "value");

-- CreateIndex
CREATE INDEX "publication_authors_publication_id_idx" ON "publication_authors"("publication_id");

-- CreateIndex
CREATE INDEX "publication_authors_researcher_id_idx" ON "publication_authors"("researcher_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_authors_publication_id_author_order_key" ON "publication_authors"("publication_id", "author_order");

-- CreateIndex
CREATE INDEX "publication_citation_counts_publication_id_idx" ON "publication_citation_counts"("publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_citation_counts_publication_id_source_key" ON "publication_citation_counts"("publication_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "files_uploader_id_idx" ON "files"("uploader_id");

-- CreateIndex
CREATE INDEX "grants_funder_id_idx" ON "grants"("funder_id");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_public_id_key" ON "opportunities"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_slug_key" ON "opportunities"("slug");

-- CreateIndex
CREATE INDEX "opportunities_type_idx" ON "opportunities"("type");

-- CreateIndex
CREATE INDEX "opportunities_status_idx" ON "opportunities"("status");

-- CreateIndex
CREATE INDEX "opportunities_deadline_idx" ON "opportunities"("deadline");

-- CreateIndex
CREATE INDEX "opportunity_saves_researcher_id_idx" ON "opportunity_saves"("researcher_id");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_saves_opportunity_id_researcher_id_key" ON "opportunity_saves"("opportunity_id", "researcher_id");

-- CreateIndex
CREATE INDEX "researcher_sources_researcher_id_idx" ON "researcher_sources"("researcher_id");

-- CreateIndex
CREATE INDEX "researcher_sources_source_source_id_idx" ON "researcher_sources"("source", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "claim_invitations_token_hash_key" ON "claim_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "claim_invitations_researcher_id_idx" ON "claim_invitations"("researcher_id");

-- CreateIndex
CREATE INDEX "claim_invitations_status_idx" ON "claim_invitations"("status");

-- CreateIndex
CREATE INDEX "researcher_publication_claims_publication_id_idx" ON "researcher_publication_claims"("publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "researcher_publication_claims_researcher_id_publication_id_key" ON "researcher_publication_claims"("researcher_id", "publication_id");

-- CreateIndex
CREATE INDEX "profile_suppressions_name_key_idx" ON "profile_suppressions"("name_key");

-- CreateIndex
CREATE INDEX "profile_suppressions_orcid_idx" ON "profile_suppressions"("orcid");

-- CreateIndex
CREATE INDEX "discovery_runs_provider_idx" ON "discovery_runs"("provider");

-- CreateIndex
CREATE INDEX "discovery_runs_status_idx" ON "discovery_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_public_id_key" ON "projects"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_pi_researcher_id_idx" ON "projects"("pi_researcher_id");

-- CreateIndex
CREATE INDEX "project_members_project_id_idx" ON "project_members"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_researcher_id_key" ON "project_members"("project_id", "researcher_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_publications_project_id_publication_id_key" ON "project_publications"("project_id", "publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "datasets_public_id_key" ON "datasets"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "datasets_slug_key" ON "datasets"("slug");

-- CreateIndex
CREATE INDEX "datasets_access_level_idx" ON "datasets"("access_level");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_public_id_key" ON "instruments"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_slug_key" ON "instruments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "software_public_id_key" ON "software"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "software_slug_key" ON "software"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ojs_sources_base_url_key" ON "ojs_sources"("base_url");

-- CreateIndex
CREATE INDEX "ojs_journals_ojs_source_id_idx" ON "ojs_journals"("ojs_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "ojs_journals_ojs_source_id_ojs_journal_id_key" ON "ojs_journals"("ojs_source_id", "ojs_journal_id");

-- CreateIndex
CREATE INDEX "ojs_articles_ojs_source_id_idx" ON "ojs_articles"("ojs_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "ojs_articles_ojs_source_id_ojs_article_id_key" ON "ojs_articles"("ojs_source_id", "ojs_article_id");

-- CreateIndex
CREATE INDEX "ojs_authors_ojs_source_id_idx" ON "ojs_authors"("ojs_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "ojs_authors_ojs_source_id_ojs_author_key_key" ON "ojs_authors"("ojs_source_id", "ojs_author_key");

-- CreateIndex
CREATE UNIQUE INDEX "sync_jobs_idempotency_key_key" ON "sync_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "sync_jobs_ojs_source_id_idx" ON "sync_jobs"("ojs_source_id");

-- CreateIndex
CREATE INDEX "sync_logs_sync_job_id_idx" ON "sync_logs"("sync_job_id");

-- CreateIndex
CREATE INDEX "external_records_entity_type_entity_id_idx" ON "external_records"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "external_records_source_source_id_idx" ON "external_records"("source", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_records_source_source_id_entity_type_entity_id_key" ON "external_records"("source", "source_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "unified_work_records_public_id_key" ON "unified_work_records"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "unified_work_records_doi_key" ON "unified_work_records"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "unified_work_records_publication_id_key" ON "unified_work_records"("publication_id");

-- CreateIndex
CREATE INDEX "unified_work_records_doi_idx" ON "unified_work_records"("doi");

-- CreateIndex
CREATE INDEX "work_field_provenance_unified_work_id_idx" ON "work_field_provenance"("unified_work_id");

-- CreateIndex
CREATE INDEX "citation_edges_cited_doi_idx" ON "citation_edges"("cited_doi");

-- CreateIndex
CREATE UNIQUE INDEX "citation_edges_citing_doi_cited_doi_source_key" ON "citation_edges"("citing_doi", "cited_doi", "source");

-- CreateIndex
CREATE INDEX "rvm_scores_subject_type_subject_id_calculated_at_idx" ON "rvm_scores"("subject_type", "subject_id", "calculated_at");

-- CreateIndex
CREATE UNIQUE INDEX "research_groups_slug_key" ON "research_groups"("slug");

-- CreateIndex
CREATE INDEX "research_group_members_group_id_idx" ON "research_group_members"("group_id");

-- CreateIndex
CREATE INDEX "research_group_members_researcher_id_idx" ON "research_group_members"("researcher_id");

-- CreateIndex
CREATE UNIQUE INDEX "research_group_members_group_id_researcher_id_key" ON "research_group_members"("group_id", "researcher_id");

-- CreateIndex
CREATE INDEX "collaboration_requests_to_researcher_id_status_idx" ON "collaboration_requests"("to_researcher_id", "status");

-- CreateIndex
CREATE INDEX "collaboration_requests_from_researcher_id_status_idx" ON "collaboration_requests"("from_researcher_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_requests_from_researcher_id_to_researcher_id_key" ON "collaboration_requests"("from_researcher_id", "to_researcher_id");

-- CreateIndex
CREATE INDEX "analytics_events_entity_type_entity_id_event_type_is_bot_idx" ON "analytics_events"("entity_type", "entity_id", "event_type", "is_bot");

-- CreateIndex
CREATE INDEX "analytics_events_occurred_at_idx" ON "analytics_events"("occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_entity_type_entity_id_visitor_hash_event_t_idx" ON "analytics_events"("entity_type", "entity_id", "visitor_hash", "event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "metric_snapshots_entity_type_entity_id_captured_at_idx" ON "metric_snapshots"("entity_type", "entity_id", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "metric_snapshots_entity_type_entity_id_period_key" ON "metric_snapshots"("entity_type", "entity_id", "period");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "researchers" ADD CONSTRAINT "researchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "researcher_identifiers" ADD CONSTRAINT "researcher_identifiers_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "researcher_name_variants" ADD CONSTRAINT "researcher_name_variants_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_department_id_fkey" FOREIGN KEY ("parent_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliations" ADD CONSTRAINT "affiliations_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliations" ADD CONSTRAINT "affiliations_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliations" ADD CONSTRAINT "affiliations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_interests" ADD CONSTRAINT "research_interests_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcid_connections" ADD CONSTRAINT "orcid_connections_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_primary_file_id_fkey" FOREIGN KEY ("primary_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_identifiers" ADD CONSTRAINT "publication_identifiers_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_authors" ADD CONSTRAINT "publication_authors_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_authors" ADD CONSTRAINT "publication_authors_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_citation_counts" ADD CONSTRAINT "publication_citation_counts_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_funder_id_fkey" FOREIGN KEY ("funder_id") REFERENCES "funders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_funder_id_fkey" FOREIGN KEY ("funder_id") REFERENCES "funders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_saves" ADD CONSTRAINT "opportunity_saves_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_saves" ADD CONSTRAINT "opportunity_saves_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "researcher_sources" ADD CONSTRAINT "researcher_sources_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_invitations" ADD CONSTRAINT "claim_invitations_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_invitations" ADD CONSTRAINT "claim_invitations_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "researcher_publication_claims" ADD CONSTRAINT "researcher_publication_claims_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "researcher_publication_claims" ADD CONSTRAINT "researcher_publication_claims_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_pi_researcher_id_fkey" FOREIGN KEY ("pi_researcher_id") REFERENCES "researchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_funder_id_fkey" FOREIGN KEY ("funder_id") REFERENCES "funders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "grants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_publications" ADD CONSTRAINT "project_publications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_publications" ADD CONSTRAINT "project_publications_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_creator_researcher_id_fkey" FOREIGN KEY ("creator_researcher_id") REFERENCES "researchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_related_project_id_fkey" FOREIGN KEY ("related_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_author_researcher_id_fkey" FOREIGN KEY ("author_researcher_id") REFERENCES "researchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_related_project_id_fkey" FOREIGN KEY ("related_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_related_dataset_id_fkey" FOREIGN KEY ("related_dataset_id") REFERENCES "datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software" ADD CONSTRAINT "software_author_researcher_id_fkey" FOREIGN KEY ("author_researcher_id") REFERENCES "researchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software" ADD CONSTRAINT "software_related_project_id_fkey" FOREIGN KEY ("related_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ojs_journals" ADD CONSTRAINT "ojs_journals_ojs_source_id_fkey" FOREIGN KEY ("ojs_source_id") REFERENCES "ojs_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ojs_articles" ADD CONSTRAINT "ojs_articles_ojs_source_id_fkey" FOREIGN KEY ("ojs_source_id") REFERENCES "ojs_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ojs_authors" ADD CONSTRAINT "ojs_authors_ojs_source_id_fkey" FOREIGN KEY ("ojs_source_id") REFERENCES "ojs_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_ojs_source_id_fkey" FOREIGN KEY ("ojs_source_id") REFERENCES "ojs_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_sync_job_id_fkey" FOREIGN KEY ("sync_job_id") REFERENCES "sync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unified_work_records" ADD CONSTRAINT "unified_work_records_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_field_provenance" ADD CONSTRAINT "work_field_provenance_unified_work_id_fkey" FOREIGN KEY ("unified_work_id") REFERENCES "unified_work_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_groups" ADD CONSTRAINT "research_groups_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_groups" ADD CONSTRAINT "research_groups_lead_researcher_id_fkey" FOREIGN KEY ("lead_researcher_id") REFERENCES "researchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_group_members" ADD CONSTRAINT "research_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "research_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_group_members" ADD CONSTRAINT "research_group_members_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_from_researcher_id_fkey" FOREIGN KEY ("from_researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_to_researcher_id_fkey" FOREIGN KEY ("to_researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

