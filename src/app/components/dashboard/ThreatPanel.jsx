export default function ThreatPanel({
  intruders = [],
  scanMode = "manual",
  onScanModeChange,
  onScan,
  onAlert,
  formatDistance,
}) {
  const hasIntruderInside = intruders.some((intruder) => intruder.isInside);

  return (
    <div className="control-card">
      <h2>Threat Detection</h2>

      <div className="scan-mode-control">
        <span className="scan-mode-label">Scan Mode</span>
        <div className="scan-mode-options">
          <label>
            <input
              type="radio"
              name="scan-mode"
              value="auto"
              checked={scanMode === "auto"}
              onChange={() => onScanModeChange?.("auto")}
            />
            Auto (Realtime)
          </label>
          <label>
            <input
              type="radio"
              name="scan-mode"
              value="manual"
              checked={scanMode === "manual"}
              onChange={() => onScanModeChange?.("manual")}
            />
            Manual
          </label>
        </div>
      </div>

      <div className="intruder-actions">
        <button type="button" onClick={onScan} disabled={scanMode === "auto"}>
          Scan Area
        </button>
        <button
          type="button"
          className="alert-button"
          onClick={onAlert}
          disabled={!hasIntruderInside}
        >
          Raise Alert
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
              Lat {intruder.position.lat.toFixed(4)} | Lng {intruder.position.lng.toFixed(4)}
            </div>
            <div className="intruder-meta">
              {intruder.distance != null ? formatDistance(intruder.distance) : "Awaiting scan"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
