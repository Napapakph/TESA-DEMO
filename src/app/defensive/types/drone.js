/**
 * Drone Data Structure from WebSocket
 * @typedef {Object} DroneData
 * @property {number} droneId - Unique identifier for the drone
 * @property {string} type - Type of drone (e.g., "DJIAir", "AutelEvo", "DJIMavic", "ParrotAnafi")
 * @property {number} lat - Latitude coordinate
 * @property {number} lng - Longitude coordinate
 * @property {number} velocity - Velocity in m/s or km/h
 * @property {number} direction - Direction in degrees (0-360)
 * @property {string} time - ISO 8601 timestamp string
 * @property {boolean} isDrone - Flag indicating if this is a drone
 * @property {string} cam_id - Associated camera ID
 */

/**
 * Example Drone Data:
 * {
 *   "droneId": 0,
 *   "type": "DJIAir",
 *   "lat": 14.30015,
 *   "lng": 101.17104,
 *   "velocity": 0.83,
 *   "direction": 357.5,
 *   "time": "2025-11-11T19:21:24.000Z",
 *   "isDrone": true,
 *   "cam_id": "cam002"
 * }
 */

export const DroneDataStructure = {
  droneId: 0,
  type: "",
  lat: 0,
  log: 0,
  velocity: 0,
  direction: 0,
  time: "",
  isDrone: true,
  cam_id: "",
};


