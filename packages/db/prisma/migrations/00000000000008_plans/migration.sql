-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('free', 'premium');

-- AlterTable
ALTER TABLE "researchers" ADD COLUMN     "plan" "PlanTier" NOT NULL DEFAULT 'free',
ADD COLUMN     "plan_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "assistant_usage" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assistant_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assistant_usage_researcher_id_period_key" ON "assistant_usage"("researcher_id", "period");

