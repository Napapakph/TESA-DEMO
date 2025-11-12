# Box Layout System Guide

## Overview

Box layout system ที่ไม่มี layout shift เมื่ออัปเดตข้อมูล และ responsive เต็มรูปแบบ

## Quick Start

```jsx
import DashboardBox from "@/app/components/DashboardBox";
import "@/app/styles/box-layout.css";

export default function Dashboard() {
  return (
    <div className="box-grid">
      {/* Map - 4 columns x 3 rows */}
      <DashboardBox title="Map" spanClass="span-4x3" noPadding>
        <div ref={mapRef} className="fill-parent" />
      </DashboardBox>
      
      {/* Status - 2 columns x 1 row */}
      <DashboardBox title="Status" spanClass="span-2x1">
        <div className="data-grid">
          <div className="data-item">
            <div className="data-label">Speed</div>
            <div className="data-value highlight">12.5 m/s</div>
          </div>
        </div>
      </DashboardBox>
      
      {/* Threats - 2 columns x 2 rows */}
      <DashboardBox title="Threats" spanClass="span-2x2" badge={3}>
        <div className="box-list">
          <div className="box-list-item active">
            Drone #1 detected
          </div>
        </div>
      </DashboardBox>
    </div>
  );
}
```

## Grid Span Classes

- `span-1x1` - 1 คอลัมน์ x 1 แถว (ขนาดเล็ก)
- `span-2x1` - 2 คอลัมน์ x 1 แถว (กว้าง)
- `span-1x2` - 1 คอลัมน์ x 2 แถว (สูง)
- `span-2x2` - 2 คอลัมน์ x 2 แถว (กลาง)
- `span-3x2` - 3 คอลัมน์ x 2 แถว (ใหญ่)
- `span-3x3` - 3 คอลัมน์ x 3 แถว (ใหญ่มาก)
- `span-4x3` - 4 คอลัมน์ x 3 แถว (แผนที่หลัก)

**Responsive:** บนมือถือ (<768px) จะปรับเป็น 1 คอลัมน์อัตโนมัติ

## Components

### DashboardBox Props

```jsx
<DashboardBox
  title="Box Title"           // หัวข้อกล่อง
  spanClass="span-2x1"         // ขนาดกล่อง
  badge={5}                    // ตัวเลข badge (optional)
  noPadding={false}            // เอา padding ออก สำหรับแผนที่/กราฟ
  className="custom-class"     // คลาสเพิ่มเติม
>
  {/* เนื้อหา */}
</DashboardBox>
```

### BoxSkeleton (Loading State)

```jsx
import BoxSkeleton from "@/app/components/BoxSkeleton";

{isLoading ? (
  <BoxSkeleton lines={5} />
) : (
  <div className="box-content">
    {data}
  </div>
)}
```

## Layout Utilities

### Data Grid (2 columns)

```jsx
<div className="data-grid">
  <div className="data-item">
    <div className="data-label">Label</div>
    <div className="data-value">Value</div>
  </div>
  <div className="data-item">
    <div className="data-label">Status</div>
    <div className="data-value highlight">Online</div>
  </div>
</div>
```

**Value classes:**
- `data-value` - สีปกติ
- `data-value highlight` - สีฟ้า (เน้น)
- `data-value warning` - สีส้ม (เตือน)
- `data-value danger` - สีแดง (อันตราย)

### List

```jsx
<div className="box-list">
  <div className="box-list-item">Item 1</div>
  <div className="box-list-item active">Item 2</div>
  <div className="box-list-item">Item 3</div>
</div>
```

### Status Dot

```jsx
<span className="status-dot online" />
<span className="status-dot offline" />
<span className="status-dot warning" />
<span className="status-dot danger" />
```

## Map/Chart Integration

สำหรับแผนที่หรือกราฟ:

```jsx
<DashboardBox title="Map" spanClass="span-4x3" noPadding className="map-box">
  {/* ใช้ fill-parent เพื่อให้เต็มกล่อง */}
  <div ref={mapContainerRef} className="fill-parent" />
</DashboardBox>
```

