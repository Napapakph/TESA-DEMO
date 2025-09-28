# โน้ตการใช้งานโปรเจกต์แดชบอร์ดป้องกันพื้นที่

## สิ่งที่ต้องติดตั้งก่อนรัน
- Node.js เวอร์ชัน 18 ขึ้นไป (แนะนำ 20 LTS)
- npm (มาพร้อม Node.js)

เมื่อติดตั้งแล้วให้รันคำสั่ง
```bash
npm install
```
เพื่อดึง dependencies ได้แก่
- `next` (เฟรมเวิร์กสำหรับ frontend + backend)
- `react`, `react-dom` (ไลบรารี UI)
- `leaflet` (ไลบรารีแผนที่)
- `mgrs` (คำนวณพิกัด Military Grid Reference System)

เริ่มเซิร์ฟเวอร์ด้วย
```bash
npm run dev
```
แล้วเปิดเบราว์เซอร์ไปที่ http://localhost:3000

## โครงสร้างองค์ประกอบที่แยกไว้
- `src/app/DefenseDashboard.jsx` : คอมโพเนนต์หลัก ฝั่ง frontend ใช้ฮุคควบคุมสถานะทั้งหมดและเรียก API จำลอง
- `src/app/components/dashboard/DashboardHeader.jsx` : หัวข้อแดชบอร์ด
- `src/app/components/dashboard/ActionToolbar.jsx` : ปุ่มโฟกัสและหยุดโดรน + สถานะการเคลื่อนที่
- `src/app/components/dashboard/MapInfoPanel.jsx` : แสดงพิกัดโดรน/ข้อมูลคลิก/ปุ่มเติมฟอร์ม
- `src/app/components/dashboard/MissionControl.jsx` : ฟอร์มตั้งเป้าหมายใหม่
- `src/app/components/dashboard/FlightControlPanel.jsx` : สไลเดอร์ควบคุมความสูง ทิศ ความเร็ว และรัศมี
- `src/app/components/dashboard/ThreatPanel.jsx` : บริหารรายการโดรนไม่ทราบฝ่าย ปุ่มสแกนและแจ้งเตือน
- `src/app/components/dashboard/AlertLogPanel.jsx` : บันทึกประวัติเตือนภัย
- `src/server/mockDatabase.js` : จำลองฐานข้อมูลกลางสำหรับ backend
- `src/app/api/drone/route.js` : เส้นทาง API ตัวอย่างให้ frontend และ backend ทำงานร่วมกัน

## ไลบรารีที่ต้อง `import` ในแต่ละส่วน
- คอมโพเนนต์เกี่ยวกับแผนที่ (`DefenseDashboard`) ต้อง `import L from "leaflet";` และ `import "leaflet/dist/leaflet.css";` รวมถึง `mgrs`
- คอมโพเนนต์ย่อยใช้เพียง React ( JSX ) ไม่ต้องนำเข้าไลบรารีเพิ่มเติม
- ฝั่ง API (`route.js`) ใช้ `NextResponse` จาก `next/server` และฟังก์ชันจำลองจาก `@/server/mockDatabase`
- โมดูลจำลองฐานข้อมูลไม่พึ่งพาไลบรารีภายนอก

## การทำงานร่วมกันระหว่าง frontend/backends (จำลองสองคนทำงาน)
- ฝั่ง frontend: `DefenseDashboard` เรียก `fetch('/api/drone')` เพื่ออ่านสถานะเริ่มต้น และ `POST` เพื่อบันทึกเป้าหมายหรือประวัติเตือน
- ฝั่ง backend: `src/app/api/drone/route.js` รับคำขอเหล่านั้นแล้วเรียก `mockDatabase` เพื่ออ่าน/เขียนข้อมูล
- ผู้พัฒนาที่ดูแล backend สามารถเปลี่ยน `mockDatabase` เป็นฐานข้อมูลจริงได้โดยไม่กระทบคอมโพเนนต์ UI

## หมายเหตุอื่น ๆ
- ปุ่ม "แจ้งหยุดการเคลื่อนที่" ใช้ `window.confirm` ยืนยันก่อนหยุด animation
- ปุ่ม "โฟกัสกลับไปที่โดรน" จะ `flyTo` กลางแผนที่แม้ผู้ใช้เลื่อนแผนที่ออกไป
- ทุกฟังก์ชันมีคอมเมนต์ภาษาไทยอธิบายหน้าที่ไว้ในไฟล์ต้นฉบับ
