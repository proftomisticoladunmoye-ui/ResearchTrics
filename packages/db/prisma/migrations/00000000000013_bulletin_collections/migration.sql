-- CreateEnum
CREATE TYPE "BulletinCollectionKind" AS ENUM ('collection', 'series');

-- CreateTable
CREATE TABLE "bulletin_collections" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "BulletinCollectionKind" NOT NULL DEFAULT 'collection',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulletin_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulletin_collection_members" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "bulletin_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bulletin_collection_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bulletin_collections_slug_key" ON "bulletin_collections"("slug");

-- CreateIndex
CREATE INDEX "bulletin_collections_published_idx" ON "bulletin_collections"("published");

-- CreateIndex
CREATE INDEX "bulletin_collection_members_bulletin_id_idx" ON "bulletin_collection_members"("bulletin_id");

-- CreateIndex
CREATE UNIQUE INDEX "bulletin_collection_members_collection_id_bulletin_id_key" ON "bulletin_collection_members"("collection_id", "bulletin_id");

-- AddForeignKey
ALTER TABLE "bulletin_collection_members" ADD CONSTRAINT "bulletin_collection_members_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "bulletin_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_collection_members" ADD CONSTRAINT "bulletin_collection_members_bulletin_id_fkey" FOREIGN KEY ("bulletin_id") REFERENCES "research_bulletins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
