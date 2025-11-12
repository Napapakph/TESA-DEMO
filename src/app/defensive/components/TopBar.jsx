"use client";

export default function TopBar({ 
  baseInfo, 
  onFocusBase, 
  cameraOrientation, 
  wsStatus, 
  wsError,
  cameraInfo
}) {
  // ตัวแปรตำแหน่งของกล้อง
  const cameraPosition = cameraInfo 
    ? {
        lat: cameraInfo.lat || baseInfo.lat,
        lng: cameraInfo.lng || baseInfo.lng,
        name: cameraInfo.name || `CAM-${cameraInfo.camId || 'N/A'}`,
        orientation: cameraInfo.orientation || 0
      }
    : null;
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <p className="toolbar-title">แดชบอร์ดป้องกันพื้นที่ • ประเทศน้ำเงิน</p>
        <p className="toolbar-subtitle">ตรวจสอบสถานะโดรนและภัยคุกคามรอบฐาน</p>
        <div className="toolbar-details">
          <div>ละติจูด: {baseInfo.lat.toFixed(5)}</div>
          <div>ลองจิจูด: {baseInfo.lng.toFixed(5)}</div>
          <div>MGRS: {baseInfo.mgrs}</div>
        </div>
      </div>

      <div className="toolbar-actions">
      <div className="compass-info">
            <span className="compass-text">ทิศทางกล้อง : {cameraOrientation.toFixed(1)}°</span>
            {cameraPosition && (
              <div className="compass-position">
                <div className="compass-pos-item">📷 {cameraPosition.name}</div>
                <div className="compass-pos-item">
                  {cameraPosition.lat.toFixed(5)}, {cameraPosition.lng.toFixed(5)}
                </div>
              </div>
            )}
          </div>
        <button type="button" className="toolbar-btn" onClick={onFocusBase}>
          โฟกัสฐานทัพ
        </button>
        <button type="button" className="toolbar-btn">
          History
        </button>

        <div className="ws-status">
          <div className="ws-info">
            <span className="ws-label">WebSocket:</span>
            <span className="ws-ip">192.168.1.104:3000</span>
          </div>
          <div className="ws-status-text">
            สถานะ: <strong>{wsStatus}</strong>
            {wsError ? <span className="ws-error"> — {wsError}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

