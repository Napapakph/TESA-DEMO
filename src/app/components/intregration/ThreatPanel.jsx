export default function ThreatPanel({
  intruders = [],
  scanMode = "manual",
  onScanModeChange,
  onScan,
  isBaseScanActive,
  onToggleBaseScan,
  onAlert,
  formatDistance,
  scanTelemetry = { auto: { isRealtime: false, lastDetectedAt: null }, manual: { lastDetectedAt: null } },
}) {
  const hasIntruderInside = intruders.some((intruder) => intruder.isInside);
  const autoTelemetry = scanTelemetry?.auto ?? { isRealtime: false, lastDetectedAt: null };
  const manualTelemetry = scanTelemetry?.manual ?? { lastDetectedAt: null };

  const autoStatusText = autoTelemetry.isRealtime
    ? `Auto: Realtime${autoTelemetry.lastDetectedAt ? ` (${autoTelemetry.lastDetectedAt})` : ""}`
    : "Auto: Standby";

  const manualStatusText = manualTelemetry.lastDetectedAt
    ? `Manual: ล่าสุด ${manualTelemetry.lastDetectedAt}`
    : "Manual: ยังไม่พบการตรวจจับ";

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
      <h2>Threat Detection</h2>

      <div className="scan-mode-status">
        <span className="status-item">{autoStatusText}</span>
        <span className="status-item">{manualStatusText}</span>
      </div>

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

      <div className="base-scan-control">
        <button
          type="button"
          className={`base-scan-toggle${isBaseScanActive ? " alert-button" : ""}`}
          onClick={onToggleBaseScan}
        >
          {isBaseScanActive ? "Disable Base Scan" : "Enable Base Scan"}
        </button>
        <span className="base-scan-status">
          {isBaseScanActive ? "Base scan active" : "Base scan inactive"}
        </span>
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
            <div className="intruder-meta">{describeDetectionSources(intruder.detectedBy)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
