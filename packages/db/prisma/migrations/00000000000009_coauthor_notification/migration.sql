-- AlterEnum
-- A researcher is told when a co-author adds a shared publication that now
-- counts on their profile.
ALTER TYPE "NotificationType" ADD VALUE 'coauthor_added';
