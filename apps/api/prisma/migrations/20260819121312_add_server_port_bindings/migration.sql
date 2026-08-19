-- AlterTable
ALTER TABLE "game_servers" ADD COLUMN     "ports" JSONB NOT NULL DEFAULT '[]';
