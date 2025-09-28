// คอมโพเนนต์ตรวจจับภัยคุกคามและแสดงรายชื่อโดรนไม่ทราบฝ่าย
export default function ThreatPanel({ intruders, onScan, onAlert, formatDistance }) {
  return (
    <div className="control-card">
      <h2>การตรวจจับภัยคุกคาม</h2>
      <div className="intruder-actions">
        <button type="button" onClick={onScan}>สแกนโดรนรอบพื้นที่</button>
        <button
          type="button"
          className="alert-button"
          onClick={onAlert}
          disabled={intruders.every((item) => !item.isInside)}
        >
          แจ้งเตือนฝ่ายบัญชาการ
        </button>
      </div>
      <ul className="intruder-list">
        {intruders.map((intruder) => (
          <li
            key={intruder.id}
            className={intruder.isInside ? "intruder danger" : "intruder"}
          >
            <div className="intruder-name">{intruder.name}</div>
            <div className="intruder-meta">
              Lat {intruder.position.lat.toFixed(4)} • Lng {intruder.position.lng.toFixed(4)}
            </div>
            <div className="intruder-meta">
              {intruder.distance != null ? formatDistance(intruder.distance) : "รอการสแกน"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
