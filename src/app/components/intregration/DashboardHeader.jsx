// คอมโพเนนต์หัวข้อแดชบอร์ดสำหรับแสดงข้อมูลฐานปฏิบัติการ
export default function DashboardHeader({ baseMgrs }) {
  return (
    <header className="panel-heading">
      <div>
        <h1>แดชบอร์ดป้องกันพื้นที่ • นครนายก</h1>
        <p>ตรวจสอบสถานะโดรนและภัยคุกคามรอบฐาน</p>
      </div>
      <div className="base-info">
        <span>ฐานควบคุม (MGRS): {baseMgrs}</span>
      </div>
    </header>
  );
}
