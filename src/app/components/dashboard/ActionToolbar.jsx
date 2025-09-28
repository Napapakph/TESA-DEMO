// คอมโพเนนต์แถบเครื่องมือสำหรับควบคุมการโฟกัสและการหยุดโดรน
export default function ActionToolbar({ onFocus, onStop, isNavigating }) {
  return (
    <div className="action-toolbar">
      <button type="button" onClick={onFocus}>
        โฟกัสกลับไปที่โดรน
      </button>
      <button type="button" className="alert-button" onClick={onStop}>
        แจ้งหยุดการเคลื่อนที่
      </button>
      <span className="movement-status">
        สถานะ: {isNavigating ? "กำลังเดินทาง" : "หยุดนิ่ง"}
      </span>
    </div>
  );
}
