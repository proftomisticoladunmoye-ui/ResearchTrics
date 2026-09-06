-- CreateEnum
CREATE TYPE "BulletinCommentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "bulletin_comments" (
    "id" TEXT NOT NULL,
    "bulletin_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_email" TEXT NOT NULL,
    "author_affiliation" TEXT,
    "author_orcid" TEXT,
    "body" TEXT NOT NULL,
    "status" "BulletinCommentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "bulletin_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulletin_comments_bulletin_id_status_idx" ON "bulletin_comments"("bulletin_id", "status");

-- CreateIndex
CREATE INDEX "bulletin_comments_status_idx" ON "bulletin_comments"("status");

-- AddForeignKey
ALTER TABLE "bulletin_comments" ADD CONSTRAINT "bulletin_comments_bulletin_id_fkey" FOREIGN KEY ("bulletin_id") REFERENCES "research_bulletins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
