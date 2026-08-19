-- DropForeignKey
ALTER TABLE "game_servers" DROP CONSTRAINT "game_servers_nodeId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordHash" TEXT;
