-- CreateTable
CREATE TABLE "publication_saves" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_saves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publication_saves_researcher_id_idx" ON "publication_saves"("researcher_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_saves_researcher_id_publication_id_key" ON "publication_saves"("researcher_id", "publication_id");

-- AddForeignKey
ALTER TABLE "publication_saves" ADD CONSTRAINT "publication_saves_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_saves" ADD CONSTRAINT "publication_saves_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

