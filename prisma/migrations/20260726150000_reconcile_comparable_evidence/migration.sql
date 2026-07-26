ALTER TABLE "Comparable" ADD COLUMN "evidenceType" TEXT NOT NULL DEFAULT 'DEMO_DATA';
ALTER TABLE "Comparable" ADD COLUMN "brand" TEXT;
ALTER TABLE "Comparable" ADD COLUMN "model" TEXT;
ALTER TABLE "Comparable" ADD COLUMN "category" TEXT;
ALTER TABLE "Comparable" ADD COLUMN "authenticationStatus" TEXT;
ALTER TABLE "Comparable" ADD COLUMN "inclusionStatus" TEXT NOT NULL DEFAULT 'INCLUDED';
