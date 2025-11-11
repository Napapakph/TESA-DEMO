// คอมโพเนนต์สำหรับปรับค่าการบินและรัศมีตรวจจับ
export default function FlightControlPanel({
  drone,
  onAltitudeChange,
  onHeadingChange,
  onSpeedChange,
  detectionRadius,
  onRadiusChange,
  baseDetectionRadius,
  onBaseRadiusChange,
}) {
  return (
    <div className="control-card">
      <h2>สถานะการบิน</h2>
      <div className="slider-group">
        <label>
          ความสูง (เมตร)
          <input
            type="range"
            min="10"
            max="500"
            value={drone.altitude}
            onChange={(event) => onAltitudeChange(event.target.value)}
          />
          <span className="slider-value">{drone.altitude.toFixed(0)} เมตร</span>
        </label>
        <label>
          ทิศทางกล้อง
          <input
            type="range"
            min="0"
            max="359"
            value={drone.heading}
            onChange={(event) => onHeadingChange(event.target.value)}
          />
          <span className="slider-value">{drone.heading.toFixed(0)}°</span>
        </label>
        <label>
          ความเร็วโดยประมาณ (กม./ชม.)
          <input
            type="range"
            min="5"
            max="1000"
            value={drone.speed}
            onChange={(event) => onSpeedChange(event.target.value)}
          />
          <span className="slider-value">{drone.speed} กม./ชม.</span>
        </label>
        <label>
          รัศมีตรวจจับ (เมตร)
          <input
            type="range"
            min="200"
            max="2000"
            step="50"
            value={detectionRadius}
            onChange={(event) => onRadiusChange(event.target.value)}
          />
          <span className="slider-value">{detectionRadius.toFixed(0)} เมตร</span>
        </label>
        <label>
          Base defense radius (m)
          <input
            type="range"
            min="200"
            max="3000"
            step="50"
            value={baseDetectionRadius}
            onChange={(event) => onBaseRadiusChange(event.target.value)}
          />
          <span className="slider-value">{Number(baseDetectionRadius).toFixed(0)} m</span>
        </label>
      </div>
    </div>
  );
}
