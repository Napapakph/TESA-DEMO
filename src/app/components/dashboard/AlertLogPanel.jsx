export default function AlertLogPanel({ alertLog = [], formatDistance }) {
  const fallbackDistance = (value) => {
    if (value == null) return "-";
    return `${value.toFixed(0)} m`;
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
              </div>
              {entry.drone ? (
                <div className="alert-detail-meta">
                  Drone Lat {entry.drone.position.lat.toFixed(4)} | Lng {entry.drone.position.lng.toFixed(4)}
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
