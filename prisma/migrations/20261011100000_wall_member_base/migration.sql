-- Wall group member floor (fixed random 1..1000 per city).

-- AlterTable
ALTER TABLE "cities" ADD COLUMN "wall_member_base" INTEGER;
