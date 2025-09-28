// โมดูลจำลองฐานข้อมูลสำหรับเก็บสถานะโดรนและการแจ้งเตือน
const droneState = {
  position: { lat: 14.2059, lng: 101.2134 },
  altitude: 120,
  heading: 35,
  detectionRadius: 600,
  alerts: [],
};

// ดึงภาพรวมสถานะโดรนจาก "ฐานข้อมูล" จำลอง
export function fetchDroneSnapshot() {
  return {
    position: { ...droneState.position },
    altitude: droneState.altitude,
    heading: droneState.heading,
    detectionRadius: droneState.detectionRadius,
  };
}

// บันทึกจุดหมายใหม่ของโดรนเพื่อให้ backend อีกคนสามารถอ่านต่อได้
export function saveDroneTarget(target) {
  droneState.position = { ...target };
}

// เก็บประวัติแจ้งเตือนลงในลิสต์จำลอง
export function recordAlert(alertEntry) {
  droneState.alerts.unshift(alertEntry);
  if (droneState.alerts.length > 10) {
    droneState.alerts.length = 10;
  }
}

// คืนค่าบันทึกการแจ้งเตือนล่าสุดทั้งหมด
export function fetchAlertHistory() {
  return [...droneState.alerts];
}