**สำคัญ:**
- ใช้ `noPadding` prop
- ใช้ `className="map-box"` สำหรับแผนที่
- ใช้ `className="fill-parent"` สำหรับ container ของแผนที่/กราฟ
- **อย่าเปลี่ยน `key` prop** ของคอมโพเนนต์แผนที่เมื่อสลับสไตล์ (จะทำให้ตำแหน่งกล้าเปลี่ยน)

## Empty State

```jsx
<div className="box-empty">
  <div className="box-empty-icon">📭</div>
  <div>No data available</div>
</div>
```

## Responsive Breakpoints

- **Mobile (<768px):** 
  - คอลัมน์เดียว
  - `--col-width: 100%`
  - `--row-height: 200px`
  - `--grid-gap: 12px`

- **Tablet (768-1199px):**
  - 2-3 คอลัมน์
  - `--col-width: 240px`
  - `--row-height: 220px`
  - `--grid-gap: 14px`

- **Desktop (≥1200px):**
  - 3-4+ คอลัมน์
  - `--col-width: 300px`
  - `--row-height: 260px`
  - `--grid-gap: 18px`

## CSS Variables (Customization)

```css
:root {
  --col-width: 300px;           /* ความกว้างคอลัมน์ */
  --row-height: 260px;          /* ความสูงแถว */
  --grid-gap: 18px;             /* ช่องว่างระหว่างกล่อง */
  
  --box-bg: rgba(15, 23, 42, 0.85);
  --box-border: rgba(148, 163, 184, 0.3);
  --box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  --box-radius: 8px;
  
  --accent-color: #38bdf8;      /* สีเน้น */
}
```

## No Layout Shift Rules

✅ **DO:**
- ใช้ `opacity` และ `transform` สำหรับ animation
- ให้เนื้อหายาวเลื่อนภายในกล่อง (`overflow: auto`)
- ใช้ `BoxSkeleton` ขณะโหลดข้อมูล
- เก็บ state แผนที่ (center, zoom) ไว้นอก component

❌ **DON'T:**
- อย่าใช้ `transition` ที่เปลี่ยน `width`, `height`, `top`, `left`
- อย่าเปลี่ยนขนาดกล่องเมื่ออัปเดตข้อมูล
- อย่าเปลี่ยน `key` ของคอมโพเนนต์แผนที่/กราฟ
- อย่าให้เนื้อหาดันกล่องขยาย

## Example Dashboard Layouts

### Layout 1: Map-Focused
```
┌─────────────────────┬────────┬────────┐
│                     │ Status │ Info   │
│                     ├────────┴────────┤
│      Map (4x3)      │ Mission Control │
│                     ├────────┬────────┤
│                     │ Threat │ Alerts │
│                     │ (2x2)  │ (2x2)  │
└─────────────────────┴────────┴────────┘
```

### Layout 2: Multi-Panel
```
┌────────┬────────┬────────┬────────┐
│ Status │ Info   │ Control│ Alerts │
├────────┴────────┴────────┴────────┤
│                                    │
│        Map (4x2)                   │
│                                    │
├────────┬────────┬────────┬────────┤
│ Threat │ Threat │ Log    │ Log    │
│ List   │ List   │ View   │ View   │
└────────┴────────┴────────┴────────┘
```

## Best Practices

1. **Map/Chart Components:**
   - ใช้ `useRef` แทน state สำหรับตัวแปรที่ไม่ต้อง re-render
   - เก็บ map view state (center, zoom, bearing, pitch) ไว้
   - Restore view state หลังเปลี่ยน base map style

2. **Performance:**
   - ใช้ `React.memo()` สำหรับ box components ที่ไม่เปลี่ยนบ่อย
   - ใช้ `useCallback()` สำหรับ event handlers
   - หลีกเลี่ยงการ remount คอมโพเนนต์หนัก

3. **Accessibility:**
   - เพิ่ม `aria-label` สำหรับกล่องสำคัญ
   - รองรับ keyboard navigation
   - ใช้สีที่มี contrast เพียงพอ

4. **Testing:**
   - ทดสอบทุก breakpoint (mobile, tablet, desktop)
   - ตรวจสอบ layout shift ด้วย Chrome DevTools
   - ทดสอบการโหลดข้อมูลช้า (skeleton state)

