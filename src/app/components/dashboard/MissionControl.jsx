// คอมโพเนนต์ฟอร์มส่งคำสั่งจุดหมายใหม่ให้โดรน
export default function MissionControl({ targetInput, onChange, onSubmit }) {
  return (
    <div className="control-card">
      <h2>ควบคุมภารกิจ</h2>
      <form className="command-form" onSubmit={onSubmit}>
        <label>
          เป้าหมาย Latitude
          <input
            type="number"
            step="0.00001"
            value={targetInput.lat}
            onChange={(event) => onChange("lat", event.target.value)}
            placeholder="14.20590"
          />
        </label>
        <label>
          เป้าหมาย Longitude
          <input
            type="number"
            step="0.00001"
            value={targetInput.lng}
            onChange={(event) => onChange("lng", event.target.value)}
            placeholder="101.21340"
          />
        </label>
        <button type="submit">ส่งจุดใหม่ให้โดรน</button>
      </form>
    </div>
  );
}
