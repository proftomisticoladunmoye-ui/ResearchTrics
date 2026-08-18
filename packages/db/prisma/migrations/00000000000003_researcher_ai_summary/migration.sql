-- AlterTable
ALTER TABLE "researchers" ADD COLUMN     "ai_summary" TEXT,
ADD COLUMN     "ai_summary_at" TIMESTAMP(3),
ADD COLUMN     "ai_summary_model" TEXT;

