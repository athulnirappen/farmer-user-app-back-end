-- AlterTable
ALTER TABLE "FarmerProfile" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickupLatitude" DOUBLE PRECISION,
ADD COLUMN     "pickupLongitude" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "FarmerProfile_latitude_longitude_idx" ON "FarmerProfile"("latitude", "longitude");
