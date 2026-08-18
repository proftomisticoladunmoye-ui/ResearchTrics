-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'opportunity_match';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "opportunity_id" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

