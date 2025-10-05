const EARTH_RADIUS_METERS = 6371000;
const MAX_INTRUDER_RADIUS_METERS = 3000;
const MAX_STEP_METERS = 180;

const UNKNOWN_INTRUDERS = [
  { id: "alpha", name: "โดรนไม่ทราบฝ่าย Alpha" },
  { id: "bravo", name: "โดรนไม่ทราบฝ่าย Bravo" },
  { id: "charlie", name: "โดรนไม่ทราบฝ่าย Charlie" },
  { id: "delta", name: "โดรนไม่ทราบฝ่าย Delta" },
  { id: "echo", name: "โดรนไม่ทราบฝ่าย Echo" },
];

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function normalizeLongitude(lng) {
  const wrapped = ((lng + 540) % 360) - 180;
  return wrapped;
}

function offsetPosition(start, distanceMeters, bearingDegrees) {
  if (distanceMeters === 0) return { lat: start.lat, lng: start.lng };

  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearingRad = toRadians(bearingDegrees);
  const lat1 = toRadians(start.lat);
  const lng1 = toRadians(start.lng);

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngular = Math.sin(angularDistance);
  const cosAngular = Math.cos(angularDistance);

  const lat2 = Math.asin(
    sinLat1 * cosAngular + cosLat1 * sinAngular * Math.cos(bearingRad),
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * sinAngular * cosLat1,
      cosAngular - sinLat1 * Math.sin(lat2),
    );

  return {
    lat: toDegrees(lat2),
    lng: normalizeLongitude(toDegrees(lng2)),
  };
}

function haversineDistance(origin, destination) {
  const dLat = toRadians(destination.lat - origin.lat);
  const dLng = toRadians(destination.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function randomBearing() {
  return Math.random() * 360;
}

function randomDistance(max) {
  return Math.random() * max;
}

function resetIntruderProperties(intruder) {
  return {
    ...intruder,
    distance: null,
    distanceToBase: null,
    isInside: false,
    isNearBase: false,
    mgrs: null,
    detectedBy: [],
  };
}

function randomPositionWithinRadius(basePosition) {
  const distance = randomDistance(MAX_INTRUDER_RADIUS_METERS);
  const bearing = randomBearing();
  return offsetPosition(basePosition, distance, bearing);
}

export function createIntruderSeeds(basePosition) {
  return UNKNOWN_INTRUDERS.map((intruder) =>
    resetIntruderProperties({
      id: intruder.id,
      name: intruder.name,
      position: randomPositionWithinRadius(basePosition),
    }),
  );
}

export function tickIntruderPositions(previousIntruders, basePosition) {
  return previousIntruders.map((intruder) => {
    const stepDistance = randomDistance(MAX_STEP_METERS);
    const bearing = randomBearing();
    let nextPosition = offsetPosition(intruder.position, stepDistance, bearing);

    if (haversineDistance(basePosition, nextPosition) > MAX_INTRUDER_RADIUS_METERS) {
      nextPosition = randomPositionWithinRadius(basePosition);
    }

    return resetIntruderProperties({
      ...intruder,
      position: nextPosition,
    });
  });
}

export const intruderMockConfig = {
  total: UNKNOWN_INTRUDERS.length,
  maxRadiusMeters: MAX_INTRUDER_RADIUS_METERS,
  stepMeters: MAX_STEP_METERS,
};
