-- CreateTable
CREATE TABLE "bulletin_citations" (
    "id" TEXT NOT NULL,
    "citing_id" TEXT NOT NULL,
    "cited_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulletin_citations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulletin_citations_cited_id_idx" ON "bulletin_citations"("cited_id");

-- CreateIndex
CREATE UNIQUE INDEX "bulletin_citations_citing_id_cited_id_key" ON "bulletin_citations"("citing_id", "cited_id");

-- AddForeignKey
ALTER TABLE "bulletin_citations" ADD CONSTRAINT "bulletin_citations_citing_id_fkey" FOREIGN KEY ("citing_id") REFERENCES "research_bulletins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_citations" ADD CONSTRAINT "bulletin_citations_cited_id_fkey" FOREIGN KEY ("cited_id") REFERENCES "research_bulletins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
