import { Prisma } from '@prisma/client';

export const DEFAULT_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 50;

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LATITUDE = 111.32;

export type NearbyPoint = { lat: number; lng: number; radiusKm: number };

// A rough square around the point, so the index on (latitude, longitude) can skip far-away farms
// before the exact distance is calculated
export const boundingBox = ({ lat, lng, radiusKm }: NearbyPoint) => {
  const latDelta = radiusKm / KM_PER_DEGREE_LATITUDE;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngDelta = cosLat > 1e-6 ? radiusKm / (KM_PER_DEGREE_LATITUDE * cosLat) : 180;

  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLng: Math.max(-180, lng - lngDelta),
    maxLng: Math.min(180, lng + lngDelta),
  };
};

// Haversine distance in km from the point to the farm. Expects the FarmerProfile table aliased as "fp".
export const distanceKmSql = ({ lat, lng }: Pick<NearbyPoint, 'lat' | 'lng'>) => Prisma.sql`
  (${EARTH_RADIUS_KM} * 2 * asin(least(1, sqrt(
    power(sin(radians(fp."latitude" - ${lat}) / 2), 2) +
    cos(radians(${lat})) * cos(radians(fp."latitude")) *
    power(sin(radians(fp."longitude" - ${lng}) / 2), 2)
  ))))
`;

// Farm-level conditions for "within radiusKm of the point". Expects "fp" like distanceKmSql.
export const withinRadiusSql = (point: NearbyPoint) => {
  const box = boundingBox(point);
  return Prisma.sql`
    fp."latitude" BETWEEN ${box.minLat} AND ${box.maxLat}
    AND fp."longitude" BETWEEN ${box.minLng} AND ${box.maxLng}
    AND ${distanceKmSql(point)} <= ${point.radiusKm}
  `;
};

export const roundKm = (km: number) => Math.round(km * 10) / 10;
