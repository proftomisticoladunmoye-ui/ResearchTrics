-- ResearchTrics — DB initialization run before/with migrations.
-- Creates the sequence backing persistent RTX researcher identities (Spec §7),
-- and enables extensions used for fuzzy matching / dedup (Spec §57, DB doc §5).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SEQUENCE IF NOT EXISTS researcher_rtx_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS publication_rtp_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS project_rtj_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS dataset_rtd_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS instrument_rti_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS software_rts_seq START WITH 1 INCREMENT BY 1;
