-- CreateTable
-- Tracks works pushed into a researcher's ORCID record; put_code is ORCID's id
-- for the created work, kept to avoid double-pushing and to allow update/delete.
CREATE TABLE "orcid_work_syncs" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "put_code" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orcid_work_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orcid_work_syncs_publication_id_idx" ON "orcid_work_syncs"("publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "orcid_work_syncs_researcher_id_publication_id_key" ON "orcid_work_syncs"("researcher_id", "publication_id");

-- AddForeignKey
ALTER TABLE "orcid_work_syncs" ADD CONSTRAINT "orcid_work_syncs_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcid_work_syncs" ADD CONSTRAINT "orcid_work_syncs_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
