"use client";

const getDroneIcon = (type) => {
  const icons = {
    DJIAir: "🚁",
    AutelEvo: "🛸",
    DJIMavic: "✈️",
    ParrotAnafi: "🎯",
  };
  return icons[type] || "🚁";
};

export default function SidebarInfo({ drones }) {
  return (
    <div className="left-panel">
      <h3>ภาพเรียลไทม์จากโดรน (Pi Node)</h3>
      {drones.length === 0 ? (
        <p className="no-drones">ยังไม่มีข้อมูลโดรน</p>
      ) : (
        <div className="drone-list">
          {drones.map((drone) => (
            <div key={drone.droneId} className="drone-card">
              <div className="drone-card-header">
                <span className="drone-icon">{getDroneIcon(drone.type)}</span>
                <div className="drone-title">
                  <strong>Drone #{drone.droneId}</strong>
                  <span className="drone-type">{drone.type || "Unknown"}</span>
                </div>
              </div>
              <div className="drone-card-body">
                <div className="drone-info-row">
                  <span className="info-label">📍 พิกัด:</span>
                  <span className="info-value">
                    {drone.lat.toFixed(5)}, {drone.lng.toFixed(5)}
                  </span>
                </div>
                <div className="drone-info-row">
                  <span className="info-label">⚡ ความเร็ว:</span>
                  <span className="info-value">
                    {drone.velocity?.toFixed(2) ?? "0.00"} m/s
                  </span>
                </div>
                <div className="drone-info-row">
                  <span className="info-label">🧭 ทิศทาง:</span>
                  <span className="info-value">
                    {drone.direction?.toFixed(1) ?? "0.0"}°
                  </span>
                </div>
                <div className="drone-info-row">
                  <span className="info-label">📷 กล้อง:</span>
                  <span className="info-value">{drone.cam_id || "N/A"}</span>
                </div>
                <div className="drone-info-row">
                  <span className="info-label">🕐 เวลา:</span>
                  <span className="info-value">
                    {new Date(drone.time).toLocaleTimeString("th-TH")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

