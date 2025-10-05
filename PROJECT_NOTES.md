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
- `src/app/data/mockIntruders.js` : mock data สำหรับโดรนไม่ทราบฝ่าย พร้อมฟังก์ชันสุ่มตำแหน่ง
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

## การเข้าถึงจากมือถือ / อุปกรณ์อื่น
1. ให้อุปกรณ์อยู่ในเครือข่าย Wi-Fi เดียวกัน
2. รัน `npm run dev` (สคริปต์ปรับให้เปิดที่ `0.0.0.0` แล้ว)
3. ดู IP ของเครื่องพัฒนา เช่น `192.168.1.23` แล้วเข้าจากมือถือผ่าน `http://192.168.1.23:3000`
4. หากเปิดไม่ขึ้นให้ตรวจสอบไฟร์วอลล์หรือระบบแชร์เน็ตเวิร์ก

ดีไซน์และสไตล์ถูกปรับให้ใช้งานได้กับหน้าจอขนาดเล็ก เช่น ปุ่มแถวเครื่องมือเรียงลงและฟอร์มเต็มความกว้างเมื่ออยู่บนมือถือ

## หมายเหตุอื่น ๆ
- ปุ่ม "แจ้งหยุดการเคลื่อนที่" ใช้ `window.confirm` ยืนยันก่อนหยุด animation
- ปุ่ม "โฟกัสกลับไปที่โดรน" จะ `flyTo` กลางแผนที่แม้ผู้ใช้เลื่อนแผนที่ออกไป
- ทุกฟังก์ชันมีคอมเมนต์ภาษาไทยอธิบายหน้าที่ไว้ในไฟล์ต้นฉบับ
## ภาพรวมคอมโพเนนต์

- **DefenseDashboard.jsx**: คอมโพเนนต์หลัก ฝั่ง frontend ใช้ฮุคควบคุมสถานะทั้งหมดและเรียก API จำลอง
- **DashboardHeader.jsx**: หัวข้อแดชบอร์ด
- **ActionToolbar.jsx**: ปุ่มโฟกัสและหยุดโดรน + สถานะการเคลื่อนที่
- **MapInfoPanel.jsx**: แสดงพิกัดโดรน/ข้อมูลคลิก/ปุ่มเติมฟอร์ม
- **RouteLayerManager.jsx**: คอมโพเนนต์จัดการเส้นทางโดรนบน Leaflet และกำหนดจุดเป้าหมาย
- **MissionControl.jsx**: ฟอร์มตั้งเป้าหมายใหม่
- **FlightControlPanel.jsx**: สไลเดอร์ควบคุมความสูง ทิศ ความเร็ว และรัศมี
- **ThreatPanel.jsx**: บริหารรายการโดรนไม่ทราบฝ่าย ปุ่มสแกนและแจ้งเตือน
- **AlertLogPanel.jsx**: บันทึกประวัติเตือนภัย

## ฟีเจอร์อัปเดตด้านการตรวจจับ

- เพิ่มฟังก์ชัน `buildDetectionSources` และ `detectionSummaryHasHit` ใน `DefenseDashboard.jsx` เพื่อรวบรวมข้อมูลแหล่งที่มาตอนสแกนและบอกว่าการสแกนครั้งล่าสุดพบเป้าหมายหรือไม่อย่างชัดเจน
- `DefenseDashboard` เก็บสถานะสแกนล่าสุด (`scanTelemetry`) ใช้แจ้งให้ `ThreatPanel` ทราบว่า Auto Scan อยู่ในโหมด Realtime หรือไม่ และ Manual Scan พบเป้าหมายครั้งสุดท้ายเมื่อใด
- หน้าต่าง Threat Detection แสดงสเตตัส Auto = Realtime เมื่อพบโดรนในโหมดอัตโนมัติ และในโหมด Manual จะบันทึกเวลาในการพบเป้าหมายครั้งล่าสุด พร้อมทั้งบอกว่าโดรนไม่ทราบฝ่ายถูกพบโดยฐานทัพหรือโดรนฝั่งเรา (หรือทั้งคู่)
- Alert Log แสดงแหล่งที่มาของการแจ้งเตือนอย่างชัดเจนว่า "พบโดยฐานทัพ" หรือ "พบโดยโดรนฝั่งเรา" และในแต่ละรายการย่อยจะระบุแหล่งตรวจพบตรงกับข้อมูลใน Threat Panel

## Mock โดรนไม่ทราบฝ่าย

- ใช้ไฟล์ `src/app/data/mockIntruders.js` กำหนดโดรนไม่ทราบฝ่าย 5 ลำให้อยู่ภายในรัศมี 3 กิโลเมตรจากฐานทัพ พร้อมสุ่มชื่อ (Alpha-Echo)
- ฟังก์ชัน `createIntruderSeeds(basePosition)` ใช้สำหรับสร้าง mock seed เริ่มต้น เมื่อฐานทัพย้ายตำแหน่งจะเรียกสุ่มใหม่โดยอัตโนมัติ
- ฟังก์ชัน `tickIntruderPositions(previous, basePosition)` ใช้สุ่มการเคลื่อนที่แบบ step เล็ก ๆ และบังคับให้อยู่ในรัศมีเดิม เพื่อจำลองการเคลื่อนที่ต่อเนื่องของโดรนไม่ทราบฝ่าย
- `DefenseDashboard` ใช้ `setInterval` ทุก 4 วินาทีเรียก `tickIntruderPositions` ทำให้รายการโดรนใน Threat Panel และแผนที่อัปเดตตำแหน่งแบบเคลื่อนไหว
