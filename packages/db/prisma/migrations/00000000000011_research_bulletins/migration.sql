-- CreateEnum
CREATE TYPE "BulletinStatus" AS ENUM ('draft', 'in_review', 'scheduled', 'published', 'archived');

-- CreateEnum
CREATE TYPE "BulletinType" AS ENUM ('research', 'methodological', 'psychometric', 'statistical', 'ai_research', 'research_technology', 'conceptual', 'evidence', 'research_practice', 'policy_research', 'replication', 'commentary', 'data_analysis');

-- CreateTable
CREATE TABLE "research_bulletins" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "type" "BulletinType" NOT NULL DEFAULT 'research',
    "category" TEXT NOT NULL,
    "status" "BulletinStatus" NOT NULL DEFAULT 'draft',
    "abstract" TEXT NOT NULL,
    "keywords" TEXT[],
    "body_html" TEXT NOT NULL,
    "authors" JSONB NOT NULL DEFAULT '[]',
    "references" JSONB NOT NULL DEFAULT '[]',
    "featured_image" TEXT,
    "license" TEXT NOT NULL DEFAULT 'all_rights_reserved',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publication_date" TIMESTAMP(3),
    "scheduled_for" TIMESTAMP(3),
    "doi" TEXT,
    "doi_status" TEXT,
    "doi_registered_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "author_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_bulletins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "research_bulletins_number_key" ON "research_bulletins"("number");

-- CreateIndex
CREATE UNIQUE INDEX "research_bulletins_slug_key" ON "research_bulletins"("slug");

-- CreateIndex
CREATE INDEX "research_bulletins_status_publication_date_idx" ON "research_bulletins"("status", "publication_date");

-- CreateIndex
CREATE INDEX "research_bulletins_type_idx" ON "research_bulletins"("type");

-- CreateIndex
CREATE INDEX "research_bulletins_category_idx" ON "research_bulletins"("category");

-- AddForeignKey
ALTER TABLE "research_bulletins" ADD CONSTRAINT "research_bulletins_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
