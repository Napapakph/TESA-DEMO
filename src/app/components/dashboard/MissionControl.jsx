export default function MissionControl({ targetInput, onChange, onSubmit, onClear }) {
  const mgrsPreview =
    targetInput.mgrsZone && targetInput.mgrsGrid && targetInput.mgrsCoord
      ? `${targetInput.mgrsZone}${targetInput.mgrsGrid}${targetInput.mgrsCoord}`
      : "-";

  const hasTargetValues = Boolean(
    targetInput.lat ||
      targetInput.lng ||
      targetInput.mgrsZone ||
      targetInput.mgrsGrid ||
      targetInput.mgrsCoord,
  );

  return (
    <div className="control-card">
      <h2>Mission Command</h2>
      <form className="command-form" onSubmit={onSubmit}>
        <label>
          Latitude
          <input
            type="number"
            step="0.00001"
            value={targetInput.lat}
            onChange={(event) => onChange("lat", event.target.value)}
            placeholder="14.20590"
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="0.00001"
            value={targetInput.lng}
            onChange={(event) => onChange("lng", event.target.value)}
            placeholder="101.21340"
          />
        </label>
        <div className="mgrs-section">
          <h3>MGRS Command</h3>
          <div className="mgrs-input-row">
            <label>
              Zone
              <input
                type="text"
                maxLength={3}
                value={targetInput.mgrsZone}
                onChange={(event) =>
                  onChange("mgrsZone", event.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))
                }
                placeholder="48Q"
              />
            </label>
            <label>
              Grid
              <input
                type="text"
                maxLength={2}
                value={targetInput.mgrsGrid}
                onChange={(event) =>
                  onChange("mgrsGrid", event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
                }
                placeholder="WD"
              />
            </label>
          </div>
          <label>
            Coordinate
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              value={targetInput.mgrsCoord}
              onChange={(event) => onChange("mgrsCoord", event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="1234512345"
            />
          </label>
          <p className="mgrs-preview">Combined MGRS: {mgrsPreview} </p>
        </div>
        <div className="form-actions">
          <button type="submit">Send Command</button>
          <button
            type="button"
            className="secondary"
            onClick={() => onClear?.()}
            disabled={!hasTargetValues}
          >
            Clear Target
          </button>
        </div>
      </form>
    </div>
  );
}
