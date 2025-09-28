// คอมโพเนนต์สรุปข้อมูลแผนที่และตำแหน่งโดรน
export default function MapInfoPanel({
  drone,
  droneMgrs,
  distanceFromBase,
  headingText,
  lastClicked,
  lastClickedMgrs,
  onFillTarget,
}) {
  return (
    <div className="map-displays">
      <div>
        <h3>ตำแหน่งโดรน</h3>
        <p>Lat: {drone.position.lat.toFixed(5)} • Lng: {drone.position.lng.toFixed(5)}</p>
        <p>MGRS: {droneMgrs}</p>
      </div>
      <div>
        <h3>ระยะจากฐาน</h3>
        <p>{distanceFromBase}</p>
      </div>
      <div>
        <h3>ความสูง</h3>
        <p>{drone.altitude.toFixed(0)} เมตร</p>
      </div>
      <div>
        <h3>ทิศทางกล้อง</h3>
        <p>{drone.heading.toFixed(0)}° • {headingText}</p>
      </div>
      <div className="click-info">
        <h3>พิกัดจากการคลิก</h3>
        {lastClicked ? (
          <>
            <p>Lat: {lastClicked.lat.toFixed(5)} • Lng: {lastClicked.lng.toFixed(5)}</p>
            <p>MGRS: {lastClickedMgrs}</p>
            <button type="button" className="click-transfer" onClick={onFillTarget}>
              เติมลงฟอร์มเป้าหมาย
            </button>
          </>
        ) : (
          <p>กดบนแผนที่เพื่อรับพิกัดใหม่</p>
        )}
      </div>
    </div>
  );
}
