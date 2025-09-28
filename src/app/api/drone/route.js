import { NextResponse } from "next/server";
import {
  fetchDroneSnapshot,
  saveDroneTarget,
  recordAlert,
  fetchAlertHistory,
} from "@/server/mockDatabase";

// ให้บริการข้อมูลสถานะโดรนล่าสุดสำหรับฝั่ง frontend
export async function GET() {
  const snapshot = fetchDroneSnapshot();
  const alerts = fetchAlertHistory();
  return NextResponse.json({ ...snapshot, alerts });
}

// รับคำสั่งใหม่จาก frontend เพื่อตั้งค่าจุดหมายหรือบันทึกแจ้งเตือน
export async function POST(request) {
  const body = await request.json();

  if (body?.target) {
    saveDroneTarget(body.target);
  }

  if (body?.alert) {
    recordAlert(body.alert);
  }

  return NextResponse.json({ success: true });
}
