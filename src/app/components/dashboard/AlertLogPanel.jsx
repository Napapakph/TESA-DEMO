// คอมโพเนนต์แสดงประวัติการแจ้งเตือนภัยคุกคาม
export default function AlertLogPanel({ alertLog }) {
  return (
    <div className="control-card">
      <h2>บันทึกการแจ้งเตือน</h2>
      {alertLog.length === 0 ? (
        <p className="empty">ยังไม่มีการแจ้งเตือน</p>
      ) : (
        <ul className="alert-log">
          {alertLog.map((entry, index) => (
            <li key={`${entry.timestamp}-${index}`}>
              <div className="alert-header">
                <strong>{entry.timestamp}</strong>
                <span>พบ {entry.detected.length} ลำในรัศมี</span>
              </div>
              <ul>
                {entry.detected.map((intruder) => (
                  <li key={intruder.id}>• {intruder.name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
