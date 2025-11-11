export default function AlertLogPanel({ alertLog = [], formatDistance }) {
  const fallbackDistance = (value) => {
    if (value == null) return "-";
    return `${value.toFixed(0)} m`;
  };

  const sourceLabelMap = {
    base: "พบโดยฐานทัพ",
    drone: "พบโดยโดรนฝั่งเรา",
  };

  const describeDetectionSources = (sources = []) => {
    if (!sources.length) {
      return "ยังไม่พบจากการสแกน";
    }

    const labelMap = {
      base: "ฐานทัพ",
      drone: "โดรนฝั่งเรา",
    };

    const labels = sources.map((source) => labelMap[source] ?? source);
    return `พบโดย: ${labels.join(", ")}`;
  };

  return (
    <div className="control-card">
      <h2>Alert Log</h2>
      {alertLog.length === 0 ? (
        <p className="empty">No alerts yet</p>
      ) : (
        <ul className="alert-log">
          {alertLog.map((entry, index) => (
            <li key={`${entry.timestamp}-${index}`}>
              <div className="alert-header">
                <strong>{entry.timestamp}</strong>
                <span>Detected {entry.detected.length} targets</span>
                {entry.source ? (
                  <span className="alert-source">{sourceLabelMap[entry.source] ?? entry.source}</span>
                ) : null}
              </div>
              {entry.drone ? (
                <div className="alert-detail-meta">
                  {(entry.drone.label ?? 'Drone')} Lat {entry.drone.position.lat.toFixed(4)} | Lng {entry.drone.position.lng.toFixed(4)}
                  {entry.drone.mgrs ? ` | MGRS ${entry.drone.mgrs}` : ''}
                </div>
              ) : null}
              <ul>
                {entry.detected.map((intruder) => (
                  <li key={intruder.id} className="alert-detail">
                    <div className="alert-detail-title">{intruder.name}</div>
                    <div className="alert-detail-meta">
                      Coordinates Lat {intruder.position.lat.toFixed(4)} | Lng {intruder.position.lng.toFixed(4)}
                      {intruder.mgrs ? ` | MGRS ${intruder.mgrs}` : ''}
                    </div>
                    <div className="alert-detail-meta">
                      Distance to drone {
                        formatDistance
                          ? formatDistance(intruder.distanceToDrone)
                          : fallbackDistance(intruder.distanceToDrone)
                      }
                      {' '}
                      | Distance to base {
                        formatDistance
                          ? formatDistance(intruder.distanceToBase)
                          : fallbackDistance(intruder.distanceToBase)
                      }
                    </div>
                    <div className="alert-detail-meta">
                      {describeDetectionSources(intruder.detectedBy)}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
